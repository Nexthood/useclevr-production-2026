import * as XLSX from "xlsx";

import { assertWorkbookHasSheets, UploadValidationError } from "@/lib/upload/upload-security";
import { matrixToWorksheetPreview } from "@/services/clevrsync/normalize";
import type {
  ClevrSyncDatasetPayload,
  ClevrSyncPreview,
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
  return (
    normalizedMime === XLSX_MIME ||
    normalizedMime === "application/zip" ||
    normalizedMime === "application/octet-stream"
  );
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
  const activeWorksheet =
    worksheets.find((sheet) => sheet.columnCount > 0) ?? worksheets[0] ?? null;

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

  return matrixToWorksheetPreview({
    name: sheetName,
    matrix,
    previewRowLimit,
  });
}

function toUint8Array(buffer: Buffer | ArrayBuffer | Uint8Array) {
  if (buffer instanceof Uint8Array) return buffer;
  return new Uint8Array(buffer);
}

function byteLength(buffer: Buffer | ArrayBuffer | Uint8Array) {
  if (buffer instanceof ArrayBuffer) return buffer.byteLength;
  return buffer.byteLength;
}
