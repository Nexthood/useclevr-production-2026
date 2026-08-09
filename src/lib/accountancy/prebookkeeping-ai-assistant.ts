import {
  normalizePrebookkeepingCategorization,
  type CategorizedTransaction,
  type PrebookkeepingCategorization,
  type PrebookkeepingCategory,
} from "@/lib/accountancy/prebookkeeping-categorization";

export const prebookkeepingSuggestedQuestions = [
  "What are my largest expenses?",
  "Which transactions still need review?",
  "Show possible duplicates.",
  "Which suppliers received the most money?",
  "How much income and expense was recorded?",
  "Which transactions are missing VAT?",
  "Summarize fixed costs.",
  "What should I review before accountant export?",
  "Show uncategorized transactions.",
  "Are there unusual transactions this period?",
];

export type PrebookkeepingAssistantAnswer = {
  answer: string;
  insight: string;
  explanation: string;
  recommendation: string;
  data: Record<string, unknown>[];
  chartType: "table" | "bar" | "summary";
  result: {
    type: "prebookkeeping_direct_analysis";
    intent: string;
    rowCount: number;
  };
};

export function answerPrebookkeepingQuestionDeterministically(input: {
  question: string;
  categorization: PrebookkeepingCategorization;
}): PrebookkeepingAssistantAnswer {
  const categorization = normalizePrebookkeepingCategorization(input.categorization);
  const question = input.question.toLowerCase();
  const transactions = categorization.transactions;

  if (/duplicate/.test(question)) {
    const rows = transactions.filter((transaction) => transaction.duplicateStatus === "possible_duplicate").slice(0, 10);
    return buildAnswer({
      intent: "duplicates",
      title: `${categorization.possibleDuplicates.length.toLocaleString()} possible duplicate group(s) need review.`,
      evidence: rows.map(describeTransaction),
      takeaway: rows.length > 0 ? "Duplicate candidates should be reviewed before accountant export." : "No possible duplicates are currently flagged.",
      nextAction: rows.length > 0 ? "Use Keep both, Merge, or Ignore on each duplicate candidate." : "Continue reviewing uncategorized or missing VAT transactions.",
      data: rows.map(transactionData),
      chartType: "table",
      rowCount: transactions.length,
    });
  }

  if (/missing.*vat|vat.*missing|tax.*missing/.test(question)) {
    const rows = transactions.filter((transaction) => transaction.vatStatus === "missing").slice(0, 10);
    return buildAnswer({
      intent: "missing_vat",
      title: `${rows.length.toLocaleString()} sampled transaction(s) are missing VAT/tax values.`,
      evidence: [
        `VAT information is missing on ${categorization.reviewSummary.vatMissingPercent}% of all transactions.`,
        ...rows.slice(0, 5).map(describeTransaction),
      ],
      takeaway: "VAT gaps reduce accountant export quality and should be completed before handoff.",
      nextAction: "Filter Missing VAT and apply the correct quick VAT rate or custom value.",
      data: rows.map(transactionData),
      chartType: "table",
      rowCount: transactions.length,
    });
  }

  if (/uncategorized|unclassified/.test(question)) {
    const rows = transactions.filter((transaction) => transaction.category === "uncategorized").slice(0, 10);
    return buildAnswer({
      intent: "uncategorized",
      title: `${categorization.uncategorizedCount.toLocaleString()} transaction(s) are uncategorized.`,
      evidence: rows.map(describeTransaction),
      takeaway: rows.length > 0 ? "Uncategorized rows are the first blocker for a clean accountant export." : "All transactions currently have a category.",
      nextAction: rows.length > 0 ? "Accept high-confidence suggestions or change the category manually." : "Review duplicates and missing VAT next.",
      data: rows.map(transactionData),
      chartType: "table",
      rowCount: transactions.length,
    });
  }

  if (/review|accountant|export/.test(question)) {
    const summary = categorization.reviewSummary;
    const blockers = [
      `${summary.requiresReview.toLocaleString()} transaction(s) require review`,
      `${summary.possibleDuplicatesDetected.toLocaleString()} duplicate group(s) flagged`,
      `${summary.vatMissingPercent}% VAT/tax missing`,
    ];
    return buildAnswer({
      intent: "review_readiness",
      title: `${summary.reviewedCount.toLocaleString()} of ${summary.totalCount.toLocaleString()} transactions are reviewed.`,
      evidence: blockers,
      takeaway: summary.progress >= 100 ? "This dataset is ready for accountant export." : "The accountant export should wait until review blockers are cleared.",
      nextAction: "Review uncategorized, duplicate, missing supplier, and missing VAT transactions first.",
      data: [{
        reviewedCount: summary.reviewedCount,
        totalCount: summary.totalCount,
        progress: summary.progress,
        requiresReview: summary.requiresReview,
        possibleDuplicates: summary.possibleDuplicatesDetected,
        vatMissingPercent: summary.vatMissingPercent,
      }],
      chartType: "summary",
      rowCount: transactions.length,
    });
  }

  if (/income|expense|revenue|spend|recorded|summary|month/.test(question)) {
    const capabilities = prebookkeepingCapabilities(transactions);
    if (isExpenseOnlyQuestion(question)) {
      if (!capabilities.hasExpenseData) {
        return buildAnswer({
          intent: "largest_expenses_unavailable",
          title: "No expense or cost data was detected in this dataset, so I can't reliably determine your largest expenses.",
          evidence: ["No validated expense category, cost field, debit classification, or trusted expense mapping was found."],
          takeaway: "UseClevr will not classify generic numeric values as expenses.",
          nextAction: "Map transaction type, category, debit, expense, cost, COGS, or supplier cost fields before asking for expense rankings.",
          data: [{ capability: "expense_data", status: "unavailable" }],
          chartType: "table",
          rowCount: transactions.length,
        });
      }
      const expenseRows = expenseBreakdown(transactions);
      return buildAnswer({
        intent: "largest_expenses",
        title: expenseRows[0]
          ? `${expenseRows[0].category} is the largest detected expense/cost category at ${formatMoney(expenseRows[0].total, currencyFor(transactions))}.`
          : "No expense rows with numeric values were found.",
        evidence: expenseRows.slice(0, 5).map((row) => `${row.category}: ${formatMoney(row.total, currencyFor(transactions))} across ${row.count} transaction(s)`),
        takeaway: "Expense rankings use only validated expense/cost categories.",
        nextAction: "Review category assignments before exporting the accountant package.",
        data: expenseRows,
        chartType: "bar",
        rowCount: transactions.length,
      });
    }
    if (isIncomeExpenseComparisonQuestion(question) && (!capabilities.hasExpenseData || !capabilities.hasIncomeData)) {
      const missing = [
        !capabilities.hasIncomeData ? "income/revenue" : null,
        !capabilities.hasExpenseData ? "expense/cost" : null,
      ].filter(Boolean).join(" and ");
      return buildAnswer({
        intent: "income_expense_summary_unavailable",
        title: `I can't calculate income versus expenses because validated ${missing} data is unavailable.`,
        evidence: [
          capabilities.hasIncomeData ? "Income/revenue semantics were detected." : "No validated income/revenue semantics were detected.",
          capabilities.hasExpenseData ? "Expense/cost semantics were detected." : "No validated expense category, cost field, debit classification, or trusted expense mapping was found.",
        ],
        takeaway: "UseClevr will not compare income and expenses unless both sides are semantically validated.",
        nextAction: "Map transaction type, category, debit/credit, revenue, or expense fields before asking for an income and expense summary.",
        data: [
          { capability: "income_data", status: capabilities.hasIncomeData ? "available" : "unavailable" },
          { capability: "expense_data", status: capabilities.hasExpenseData ? "available" : "unavailable" },
        ],
        chartType: "table",
        rowCount: transactions.length,
      });
    }
    const categoryRows = categoryBreakdown(transactions);
    return buildAnswer({
      intent: "income_expense_summary",
      title: `Income is ${formatMoney(categorization.incomeTotal, currencyFor(transactions))}; expenses are ${formatMoney(categorization.expenseTotal, currencyFor(transactions))}.`,
      evidence: [
        `${categorization.rowCount.toLocaleString()} transactions analyzed.`,
        `${categorization.vatTaxSummary.rowsWithTax.toLocaleString()} transaction(s) contain VAT/tax values totaling ${formatMoney(categorization.vatTaxSummary.total, currencyFor(transactions))}.`,
        ...categoryRows.slice(0, 5).map((row) => `${row.category}: ${formatMoney(row.total, currencyFor(transactions))} across ${row.count} transaction(s)`),
      ],
      takeaway: categorization.expenseTotal > categorization.incomeTotal ? "Expenses exceed income in the reviewed bookkeeping data." : "Income covers detected expenses in the reviewed bookkeeping data.",
      nextAction: "Review category assignments before exporting the accountant package.",
      data: categoryRows,
      chartType: "bar",
      rowCount: transactions.length,
    });
  }

  if (/supplier|vendor|merchant|paid|received/.test(question)) {
    const capabilities = prebookkeepingCapabilities(transactions);
    if (!capabilities.hasExpenseData) {
      return buildAnswer({
        intent: "top_suppliers_unavailable",
        title: "No expense or cost data was detected, so supplier spending cannot be calculated reliably.",
        evidence: ["No validated expense category, cost field, debit classification, or trusted expense mapping was found."],
        takeaway: "UseClevr will not classify generic transaction values as supplier expenses.",
        nextAction: "Map supplier plus expense, cost, debit, or transaction type fields before asking for supplier spending.",
        data: [{ capability: "expense_data", status: "unavailable" }],
        chartType: "table",
        rowCount: transactions.length,
      });
    }
    const rows = groupBySupplier(transactions).slice(0, 10);
    return buildAnswer({
      intent: "top_suppliers",
      title: rows[0]
        ? `${rows[0].supplier} received the most money: ${formatMoney(rows[0].expenseTotal, currencyFor(transactions))}.`
        : "No supplier spending could be calculated.",
      evidence: rows.slice(0, 5).map((row) => `${row.supplier}: ${formatMoney(row.expenseTotal, currencyFor(transactions))} across ${row.count} transaction(s)`),
      takeaway: rows.length > 0 ? "Supplier concentration is visible from reviewed transaction amounts." : "Supplier names are missing or no expenses were detected.",
      nextAction: "Open Missing Supplier if supplier names look incomplete.",
      data: rows,
      chartType: "bar",
      rowCount: transactions.length,
    });
  }

  if (/fixed/.test(question)) {
    const rows = transactions.filter((transaction) => transaction.category === "fixed_costs").slice(0, 10);
    const total = sumAbs(rows);
    return buildAnswer({
      intent: "fixed_costs",
      title: `Fixed costs total ${formatMoney(total, currencyFor(transactions))} in the sampled matching rows.`,
      evidence: rows.slice(0, 5).map(describeTransaction),
      takeaway: rows.length > 0 ? "Fixed costs are recurring-style expenses that should be checked for period accuracy." : "No fixed-cost transactions are currently categorized.",
      nextAction: "Review Fixed Costs and confirm recurring suppliers before export.",
      data: rows.map(transactionData),
      chartType: "table",
      rowCount: transactions.length,
    });
  }

  const rows = [...transactions].sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0)).slice(0, 10);
  return buildAnswer({
    intent: "unusual_transactions",
    title: rows[0]
      ? `The largest transaction is ${formatMoney(rows[0].amount || 0, currencyFor(transactions))}: ${rows[0].description || rows[0].supplierCustomer || "Unnamed transaction"}.`
      : "No transactions are available for direct analysis.",
    evidence: rows.slice(0, 5).map(describeTransaction),
    takeaway: "Large and low-confidence transactions are the best first review targets.",
    nextAction: "Filter Large Transactions and Needs Review before accountant export.",
    data: rows.map(transactionData),
    chartType: "table",
    rowCount: transactions.length,
  });
}

