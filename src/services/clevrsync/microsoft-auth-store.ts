import "server-only";

import type { ClevrSyncConnectorStatus } from "@/lib/db/schema";
import {
  hasMicrosoftScope,
  getMicrosoftScopes,
  type MicrosoftConnectorType,
} from "@/services/clevrsync/connectors/microsoft-graph";
import { refreshMicrosoftAccessToken } from "@/services/clevrsync/connectors/microsoft-graph";
import { decryptClevrSyncToken, encryptClevrSyncToken } from "@/services/clevrsync/token-vault";
import {
  getNewestOwnedMicrosoftConnector,
  getOwnedClevrSyncConnector,
  updateClevrSyncConnector,
} from "@/services/clevrsync/sync-engine";

export function microsoftConnectorCoversScope(
  connector: { sourceMeta: Record<string, unknown> },
  connectorType: MicrosoftConnectorType,
) {
  const scope = typeof connector.sourceMeta.scope === "string" ? connector.sourceMeta.scope : null;
  return getMicrosoftScopes(connectorType)
    .filter((scopeName) => scopeName !== "offline_access")
    .every((scopeName) => hasMicrosoftScope(scope, scopeName));
}

export async function resolveOwnedMicrosoftConnector(
  userId: string,
  connectorId?: string | null,
  connectorType?: MicrosoftConnectorType | null,
) {
  if (connectorId) {
    const connector = await getOwnedClevrSyncConnector(userId, connectorId);
    if (!connector) return null;
    if (connectorType && connector.type !== connectorType) return null;
    return connector.type === "onedrive" || connector.type === "sharepoint" ? connector : null;
  }
  if (connectorType) {
    return getNewestOwnedMicrosoftConnector(userId, connectorType);
  }
  return null;
}

export async function getMicrosoftAccessToken(input: {
  userId: string;
  connectorId: string;
}) {
  const connector = await getOwnedClevrSyncConnector(input.userId, input.connectorId);
  if (!connector || (connector.type !== "onedrive" && connector.type !== "sharepoint")) {
    return null;
  }

  const accessTokenEncrypted = connector.accessTokenEncrypted;
  if (!accessTokenEncrypted) {
    await markMicrosoftConnectorStatus(input.userId, input.connectorId, "reconnect_required");
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
    const refreshed = await refreshMicrosoftAccessToken(
      refreshToken,
      connector.type as MicrosoftConnectorType,
    );
    await updateClevrSyncConnector({
      userId: input.userId,
      connectorId: input.connectorId,
      status: "connected",
      accessTokenEncrypted: encryptClevrSyncToken(refreshed.accessToken),
      refreshTokenEncrypted: refreshed.refreshToken
        ? encryptClevrSyncToken(refreshed.refreshToken)
        : connector.refreshTokenEncrypted,
      tokenExpiresAt: refreshed.expiresAt,
sourceMeta: {
        ...(connector.sourceMeta as Record<string, unknown>),
        ...(refreshed.scope ? { scope: refreshed.scope } : {}),
      },
    });
    return { connector, accessToken: refreshed.accessToken };
  } catch {
    await markMicrosoftConnectorStatus(input.userId, input.connectorId, "reconnect_required");
    return null;
  }
}

export async function markMicrosoftConnectorStatus(
  userId: string,
  connectorId: string,
  status: ClevrSyncConnectorStatus,
) {
  return updateClevrSyncConnector({ userId, connectorId, status });
}
