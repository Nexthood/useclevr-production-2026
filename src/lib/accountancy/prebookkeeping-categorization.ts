export type PrebookkeepingCategory =
  | "revenue"
  | "operating_expenses"
  | "payroll"
  | "fixed_costs"
  | "taxes"
  | "bank_fees"
  | "transfers"
  | "uncategorized";

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
  sourceCategory: string | null;
  invoiceReference: string | null;
  confidence: number;
  reasons: string[];
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
  transactions: CategorizedTransaction[];
}

const categories: PrebookkeepingCategory[] = [
  "revenue",
  "operating_expenses",
  "payroll",
  "fixed_costs",
  "taxes",
  "bank_fees",
  "transfers",
  "uncategorized",
];

export function categorizePrebookkeepingRows(rows: Record<string, unknown>[]): PrebookkeepingCategorization {
  const columns = detectPrebookkeepingColumns(rows);
  const transactions = rows.map((row, index) => normalizeTransaction(row, index, columns));
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
  const possibleDuplicates = findPossibleDuplicates(transactions);
  const missingDataWarnings = buildMissingDataWarnings(columns, transactions);

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
    vatTax: find(/vatamount|taxamount|gstamount|btwamount|sales.?tax.?amount|vatvalue|taxvalue/, /^vat$|^tax$|^gst$|^btw$|sales.?tax/),
    category: find(/^category$/, /account|ledger|classification|type/),
    invoiceReference: find(/invoice|reference|ref|document|receipt|number|transactionid/),
  };
}

function normalizeTransaction(
  row: Record<string, unknown>,
  rowIndex: number,
  columns: ReturnType<typeof detectPrebookkeepingColumns>,
): CategorizedTransaction {
  const debit = readNumber(row, columns.debit);
  const credit = readNumber(row, columns.credit);
  const explicitAmount = readNumber(row, columns.amount);
  const amount = typeof explicitAmount === "number" ? explicitAmount : typeof credit === "number" ? Math.abs(credit) : typeof debit === "number" ? -Math.abs(debit) : null;
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
  });

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
    sourceCategory,
    invoiceReference: readText(row, columns.invoiceReference),
    confidence: categoryResult.confidence,
    reasons: categoryResult.reasons,
  };
}

function classifyTransaction(input: {
  amount: number | null;
  debit: number | null;
  credit: number | null;
  description: string | null;
  supplierCustomer: string | null;
  sourceCategory: string | null;
}): { category: PrebookkeepingCategory; confidence: number; reasons: string[] } {
  const text = [input.description, input.supplierCustomer, input.sourceCategory].filter(Boolean).join(" ").toLowerCase();
  const reasons: string[] = [];
  const has = (pattern: RegExp, reason: string) => {
    if (!pattern.test(text)) return false;
    reasons.push(reason);
    return true;
  };

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

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