function buildAnswer(input: {
  intent: string;
  title: string;
  evidence: string[];
  takeaway: string;
  nextAction: string;
  data: Record<string, unknown>[];
  chartType: "table" | "bar" | "summary";
  rowCount: number;
}): PrebookkeepingAssistantAnswer {
  const evidence = input.evidence.length > 0 ? input.evidence : ["No matching transaction rows were found."];
  const answer = [
    `Answer\n${input.title}`,
    `Evidence\n${evidence.map((item) => `- ${item}`).join("\n")}`,
    `Takeaway\n${input.takeaway}`,
    `Next action\n${input.nextAction}`,
  ].join("\n\n");

  return {
    answer,
    insight: input.title,
    explanation: "Direct data analysis used the selected pre-bookkeeping dataset, normalized transactions, review summary, and deterministic calculations.",
    recommendation: input.nextAction,
    data: input.data,
    chartType: input.chartType,
    result: {
      type: "prebookkeeping_direct_analysis",
      intent: input.intent,
      rowCount: input.rowCount,
    },
  };
}

function describeTransaction(transaction: CategorizedTransaction) {
  const label = transaction.description || transaction.supplierCustomer || `Row ${transaction.rowIndex + 1}`;
  return `${label}: ${formatMoney(transaction.amount || 0, transaction.currency)} (${formatCategory(transaction.category)})`;
}

