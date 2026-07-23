import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { retailConnections, retailWebhookEvents } from "@/lib/db/schema";
import { getRetailConnector } from "./connector.factory";
import { createRetailId } from "./connection.service";
import type { RetailProvider } from "./normalized-types";

export async function receiveRetailWebhook(input: {
  provider: RetailProvider;
  headers: Record<string, string>;
  rawBody: string;
}) {
  const connector = getRetailConnector(input.provider);
  const verified = await connector.verifyWebhook(input.headers, input.rawBody);
  if (!verified) {
    return { accepted: false as const, status: 401, error: "Invalid Square webhook signature." };
  }

  const parsedBody = JSON.parse(input.rawBody) as unknown;
  const event = await connector.parseWebhook(parsedBody);
  const db = getRequiredDb();
  const connection = event.externalMerchantId
    ? await findConnection(input.provider, event.externalMerchantId)
    : null;
  const now = new Date();

  const existing = await db
    .select({ id: retailWebhookEvents.id })
    .from(retailWebhookEvents)
    .where(
      and(
        eq(retailWebhookEvents.provider, input.provider),
        eq(retailWebhookEvents.providerEventId, event.providerEventId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(retailWebhookEvents)
      .set({ status: "duplicate", updatedAt: now })
      .where(eq(retailWebhookEvents.id, existing[0].id));
    return { accepted: true as const, duplicate: true, eventId: existing[0].id };
  }

  const [row] = await db
    .insert(retailWebhookEvents)
    .values({
      id: createRetailId("webhook"),
      organizationId: connection?.organizationId || null,
      connectionId: connection?.id || null,
      provider: input.provider,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      status: connection ? "queued" : "ignored",
      receivedAt: now,
      sanitizedPayload: event.sanitizedPayload,
      processingError: connection ? null : "No matching Square retail connection.",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (connection) {
    await db
      .update(retailConnections)
      .set({ lastWebhookAt: now, updatedAt: now })
      .where(eq(retailConnections.id, connection.id));
  }

  return { accepted: true as const, duplicate: false, eventId: row.id };
}

async function findConnection(provider: RetailProvider, externalMerchantId: string) {
  const db = getRequiredDb();
  const [connection] = await db
    .select()
    .from(retailConnections)
    .where(
      and(
        eq(retailConnections.provider, provider),
        eq(retailConnections.externalMerchantId, externalMerchantId),
      ),
    )
    .limit(1);
  return connection || null;
}

function getRequiredDb() {
  const db = getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}
