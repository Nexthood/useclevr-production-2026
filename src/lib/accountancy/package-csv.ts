export type AccountancyPackageCsvField = {
  label: string;
  value: string;
};

export type AccountancyPackageCsvRow = {
  category: string;
  field: string;
  value: string;
  unit: string;
  frequency: string;
};

const CSV_HEADER = ["Category", "Field", "Value", "Unit", "Frequency"];
const MISSING_VALUE_PATTERN = /^(not provided|not configured|none provided)$/i;

export function buildAccountancyPackageCsv(fields: AccountancyPackageCsvField[]) {
  const currency = findFieldValue(fields, "Currency");
  const rows = fields.flatMap((field) => toStructuredRows(field, currency));
  return `\uFEFF${[
    CSV_HEADER.join(","),
    ...rows.map((row) => [
      escapeCsv(row.category),
      escapeCsv(row.field),
      escapeCsv(row.value),
      escapeCsv(row.unit),
      escapeCsv(row.frequency),
    ].join(",")),
  ].join("\r\n")}`;
}

export function toStructuredAccountancyPackageCsvRows(
  fields: AccountancyPackageCsvField[],
): AccountancyPackageCsvRow[] {
  const currency = findFieldValue(fields, "Currency");
  return fields.flatMap((field) => toStructuredRows(field, currency));
}

function toStructuredRows(field: AccountancyPackageCsvField, currency: string): AccountancyPackageCsvRow[] {
  const label = cleanText(field.label);
  const value = cleanText(field.value);
  if (!label) return [];

  if (isListSummaryLabel(label) && isStructuredListValue(value)) {
    return value.split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => parseSummaryEntry(summaryCategory(label), entry, currency));
  }

  const category = categoryForLabel(label);
  const parsed = parseScalarValue(label, value);
  return [{
    category,
    field: displayFieldLabel(label),
    value: parsed.value,
    unit: parsed.unit,
    frequency: parsed.frequency,
  }];
}

function parseSummaryEntry(category: string, entry: string, currency: string): AccountancyPackageCsvRow {
  const frequency = extractFrequency(entry);
  const percentage = entry.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (percentage) {
    return {
      category,
      field: cleanText(entry.slice(0, percentage.index).replace(/\b(monthly|annual|yearly|weekly|daily|quarterly)\b/gi, "")),
      value: normalizeNumber(percentage[1]),
      unit: "%",
      frequency,
    };
  }

  const amount = entry.match(/(?:^|\s)(-?\d+(?:[.,]\d+)?)(?=\s+(?:monthly|annual|yearly|weekly|daily|quarterly)\b|$)/i);
  if (amount) {
    return {
      category,
      field: cleanText(entry.slice(0, amount.index).replace(/\b(monthly|annual|yearly|weekly|daily|quarterly)\b/gi, "")),
      value: normalizeNumber(amount[1]),
      unit: currency,
      frequency,
    };
  }

  return {
    category,
    field: cleanText(entry),
    value: entry,
    unit: "",
    frequency,
  };
}

function parseScalarValue(label: string, value: string) {
  if (/rate|tax/i.test(label)) {
    const percentage = value.match(/^(-?\d+(?:[.,]\d+)?)\s*%?$/);
    if (percentage) return { value: normalizeNumber(percentage[1]), unit: "%", frequency: "" };
  }

  if (/currency/i.test(label) && !MISSING_VALUE_PATTERN.test(value)) {
    return { value, unit: value, frequency: "" };
  }

  return { value, unit: "", frequency: "" };
}

function extractFrequency(value: string) {
  const match = value.match(/\b(monthly|annual|yearly|weekly|daily|quarterly)\b/i);
  if (!match) return "";
  const normalized = match[1].toLowerCase() === "yearly" ? "annual" : match[1].toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isListSummaryLabel(label: string) {
  return /^payroll$/i.test(label) || /^fixed costs?$/i.test(label);
}

function isStructuredListValue(value: string) {
  return value.includes(";") && !MISSING_VALUE_PATTERN.test(value);
}

function summaryCategory(label: string) {
  return /^payroll$/i.test(label) ? "Payroll" : "Fixed Cost";
}

function categoryForLabel(label: string) {
  if (/^payroll$/i.test(label)) return "Payroll";
  if (/^fixed costs?$/i.test(label)) return "Fixed Cost";
  if (/vat|tax system|tax country|tax period/i.test(label)) return "Tax";
  if (/accountant/i.test(label)) return "Accountant";
  if (/notes?|message/i.test(label)) return "Notes";
  return "Company";
}

function displayFieldLabel(label: string) {
  if (/^company name$/i.test(label)) return "Company Name";
  if (/^tax country$/i.test(label)) return "Country";
  if (/^default vat rate$/i.test(label)) return "VAT Rate";
  return label.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function findFieldValue(fields: AccountancyPackageCsvField[], label: string) {
  const value = fields.find((field) => field.label.toLowerCase() === label.toLowerCase())?.value || "";
  return MISSING_VALUE_PATTERN.test(value) ? "" : cleanText(value);
}

function normalizeNumber(value: string) {
  return value.replace(",", ".");
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim();
}

function escapeCsv(value: unknown) {
  const safeValue = String(value ?? "");
  return `"${safeValue.replace(/"/g, '""')}"`;
}
