export type PrebookkeepingCategory =
  | "revenue"
  | "operating_expenses"
  | "payroll"
  | "fixed_costs"
  | "taxes"
  | "bank_fees"
  | "transfers"
  | "assets"
  | "liabilities"
  | "equity"
  | "other"
  | "uncategorized";

export type PrebookkeepingReviewCategory = Exclude<PrebookkeepingCategory, "uncategorized">;

export interface PrebookkeepingLearningRuleInput {
  supplierKey?: string | null;
  descriptionKeyword?: string | null;
  merchantKey?: string | null;
  category: string;
}

export interface CategorizedTransaction {
  rowIndex: number;
  transactionDate: string | null;
  description: string | null;
  supplierCustomer: string | null;
  debit: number | null;
  credit: number | null;
  amount: number | null;
  currency: string | null;
  vatTax: number | null;
  category: PrebookkeepingCategory;
  suggestedCategory: PrebookkeepingReviewCategory | null;
  sourceCategory: string | null;
  invoiceReference: string | null;
  confidence: number;
  reasons: string[];
  reviewed: boolean;
  needsReview: boolean;
  reviewStatus: "pending" | "reviewed";
  duplicateStatus: "none" | "possible_duplicate" | "keep_both" | "merged" | "ignored";
  vatStatus: "present" | "missing";
  vatRate: number | null;
  isLargeTransaction: boolean;
}

export interface PrebookkeepingCategorization {
  status: "ready_for_review";
  generatedAt: string;
  rowCount: number;
  categorizedCount: number;
  uncategorizedCount: number;
  incomeTotal: number;
  expenseTotal: number;
  vatTaxSummary: {
    total: number;
    rowsWithTax: number;
  };
  possibleDuplicates: Array<{
    key: string;
    count: number;
    rowIndexes: number[];
  }>;
  missingDataWarnings: string[];
  columns: {
    transactionDate: string | null;
    description: string | null;
    supplierCustomer: string | null;
    debit: string | null;
    credit: string | null;
    amount: string | null;
    currency: string | null;
    vatTax: string | null;
    category: string | null;
    invoiceReference: string | null;
  };
  categoryCounts: Record<PrebookkeepingCategory, number>;
  reviewSummary: PrebookkeepingReviewSummary;
  recommendations: string[];
  transactions: CategorizedTransaction[];
}

export type PrebookkeepingReviewStatus = "pending" | "processing" | "ready_for_review" | "ready_for_accountant" | "failed";

export type PrebookkeepingReviewSummary = {
  transactionsAnalyzed: number;
  categorizedAutomatically: number;
  requiresReview: number;
  possibleDuplicatesDetected: number;
  missingDataWarnings: number;
  vatMissingPercent: number;
  confidenceScore: number;
  reviewedCount: number;
  reviewProgressPercent: number;
  totalCount: number;
  progress: number;
  status: PrebookkeepingReviewStatus;
};

const categories: PrebookkeepingCategory[] = [
  "revenue",
  "operating_expenses",
  "payroll",
  "fixed_costs",
  "taxes",
  "bank_fees",
  "transfers",
  "assets",
  "liabilities",
  "equity",
  "other",
  "uncategorized",
];