function transactionData(transaction: CategorizedTransaction) {
  return {
    rowIndex: transaction.rowIndex,
    date: transaction.transactionDate,
    description: transaction.description,
    supplier: transaction.supplierCustomer,
    amount: transaction.amount,
    currency: transaction.currency,
    category: transaction.category,
    confidence: Math.round(transaction.confidence * 100),
    reviewed: transaction.reviewed,
    vatStatus: transaction.vatStatus,
    duplicateStatus: transaction.duplicateStatus,
  };
}

function groupBySupplier(transactions: CategorizedTransaction[]) {
  const groups = new Map<string, { supplier: string; expenseTotal: number; count: number }>();
  for (const transaction of transactions) {
    if (!isExpense(transaction) || !transaction.supplierCustomer) continue;
    const current = groups.get(transaction.supplierCustomer) ?? { supplier: transaction.supplierCustomer, expenseTotal: 0, count: 0 };
    current.expenseTotal += Math.abs(transaction.amount || transaction.debit || 0);
    current.count += 1;
    groups.set(transaction.supplierCustomer, current);
  }
  return Array.from(groups.values())
    .map((row) => ({ ...row, expenseTotal: roundMoney(row.expenseTotal) }))
    .sort((a, b) => b.expenseTotal - a.expenseTotal);
}

