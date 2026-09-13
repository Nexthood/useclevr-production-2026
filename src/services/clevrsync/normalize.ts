import { assertWorksheetBounds } from "@/lib/upload/upload-security";
import type {
  ClevrSyncColumn,
  ClevrSyncColumnType,
  ClevrSyncRow,
  ClevrSyncWorksheetPreview,
} from "@/services/clevrsync/types";

export function matrixToWorksheetPreview(input: {
  name: string;
  matrix: unknown[][];
  previewRowLimit: number;
}): ClevrSyncWorksheetPreview {
  const headerIndex = input.matrix.findIndex((row) => row.some((cell) => !isEmptyValue(cell)));
  if (headerIndex === -1) {
    return { name: input.name, columns: [], rows: [], rowCount: 0, columnCount: 0 };
  }

  const headers = normalizeHeaders(input.matrix[headerIndex]);
  const dataRows = input.matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => !isEmptyValue(cell)));
  assertWorksheetBounds(dataRows.length, headers.length);

  return {
    name: input.name,
    columns: detectColumns(headers, dataRows),
    rows: dataRows.slice(0, input.previewRowLimit).map((row) => toRowObject(headers, row)),
    rowCount: dataRows.length,
    columnCount: headers.length,
  };
}

export function normalizeRowsAsCsv(rows: ClevrSyncRow[], columns: string[]) {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = value instanceof Date ? value.toISOString() : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(",")),
  ].join("\n");
}

function normalizeHeaders(headerRow: unknown[]) {
  const counts = new Map<string, number>();
  return headerRow.map((cell, index) => {
    const baseName = String(cell ?? "").trim() || `Column ${index + 1}`;
    const seen = counts.get(baseName) ?? 0;
    counts.set(baseName, seen + 1);
    return seen === 0 ? baseName : `${baseName} ${seen + 1}`;
  });
}

function toRowObject(headers: string[], row: unknown[]) {
  return headers.reduce<ClevrSyncRow>((record, header, index) => {
    record[header] = normalizeCellValue(row[index]);
    return record;
  }, {});
}

function detectColumns(headers: string[], rows: unknown[][]): ClevrSyncColumn[] {
  return headers.map((header, index) => {
    const values = rows.map((row) => row[index]);
    const nonEmptyValues = values.filter((value) => !isEmptyValue(value));
    const sampleValues = nonEmptyValues
      .slice(0, 5)
      .map(normalizeCellValue)
      .filter(
        (value): value is string | number | boolean => value !== null && !(value instanceof Date),
      );

    return {
      name: header,
      originalName: header,
      type: detectColumnType(nonEmptyValues),
      emptyCount: values.length - nonEmptyValues.length,
      sampleValues,
    };
  });
}

function detectColumnType(values: unknown[]): ClevrSyncColumnType {
  if (values.length === 0) return "empty";
  const detected = new Set(values.map(detectValueType));
  if (detected.size === 1) return [...detected][0] ?? "empty";
  return "mixed";
}

function detectValueType(value: unknown): Exclude<ClevrSyncColumnType, "empty" | "mixed"> {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return "date";

  const text = String(value).trim();
  if (/^(true|false)$/i.test(text)) return "boolean";
  if (text !== "" && Number.isFinite(Number(text))) return "number";
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(text) && !Number.isNaN(Date.parse(text))) return "date";
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text) && !Number.isNaN(Date.parse(text)))
    return "date";
  return "string";
}

function normalizeCellValue(value: unknown): ClevrSyncRow[string] {
  if (isEmptyValue(value)) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  return String(value);
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}