export function categorizePrebookkeepingRows(
  rows: Record<string, unknown>[],
  learningRules: PrebookkeepingLearningRuleInput[] = [],
): PrebookkeepingCategorization {
  const columns = detectPrebookkeepingColumns(rows);
  const learnedRules = normalizeLearningRules(learningRules);
  const initialTransactions = rows.map((row, index) => normalizeTransaction(row, index, columns, learnedRules));
  const duplicateGroups = findPossibleDuplicates(initialTransactions);
  const duplicateRows = new Set(duplicateGroups.flatMap((group) => group.rowIndexes));
  const largeThreshold = detectLargeTransactionThreshold(initialTransactions);
  const transactions = initialTransactions.map((transaction) => ({
    ...transaction,
    duplicateStatus: duplicateRows.has(transaction.rowIndex) ? "possible_duplicate" as const : "none" as const,
    isLargeTransaction: typeof transaction.amount === "number" && Math.abs(transaction.amount) >= largeThreshold,
    needsReview:
      transaction.category === "uncategorized" ||
      transaction.confidence < 0.7 ||
      duplicateRows.has(transaction.rowIndex) ||
      transaction.vatStatus === "missing" ||
      !transaction.supplierCustomer,
  }));
  const categoryCounts = Object.fromEntries(categories.map((category) => [category, 0])) as Record<PrebookkeepingCategory, number>;

  for (const transaction of transactions) {
    categoryCounts[transaction.category] += 1;
  }

  const incomeTotal = roundMoney(
    transactions
      .filter((transaction) => transaction.category === "revenue")
      .reduce((sum, transaction) => sum + Math.max(transaction.amount || 0, 0), 0),
  );
  const expenseTotal = roundMoney(
    transactions
      .filter((transaction) => isExpenseCategory(transaction.category))
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount || transaction.debit || 0), 0),
  );
  const vatTaxRows = transactions.filter((transaction) => typeof transaction.vatTax === "number");
  const possibleDuplicates = duplicateGroups;
  const missingDataWarnings = buildMissingDataWarnings(columns, transactions);
  const reviewedCount = transactions.filter((transaction) => transaction.reviewed).length;
  const confidenceScore = Math.round(
    (transactions.reduce((sum, transaction) => sum + transaction.confidence, 0) / Math.max(transactions.length, 1)) * 100,
  );
  const vatMissingPercent = Math.round(
    (transactions.filter((transaction) => transaction.vatStatus === "missing").length / Math.max(transactions.length, 1)) * 100,
  );
  const reviewSummary = {
    transactionsAnalyzed: transactions.length,
    categorizedAutomatically: transactions.length - categoryCounts.uncategorized,
    requiresReview: transactions.filter((transaction) => transaction.needsReview).length,
    possibleDuplicatesDetected: possibleDuplicates.length,
    missingDataWarnings: missingDataWarnings.length,
    vatMissingPercent,
    confidenceScore,
    reviewedCount,
    reviewProgressPercent: Math.round((reviewedCount / Math.max(transactions.length, 1)) * 100),
    totalCount: transactions.length,
    progress: Math.round((reviewedCount / Math.max(transactions.length, 1)) * 100),
    status: "ready_for_review" as const,
  };

  return {
    status: "ready_for_review",
    generatedAt: new Date().toISOString(),
    rowCount: transactions.length,
    categorizedCount: transactions.length - categoryCounts.uncategorized,
    uncategorizedCount: categoryCounts.uncategorized,
    incomeTotal,
    expenseTotal,
    vatTaxSummary: {
      total: roundMoney(vatTaxRows.reduce((sum, transaction) => sum + Math.abs(transaction.vatTax || 0), 0)),
      rowsWithTax: vatTaxRows.length,
    },
    possibleDuplicates,
    missingDataWarnings,
    columns,
    categoryCounts,
    reviewSummary,
    recommendations: buildRecommendations({
      reviewSummary,
      categoryCounts,
      expenseTotal,
      incomeTotal,
    }),
    transactions,
  };
}

export function isPrebookkeepingCategorization(value: unknown): value is PrebookkeepingCategorization {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { status?: unknown }).status === "ready_for_review" &&
      Array.isArray((value as { transactions?: unknown }).transactions),
  );
}

export function createDefaultPrebookkeepingReviewSummary(
  totalCount: number,
  status: PrebookkeepingReviewStatus = "pending",
): PrebookkeepingReviewSummary {
  return {
    transactionsAnalyzed: totalCount,
    categorizedAutomatically: 0,
    requiresReview: totalCount,
    possibleDuplicatesDetected: 0,
    missingDataWarnings: 0,
    vatMissingPercent: totalCount > 0 ? 100 : 0,
    confidenceScore: 0,
    reviewedCount: 0,
    reviewProgressPercent: 0,
    totalCount,
    progress: 0,
    status,
  };
}

