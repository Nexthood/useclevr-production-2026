import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import {
  isPrebookkeepingCategorization,
  normalizePrebookkeepingCategorization,
} from "@/lib/accountancy/prebookkeeping-categorization";
import {
  applyPrebookkeepingReviewUpdate,
  buildPrebookkeepingLearningRuleValues,
  isAutonomousReviewAction,
  type ReviewAction,
} from "@/lib/accountancy/prebookkeeping-review-updates";
import { resolveDatasetType } from "@/lib/data/dataset-category";
import { getDb } from "@/lib/db";
import { datasets, prebookkeepingAuditEvents, prebookkeepingLearningRules } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return jsonError("Please sign in before reviewing transactions.", 401);

    await requireBuiltinUserRecord(userId);

    const body = await request.json().catch(() => ({}));
    const datasetId = typeof body.datasetId === "string" ? body.datasetId : "";
    const action = typeof body.action === "string" ? body.action as ReviewAction : null;
    const rowIndexes = normalizeRowIndexes(body.rowIndexes ?? body.rowIndex);
    const threshold = normalizeThreshold(body.threshold);

    if (!datasetId || !action) {
      return jsonError("Dataset ID and action are required.", 400);
    }

    if (!isAutonomousReviewAction(action) && rowIndexes.length === 0) {
      return jsonError("Dataset ID, action, and row indexes are required.", 400);
    }

    const db = getDb();
    if (!db) return jsonError("Database is not configured.", 503);

    const dataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
      columns: {
        id: true,
        userId: true,
        datasetType: true,
        analysis: true,
      },
    });

    if (!dataset || resolveDatasetType(dataset.datasetType, dataset.analysis) !== "prebookkeeping") {
      return jsonError("Pre-bookkeeping dataset was not found.", 404);
    }

    const analysis = isRecord(dataset.analysis) ? dataset.analysis : {};
    const categorizationValue = analysis.prebookkeepingCategorization;
    if (!isPrebookkeepingCategorization(categorizationValue)) {
      return jsonError("Categorization must be completed before review edits can be saved.", 409);
    }
    const categorization = normalizePrebookkeepingCategorization(categorizationValue);

    const now = new Date();
    const { effectiveRowIndexes, beforeByRow, updated, afterByRow } = applyPrebookkeepingReviewUpdate({
      categorization,
      rowIndexes,
      action,
      body,
      threshold,
    });
    await db.transaction(async (tx) => {
      await tx
        .update(datasets)
        .set({
          analysis: {
            ...analysis,
            categorizationStatus: updated.reviewSummary.reviewProgressPercent === 100 ? "ready_for_accountant" : "ready_for_review",
            prebookkeepingCategorization: updated,
          },
          analysisMessage: updated.reviewSummary.reviewProgressPercent === 100 ? "Ready for accountant." : "Ready for review.",
          updatedAt: now,
        })
        .where(eq(datasets.id, dataset.id));

      await tx.insert(prebookkeepingAuditEvents).values(
        effectiveRowIndexes.map((rowIndex) => ({
          id: `prebook_audit_${uuidv4()}`,
          userId,
          datasetId: dataset.id,
          rowIndex,
          action,
          before: toJsonRecord(beforeByRow.get(rowIndex), { rowIndex }),
          after: toJsonRecord(afterByRow.get(rowIndex), { action, rowIndex }),
          createdAt: now,
        })),
      );

      const rules = buildPrebookkeepingLearningRuleValues({
        action,
        categorization,
        updated,
        effectiveRowIndexes,
        userId,
        now,
        idFactory: () => `prebook_rule_${uuidv4()}`,
      });
      if (rules.length > 0) await tx.insert(prebookkeepingLearningRules).values(rules);
    });

    revalidatePath("/app/prebookkeeping");
    return NextResponse.json({ ok: true, categorization: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Review update failed.", 500);
  }
}

function normalizeThreshold(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

function normalizeRowIndexes(value: unknown): number[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toJsonRecord(value: unknown, fallback: Record<string, unknown>) {
  return isRecord(value) ? { ...value } : fallback;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}
