import {
  finalizeCredits,
  releaseCredits,
  reserveCredits,
} from "@/lib/billing/credit-engine";
import { FEATURE_CREDIT_COSTS } from "@/lib/billing/feature-costs";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { debugError } from "@/lib/utils/debug";

/**
 * Accountancy uploads participate in the centralized credit engine like every
 * other upload: one RESERVE → PROCESS → FINALIZE (or RELEASE on failure)
 * transaction per logical user operation using the authoritative
 * standard_upload_analysis feature cost. No accountancy-specific price exists.
 */
export const ACCOUNTANCY_UPLOAD_FEATURE = "standard_upload_analysis" as const;
export const ACCOUNTANCY_UPLOAD_CREDITS = FEATURE_CREDIT_COSTS.STANDARD_UPLOAD_ANALYSIS;

export interface AccountancyUploadCreditContext {
  userId: string;
  datasetId: string;
  datasetType: string;
  uploadType: string;
  fileName: string;
  rowCount: number;
  role?: string | null;
  email?: string | null;
}

export interface AccountancyUploadCreditReservation {
  operationId: string;
  reservedCredits: number;
}

export type AccountancyUploadCreditOutcome =
  | { ok: true; unlimited: true; reservation: null }
  | { ok: true; unlimited: false; reservation: AccountancyUploadCreditReservation }
  | {
      ok: false
      unlimited: false
      reservation: null
      error: string
      requiredCredits: number
      availableCredits: number
      usedCredits: number
      totalCredits: number | null
    };

function buildCreditMetadata(context: AccountancyUploadCreditContext) {
  return {
    datasetId: context.datasetId,
    fileName: context.fileName,
    rowCount: context.rowCount,
    datasetType: context.datasetType,
    uploadType: context.uploadType,
  };
}

export async function reserveAccountancyUploadCredits(
  context: AccountancyUploadCreditContext,
): Promise<AccountancyUploadCreditOutcome> {
  const usage = await getAnalystCreditUsage(context.userId, context.role, context.email ?? null);
  if (usage.unlimited) {
    return { ok: true, unlimited: true, reservation: null };
  }

  const operationId = `accountancy-upload:${context.userId}:${context.datasetId}`;
  const reservation = await reserveCredits({
    userId: context.userId,
    operationId,
    idempotencyKey: operationId,
    feature: ACCOUNTANCY_UPLOAD_FEATURE,
    source: "accountancy_upload",
    role: context.role ?? null,
    email: context.email ?? null,
    metadata: buildCreditMetadata(context),
  });

  if (!reservation.success) {
    debugError("[ACCOUNTANCY-UPLOAD] credit reservation rejected", {
      userId: context.userId,
      datasetId: context.datasetId,
      datasetType: context.datasetType,
      uploadType: context.uploadType,
      requiredCredits: reservation.reservedCredits,
      availableCredits: reservation.availableCredits,
      reason: reservation.error,
    });
    return {
      ok: false,
      unlimited: false,
      reservation: null,
      error: reservation.error || `This upload with its analysis uses ${ACCOUNTANCY_UPLOAD_CREDITS} credits.`,
      requiredCredits: reservation.reservedCredits,
      availableCredits: reservation.availableCredits,
      usedCredits: usage.usedCredits ?? 0,
      totalCredits: usage.total,
    };
  }

  return {
    ok: true,
    unlimited: false,
    reservation: { operationId, reservedCredits: reservation.reservedCredits },
  };
}

export async function finalizeAccountancyUploadCredits(
  context: AccountancyUploadCreditContext,
  outcome: AccountancyUploadCreditOutcome,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!outcome.ok || outcome.unlimited || !outcome.reservation) return { ok: true };

  const finalized = await finalizeCredits({
    operationId: outcome.reservation.operationId,
    actualCredits: outcome.reservation.reservedCredits,
    metadata: buildCreditMetadata(context),
  });

  if (!finalized.success) {
    await releaseCredits(outcome.reservation.operationId, "accountancy_upload_finalization_failed");
    return { ok: false, error: finalized.error || "The upload credit could not be finalized." };
  }

  return { ok: true };
}

export async function releaseAccountancyUploadCredits(
  outcome: AccountancyUploadCreditOutcome | null,
  reason: string,
): Promise<void> {
  if (!outcome?.ok || outcome.unlimited || !outcome.reservation) return;
  await releaseCredits(outcome.reservation.operationId, reason);
}