export function normalizePrebookkeepingCategorization(
  value: PrebookkeepingCategorization,
): PrebookkeepingCategorization {
  const rows = Array.isArray(value.transactions) ? value.transactions.map(normalizeCategorizedTransaction) : [];
  const possibleDuplicates = Array.isArray(value.possibleDuplicates) ? value.possibleDuplicates : [];
  const missingDataWarnings = Array.isArray(value.missingDataWarnings) ? value.missingDataWarnings : [];
  const categoryCounts = Object.fromEntries(categories.map((category) => [category, 0])) as Record<PrebookkeepingCategory, number>;
  for (const transaction of rows) categoryCounts[transaction.category] += 1;
  if (rows.length === 0 && isRecord(value.categoryCounts)) {
    for (const category of categories) categoryCounts[category] = numberOrDefault(value.categoryCounts[category], 0);
  }
  const existing: Record<string, unknown> = isRecord(value.reviewSummary) ? value.reviewSummary : {};
  const reviewedCount = numberOrDefault(existing.reviewedCount, rows.filter((transaction) => transaction.reviewed).length);
  const totalCount = numberOrDefault(existing.totalCount, numberOrDefault(existing.transactionsAnalyzed, rows.length));
  const progress = numberOrDefault(
    existing.progress,
    numberOrDefault(existing.reviewProgressPercent, Math.round((reviewedCount / Math.max(totalCount, 1)) * 100)),
  );
  const status = normalizeReviewStatus(existing.status, progress >= 100 && totalCount > 0 ? "ready_for_accountant" : "ready_for_review");

  const reviewSummary: PrebookkeepingReviewSummary = {
    transactionsAnalyzed: numberOrDefault(existing.transactionsAnalyzed, totalCount),
    categorizedAutomatically: numberOrDefault(existing.categorizedAutomatically, numberOrDefault(value.categorizedCount, rows.length - categoryCounts.uncategorized)),
    requiresReview: numberOrDefault(existing.requiresReview, rows.filter((transaction) => transaction.needsReview).length),
    possibleDuplicatesDetected: numberOrDefault(existing.possibleDuplicatesDetected, possibleDuplicates.length),
    missingDataWarnings: numberOrDefault(existing.missingDataWarnings, missingDataWarnings.length),
    vatMissingPercent: numberOrDefault(
      existing.vatMissingPercent,
      Math.round((rows.filter((transaction) => transaction.vatStatus === "missing").length / Math.max(totalCount, 1)) * 100),
    ),
    confidenceScore: numberOrDefault(
      existing.confidenceScore,
      Math.round((rows.reduce((sum, transaction) => sum + transaction.confidence, 0) / Math.max(rows.length, 1)) * 100),
    ),
    reviewedCount,
    reviewProgressPercent: numberOrDefault(existing.reviewProgressPercent, progress),
    totalCount,
    progress,
    status,
  };

  return {
    ...value,
    categoryCounts,
    categorizedCount: rows.length - categoryCounts.uncategorized,
    uncategorizedCount: categoryCounts.uncategorized,
    transactions: rows,
    reviewSummary,
    recommendations: Array.isArray(value.recommendations) && value.recommendations.length > 0
      ? value.recommendations
      : buildRecommendations({
          reviewSummary,
          categoryCounts,
          expenseTotal: numberOrDefault(value.expenseTotal, 0),
          incomeTotal: numberOrDefault(value.incomeTotal, 0),
        }),
  };
}

function normalizeCategorizedTransaction(value: unknown, index: number): CategorizedTransaction {
  const row = isRecord(value) ? value : {};
  const category = normalizeReviewCategory(row.category);
  const suggested = normalizeReviewCategory(row.suggestedCategory);
  return {
    rowIndex: typeof row.rowIndex === "number" && Number.isInteger(row.rowIndex) ? row.rowIndex : index,
    transactionDate: stringOrNull(row.transactionDate),
    description: stringOrNull(row.description),
    supplierCustomer: stringOrNull(row.supplierCustomer),
    debit: nullableNumber(row.debit),
    credit: nullableNumber(row.credit),
    amount: nullableNumber(row.amount),
    currency: stringOrNull(row.currency),
    vatTax: nullableNumber(row.vatTax),
    category,
    suggestedCategory: suggested === "uncategorized" ? null : suggested,
    sourceCategory: stringOrNull(row.sourceCategory),
    invoiceReference: stringOrNull(row.invoiceReference),
    confidence: clamp(numberOrDefault(row.confidence, 0), 0, 1),
    reasons: Array.isArray(row.reasons) ? row.reasons.map((reason) => String(reason ?? "")).filter(Boolean) : [],
    reviewed: row.reviewed === true,
    needsReview: row.needsReview === true || category === "uncategorized",
    reviewStatus: row.reviewStatus === "reviewed" ? "reviewed" : "pending",
    duplicateStatus: normalizeDuplicateStatus(row.duplicateStatus),
    vatStatus: row.vatStatus === "present" ? "present" : "missing",
    vatRate: nullableNumber(row.vatRate),
    isLargeTransaction: row.isLargeTransaction === true,
  };
}

