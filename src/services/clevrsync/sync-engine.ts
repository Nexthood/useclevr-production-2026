import { and, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { getDb } from "@/lib/db";
import {
  clevrSyncConnectors,
  clevrSyncConnectorTypes,
  clevrSyncRuns,
  type ClevrSyncConnectorStatus,
  type ClevrSyncConnectorType,
  type ClevrSyncStatus,
} from "@/lib/db/schema";
import type { ClevrSyncPreview, CreateClevrSyncConnectorInput } from "@/services/clevrsync/types";

export function isClevrSyncConnectorType(value: unknown): value is ClevrSyncConnectorType {
  return (
    typeof value === "string" && clevrSyncConnectorTypes.includes(value as ClevrSyncConnectorType)
  );
}

export function isConnectorTypeAvailable(type: ClevrSyncConnectorType) {
  return type === "excel" || type === "google_sheets";
}

export function buildColumnMapping(preview: Pick<ClevrSyncPreview, "columns">) {
  return Object.fromEntries(preview.columns.map((column) => [column.originalName, column.name]));
}

export async function createClevrSyncConnector(input: CreateClevrSyncConnectorInput) {
  const db = getRequiredDb();
  const now = new Date();
  const displayName = input.displayName?.trim() || defaultDisplayName(input.type);
  const connector = {
    id: `cs_conn_${uuidv4()}`,
    userId: input.userId,
    organizationId: input.organizationId?.trim() || input.userId,
    type: input.type,
    status: "connected" as const,
    displayName,
    sourceMeta: input.sourceMeta ?? {},
    accessTokenEncrypted: null,
    refreshTokenEncrypted: null,
    tokenExpiresAt: null,
    providerAccountLabel: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(clevrSyncConnectors).values(connector);
  return connector;
}

export async function createGoogleSheetsConnector(
  input: CreateClevrSyncConnectorInput & {
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | null;
  },
) {
  const db = getRequiredDb();
  const now = new Date();
  const connector = {
    id: `cs_conn_${uuidv4()}`,
    userId: input.userId,
    organizationId: input.organizationId?.trim() || input.userId,
    type: "google_sheets" as const,
    status: "connected" as const,
    displayName: input.displayName?.trim() || "Google Sheets",
    sourceMeta: input.sourceMeta ?? {},
    accessTokenEncrypted: input.accessTokenEncrypted,
    refreshTokenEncrypted: input.refreshTokenEncrypted ?? null,
    tokenExpiresAt: input.tokenExpiresAt ?? null,
    providerAccountLabel: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(clevrSyncConnectors).values(connector);
  return sanitizeConnector(connector);
}

export async function listClevrSyncConnectors(userId: string) {
  const db = getRequiredDb();
  const connectors = await db.query.clevrSyncConnectors.findMany({
    where: eq(clevrSyncConnectors.userId, userId),
    orderBy: [desc(clevrSyncConnectors.updatedAt)],
  });
  return connectors.map(sanitizeConnector);
}

export async function getOwnedClevrSyncConnector(userId: string, connectorId: string) {
  const db = getRequiredDb();
  return db.query.clevrSyncConnectors.findFirst({
    where: and(eq(clevrSyncConnectors.id, connectorId), eq(clevrSyncConnectors.userId, userId)),
  });
}

export async function getOwnedClevrSyncConnectorForApi(userId: string, connectorId: string) {
  const connector = await getOwnedClevrSyncConnector(userId, connectorId);
  return connector ? sanitizeConnector(connector) : null;
}

export async function updateClevrSyncConnector(input: {
  userId: string;
  connectorId: string;
  status?: ClevrSyncConnectorStatus;
  sourceMeta?: Record<string, unknown>;
  displayName?: string;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: Date | null;
  providerAccountLabel?: string | null;
}) {
  const db = getRequiredDb();
  const now = new Date();
  const updates = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.sourceMeta ? { sourceMeta: input.sourceMeta } : {}),
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "accessTokenEncrypted")
      ? { accessTokenEncrypted: input.accessTokenEncrypted }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "refreshTokenEncrypted")
      ? { refreshTokenEncrypted: input.refreshTokenEncrypted }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "tokenExpiresAt")
      ? { tokenExpiresAt: input.tokenExpiresAt }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "providerAccountLabel")
      ? { providerAccountLabel: input.providerAccountLabel }
      : {}),
    updatedAt: now,
  };

  const [updated] = await db
    .update(clevrSyncConnectors)
    .set(updates)
    .where(
      and(
        eq(clevrSyncConnectors.id, input.connectorId),
        eq(clevrSyncConnectors.userId, input.userId),
      ),
    )
    .returning();
  return updated ? sanitizeConnector(updated) : null;
}

export async function createClevrSyncRun(input: {
  userId: string;
  connectorId: string;
  preview: Pick<ClevrSyncPreview, "columns" | "rowCount">;
  status: ClevrSyncStatus;
  datasetId?: string | null;
  error?: string | null;
}) {
  const db = getRequiredDb();
  const now = new Date();
  const run = {
    id: `cs_sync_${uuidv4()}`,
    connectorId: input.connectorId,
    userId: input.userId,
    lastSync: now,
    rowCount: input.preview.rowCount,
    columnMapping: buildColumnMapping(input.preview),
    status: input.status,
    datasetId: input.datasetId ?? null,
    error: input.error ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(clevrSyncRuns).values(run);
  return run;
}

export function sanitizeConnector<
  T extends {
    accessTokenEncrypted?: string | null;
    refreshTokenEncrypted?: string | null;
  },
>(connector: T) {
  const {
    accessTokenEncrypted: _accessTokenEncrypted,
    refreshTokenEncrypted: _refreshTokenEncrypted,
    ...safe
  } = connector;
  return safe;
}

function defaultDisplayName(type: ClevrSyncConnectorType) {
  if (type === "excel") return "Excel workbook";
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRequiredDb() {
  const db = getDb();
  if (!db) {
    throw new Error("Database is not configured");
  }
  return db;
}
