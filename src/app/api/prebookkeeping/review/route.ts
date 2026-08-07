import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import {
  isPrebookkeepingCategorization,
  normalizePrebookkeepingCategorization,
  normalizeReviewCategory,
  type CategorizedTransaction,
  type PrebookkeepingCategorization,
} from "@/lib/accountancy/prebookkeeping-categorization";
import { resolveDatasetType } from "@/lib/data/dataset-category";
import { getDb } from "@/lib/db";
import { datasets, prebookkeepingAuditEvents, prebookkeepingLearningRules } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

type ReviewAction =
  | "accept_suggestion"
  | "change_category"
  | "add_vat"
  | "mark_reviewed"
  | "duplicate_action"
  | "bulk_accept_suggestions"
  | "bulk_change_category"
  | "bulk_add_vat"
  | "apply_business_default_vat"
  | "apply_vat_to_matching"
  | "bulk_mark_reviewed"
  | "bulk_delete_duplicates";

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

    if (!datasetId || !action || rowIndexes.length === 0) {
      return jsonError("Dataset ID, action, and row indexes are required.", 400);
    }

    const db = getDb();
    if (!db) return jsonError("Database is not configured.", 503);

    const datasetWhere =
      session.user.role === "superadmin"
        ? eq(datasets.id, datasetId)
        : and(eq(datasets.id, datasetId), eq(datasets.userId, userId));
    const dataset = await db.query.datasets.findFirst({
      where: datasetWhere,
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
    const beforeByRow = new Map(
      categorization.transactions
        .filter((transaction) => rowIndexes.includes(transaction.rowIndex))
        .map((transaction) => [transaction.rowIndex, transaction]),
    );
    const updated = applyReviewAction(categorization, rowIndexes, action, body);
    const afterByRow = new Map(
      updated.transactions
        .filter((transaction) => rowIndexes.includes(transaction.rowIndex))
        .map((transaction) => [transaction.rowIndex, transaction]),
    );
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
        rowIndexes.map((rowIndex) => ({
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

      if (
        action === "change_category" ||
        action === "bulk_change_category" ||
        action === "accept_suggestion" ||
        action === "bulk_accept_suggestions" ||
        action === "add_vat" ||
        action === "bulk_add_vat" ||
        action === "apply_business_default_vat" ||
        action === "apply_vat_to_matching"
      ) {
        const changedRows = updated.transactions.filter((transaction) => rowIndexes.includes(transaction.rowIndex));
        const rules = changedRows
          .filter((transaction) => transaction.category !== "uncategorized")
          .map((transaction) => ({
            id: `prebook_rule_${uuidv4()}`,
            userId,
            supplierKey: normalizeRuleText(transaction.supplierCustomer),
            descriptionKeyword: normalizeRuleText(transaction.description),
            merchantKey: normalizeRuleText(transaction.supplierCustomer),
            category: transaction.category,
            countryKey: normalizeRuleText(categorization.taxProfile.taxCountry),
            vatRate: transaction.vatSource === "manual_review" ? transaction.vatRate : null,
            source: transaction.vatSource === "manual_review" ? "manual_vat_edit" : "manual_edit",
            usageCount: 0,
            createdAt: now,
            updatedAt: now,
          }))
          .filter((rule) => rule.supplierKey || rule.descriptionKeyword || rule.merchantKey);

        if (rules.length > 0) await tx.insert(prebookkeepingLearningRules).values(rules);
      }
    });

    revalidatePath("/app/prebookkeeping");
    return NextResponse.json({ ok: true, categorization: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Review update failed.", 500);
  }
}

function applyReviewAction(
  categorization: PrebookkeepingCategorization,
  rowIndexes: number[],
  action: ReviewAction,
  body: Record<string, unknown>,
): PrebookkeepingCategorization {
  const selected = new Set(rowIndexes);
  const category = normalizeReviewCategory(body.category);
  const fallbackVatRate = action === "apply_business_default_vat" ? categorization.taxProfile.defaultVatRate : null;
  const vatRate = normalizeVatRate(body.vatRate, fallbackVatRate);
  const duplicateStatus = normalizeDuplicateStatus(body.duplicateStatus);
  const matchingRows = action === "apply_vat_to_matching" ? findMatchingVatRows(categorization.transactions, rowIndexes) : selected;

  const transactions = categorization.transactions.map((transaction) => {
    const appliesToRow = action === "apply_vat_to_matching" ? matchingRows.has(transaction.rowIndex) : selected.has(transaction.rowIndex);
    if (!appliesToRow) return transaction;
    const next: CategorizedTransaction = { ...transaction };

    if (action === "accept_suggestion" || action === "bulk_accept_suggestions") {
      if (next.suggestedCategory) next.category = next.suggestedCategory;
      next.reviewed = true;
    }
    if ((action === "change_category" || action === "bulk_change_category") && category !== "uncategorized") {
      next.category = category;
      next.suggestedCategory = category;
      next.confidence = 1;
      next.reviewed = true;
      next.reasons = ["manual category edit"];
    }
    if (
      (action === "add_vat" ||
        action === "bulk_add_vat" ||
        action === "apply_business_default_vat" ||
        action === "apply_vat_to_matching") &&
      typeof vatRate === "number"
    ) {
      next.vatRate = vatRate;
      next.vatTax = typeof next.amount === "number" ? Math.round(Math.abs(next.amount) * (vatRate / 100) * 100) / 100 : 0;
      next.vatStatus = "present";
      next.vatConfidence = 1;
      next.vatReason = action === "apply_business_default_vat"
        ? "Business Profile default VAT rate was applied by the reviewer."
        : "VAT rate was confirmed during review.";
      next.vatBusinessRule = action === "apply_vat_to_matching"
        ? "Apply this reviewed VAT rate to matching supplier/category/country transactions."
        : "Use the reviewer-confirmed VAT rate for this transaction.";
      next.vatSource = "manual_review";
      next.vatNeedsReview = false;
      next.reviewed = true;
    }
    if (action === "mark_reviewed" || action === "bulk_mark_reviewed") next.reviewed = true;
    if (action === "duplicate_action" && duplicateStatus) next.duplicateStatus = duplicateStatus;
    if (action === "bulk_delete_duplicates") {
      next.duplicateStatus = "merged";
      next.reviewed = true;
    }

    next.reviewStatus = next.reviewed ? "reviewed" : "pending";
    next.needsReview = !next.reviewed && (next.category === "uncategorized" || next.confidence < 0.7 || next.duplicateStatus === "possible_duplicate" || next.vatStatus === "missing" || !next.supplierCustomer);
    return next;
  });

  return rebuildCategorization(categorization, transactions);
}

function rebuildCategorization(
  categorization: PrebookkeepingCategorization,
  transactions: CategorizedTransaction[],
): PrebookkeepingCategorization {
  const categoryCounts = { ...categorization.categoryCounts };
  for (const key of Object.keys(categoryCounts)) categoryCounts[key as keyof typeof categoryCounts] = 0;
  for (const transaction of transactions) categoryCounts[transaction.category] += 1;
  const reviewedCount = transactions.filter((transaction) => transaction.reviewed).length;
  const requiresReview = transactions.filter((transaction) => transaction.needsReview).length;
  const vatRows = transactions.filter((transaction) => transaction.vatStatus === "present");
  const reviewProgressPercent = Math.round((reviewedCount / Math.max(transactions.length, 1)) * 100);
  return {
    ...categorization,
    categoryCounts,
    categorizedCount: transactions.length - categoryCounts.uncategorized,
    uncategorizedCount: categoryCounts.uncategorized,
    vatTaxSummary: {
      total: Math.round(vatRows.reduce((sum, transaction) => sum + Math.abs(transaction.vatTax || 0), 0) * 100) / 100,
      rowsWithTax: vatRows.length,
    },
    reviewSummary: {
      ...categorization.reviewSummary,
      categorizedAutomatically: transactions.length - categoryCounts.uncategorized,
      requiresReview,
      reviewedCount,
      vatMissingPercent: Math.round((transactions.filter((transaction) => transaction.vatStatus === "missing").length / Math.max(transactions.length, 1)) * 100),
      manualCorrections: transactions.filter((transaction) => transaction.vatSource === "manual_review" || transaction.reasons.includes("manual category edit")).length,
      averageVatConfidence: Math.round((transactions.reduce((sum, transaction) => sum + transaction.vatConfidence, 0) / Math.max(transactions.length, 1)) * 100),
      confidenceDistribution: buildVatConfidenceDistribution(transactions),
      reviewProgressPercent,
      totalCount: transactions.length,
      progress: reviewProgressPercent,
      status: reviewProgressPercent === 100 && transactions.length > 0 ? "ready_for_accountant" : "ready_for_review",
    },
    transactions,
  };
}

function findMatchingVatRows(transactions: CategorizedTransaction[], rowIndexes: number[]) {
  const selected = transactions.filter((transaction) => rowIndexes.includes(transaction.rowIndex));
  const matches = new Set(rowIndexes);
  for (const source of selected) {
    const supplier = normalizeRuleText(source.supplierCustomer);
    const category = source.category;
    for (const transaction of transactions) {
      if (transaction.category !== category) continue;
      if (supplier && normalizeRuleText(transaction.supplierCustomer) === supplier) matches.add(transaction.rowIndex);
    }
  }
  return matches;
}

function normalizeRowIndexes(value: unknown): number[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0);
}

function normalizeDuplicateStatus(value: unknown) {
  const normalized = String(value || "");
  if (normalized === "keep_both" || normalized === "merged" || normalized === "ignored") return normalized;
  return null;
}

function normalizeVatRate(value: unknown, fallback: number | null) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value * 100) / 100;
  if (typeof value === "string") {
    const parsed = Number(value.replace("%", "").replace(",", ".").trim());
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed * 100) / 100;
  }
  return typeof fallback === "number" ? fallback : null;
}

function buildVatConfidenceDistribution(transactions: CategorizedTransaction[]) {
  return transactions.reduce(
    (distribution, transaction) => {
      if (transaction.vatConfidence >= 0.9) distribution.high += 1;
      else if (transaction.vatConfidence >= 0.7) distribution.medium += 1;
      else distribution.low += 1;
      return distribution;
    },
    { high: 0, medium: 0, low: 0 },
  );
}

function normalizeRuleText(value: unknown) {
  const text = String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  return text.length >= 3 ? text.slice(0, 120) : null;
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