function detectPrebookkeepingColumns(rows: Record<string, unknown>[]) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const find = (...patterns: RegExp[]) => headers.find((header) => patterns.some((pattern) => pattern.test(normalizeHeader(header)))) || null;

  return {
    transactionDate: find(/^(transaction)?date$/, /postingdate|bookingdate|valuedate|datum|orderdate/),
    description: find(/description|details|memo|omschrijving|narrative|merchant|payee|name/),
    supplierCustomer: find(/supplier|vendor|customer|client|merchant|payee|counterparty|debtor|creditor/),
    debit: find(/^debit$/, /withdrawal|paidout|afschrijving|moneyout/),
    credit: find(/^credit$/, /deposit|paidin|bijschrijving|moneyin/),
    amount: find(/^amount$/, /transactionamount|bedrag|value|total|gross/),
    currency: find(/currency|valuta|ccy/),
    vatTax: find(/vattax|taxvat|vatamount|taxamount|gstamount|btwamount|sales.?tax.?amount|vatvalue|taxvalue/, /^vat$|^tax$|^gst$|^btw$|sales.?tax/),
    category: find(/^category$/, /account|ledger|classification|type/),
    invoiceReference: find(/invoice|reference|ref|document|receipt|number|transactionid/),
  };
}

function normalizeTransaction(
  row: Record<string, unknown>,
  rowIndex: number,
  columns: ReturnType<typeof detectPrebookkeepingColumns>,
  learningRules: NormalizedLearningRule[],
): CategorizedTransaction {
  const debit = readNumber(row, columns.debit);
  const credit = readNumber(row, columns.credit);
  const explicitAmount = readNumber(row, columns.amount);
  const amount =
    typeof explicitAmount === "number"
      ? explicitAmount
      : typeof credit === "number" && credit !== 0
        ? Math.abs(credit)
        : typeof debit === "number" && debit !== 0
          ? -Math.abs(debit)
          : null;
  const description = readText(row, columns.description);
  const supplierCustomer = readText(row, columns.supplierCustomer) || inferParty(description);
  const sourceCategory = readText(row, columns.category);
  const vatTax = readNumber(row, columns.vatTax);
  const categoryResult = classifyTransaction({
    amount,
    debit,
    credit,
    description,
    supplierCustomer,
    sourceCategory,
  }, learningRules);
  const suggestedCategory = categoryResult.category === "uncategorized"
    ? suggestFallbackCategory(amount)
    : categoryResult.category;
  const needsReview = categoryResult.category === "uncategorized" || categoryResult.confidence < 0.7 || vatTax === null || !supplierCustomer;

  return {
    rowIndex,
    transactionDate: readText(row, columns.transactionDate),
    description,
    supplierCustomer,
    debit,
    credit,
    amount,
    currency: readText(row, columns.currency),
    vatTax,
    category: categoryResult.category,
    suggestedCategory,
    sourceCategory,
    invoiceReference: readText(row, columns.invoiceReference),
    confidence: categoryResult.confidence,
    reasons: categoryResult.reasons,
    reviewed: false,
    needsReview,
    reviewStatus: "pending",
    duplicateStatus: "none",
    vatStatus: vatTax === null ? "missing" : "present",
    vatRate: null,
    isLargeTransaction: false,
  };
}

