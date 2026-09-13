import "server-only";

import type { ClevrSyncConnectorStatus } from "@/lib/db/schema";
import { refreshGoogleSheetsAccessToken } from "@/services/clevrsync/connectors/google-sheets";
import { decryptClevrSyncToken, encryptClevrSyncToken } from "@/services/clevrsync/token-vault";
import {
  getOwnedClevrSyncConnector,
  updateClevrSyncConnector,
} from "@/services/clevrsync/sync-engine";

export async function getGoogleSheetsAccessToken(input: { userId: string; connectorId: string }) {
  const connector = await getOwnedClevrSyncConnector(input.userId, input.connectorId);
  if (!connector || connector.type !== "google_sheets") return null;

  const accessTokenEncrypted = connector.accessTokenEncrypted;
  if (!accessTokenEncrypted) {
    await markGoogleConnectorStatus(input.userId, input.connectorId, "reconnect_required");
    return null;
  }

  const accessToken = decryptClevrSyncToken(accessTokenEncrypted);
  const expiresAt = connector.tokenExpiresAt?.getTime() ?? 0;
  const shouldRefresh = Boolean(
    connector.refreshTokenEncrypted && expiresAt && expiresAt < Date.now() + 60_000,
  );
  if (!shouldRefresh) {
    return { connector, accessToken };
  }

  try {
    const refreshToken = decryptClevrSyncToken(connector.refreshTokenEncrypted!);
    const refreshed = await refreshGoogleSheetsAccessToken(refreshToken);
    await updateClevrSyncConnector({
      userId: input.userId,
      connectorId: input.connectorId,
      status: "connected",
      accessTokenEncrypted: encryptClevrSyncToken(refreshed.accessToken),
      refreshTokenEncrypted: refreshed.refreshToken
        ? encryptClevrSyncToken(refreshed.refreshToken)
        : connector.refreshTokenEncrypted,
      tokenExpiresAt: refreshed.expiresAt,
    });
    return { connector, accessToken: refreshed.accessToken };
  } catch {
    await markGoogleConnectorStatus(input.userId, input.connectorId, "reconnect_required");
    return null;
  }
}

export async function markGoogleConnectorStatus(
  userId: string,
  connectorId: string,
  status: ClevrSyncConnectorStatus,
) {
  return updateClevrSyncConnector({ userId, connectorId, status });
}
