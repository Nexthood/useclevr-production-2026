import * as XLSX from "xlsx";

import {
  assertWorkbookHasSheets,
  assertWorksheetBounds,
  UploadValidationError,
} from "@/lib/upload/upload-security";
import type {
  ClevrSyncColumn,
  ClevrSyncColumnType,
  ClevrSyncDatasetPayload,
  ClevrSyncPreview,
  ClevrSyncRow,
  ClevrSyncWorksheetPreview,
} from "@/services/clevrsync/types";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DEFAULT_PREVIEW_ROW_LIMIT = 20;

type ExcelParseInput = {
  fileBuffer: Buffer | ArrayBuffer | Uint8Array;
  fileName: string;
  fileSize?: number;
  mimeType?: string | null;
  previewRowLimit?: number;
};

export function isSupportedExcelFile(fileName: string, mimeType?: string | null) {
  const normalizedName = fileName.toLowerCase();
  const normalizedMime = String(mimeType || "").toLowerCase();
  if (!normalizedName.endsWith(".xlsx")) return false;
  if (!normalizedMime) return true;
  return normalizedMime === XLSX_MIME || normalizedMime === "application/zip" || normalizedMime === "application/octet-stream";
}

export function parseExcelWorkbook(input: ExcelParseInput): ClevrSyncPreview {
  if (!isSupportedExcelFile(input.fileName, input.mimeType)) {
    throw new UploadValidationError(
      "CLEVRSYNC_EXCEL_FILE_INVALID",
      "ClevrSync Excel connections support XLSX files.",
      422,
    );
  }

  const previewRowLimit = Math.max(1, input.previewRowLimit ?? DEFAULT_PREVIEW_ROW_LIMIT);
  const workbook = XLSX.read(toUint8Array(input.fileBuffer), {
    type: "array",
    cellDates: true,
    bookVBA: false,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
  });
  assertWorkbookHasSheets(workbook);

  const worksheets = workbook.SheetNames.map((sheetName) =>
    parseWorksheetPreview(workbook, sheetName, previewRowLimit),
  );
  const activeWorksheet = worksheets.find((sheet) => sheet.columnCount > 0) ?? worksheets[0] ?? null;

  return {
    sourceType: "excel",
    fileName: input.fileName,
    fileSize: input.fileSize ?? byteLength(input.fileBuffer),
    mimeType: input.mimeType || XLSX_MIME,
    activeWorksheet: activeWorksheet?.name ?? null,
    worksheets,
    columns: activeWorksheet?.columns ?? [],
    rows: activeWorksheet?.rows ?? [],
    rowCount: activeWorksheet?.rowCount ?? 0,
    columnCount: activeWorksheet?.columnCount ?? 0,
  };
}

export function toDatasetPayload(preview: ClevrSyncPreview): ClevrSyncDatasetPayload {
  const columns = preview.columns.map((column) => column.name);
  return {
    name: preview.fileName.replace(/\.xlsx$/i, ""),
    fileName: preview.fileName,
    fileSize: preview.fileSize,
    mimeType: preview.mimeType,
    columns,
    rows: preview.rows,
    columnTypes: Object.fromEntries(preview.columns.map((column) => [column.name, column.type])),
    datasetType: "standard",
    source: "clevrsync",
  };
}

function parseWorksheetPreview(
  workbook: XLSX.WorkBook,
  sheetName: string,
  previewRowLimit: number,
): ClevrSyncWorksheetPreview {
  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });

  const headerIndex = matrix.findIndex((row) => row.some((cell) => !isEmptyValue(cell)));
  if (headerIndex === -1) {
    return { name: sheetName, columns: [], rows: [], rowCount: 0, columnCount: 0 };
  }

  const headers = normalizeHeaders(matrix[headerIndex]);
  const dataRows = matrix.slice(headerIndex + 1).filter((row) => row.some((cell) => !isEmptyValue(cell)));
  assertWorksheetBounds(dataRows.length, headers.length);

  const rows = dataRows.slice(0, previewRowLimit).map((row) => toRowObject(headers, row));
  const columns = detectColumns(headers, dataRows);

  return {
    name: sheetName,
    columns,
    rows,
    rowCount: dataRows.length,
    columnCount: headers.length,
  };
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
      .filter((value): value is string | number | boolean => value !== null && !(value instanceof Date));

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
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text) && !Number.isNaN(Date.parse(text))) return "date";
  return "string";
}

function normalizeCellValue(value: unknown): ClevrSyncRow[string] {
  if (isEmptyValue(value)) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function toUint8Array(buffer: Buffer | ArrayBuffer | Uint8Array) {
  if (buffer instanceof Uint8Array) return buffer;
  return new Uint8Array(buffer);
}

function byteLength(buffer: Buffer | ArrayBuffer | Uint8Array) {
  if (buffer instanceof ArrayBuffer) return buffer.byteLength;
  return buffer.byteLength;
}