function classifyTransaction(input: {
  amount: number | null;
  debit: number | null;
  credit: number | null;
  description: string | null;
  supplierCustomer: string | null;
  sourceCategory: string | null;
}, learningRules: NormalizedLearningRule[]): { category: PrebookkeepingCategory; confidence: number; reasons: string[] } {
  const text = [input.description, input.supplierCustomer, input.sourceCategory].filter(Boolean).join(" ").toLowerCase();
  const reasons: string[] = [];
  const has = (pattern: RegExp, reason: string) => {
    if (!pattern.test(text)) return false;
    reasons.push(reason);
    return true;
  };

  const learnedMatch = learningRules.find((rule) => {
    if (rule.supplierKey && input.supplierCustomer?.toLowerCase().includes(rule.supplierKey)) return true;
    if (rule.merchantKey && text.includes(rule.merchantKey)) return true;
    if (rule.descriptionKeyword && text.includes(rule.descriptionKeyword)) return true;
    return false;
  });

  if (learnedMatch) {
    return {
      category: learnedMatch.category,
      confidence: 0.96,
      reasons: ["learned user rule"],
    };
  }

  if (has(/salary|payroll|wage|employee|pension|social security|gross salary/i, "payroll keyword")) {
    return { category: "payroll", confidence: 0.9, reasons };
  }
  if (has(/vat|tax|hmrc|irs|belasting|btw|corporate tax|sales tax/i, "tax keyword")) {
    return { category: "taxes", confidence: 0.9, reasons };
  }
  if (has(/bank fee|service charge|card fee|transaction fee|stripe fee|square fee|paypal fee/i, "bank or payment fee keyword")) {
    return { category: "bank_fees", confidence: 0.86, reasons };
  }
  if (has(/transfer|internal transfer|savings|owner draw|capital injection|loan repayment/i, "transfer keyword")) {
    return { category: "transfers", confidence: 0.82, reasons };
  }
  if (has(/asset|equipment|computer|furniture|vehicle/i, "asset keyword")) {
    return { category: "assets", confidence: 0.78, reasons };
  }
  if (has(/loan|liability|credit card payable|accounts payable/i, "liability keyword")) {
    return { category: "liabilities", confidence: 0.78, reasons };
  }
  if (has(/owner contribution|share capital|equity|retained earnings/i, "equity keyword")) {
    return { category: "equity", confidence: 0.78, reasons };
  }
  if (has(/rent|lease|insurance|subscription|software|hosting|utilities|internet|phone/i, "fixed-cost keyword")) {
    return { category: "fixed_costs", confidence: 0.8, reasons };
  }
  if (has(/office|travel|meal|supplies|marketing|advertising|freight|shipping|expense|cost/i, "operating expense keyword")) {
    return { category: "operating_expenses", confidence: 0.75, reasons };
  }
  if (has(/sale|sales|revenue|invoice paid|customer payment|deposit|income/i, "revenue keyword") || (typeof input.amount === "number" && input.amount > 0 && input.credit !== null)) {
    reasons.push("positive credited amount");
    return { category: "revenue", confidence: 0.72, reasons };
  }
  if (typeof input.amount === "number" && input.amount < 0) {
    reasons.push("negative amount");
    return { category: "operating_expenses", confidence: 0.55, reasons };
  }

  return { category: "uncategorized", confidence: 0.2, reasons: ["no deterministic category signal"] };
}

type NormalizedLearningRule = {
  supplierKey: string | null;
  descriptionKeyword: string | null;
  merchantKey: string | null;
  category: PrebookkeepingCategory;
}

function normalizeLearningRules(rules: PrebookkeepingLearningRuleInput[]): NormalizedLearningRule[] {
  return rules
    .map((rule) => ({
      supplierKey: normalizeRuleKey(rule.supplierKey),
      descriptionKeyword: normalizeRuleKey(rule.descriptionKeyword),
      merchantKey: normalizeRuleKey(rule.merchantKey),
      category: normalizeReviewCategory(rule.category),
    }))
    .filter((rule) => rule.category !== "uncategorized" && (rule.supplierKey || rule.descriptionKeyword || rule.merchantKey));
}

export function normalizeReviewCategory(value: unknown): PrebookkeepingCategory {
  const normalized = String(value || "").toLowerCase().replace(/[\s-]+/g, "_");
  return categories.includes(normalized as PrebookkeepingCategory) ? normalized as PrebookkeepingCategory : "uncategorized";
}

