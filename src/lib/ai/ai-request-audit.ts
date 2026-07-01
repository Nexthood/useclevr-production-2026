import { randomUUID } from "node:crypto";

import type { AiProviderType } from "@/lib/ai/byoai-provider";
import type { AiMode, UniversalAiGenerateResult } from "@/lib/ai/universal-ai-adapter";
import { db } from "@/lib/db";
import {
  aiRequestAuditLogs,
  type AiRequestExecutionLocation,
  type AiRequestAuditPurpose,
} from "@/lib/db/schema";
import { debugWarn } from "@/lib/utils/debug";
import { and, desc, eq } from "drizzle-orm";

export type AiRequestAuditProviderType = AiProviderType | "default-cloud" | "offline-mode" | "none";

export type AiRequestAuditInput = {
  userId: string;
  datasetId?: string | null;
  providerName: string;
  providerType: AiRequestAuditProviderType | string;
  modelName?: string | null;
  mode: AiMode | string;
  executionLocation: AiRequestExecutionLocation;
  fallbackUsed: boolean;
  purpose: AiRequestAuditPurpose;
  success: boolean;
  errorReason?: string | null;
};

export type AiRequestAuditEntry = typeof aiRequestAuditLogs.$inferSelect;

const MAX_ERROR_REASON_LENGTH = 1000;

export function recordAiRequestAudit(input: AiRequestAuditInput) {
  void writeAiRequestAudit(input).catch((error) => {
    debugWarn("[AI_AUDIT] Failed to record AI request audit metadata", {
      userId: input.userId,
      providerName: input.providerName,
      providerType: input.providerType,
      purpose: input.purpose,
      success: input.success,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export function auditInputFromAdapterResult(
  userId: string,
  result: UniversalAiGenerateResult,
  purpose: AiRequestAuditPurpose,
  datasetId?: string | null,
): AiRequestAuditInput {
  return {
    userId,
    datasetId,
    providerName: result.providerName,
    providerType: result.providerType,
    modelName: result.modelName,
    mode: result.mode,
    executionLocation: result.route,
    fallbackUsed: result.fallbackUsed,
    purpose,
    success: true,
  };
}

export async function listAiRequestAuditLogs(input: {
  userId: string;
  role?: string | null;
  limit?: number;
}): Promise<AiRequestAuditEntry[]> {
  const limit = normalizeLimit(input.limit);
  if (input.role === "superadmin") {
    return db.query.aiRequestAuditLogs.findMany({
      orderBy: desc(aiRequestAuditLogs.createdAt),
      limit,
    });
  }

  return db.query.aiRequestAuditLogs.findMany({
    where: eq(aiRequestAuditLogs.userId, input.userId),
    orderBy: desc(aiRequestAuditLogs.createdAt),
    limit,
  });
}

export async function listOwnAiRequestAuditLogs(userId: string, limit?: number) {
  return db.query.aiRequestAuditLogs.findMany({
    where: eq(aiRequestAuditLogs.userId, userId),
    orderBy: desc(aiRequestAuditLogs.createdAt),
    limit: normalizeLimit(limit),
  });
}

export async function listDatasetAiRequestAuditLogs(userId: string, datasetId: string, limit?: number) {
  return db.query.aiRequestAuditLogs.findMany({
    where: and(eq(aiRequestAuditLogs.userId, userId), eq(aiRequestAuditLogs.datasetId, datasetId)),
    orderBy: desc(aiRequestAuditLogs.createdAt),
    limit: normalizeLimit(limit),
  });
}

async function writeAiRequestAudit(input: AiRequestAuditInput) {
  await db.insert(aiRequestAuditLogs).values({
    id: `aia_${randomUUID().replaceAll("-", "").slice(0, 24)}`,
    userId: input.userId,
    datasetId: normalizeNullable(input.datasetId),
    providerName: normalizeRequired(input.providerName, "Unknown provider", 160),
    providerType: normalizeRequired(input.providerType, "none", 80),
    modelName: normalizeRequired(input.modelName, "unknown", 160),
    mode: normalizeRequired(input.mode, "auto", 30),
    executionLocation: input.executionLocation,
    fallbackUsed: input.fallbackUsed,
    purpose: input.purpose,
    success: input.success,
    errorReason: normalizeErrorReason(input.errorReason),
    createdAt: new Date(),
  });
}

function normalizeRequired(value: unknown, fallback: string, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback).slice(0, maxLength);
}

function normalizeNullable(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeErrorReason(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_ERROR_REASON_LENGTH) : null;
}

function normalizeLimit(value: unknown) {
  const numeric = Number(value ?? 100);
  if (!Number.isFinite(numeric)) return 100;
  return Math.max(1, Math.min(250, Math.floor(numeric)));
}
