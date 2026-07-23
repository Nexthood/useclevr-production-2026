import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  retailConnections,
  retailLocations,
  retailOauthStates,
  retailOrders,
  retailProducts,
  retailSyncRuns,
  retailVariants,
  retailWebhookEvents,
  type RetailConnectionStatus,
  type RetailProvider,
  type RetailSyncType,
} from "@/lib/db/schema";
import { encryptRetailSecret } from "./encryption.service";
import type { RetailConnectionRecord, TokenResult } from "./normalized-types";

export function createRetailId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

export function hashOauthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export async function createOauthState(input: {
  organizationId: string;
  provider: RetailProvider;
  createdBy: string;
}) {
  const db = getRequiredDb();
  const state = randomBytes(32).toString("base64url");
  await db.insert(retailOauthStates).values({
    id: createRetailId("oauth"),
    organizationId: input.organizationId,
    provider: input.provider,
    stateHash: hashOauthState(state),
    createdBy: input.createdBy,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return state;
}

export async function consumeOauthState(input: {
  state: string;
  provider: RetailProvider;
  userId: string;
}) {
  const db = getRequiredDb();
  const now = new Date();
  const [row] = await db
    .select()
    .from(retailOauthStates)
    .where(
      and(
        eq(retailOauthStates.stateHash, hashOauthState(input.state)),
        eq(retailOauthStates.provider, input.provider),
        eq(retailOauthStates.createdBy, input.userId),
        isNull(retailOauthStates.usedAt),
      ),
    )
    .limit(1);

  if (!row || row.expiresAt <= now) {
    throw new Error("Square authorization state is invalid or expired.");
  }

  await db
    .update(retailOauthStates)
    .set({ usedAt: now })
    .where(eq(retailOauthStates.id, row.id));

  return row.organizationId;
}

export async function saveRetailConnection(input: {
  organizationId: string;
  provider: RetailProvider;
  createdBy: string;
  token: TokenResult;
  displayName?: string | null;
}) {
  const db = getRequiredDb();
  const now = new Date();
  const existing = input.token.merchantId
    ? await db
      .select()
      .from(retailConnections)
      .where(
        and(
          eq(retailConnections.organizationId, input.organizationId),
          eq(retailConnections.provider, input.provider),
          eq(retailConnections.externalMerchantId, input.token.merchantId),
        ),
      )
      .limit(1)
    : [];
  const id = existing[0]?.id || createRetailId("retconn");
  const values = {
    organizationId: input.organizationId,
    provider: input.provider,
    externalMerchantId: input.token.merchantId,
    displayName: input.displayName || "Square",
    connectionStatus: "connected" as RetailConnectionStatus,
    accessTokenEncrypted: encryptRetailSecret(input.token.accessToken),
    refreshTokenEncrypted: input.token.refreshToken ? encryptRetailSecret(input.token.refreshToken) : null,
    tokenExpiresAt: input.token.expiresAt,
    grantedScopes: input.token.scopes,
    connectionError: null,
    disconnectedAt: null,
    updatedAt: now,
  };

  if (existing[0]) {
    const [updated] = await db
      .update(retailConnections)
      .set(values)
      .where(eq(retailConnections.id, id))
      .returning();
    return toConnectionRecord(updated);
  }

  const [created] = await db
    .insert(retailConnections)
    .values({ id, ...values, createdBy: input.createdBy, createdAt: now })
    .returning();
  return toConnectionRecord(created);
}

export async function getOwnedRetailConnection(input: { userId: string; connectionId: string }) {
  const db = getRequiredDb();
  const [row] = await db
    .select()
    .from(retailConnections)
    .where(
      and(
        eq(retailConnections.id, input.connectionId),
        inArray(
          retailConnections.organizationId,
          db
            .select({ id: sql<string>`"Business"."id"` })
            .from(sql`"Business"`)
            .where(sql`"Business"."userId" = ${input.userId}`),
        ),
      ),
    )
    .limit(1);
  return row ? toConnectionRecord(row) : null;
}

export async function listRetailConnectionSummaries(userId: string) {
  const db = getRequiredDb();
  const rows = await db
    .select({
      id: retailConnections.id,
      organizationId: retailConnections.organizationId,
      provider: retailConnections.provider,
      displayName: retailConnections.displayName,
      connectionStatus: retailConnections.connectionStatus,
      externalMerchantId: retailConnections.externalMerchantId,
      lastSuccessfulSyncAt: retailConnections.lastSuccessfulSyncAt,
      lastSyncAttemptAt: retailConnections.lastSyncAttemptAt,
      lastWebhookAt: retailConnections.lastWebhookAt,
      connectionError: retailConnections.connectionError,
      syncRunId: retailSyncRuns.id,
      syncStatus: retailSyncRuns.status,
      syncType: retailSyncRuns.syncType,
      syncCreatedAt: retailSyncRuns.createdAt,
    })
    .from(retailConnections)
    .leftJoin(retailSyncRuns, eq(retailSyncRuns.connectionId, retailConnections.id))
    .where(
      inArray(
        retailConnections.organizationId,
        db
          .select({ id: sql<string>`"Business"."id"` })
          .from(sql`"Business"`)
          .where(sql`"Business"."userId" = ${userId}`),
      ),
    )
    .orderBy(desc(retailConnections.updatedAt), desc(retailSyncRuns.createdAt));

  const connectionIds = [...new Set(rows.map((row) => row.id))];
  const summaries = await Promise.all(connectionIds.map(async (connectionId) => {
    const first = rows.find((row) => row.id === connectionId);
    if (!first) return null;
    const [locations, products, variants, orders, webhookFailures] = await Promise.all([
      countRetailLocations(connectionId),
      countRetailProducts(connectionId),
      countRetailVariants(connectionId),
      countRetailOrders(connectionId),
      countFailedWebhooks(connectionId),
    ]);
    return {
      id: first.id,
      organizationId: first.organizationId,
      provider: first.provider,
      displayName: first.displayName,
      connectionStatus: first.connectionStatus,
      externalMerchantId: first.externalMerchantId,
      lastSuccessfulSyncAt: first.lastSuccessfulSyncAt?.toISOString() || null,
      lastSyncAttemptAt: first.lastSyncAttemptAt?.toISOString() || null,
      lastWebhookAt: first.lastWebhookAt?.toISOString() || null,
      connectionError: first.connectionError,
      counts: { locations, products, variants, orders, failedWebhookEvents: webhookFailures },
      recentSyncRuns: rows
        .filter((row) => row.id === connectionId && row.syncRunId)
        .slice(0, 5)
        .map((row) => ({
          id: row.syncRunId,
          status: row.syncStatus,
          syncType: row.syncType,
          createdAt: row.syncCreatedAt?.toISOString() || null,
        })),
    };
  }));

  return summaries.filter(Boolean);
}

export async function createSyncRun(input: {
  connection: RetailConnectionRecord;
  syncType: RetailSyncType;
  status?: "queued" | "running";
  metadata?: Record<string, unknown>;
}) {
  const db = getRequiredDb();
  const now = new Date();
  const [run] = await db
    .insert(retailSyncRuns)
    .values({
      id: createRetailId("sync"),
      organizationId: input.connection.organizationId,
      connectionId: input.connection.id,
      provider: input.connection.provider,
      syncType: input.syncType,
      status: input.status || "queued",
      startedAt: input.status === "running" ? now : null,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db
    .update(retailConnections)
    .set({
      connectionStatus: input.status === "running" ? "syncing" : input.connection.connectionStatus,
      lastSyncAttemptAt: now,
      updatedAt: now,
    })
    .where(eq(retailConnections.id, input.connection.id));

  return run;
}

export async function markConnectionDisconnected(connection: RetailConnectionRecord) {
  const db = getRequiredDb();
  const now = new Date();
  await db
    .update(retailConnections)
    .set({
      connectionStatus: "disconnected",
      disconnectedAt: now,
      updatedAt: now,
    })
    .where(eq(retailConnections.id, connection.id));
}

export async function updateConnectionTokens(connectionId: string, token: TokenResult) {
  const db = getRequiredDb();
  await db
    .update(retailConnections)
    .set({
      accessTokenEncrypted: encryptRetailSecret(token.accessToken),
      refreshTokenEncrypted: token.refreshToken ? encryptRetailSecret(token.refreshToken) : undefined,
      tokenExpiresAt: token.expiresAt,
      grantedScopes: token.scopes,
      updatedAt: new Date(),
    })
    .where(eq(retailConnections.id, connectionId));
}

export async function markConnectionError(connectionId: string, message: string, status: RetailConnectionStatus = "error") {
  const db = getRequiredDb();
  await db
    .update(retailConnections)
    .set({ connectionStatus: status, connectionError: message, updatedAt: new Date() })
    .where(eq(retailConnections.id, connectionId));
}

function toConnectionRecord(row: typeof retailConnections.$inferSelect): RetailConnectionRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider,
    externalMerchantId: row.externalMerchantId,
    displayName: row.displayName,
    connectionStatus: row.connectionStatus,
    accessTokenEncrypted: row.accessTokenEncrypted,
    refreshTokenEncrypted: row.refreshTokenEncrypted,
    tokenExpiresAt: row.tokenExpiresAt,
    grantedScopes: row.grantedScopes,
  };
}

async function countRetailLocations(connectionId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(retailLocations)
    .where(eq(retailLocations.connectionId, connectionId));
  return row?.value || 0;
}

async function countRetailProducts(connectionId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(retailProducts)
    .where(eq(retailProducts.connectionId, connectionId));
  return row?.value || 0;
}

async function countRetailVariants(connectionId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(retailVariants)
    .where(eq(retailVariants.connectionId, connectionId));
  return row?.value || 0;
}

async function countRetailOrders(connectionId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(retailOrders)
    .where(eq(retailOrders.connectionId, connectionId));
  return row?.value || 0;
}

async function countFailedWebhooks(connectionId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(retailWebhookEvents)
    .where(
      and(
        eq(retailWebhookEvents.connectionId, connectionId),
        or(eq(retailWebhookEvents.status, "failed"), isNotNull(retailWebhookEvents.processingError)),
      ),
    );
  return row?.value || 0;
}

function getRequiredDb() {
  const db = getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}