function normalizeRuleKey(value: unknown) {
  const text = String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  return text.length >= 3 ? text.slice(0, 120) : null;
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeReviewStatus(value: unknown, fallback: PrebookkeepingReviewStatus): PrebookkeepingReviewStatus {
  if (
    value === "pending" ||
    value === "processing" ||
    value === "ready_for_review" ||
    value === "ready_for_accountant" ||
    value === "failed"
  ) {
    return value;
  }
  return fallback;
}

function normalizeDuplicateStatus(value: unknown): CategorizedTransaction["duplicateStatus"] {
  if (value === "possible_duplicate" || value === "keep_both" || value === "merged" || value === "ignored") return value;
  return "none";
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function nullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function suggestFallbackCategory(amount: number | null): PrebookkeepingReviewCategory | null {
  if (typeof amount !== "number") return "other";
  return amount >= 0 ? "revenue" : "operating_expenses";
}

function detectLargeTransactionThreshold(transactions: CategorizedTransaction[]) {
  const amounts = transactions
    .map((transaction) => Math.abs(transaction.amount || 0))
    .filter((amount) => amount > 0)
    .sort((a, b) => a - b);
  if (amounts.length === 0) return Number.POSITIVE_INFINITY;
  return amounts[Math.max(Math.floor(amounts.length * 0.9) - 1, 0)] || Number.POSITIVE_INFINITY;
}

function buildRecommendations(input: {
  reviewSummary: PrebookkeepingCategorization["reviewSummary"];
  categoryCounts: Record<PrebookkeepingCategory, number>;
  expenseTotal: number;
  incomeTotal: number;
}) {
  const recommendations: string[] = [];
  if (input.reviewSummary.requiresReview > 0) recommendations.push("Review uncategorized and low-confidence transactions first.");
  if (input.reviewSummary.possibleDuplicatesDetected > 0) recommendations.push("Verify possible duplicate transactions before export.");
  if (input.reviewSummary.vatMissingPercent > 0) recommendations.push("Complete VAT information before exporting reviewed data.");
  if (input.categoryCounts.fixed_costs > 0 && input.expenseTotal > input.incomeTotal * 0.5) recommendations.push("Fixed costs appear unusually high this period.");
  if (recommendations.length === 0) recommendations.push("All detected bookkeeping items are ready for accountant review.");
  return recommendations;
}

function findPossibleDuplicates(transactions: CategorizedTransaction[]) {
  const groups = new Map<string, number[]>();

  for (const transaction of transactions) {
    if (!transaction.transactionDate || !transaction.description || typeof transaction.amount !== "number") continue;
    const key = `${transaction.transactionDate}|${transaction.description.toLowerCase().replace(/\s+/g, " ").trim()}|${transaction.amount.toFixed(2)}`;
    const existing = groups.get(key) || [];
    existing.push(transaction.rowIndex);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .filter(([, rowIndexes]) => rowIndexes.length > 1)
    .map(([key, rowIndexes]) => ({ key, count: rowIndexes.length, rowIndexes }))
    .slice(0, 20);
}

function buildMissingDataWarnings(
  columns: PrebookkeepingCategorization["columns"],
  transactions: CategorizedTransaction[],
) {
  const warnings: string[] = [];
  if (!columns.transactionDate) warnings.push("Transaction date column was not detected.");
  if (!columns.description) warnings.push("Description column was not detected.");
  if (!columns.amount && !columns.debit && !columns.credit) warnings.push("Amount, debit, or credit columns were not detected.");
  if (!columns.currency) warnings.push("Currency column was not detected.");
  if (!columns.vatTax) warnings.push("VAT/tax column was not detected.");

  const missingDates = transactions.filter((transaction) => !transaction.transactionDate).length;
  const missingDescriptions = transactions.filter((transaction) => !transaction.description).length;
  const missingAmounts = transactions.filter((transaction) => transaction.amount === null).length;
  if (missingDates > 0) warnings.push(`${missingDates} transaction(s) are missing a date.`);
  if (missingDescriptions > 0) warnings.push(`${missingDescriptions} transaction(s) are missing a description.`);
  if (missingAmounts > 0) warnings.push(`${missingAmounts} transaction(s) are missing an amount.`);
  return warnings;
}

function isExpenseCategory(category: PrebookkeepingCategory) {
  return category === "operating_expenses" || category === "payroll" || category === "fixed_costs" || category === "taxes" || category === "bank_fees";
}

function readText(row: Record<string, unknown>, column: string | null) {
  if (!column) return null;
  const value = row[column];
  const text = String(value ?? "").trim();
  return text || null;
}

function readNumber(row: Record<string, unknown>, column: string | null) {
  if (!column) return null;
  return parseMoney(row[column]);
}

function parseMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const withoutCurrencyWords = text.replace(/\b(EUR|USD|GBP|CHF|HUF|RON|CAD|AUD)\b/gi, "");
  if (/[A-Za-z]/.test(withoutCurrencyWords)) return null;
  const negative = /^\(.*\)$/.test(text);
  const cleaned = withoutCurrencyWords
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function inferParty(description: string | null) {
  if (!description) return null;
  return description.split(/[-–|]/)[0]?.trim() || null;
}

function normalizeHeader(header: unknown) {
  const safeHeader = typeof header === "string" ? header : String(header ?? "");
  return safeHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
