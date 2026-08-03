import {
  normalizePrebookkeepingCategorization,
  type CategorizedTransaction,
  type PrebookkeepingCategorization,
} from "@/lib/accountancy/prebookkeeping-categorization";
import * as XLSX from "xlsx";

export const prebookkeepingExportFormats = ["csv", "excel", "datev", "quickbooks", "xero"] as const;

export type PrebookkeepingExportFormat = (typeof prebookkeepingExportFormats)[number];

export type PrebookkeepingExportResult = {
  body: string | Uint8Array;
  contentType: string;
  filename: string;
  format: PrebookkeepingExportFormat;
  rowCount: number;
  metadata: {
    generatedAt: string;
    reviewedRows: number;
    format: PrebookkeepingExportFormat;
  };
};

export class PrebookkeepingExportError extends Error {
  constructor(
    public readonly stage: "validation" | "setup" | "generation",
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = "PrebookkeepingExportError";
  }
}

export function isPrebookkeepingExportFormat(value: unknown): value is PrebookkeepingExportFormat {
  return prebookkeepingExportFormats.includes(value as PrebookkeepingExportFormat);
}

export function buildPrebookkeepingExport(input: {
  datasetName: string;
  categorization: PrebookkeepingCategorization;
  format: PrebookkeepingExportFormat;
}): PrebookkeepingExportResult {
  const categorization = normalizePrebookkeepingCategorization(input.categorization);
  const rows = categorization.transactions.filter((transaction) =>
    transaction.reviewed && transaction.duplicateStatus !== "merged"
  );

  if (rows.length === 0) {
    throw new PrebookkeepingExportError("validation", "Review at least one transaction before exporting.");
  }

  const filenameBase = safeFileName(input.datasetName);
  const generatedAt = new Date().toISOString();
  const metadata = {
    generatedAt,
    reviewedRows: rows.length,
    format: input.format,
  };

  if (input.format === "excel") {
    return {
      body: buildExcelWorkbook(rows, categorization),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${filenameBase}-accountant-export.xlsx`,
      format: input.format,
      rowCount: rows.length,
      metadata,
    };
  }

  if (input.format === "datev") {
    const datevRows = buildDatevRows(rows);
    return {
      body: withBom(toCsv(datevRows, ";")),
      contentType: "text/csv; charset=utf-8",
      filename: `${filenameBase}-datev-export.csv`,
      format: input.format,
      rowCount: rows.length,
      metadata,
    };
  }

  if (input.format === "quickbooks") {
    const quickBooksRows = buildQuickBooksRows(rows);
    return {
      body: withBom(toCsv(quickBooksRows)),
      contentType: "text/csv; charset=utf-8",
      filename: `${filenameBase}-quickbooks-export.csv`,
      format: input.format,
      rowCount: rows.length,
      metadata,
    };
  }

  if (input.format === "xero") {
    const xeroRows = buildXeroRows(rows);
    return {
      body: withBom(toCsv(xeroRows)),
      contentType: "text/csv; charset=utf-8",
      filename: `${filenameBase}-xero-bank-import.csv`,
      format: input.format,
      rowCount: rows.length,
      metadata,
    };
  }

  return {
    body: withBom(toCsv(buildAccountantCsvRows(rows))),
    contentType: "text/csv; charset=utf-8",
    filename: `${filenameBase}-accountant-export.csv`,
    format: input.format,
    rowCount: rows.length,
    metadata,
  };
}

function buildAccountantCsvRows(rows: CategorizedTransaction[]) {
  return rows.map((transaction) => ({
    Date: transaction.transactionDate || "",
    Description: transaction.description || "",
    "Supplier/Customer": transaction.supplierCustomer || "",
    Amount: transaction.amount ?? "",
    Debit: transaction.debit ?? (typeof transaction.amount === "number" && transaction.amount < 0 ? Math.abs(transaction.amount) : ""),
    Credit: transaction.credit ?? (typeof transaction.amount === "number" && transaction.amount > 0 ? transaction.amount : ""),
    Currency: transaction.currency || "",
    VAT: transaction.vatTax ?? "",
    "VAT Rate": transaction.vatRate ?? "",
    Category: formatCategory(transaction.category),
    Reference: transaction.invoiceReference || "",
    "Review Status": transaction.reviewStatus,
  }));
}

function buildExcelWorkbook(rows: CategorizedTransaction[], categorization: PrebookkeepingCategorization) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildAccountantCsvRows(rows)), "Reviewed Transactions");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { Metric: "Reviewed transactions", Value: rows.length },
    { Metric: "Income total", Value: categorization.incomeTotal },
    { Metric: "Expense total", Value: categorization.expenseTotal },
    { Metric: "Uncategorized count", Value: categorization.uncategorizedCount },
    { Metric: "Possible duplicates", Value: categorization.possibleDuplicates.length },
    { Metric: "VAT/tax total", Value: categorization.vatTaxSummary.total },
    { Metric: "Rows with VAT/tax", Value: categorization.vatTaxSummary.rowsWithTax },
  ]), "Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildVatSummaryRows(rows)), "VAT Summary");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(buffer);
}

function buildVatSummaryRows(rows: CategorizedTransaction[]) {
  const groups = new Map<string, { count: number; vat: number; net: number }>();
  for (const row of rows) {
    const key = typeof row.vatRate === "number" ? `${row.vatRate}%` : row.vatStatus === "present" ? "VAT present" : "VAT missing";
    const current = groups.get(key) ?? { count: 0, vat: 0, net: 0 };
    current.count += 1;
    current.vat += Math.abs(row.vatTax || 0);
    current.net += Math.abs(row.amount || 0);
    groups.set(key, current);
  }
  return Array.from(groups.entries()).map(([status, value]) => ({
    "VAT Status/Rate": status,
    Transactions: value.count,
    "VAT Amount": roundMoney(value.vat),
    "Transaction Amount": roundMoney(value.net),
  }));
}

function buildDatevRows(rows: CategorizedTransaction[]) {
  const missingMappings = rows.filter((row) => !datevAccountForCategory(row.category)).slice(0, 5);
  if (missingMappings.length > 0) {
    throw new PrebookkeepingExportError(
      "setup",
      "DATEV export requires account mappings for every reviewed category before export.",
    );
  }

  return rows.map((transaction) => ({
    Umsatz: formatDecimal(Math.abs(transaction.amount || transaction.debit || transaction.credit || 0)),
    "Soll/Haben-Kennzeichen": (transaction.amount || 0) < 0 ? "S" : "H",
    WKZ: transaction.currency || "",
    "Belegdatum": formatDateForDatev(transaction.transactionDate),
    "Belegfeld 1": transaction.invoiceReference || "",
    Buchungstext: transaction.description || transaction.supplierCustomer || "",
    Konto: datevAccountForCategory(transaction.category) || "",
    Gegenkonto: (transaction.amount || 0) < 0 ? "1200" : "8400",
    "Steuersatz": transaction.vatRate ?? "",
  }));
}

function buildQuickBooksRows(rows: CategorizedTransaction[]) {
  return rows.map((transaction) => ({
    Date: transaction.transactionDate || "",
    "Transaction Type": transaction.amount !== null && transaction.amount < 0 ? "Expense" : "Deposit",
    Num: transaction.invoiceReference || "",
    Name: transaction.supplierCustomer || "",
    Memo: transaction.description || "",
    Account: quickBooksAccountForCategory(transaction.category),
    Amount: transaction.amount ?? "",
    "Tax Amount": transaction.vatTax ?? "",
    Category: formatCategory(transaction.category),
  }));
}

function buildXeroRows(rows: CategorizedTransaction[]) {
  const invalidRows = rows.filter((transaction) => !transaction.transactionDate || typeof transaction.amount !== "number");
  if (invalidRows.length > 0) {
    throw new PrebookkeepingExportError(
      "validation",
      "Xero export requires a transaction date and amount for every reviewed transaction.",
    );
  }
  return rows.map((transaction) => ({
    Date: transaction.transactionDate || "",
    Amount: transaction.amount ?? "",
    Payee: transaction.supplierCustomer || "",
    Description: transaction.description || "",
    Reference: transaction.invoiceReference || "",
    "Transaction Type": transaction.amount !== null && transaction.amount < 0 ? "Spend Money" : "Receive Money",
  }));
}

function datevAccountForCategory(category: string) {
  const accounts: Record<string, string> = {
    revenue: "8400",
    operating_expenses: "4980",
    payroll: "4120",
    fixed_costs: "4210",
    taxes: "1780",
    bank_fees: "4970",
    transfers: "1360",
    assets: "0400",
    liabilities: "1700",
    equity: "0800",
    other: "4900",
  };
  return accounts[category] || null;
}

function quickBooksAccountForCategory(category: string) {
  const accounts: Record<string, string> = {
    revenue: "Sales",
    operating_expenses: "Office/General Administrative Expenses",
    payroll: "Payroll Expenses",
    fixed_costs: "Rent or Lease",
    taxes: "Taxes Paid",
    bank_fees: "Bank Charges",
    transfers: "Transfers",
    assets: "Fixed Assets",
    liabilities: "Liabilities",
    equity: "Owner's Equity",
    other: "Other Business Expenses",
    uncategorized: "Uncategorized Expense",
  };
  return accounts[category] || "Uncategorized Expense";
}

function toCsv(rows: Record<string, unknown>[], delimiter = ",") {
  const headers = Object.keys(rows[0] || {});
  return [
    headers.map((header) => csvCell(header, delimiter)).join(delimiter),
    ...rows.map((row) => headers.map((header) => csvCell(row[header], delimiter)).join(delimiter)),
  ].join("\n");
}

function csvCell(value: unknown, delimiter: string) {
  const text = String(value ?? "");
  const delimiterPattern = delimiter === "\t" ? "\t" : delimiter;
  return text.includes('"') || text.includes("\n") || text.includes("\r") || text.includes(delimiterPattern)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function withBom(csv: string) {
  return `\uFEFF${csv}`;
}

function safeFileName(value: unknown) {
  const safeValue = typeof value === "string" ? value : String(value ?? "");
  return safeValue.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "prebookkeeping";
}

function formatCategory(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDecimal(value: number) {
  return roundMoney(value).toFixed(2).replace(".", ",");
}

function formatDateForDatev(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace(/[^0-9]/g, "").slice(0, 8);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
