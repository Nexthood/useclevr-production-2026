import {
  applyAutonomousReview,
  normalizeReviewCategory,
  type CategorizedTransaction,
  type PrebookkeepingCategorization,
} from "@/lib/accountancy/prebookkeeping-categorization";

export type ReviewAction =
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
  | "bulk_delete_duplicates"
  | "auto_review_all_high_confidence"
  | "auto_review_selected"
  | "auto_review_all_filtered"
  | "auto_review_all"
  | "undo_last_review"
  | "reset_review_status";

export type PrebookkeepingLearningRuleInsert = {
  id: string;
  userId: string;
  supplierKey: string | null;
  descriptionKeyword: string | null;
  merchantKey: string | null;
  category: string;
  countryKey: string | null;
  vatRate: number | null;
  source: "manual_edit" | "manual_vat_edit";
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export function isAutonomousReviewAction(action: string): action is
  | "auto_review_all_high_confidence"
  | "auto_review_selected"
  | "auto_review_all_filtered"
  | "auto_review_all"
  | "undo_last_review"
  | "reset_review_status" {
  return [
    "auto_review_all_high_confidence",
    "auto_review_selected",
    "auto_review_all_filtered",
    "auto_review_all",
    "undo_last_review",
    "reset_review_status",
  ].includes(action);
}

export function applyPrebookkeepingReviewUpdate(input: {
  categorization: PrebookkeepingCategorization;
  rowIndexes: number[];
  action: ReviewAction;
  body: Record<string, unknown>;
  threshold?: number;
}) {
  const { categorization, rowIndexes, action, body, threshold } = input;
  const effectiveRowIndexes = isAutonomousReviewAction(action)
    ? categorization.transactions
        .filter((transaction) => rowIndexes.includes(transaction.rowIndex) || rowIndexes.length === 0)
        .map((transaction) => transaction.rowIndex)
    : rowIndexes;
  const beforeByRow = new Map(
    categorization.transactions
      .filter((transaction) => effectiveRowIndexes.includes(transaction.rowIndex))
      .map((transaction) => [transaction.rowIndex, transaction]),
  );
  const updated = applyReviewAction(categorization, effectiveRowIndexes, action, body, threshold);
  const afterByRow = new Map(
    updated.transactions
      .filter((transaction) => effectiveRowIndexes.includes(transaction.rowIndex))
      .map((transaction) => [transaction.rowIndex, transaction]),
  );

  return { effectiveRowIndexes, beforeByRow, updated, afterByRow };
}

export function buildPrebookkeepingLearningRuleValues(input: {
  action: ReviewAction;
  categorization: PrebookkeepingCategorization;
  updated: PrebookkeepingCategorization;
  effectiveRowIndexes: number[];
  userId: string;
  now: Date;
  idFactory: () => string;
}): PrebookkeepingLearningRuleInsert[] {
  const learningActions: ReviewAction[] = [
    "change_category",
    "bulk_change_category",
    "accept_suggestion",
    "bulk_accept_suggestions",
    "add_vat",
    "bulk_add_vat",
    "apply_business_default_vat",
    "apply_vat_to_matching",
  ];
  if (!learningActions.includes(input.action)) return [];

  return input.updated.transactions
    .filter((transaction) => input.effectiveRowIndexes.includes(transaction.rowIndex))
    .filter((transaction) => transaction.category !== "uncategorized")
    .map((transaction) => ({
      id: input.idFactory(),
      userId: input.userId,
      supplierKey: normalizeRuleText(transaction.supplierCustomer),
      descriptionKeyword: normalizeRuleText(transaction.description),
      merchantKey: normalizeRuleText(transaction.supplierCustomer),
      category: transaction.category,
      countryKey: normalizeRuleText(input.categorization.taxProfile.taxCountry),
      vatRate: transaction.vatSource === "manual_review" ? transaction.vatRate : null,
      source: transaction.vatSource === "manual_review" ? "manual_vat_edit" as const : "manual_edit" as const,
      usageCount: 0,
      createdAt: input.now,
      updatedAt: input.now,
    }))
    .filter((rule) => rule.supplierKey || rule.descriptionKeyword || rule.merchantKey);
}

function applyReviewAction(
  categorization: PrebookkeepingCategorization,
  rowIndexes: number[],
  action: ReviewAction,
  body: Record<string, unknown>,
  threshold?: number,
): PrebookkeepingCategorization {
  if (isAutonomousReviewAction(action)) {
    const configuredThreshold = threshold ?? categorization.reviewSummary.thresholdConfig.autoReview;
    const withThreshold = {
      ...categorization,
      thresholdConfig: {
        ...categorization.thresholdConfig,
        autoReview: configuredThreshold,
      },
    };

    if (action === "reset_review_status") {
      const resetTransactions = categorization.transactions.map((transaction) => ({
        ...transaction,
        reviewed: false,
        autoReviewed: false,
        autoReviewReason: null,
        autoReviewEvidence: [] as string[],
        autoReviewBusinessRule: null,
        autoReviewCalculationSource: null,
        autoReviewProviderSource: null,
        reviewDecision: null as "auto" | "manual" | null,
        riskScore: 0,
        reviewBlockers: [] as string[],
        reviewStatus: "pending" as const,
        needsReview: transaction.category === "uncategorized" || transaction.confidence < 0.7 || transaction.duplicateStatus === "possible_duplicate" || transaction.vatStatus === "missing" || !transaction.supplierCustomer,
      }));
      return rebuildCategorization(categorization, resetTransactions);
    }

    return applyAutonomousReview(withThreshold, [], categorization.taxProfile);
  }

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
      next.reviewDecision = "manual";
    }
    if ((action === "change_category" || action === "bulk_change_category") && category !== "uncategorized") {
      next.category = category;
      next.suggestedCategory = category;
      next.confidence = 1;
      next.reviewed = true;
      next.reasons = ["manual category edit"];
      next.reviewDecision = "manual";
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
      next.reviewDecision = "manual";
    }
    if (action === "mark_reviewed" || action === "bulk_mark_reviewed") {
      next.reviewed = true;
      next.reviewDecision = "manual";
    }
    if (action === "duplicate_action" && duplicateStatus) next.duplicateStatus = duplicateStatus;
    if (action === "bulk_delete_duplicates") {
      next.duplicateStatus = "merged";
      next.reviewed = true;
      next.reviewDecision = "manual";
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
      autoReviewedCount: transactions.filter((transaction) => transaction.autoReviewed).length,
      needsReviewCount: requiresReview,
      riskDistribution: buildRiskDistribution(transactions),
      thresholdConfig: categorization.thresholdConfig ?? { autoReview: 0.95, suggestedReview: 0.8, manualReview: 0 },
    },
    transactions,
  };
}

function buildRiskDistribution(transactions: CategorizedTransaction[]) {
  return transactions.reduce(
    (distribution, transaction) => {
      if (transaction.riskScore < 0.3) distribution.low += 1;
      else if (transaction.riskScore < 0.7) distribution.medium += 1;
      else distribution.high += 1;
      return distribution;
    },
    { low: 0, medium: 0, high: 0 },
  );
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
