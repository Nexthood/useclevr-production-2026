import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  aiAgentPassports,
  aiAgentRiskClasses,
  aiAgentLifecycleStates,
  aiInteractionTraces,
} from "@/lib/db/schema";
import { debugError } from "@/lib/utils/debug";

export const CLEVR_ANALYST_KEY = "clevr-ai-analyst";
export const PASSPORT_NOTICE =
  "Lifecycle and owner-declared risk are descriptive only. They do not enforce runtime restrictions, grant permissions, or constitute security certification.";
type Actor = { id: string; role?: string | null };
type PassportRow = typeof aiAgentPassports.$inferSelect;
export type AgentPassport = Omit<PassportRow, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

const fields = z
  .object({
    ownerName: z.string().trim().min(1).max(160),
    purpose: z.string().trim().min(1).max(2000),
    declaredScope: z.string().trim().min(1).max(4000),
    riskClass: z.enum(aiAgentRiskClasses).default("unclassified"),
    lifecycle: z.enum(aiAgentLifecycleStates).default("draft"),
  })
  .strict();
const patchFields = fields
  .extend({
    riskClass: z.enum(aiAgentRiskClasses),
    lifecycle: z.enum(aiAgentLifecycleStates),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export class PassportError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function database() {
  const db = getDb();
  if (!db) throw new PassportError(503, "Agent passports are temporarily unavailable.");
  return db;
}

function serialize(row: PassportRow): AgentPassport {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function listAgentPassports(actor: Actor) {
  const db = database();
  const rows = await db
    .select()
    .from(aiAgentPassports)
    .where(actor.role === "superadmin" ? undefined : eq(aiAgentPassports.userId, actor.id))
    .orderBy(desc(aiAgentPassports.createdAt))
    .limit(100);
  return rows.map(serialize);
}

export async function getOwnAnalystPassport(userId: string) {
  const [row] = await database()
    .select()
    .from(aiAgentPassports)
    .where(
      and(eq(aiAgentPassports.userId, userId), eq(aiAgentPassports.agentKey, CLEVR_ANALYST_KEY)),
    )
    .limit(1);
  return row ? serialize(row) : null;
}

export async function getAgentPassport(actor: Actor, id: string) {
  const [row] = await database()
    .select()
    .from(aiAgentPassports)
    .where(
      and(
        eq(aiAgentPassports.id, id),
        actor.role === "superadmin" ? undefined : eq(aiAgentPassports.userId, actor.id),
      ),
    )
    .limit(1);
  if (!row) throw new PassportError(404, "Agent passport not found.");
  return serialize(row);
}

export async function createAgentPassport(userId: string, body: unknown) {
  const parsed = fields.safeParse(body);
  if (!parsed.success)
    throw new PassportError(
      400,
      "Provide a human owner name, purpose, scope, and valid risk and lifecycle values.",
    );
  const rows = await database()
    .insert(aiAgentPassports)
    .values({
      id: randomUUID(),
      userId,
      agentKey: CLEVR_ANALYST_KEY,
      ...parsed.data,
    })
    .onConflictDoNothing({ target: [aiAgentPassports.userId, aiAgentPassports.agentKey] })
    .returning();
  if (!rows[0])
    throw new PassportError(
      409,
      "This analyst already has a passport. Edit its existing passport.",
    );
  return serialize(rows[0]);
}

export async function updateAgentPassport(userId: string, id: string, body: unknown) {
  const parsed = patchFields.safeParse(body);
  if (!parsed.success)
    throw new PassportError(
      400,
      "Provide valid passport fields. Identity and ownership cannot be reassigned.",
    );
  const rows = await database()
    .update(aiAgentPassports)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(aiAgentPassports.id, id), eq(aiAgentPassports.userId, userId)))
    .returning();
  if (!rows[0]) throw new PassportError(404, "Agent passport not found.");
  return serialize(rows[0]);
}

export async function listAgentPassportTraces(actor: Actor, id: string, offset = 0) {
  const passport = await getAgentPassport(actor, id);
  const db = database();
  const where = and(
    eq(aiInteractionTraces.agentPassportId, passport.id),
    eq(aiInteractionTraces.userId, passport.userId),
  );
  const safeOffset = Number.isSafeInteger(offset) && offset >= 0 ? Math.min(offset, 1000000) : 0;
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: aiInteractionTraces.id,
        datasetId: aiInteractionTraces.datasetId,
        providerName: aiInteractionTraces.providerName,
        modelName: aiInteractionTraces.modelName,
        createdAt: aiInteractionTraces.createdAt,
      })
      .from(aiInteractionTraces)
      .where(where)
      .orderBy(desc(aiInteractionTraces.createdAt), desc(aiInteractionTraces.id))
      .limit(20)
      .offset(safeOffset),
    db.select({ total: count() }).from(aiInteractionTraces).where(where),
  ]);
  return {
    passport,
    traces: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    total: totals[0]?.total ?? 0,
    offset: safeOffset,
  };
}

// Called only with a server-selected analyst key, never with a request-body ID.
// No automatic passport creation or historical attribution occurs here.
export async function resolveTracePassport(
  userId: string,
  agentKey?: string,
): Promise<string | null> {
  if (!agentKey) return null;
  try {
    const [row] = await database()
      .select({ id: aiAgentPassports.id })
      .from(aiAgentPassports)
      .where(and(eq(aiAgentPassports.userId, userId), eq(aiAgentPassports.agentKey, agentKey)))
      .limit(1);
    return row?.id ?? null;
  } catch (error) {
    debugError("[AGENT_PASSPORT] Trace attribution unavailable", error);
    return null;
  }
}

export async function getGovernancePassports(actor: Actor) {
  try {
    const [items, ownPassport] = await Promise.all([
      listAgentPassports(actor),
      getOwnAnalystPassport(actor.id),
    ]);
    return { available: true, items, ownPassport };
  } catch (error) {
    debugError("[AGENT_PASSPORT] Governance passport load failed", error);
    return { available: false, items: [] as AgentPassport[], ownPassport: null };
  }
}