function categoryBreakdown(transactions: CategorizedTransaction[]) {
  const groups = new Map<PrebookkeepingCategory, { category: string; total: number; count: number }>();
  for (const transaction of transactions) {
    const current = groups.get(transaction.category) ?? { category: formatCategory(transaction.category), total: 0, count: 0 };
    current.total += Math.abs(transaction.amount || 0);
    current.count += 1;
    groups.set(transaction.category, current);
  }
  return Array.from(groups.values())
    .map((row) => ({ ...row, total: roundMoney(row.total) }))
    .sort((a, b) => b.total - a.total);
}

function expenseBreakdown(transactions: CategorizedTransaction[]) {
  return categoryBreakdown(transactions.filter(isValidatedExpense));
}

function isExpense(transaction: CategorizedTransaction) {
  return isValidatedExpense(transaction);
}

function sumAbs(transactions: CategorizedTransaction[]) {
  return roundMoney(transactions.reduce((total, transaction) => total + Math.abs(transaction.amount || transaction.debit || 0), 0));
}

function currencyFor(transactions: CategorizedTransaction[]) {
  return transactions.find((transaction) => transaction.currency)?.currency || null;
}

function formatMoney(value: number, currency: string | null) {
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatCategory(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isExpenseOnlyQuestion(question: string) {
  return /expense|expenses|spend|spending|cost|costs|opex|money\s+going/i.test(question) &&
    /largest|biggest|top|most|where|show|which|category/i.test(question) &&
    !/income|revenue/.test(question);
}

function isIncomeExpenseComparisonQuestion(question: string) {
  return /income|revenue/.test(question) && /expense|expenses|spend|spending|cost|costs/.test(question);
}

function prebookkeepingCapabilities(transactions: CategorizedTransaction[]) {
  return {
    hasIncomeData: transactions.some(isValidatedIncome),
    hasExpenseData: transactions.some(isValidatedExpense),
  };
}

function isValidatedIncome(transaction: CategorizedTransaction) {
  if (transaction.category === "revenue" && hasSemanticReason(transaction, /revenue|income|sale|customer payment|positive credited|learned user rule/i)) return true;
  return typeof transaction.credit === "number" && transaction.credit > 0;
}

function isValidatedExpense(transaction: CategorizedTransaction) {
  if (!["operating_expenses", "payroll", "fixed_costs", "taxes", "bank_fees"].includes(transaction.category)) return false;
  if (typeof transaction.debit === "number" && transaction.debit > 0) return true;
  if (hasSemanticReason(transaction, /payroll|tax|bank|fee|fixed|operating expense|expense|cost|learned user rule/i)) return true;
  return hasSourceCategory(transaction, /expense|cost|cogs|opex|debit|payroll|tax|fee/i);
}

function hasSemanticReason(transaction: CategorizedTransaction, pattern: RegExp) {
  return transaction.reasons.some((reason) => pattern.test(reason));
}

function hasSourceCategory(transaction: CategorizedTransaction, pattern: RegExp) {
  return pattern.test(String(transaction.sourceCategory ?? ""));
}
