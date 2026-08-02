import { getBusinessModelRedirect } from "@/lib/data/business-model";
import {
  categorizePrebookkeepingRows,
  createDefaultPrebookkeepingReviewSummary,
  isPrebookkeepingCategorization,
  normalizePrebookkeepingCategorization,
} from "@/lib/accountancy/prebookkeeping-categorization";
import { computePrecomputedMetrics } from "@/lib/data/csvLoader";
import { getDb } from "@/lib/db";
import { datasetRows, datasets, prebookkeepingLearningRules, type DatasetBusinessModel } from "@/lib/db/schema";
import { deleteFile, uploadFile as storeUploadedFile } from "@/lib/data/upload-handler";
import { debugError, debugLog } from "@/lib/utils/debug";
import { and, asc, eq } from "drizzle-orm";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createHash } from "node:crypto";

export type AccountancyDatasetType = "accountancy" | "prebookkeeping";
export type AccountancyUploadType = "csv" | "excel" | "pdf" | "receipt" | "bank";
export type AccountancyUploadStage = "validation" | "storage" | "parsing" | "database" | "extraction";

export interface AccountancyUploadMeta {
  fileName: string;
  mimeType: string;
  size: number;
  uploadType: AccountancyUploadType;
  datasetType: AccountancyDatasetType;
}

export interface AccountancyParsedUpload {
  route: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  columnCount: number;
  columnTypes: Record<string, string>;
  previewRows: Record<string, unknown>[];
  extractedData: Record<string, unknown>[];
  sheetNames?: string[];
  selectedSheet?: string;
  duplicateColumns?: string[];
  documentTextStatus?: "embedded_text" | "scanner_required" | "image_scanner";
  warnings: string[];
}

export interface AccountancyUploadResult {
  ok: true;
  success: true;
  datasetId: string;
  datasetName: string;
  datasetType: AccountancyDatasetType;
  uploadType: AccountancyUploadType;
  processingRoute: string;
  rowsProcessed: number;
  columnsDetected: number;
  redirectTo: string;
  redirectUrl: string;
  storageKey?: string | null;
  checksum?: string;
  duplicate?: boolean;
  extractedData: Record<string, unknown>[];
  preview: { headers: string[]; rows: Record<string, unknown>[] };
  warnings: string[];
}

export class AccountancyUploadError extends Error {
  readonly stage: AccountancyUploadStage;
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(stage: AccountancyUploadStage, code: string, message: string, status = 400, retryable = false) {
    super(message);
    this.name = "AccountancyUploadError";
    this.stage = stage;
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const PREVIEW_ROW_COUNT = 20;
const MAX_EXCEL_HEADER_SCAN_ROWS = 30;

interface ExcelSheetProfile {
  sheetName: string;
  rows: unknown[][];
  rowCount: number;
  columnCount: number;
  nonEmptyRowCount: number;
  selected: boolean;
  score: number;
  reason: string;
  headerIndex: number | null;
  headers: string[];
  dataRows: unknown[][];
}

const uploadSpecs: Record<
  AccountancyUploadType,
  { route: string; extensions: string[]; mimeTypes: string[]; tabular: boolean }
> = {
  csv: {
    route: "accountancy_csv_parser",
    extensions: [".csv"],
    mimeTypes: ["text/csv", "application/csv", "application/vnd.ms-excel", "application/octet-stream", ""],
    tabular: true,
  },
  excel: {
    route: "accountancy_excel_workbook_parser",
    extensions: [".xlsx", ".xls"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/octet-stream",
      "",
    ],
    tabular: true,
  },
  pdf: {
    route: "accountancy_pdf_document_processor",
    extensions: [".pdf"],
    mimeTypes: ["application/pdf", "application/octet-stream", ""],
    tabular: false,
  },
  receipt: {
    route: "receipt_invoice_document_scanner",
    extensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/octet-stream", ""],
    tabular: false,
  },
  bank: {
    route: "bank_transaction_parser",
    extensions: [".csv", ".xlsx", ".xls", ".ofx", ".qif", ".qfx"],
    mimeTypes: [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
      "application/x-ofx",
      "application/vnd.intu.qfx",
      "",
    ],
    tabular: true,
  },
};

export function getAccountancyUploadSpec(uploadType: AccountancyUploadType) {
  return uploadSpecs[uploadType];
}

export function normalizeAccountancyUploadType(value: FormDataEntryValue | null): AccountancyUploadType | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "csv" || normalized === "excel" || normalized === "pdf" || normalized === "receipt" || normalized === "bank") {
    return normalized;
  }
  return null;
}

export function normalizeAccountancyDatasetType(value: FormDataEntryValue | null): AccountancyDatasetType | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "accountancy" || normalized === "prebookkeeping") return normalized;
  return null;
}

export function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function validateAccountancyUpload(meta: AccountancyUploadMeta) {
  const spec = uploadSpecs[meta.uploadType];
  const extension = getFileExtension(meta.fileName);
  const mimeType = meta.mimeType.toLowerCase();

  if (meta.size <= 0) {
    throw new AccountancyUploadError("validation", "EMPTY_FILE", "The selected file is empty.", 400, false);
  }

  if (meta.size > MAX_FILE_SIZE) {
    throw new AccountancyUploadError(
      "validation",
      "FILE_TOO_LARGE",
      "File size must be less than 50MB.",
      413,
      false,
    );
  }

  if (!spec.extensions.includes(extension)) {
    throw new AccountancyUploadError(
      "validation",
      "UNSUPPORTED_EXTENSION",
      `${displayUploadType(meta.uploadType)} uploads accept ${spec.extensions.join(", ")} files.`,
      415,
      false,
    );
  }

  if (!spec.mimeTypes.includes(mimeType)) {
    throw new AccountancyUploadError(
      "validation",
      "UNSUPPORTED_MIME_TYPE",
      `${displayUploadType(meta.uploadType)} uploads do not accept ${meta.mimeType || "unknown"} files.`,
      415,
      false,
    );
  }
}

export async function parseAccountancyUploadBuffer(
  buffer: Buffer,
  meta: AccountancyUploadMeta,
): Promise<AccountancyParsedUpload> {
  validateAccountancyUpload(meta);

  if (meta.uploadType === "csv") return parseCsvUpload(buffer, meta);
  if (meta.uploadType === "excel") return parseExcelUpload(buffer, meta);
  if (meta.uploadType === "bank") return parseBankUpload(buffer, meta);
  if (meta.uploadType === "pdf") return parsePdfUpload(buffer, meta);
  return parseReceiptUpload(buffer, meta);
}

export async function processAccountancyUpload(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  userId: string;
  datasetType: AccountancyDatasetType;
  uploadType: AccountancyUploadType;
}): Promise<AccountancyUploadResult> {
  const requestMeta: AccountancyUploadMeta = {
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.buffer.length,
    uploadType: input.uploadType,
    datasetType: input.datasetType,
  };
  const extension = getFileExtension(input.fileName);

  debugLog("[ACCOUNTANCY-UPLOAD] request received", {
    fileName: input.fileName,
    extension,
    mimeType: input.mimeType || "unknown",
    uploadType: input.uploadType,
    datasetType: input.datasetType,
    processingRoute: uploadSpecs[input.uploadType].route,
    stage: "validation",
  });

  validateAccountancyUpload(requestMeta);
  const checksum = createHash("sha256").update(input.buffer).digest("hex");

  const db = getDb();
  if (!db) {
    throw new AccountancyUploadError("database", "DB_UNAVAILABLE", "Database is not configured.", 503, true);
  }

  const existingDataset = await db.query.datasets.findFirst({
    where: and(
      eq(datasets.userId, input.userId),
      eq(datasets.checksum, checksum),
      eq(datasets.datasetType, input.datasetType),
      eq(datasets.fileName, input.fileName),
    ),
  });

  if (existingDataset) {
    const prebookkeepingCategorization =
      input.datasetType === "prebookkeeping"
        ? await ensureExistingPrebookkeepingCategorization(existingDataset.id, existingDataset.analysis)
        : null;

    debugLog("[ACCOUNTANCY-UPLOAD] duplicate upload returned existing dataset", {
      fileName: input.fileName,
      extension,
      mimeType: input.mimeType || "unknown",
      uploadType: input.uploadType,
      datasetType: input.datasetType,
      processingRoute: uploadSpecs[input.uploadType].route,
      stage: "database",
      datasetId: existingDataset.id,
    });

    return {
      ok: true,
      success: true,
      datasetId: existingDataset.id,
      datasetName: existingDataset.name,
      datasetType: input.datasetType,
      uploadType: input.uploadType,
      processingRoute: uploadSpecs[input.uploadType].route,
      rowsProcessed: existingDataset.rowCount || 0,
      columnsDetected: Array.isArray(existingDataset.columns) ? existingDataset.columns.length : 0,
      redirectTo: getBusinessModelRedirect({
        datasetType: input.datasetType,
        businessModel: existingDataset.businessModel || "generic",
        datasetId: existingDataset.id,
      }),
      redirectUrl: getBusinessModelRedirect({
        datasetType: input.datasetType,
        businessModel: existingDataset.businessModel || "generic",
        datasetId: existingDataset.id,
      }),
      storageKey: existingDataset.storageKey,
      checksum,
      duplicate: true,
      extractedData: prebookkeepingCategorization?.transactions.slice(0, PREVIEW_ROW_COUNT).map((transaction) => ({ ...transaction })) || [],
      preview: {
        headers: Array.isArray(existingDataset.columns) ? existingDataset.columns : [],
        rows: Array.isArray(existingDataset.data) ? existingDataset.data.slice(0, 5) : [],
      },
      warnings: [
        "This file already exists, so the existing dataset was reused.",
        ...(prebookkeepingCategorization ? ["Existing Pre-bookkeeping dataset is categorized and ready for review."] : []),
      ],
    };
  }

  let parsed: AccountancyParsedUpload;
  try {
    parsed = await parseAccountancyUploadBuffer(input.buffer, requestMeta);
  } catch (error) {
    if (error instanceof AccountancyUploadError) throw error;
    debugError("[ACCOUNTANCY-UPLOAD] parsing failed", safeLogMeta(input, "parsing", error));
    throw new AccountancyUploadError(
      "parsing",
      "PARSING_FAILED",
      error instanceof Error ? error.message : "The file could not be parsed.",
      422,
      false,
    );
  }

  debugLog("[ACCOUNTANCY-UPLOAD] parsing finished", {
    fileName: input.fileName,
    extension,
    mimeType: input.mimeType || "unknown",
    uploadType: input.uploadType,
    datasetType: input.datasetType,
    processingRoute: parsed.route,
    stage: "parsing",
    rows: parsed.rowCount,
    columns: parsed.columnCount,
  });

  let storage;
  try {
    storage = await storeUploadedFile(input.buffer, input.fileName, input.mimeType || inferMimeType(input.fileName));
  } catch (error) {
    debugError("[ACCOUNTANCY-UPLOAD] storage failed", safeLogMeta(input, "storage", error));
    throw new AccountancyUploadError(
      "storage",
      "STORAGE_FAILED",
      error instanceof Error ? error.message : "The original file could not be stored.",
      500,
      true,
    );
  }

  if (!storage.success) {
    debugError("[ACCOUNTANCY-UPLOAD] storage failed", safeLogMeta(input, "storage", storage.error));
    throw new AccountancyUploadError(
      "storage",
      "STORAGE_FAILED",
      storage.error || "The original file could not be stored.",
      500,
      true,
    );
  }

  const datasetId = `acct_${Date.now()}_${checksum.slice(0, 8)}`;
  const datasetName = input.fileName.replace(/\.(csv|xlsx|xls|pdf|jpg|jpeg|png|webp|ofx|qif|qfx)$/i, "");
  const now = new Date();
  const businessModel: DatasetBusinessModel = "generic";
  const redirectTo = getBusinessModelRedirect({ datasetType: input.datasetType, businessModel, datasetId });
  const precomputedMetrics = parsed.rows.length > 0 ? computePrecomputedMetrics(parsed.rows, parsed.columns) : null;
  const learningRules =
    input.datasetType === "prebookkeeping"
      ? await db.query.prebookkeepingLearningRules.findMany({
          where: eq(prebookkeepingLearningRules.userId, input.userId),
          columns: {
            supplierKey: true,
            descriptionKeyword: true,
            merchantKey: true,
            category: true,
          },
        })
      : [];
  const prebookkeepingCategorization =
    input.datasetType === "prebookkeeping" && parsed.rows.length > 0
      ? categorizePrebookkeepingRows(parsed.rows, learningRules)
      : null;
  const reviewSummary = prebookkeepingCategorization
    ? prebookkeepingCategorization.reviewSummary
    : createDefaultPrebookkeepingReviewSummary(parsed.rowCount, parsed.rowCount > 0 ? "pending" : "pending");

  const insertData = {
    id: datasetId,
    userId: input.userId,
    name: datasetName || input.fileName,
    fileName: input.fileName,
    fileSize: input.buffer.length,
    mimeType: input.mimeType || inferMimeType(input.fileName),
    storageKey: storage.storageKey,
    checksum,
    rowCount: parsed.rowCount,
    columnCount: parsed.columnCount,
    columns: parsed.columns,
    data: parsed.previewRows,
    columnTypes: parsed.columnTypes,
    datasetType: input.datasetType,
    businessModel,
    status: "ready",
    analysisStatus: "ready",
    analysisProgress: 100,
    analysisMessage: prebookkeepingCategorization ? "Ready for review." : "Accountancy upload processed.",
    analysisError: null,
    analysis: {
      dataset_type: input.datasetType,
      datasetCategory: input.datasetType,
      datasetType: input.datasetType,
      accountancyUploadType: input.uploadType,
      processingRoute: parsed.route,
      selectedSheet: parsed.selectedSheet,
      sheetNames: parsed.sheetNames,
      duplicateColumns: parsed.duplicateColumns,
      documentTextStatus: parsed.documentTextStatus,
      extractedData: parsed.extractedData,
      warnings: parsed.warnings,
      reviewSummary,
      categorizationStatus: prebookkeepingCategorization ? "ready_for_review" : undefined,
      prebookkeepingCategorization,
    },
    precomputedMetrics,
    columnMapping: {
      accountancyUploadType: input.uploadType,
      processingRoute: parsed.route,
      selectedSheet: parsed.selectedSheet,
    },
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.transaction(async (tx) => {
      await tx.insert(datasets).values(insertData);

      if (parsed.rows.length > 0) {
        const rowValues = parsed.rows.slice(0, 5000).map((row, index) => ({
          id: `${datasetId}-row-${index}`,
          datasetId,
          rowIndex: index,
          data: row,
        }));
        if (rowValues.length > 0) {
          await tx.insert(datasetRows).values(rowValues);
        }
      }
    });
  } catch (error) {
    await deleteFile(storage.storageKey).catch(() => false);
    debugError("[ACCOUNTANCY-UPLOAD] database failed", safeLogMeta(input, "database", error));
    throw new AccountancyUploadError(
      "database",
      "DATABASE_FAILED",
      error instanceof Error ? error.message : "The dataset could not be saved.",
      500,
      true,
    );
  }

  debugLog("[ACCOUNTANCY-UPLOAD] upload completed", {
    fileName: input.fileName,
    extension,
    mimeType: input.mimeType || "unknown",
    uploadType: input.uploadType,
    datasetType: input.datasetType,
    processingRoute: parsed.route,
    stage: "database",
    datasetId,
  });

  return {
    ok: true,
    success: true,
    datasetId,
    datasetName: datasetName || input.fileName,
    datasetType: input.datasetType,
    uploadType: input.uploadType,
    processingRoute: parsed.route,
    rowsProcessed: parsed.rowCount,
    columnsDetected: parsed.columnCount,
    redirectTo,
    redirectUrl: redirectTo,
    storageKey: storage.storageKey,
    checksum,
    extractedData: parsed.extractedData,
    preview: {
      headers: parsed.columns,
      rows: parsed.previewRows.slice(0, 5),
    },
    warnings: parsed.warnings,
  };
}

async function ensureExistingPrebookkeepingCategorization(datasetId: string, analysis: unknown) {
  const existingAnalysis = isRecord(analysis) ? analysis : {};
  const existingCategorization = existingAnalysis.prebookkeepingCategorization;
  if (isPrebookkeepingCategorization(existingCategorization)) {
    const normalized = normalizePrebookkeepingCategorization(existingCategorization);
    if (!hasCompleteReviewSummary((existingCategorization as { reviewSummary?: unknown }).reviewSummary)) {
      await updatePrebookkeepingCategorization(datasetId, existingAnalysis, normalized);
    }
    return normalized;
  }

  const db = getDb();
  if (!db) return null;

  const rows = await db.query.datasetRows.findMany({
    where: eq(datasetRows.datasetId, datasetId),
    orderBy: [asc(datasetRows.rowIndex)],
    columns: {
      data: true,
    },
  });

  if (rows.length === 0) return null;

  const categorization = categorizePrebookkeepingRows(rows.map((row) => row.data as Record<string, unknown>));
  await updatePrebookkeepingCategorization(datasetId, existingAnalysis, categorization);

  return categorization;
}

async function updatePrebookkeepingCategorization(
  datasetId: string,
  existingAnalysis: Record<string, unknown>,
  categorization: ReturnType<typeof normalizePrebookkeepingCategorization>,
) {
  const db = getDb();
  if (!db) return;

  await db
    .update(datasets)
    .set({
      analysisStatus: "ready",
      analysisProgress: 100,
      analysisMessage: "Ready for review.",
      analysis: {
        ...existingAnalysis,
        reviewSummary: categorization.reviewSummary,
        categorizationStatus: "ready_for_review",
        prebookkeepingCategorization: categorization,
      },
      updatedAt: new Date(),
    })
    .where(eq(datasets.id, datasetId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasCompleteReviewSummary(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    typeof value.reviewedCount === "number" &&
    typeof value.totalCount === "number" &&
    typeof value.progress === "number" &&
    typeof value.status === "string" &&
    typeof value.transactionsAnalyzed === "number" &&
    typeof value.reviewProgressPercent === "number"
  );
}

function parseCsvUpload(buffer: Buffer, meta: AccountancyUploadMeta): AccountancyParsedUpload {
  const text = decodeText(buffer);
  const delimiter = detectDelimiter(text);
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    delimiter,
    transformHeader: (header) => header.trim().replace(/^\uFEFF/, ""),
  });

  if (parsed.errors.length > 0) {
    throw new AccountancyUploadError(
      "parsing",
      "CSV_PARSE_FAILED",
      `CSV parsing failed: ${parsed.errors[0]?.message || "invalid CSV"}`,
      422,
      false,
    );
  }

  return normalizeTabularRows(parsed.meta.fields || [], parsed.data, {
    route: uploadSpecs[meta.uploadType].route,
    warnings: [`Detected ${delimiter === "\t" ? "tab" : delimiter} delimiter.`],
  });
}

function parseExcelUpload(buffer: Buffer, meta: AccountancyUploadMeta): AccountancyParsedUpload {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, cellFormula: true, cellStyles: true });
  const sheetNames = workbook.SheetNames;
  const sheetProfiles = sheetNames.map((sheetName) => profileExcelSheet(sheetName, workbook.Sheets[sheetName]));
  const selected = sheetProfiles
    .filter((profile) => profile.selected)
    .sort((a, b) => b.score - a.score || sheetNames.indexOf(a.sheetName) - sheetNames.indexOf(b.sheetName))[0];

  debugLog("[ACCOUNTANCY-UPLOAD] workbook sheet scan", {
    fileName: meta.fileName,
    mimeType: meta.mimeType || "unknown",
    uploadType: meta.uploadType,
    datasetType: meta.datasetType,
    processingRoute: uploadSpecs[meta.uploadType].route,
    stage: "parsing",
    sheetNames,
    sheets: sheetProfiles.map((profile) => ({
      sheetName: profile.sheetName,
      rowCount: profile.rowCount,
      columnCount: profile.columnCount,
      nonEmptyRowCount: profile.nonEmptyRowCount,
      selected: profile.selected,
      reason: profile.reason,
    })),
  });

  if (!selected) {
    const details =
      sheetProfiles.length > 0
        ? sheetProfiles
            .map((profile) => `${profile.sheetName}: ${profile.reason} (${profile.rowCount} rows, ${profile.columnCount} columns)`)
            .join("; ")
        : "No worksheets were found.";

    throw new AccountancyUploadError(
      "parsing",
      "EXCEL_NO_DATA_SHEET",
      `No valid Excel data sheet was found. ${details}`,
      422,
      false,
    );
  }

  const objectRows = selected.dataRows.map((row) => {
    const record: Record<string, unknown> = {};
    selected.headers.forEach((header, index) => {
      record[header] = row[index] === "" ? null : row[index];
    });
    return record;
  });

  return {
    ...normalizeTabularRows(selected.headers, objectRows, {
      route: uploadSpecs[meta.uploadType].route,
      warnings: [
        ...(sheetNames.length > 1 ? [`Selected worksheet "${selected.sheetName}" from ${sheetNames.length} worksheets.`] : []),
        ...sheetProfiles
          .filter((profile) => profile.sheetName !== selected.sheetName && !profile.selected)
          .map((profile) => `Rejected worksheet "${profile.sheetName}": ${profile.reason}`),
      ],
    }),
    sheetNames,
    selectedSheet: selected.sheetName,
  };
}

function profileExcelSheet(sheetName: string, sheet: XLSX.WorkSheet | undefined): ExcelSheetProfile {
  if (!sheet) return rejectedExcelSheet(sheetName, [], "Worksheet is missing from the workbook.");

  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: true }) as unknown[][];
  const rows = expandMergedCells(rawRows, sheet["!merges"]);
  const nonEmptyRows = rows.filter(isNonEmptyRow);
  const rowCount = rows.length;
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

  if (nonEmptyRows.length === 0) {
    return rejectedExcelSheet(sheetName, rows, "Sheet is empty.");
  }

  if (nonEmptyRows.length < 2) {
    return rejectedExcelSheet(sheetName, rows, "Sheet has only one non-empty row.");
  }

  const candidate = detectExcelTableRegion(rows);
  if (!candidate) {
    return rejectedExcelSheet(sheetName, rows, "No generic tabular region with a header row and data rows was detected.");
  }

  const score =
    candidate.dataRows.length * candidate.headers.length +
    candidate.headerSignal * 4 +
    candidate.density * 10 -
    candidate.headerIndex * 0.1;

  return {
    sheetName,
    rows,
    rowCount,
    columnCount,
    nonEmptyRowCount: nonEmptyRows.length,
    selected: true,
    score,
    reason: `Accepted generic table at row ${candidate.headerIndex + 1} with ${candidate.headers.length} columns and ${candidate.dataRows.length} data rows.`,
    headerIndex: candidate.headerIndex,
    headers: candidate.headers,
    dataRows: candidate.dataRows,
  };
}

function rejectedExcelSheet(sheetName: string, rows: unknown[][], reason: string): ExcelSheetProfile {
  return {
    sheetName,
    rows,
    rowCount: rows.length,
    columnCount: rows.reduce((max, row) => Math.max(max, row.length), 0),
    nonEmptyRowCount: rows.filter(isNonEmptyRow).length,
    selected: false,
    score: 0,
    reason,
    headerIndex: null,
    headers: [],
    dataRows: [],
  };
}

function detectExcelTableRegion(rows: unknown[][]) {
  const candidates = rows.slice(0, MAX_EXCEL_HEADER_SCAN_ROWS).map((row, headerIndex) => {
    const headers = row.map((value) => normalizeExcelCell(value));
    const meaningfulHeaderCount = headers.filter(Boolean).length;
    const distinctHeaderCount = new Set(headers.filter(Boolean).map((header) => header.toLowerCase())).size;
    const headerSignal = new Set(
      headers
        .filter((header) => header && !looksLikeMostlyNumeric(header))
        .map((header) => header.toLowerCase()),
    ).size;
    const tableWidth = Math.max(headers.length, ...rows.slice(headerIndex + 1, headerIndex + 8).map((nextRow) => nextRow.length));

    if (meaningfulHeaderCount < 2 || distinctHeaderCount < 2 || headerSignal < 1 || tableWidth < 2) return null;

    const dataRows = rows
      .slice(headerIndex + 1)
      .filter(isNonEmptyRow)
      .filter((dataRow) => !isFooterLikeRow(dataRow))
      .filter((dataRow) => countCellsInRange(dataRow, tableWidth) >= 1);

    if (dataRows.length === 0) return null;

    const populatedCells = dataRows.reduce((sum, dataRow) => sum + countCellsInRange(dataRow, tableWidth), 0);
    const density = populatedCells / Math.max(dataRows.length * tableWidth, 1);
    const usableWidth = Math.max(meaningfulHeaderCount, dataRows.reduce((max, dataRow) => Math.max(max, countCellsInRange(dataRow, tableWidth)), 0));

    if (usableWidth < 2 || density < 0.15) return null;

    const normalizedHeaders = Array.from({ length: usableWidth }, (_, index) => headers[index] || `Column ${index + 1}`);

    return {
      headerIndex,
      headers: normalizedHeaders,
      dataRows: dataRows.map((dataRow) => normalizedHeaders.map((_, index) => dataRow[index] ?? "")),
      headerSignal,
      density,
      score: dataRows.length * usableWidth + headerSignal * 4 + density * 10 - headerIndex * 0.1,
    };
  });

  return candidates.filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)).sort((a, b) => b.score - a.score)[0] || null;
}

function parseBankUpload(buffer: Buffer, meta: AccountancyUploadMeta): AccountancyParsedUpload {
  const extension = getFileExtension(meta.fileName);
  const parsed =
    extension === ".xlsx" || extension === ".xls"
      ? parseExcelUpload(buffer, { ...meta, uploadType: "excel" })
      : extension === ".csv"
        ? parseCsvUpload(buffer, { ...meta, uploadType: "csv" })
        : parseBankTextUpload(buffer);

  if (extension !== ".csv" && extension !== ".xlsx" && extension !== ".xls") {
    return parsed;
  }

  const bankColumns = detectBankColumns(parsed.columns);
  const normalizedRows = parsed.rows.map((row) => normalizeBankRow(row, bankColumns));
  const warnings = [...parsed.warnings];

  if (!bankColumns.date || !bankColumns.description || (!bankColumns.amount && (!bankColumns.debit || !bankColumns.credit))) {
    warnings.push("Bank export columns were detected partially; review date, description, amount, debit, and credit mappings.");
  }

  const bankOutputColumns = [
    ...parsed.columns,
    "normalizedAmount",
    "transactionDate",
    "transactionDescription",
    "transactionCurrency",
    "transactionBalance",
    "transactionReference",
  ].filter((column, index, array) => array.indexOf(column) === index);

  return {
    ...normalizeTabularRows(bankOutputColumns, normalizedRows, {
      route: uploadSpecs.bank.route,
      warnings,
    }),
    sheetNames: parsed.sheetNames,
    selectedSheet: parsed.selectedSheet,
  };
}

function parseBankTextUpload(buffer: Buffer): AccountancyParsedUpload {
  const text = decodeText(buffer);
  const ofxTransactions = Array.from(text.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi)).map(
    (match) => {
      const block = match[1] || "";
      return {
        transactionDate: tagValue(block, "DTPOSTED"),
        normalizedAmount: parseLocalizedNumber(tagValue(block, "TRNAMT")),
        transactionDescription: tagValue(block, "NAME") || tagValue(block, "MEMO"),
        transactionReference: tagValue(block, "FITID"),
      };
    },
  );

  if (ofxTransactions.length > 0) {
    return normalizeTabularRows(
      ["transactionDate", "normalizedAmount", "transactionDescription", "transactionReference"],
      ofxTransactions,
      { route: uploadSpecs.bank.route, warnings: ["Detected OFX/QFX bank export structure."] },
    );
  }

  const qifRows = text
    .split("^")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const lines = entry.split(/\r?\n/);
      const getLine = (prefix: string) => lines.find((line) => line.startsWith(prefix))?.slice(1).trim() || null;
      return {
        transactionDate: getLine("D"),
        normalizedAmount: parseLocalizedNumber(getLine("T")),
        transactionDescription: getLine("P") || getLine("M"),
        transactionReference: getLine("N"),
      };
    })
    .filter((row) => row.transactionDate || row.normalizedAmount || row.transactionDescription);

  if (qifRows.length > 0) {
    return normalizeTabularRows(
      ["transactionDate", "normalizedAmount", "transactionDescription", "transactionReference"],
      qifRows,
      { route: uploadSpecs.bank.route, warnings: ["Detected QIF bank export structure."] },
    );
  }

  throw new AccountancyUploadError(
    "parsing",
    "BANK_EXPORT_PARSE_FAILED",
    "The bank export format was accepted but no transactions could be read.",
    422,
    false,
  );
}

function parsePdfUpload(buffer: Buffer, _meta: AccountancyUploadMeta): AccountancyParsedUpload {
  const text = extractPdfText(buffer);
  const hasAccountingSignal = /invoice|receipt|supplier|vendor|merchant|subtotal|total|tax|vat|amount due/i.test(text);
  const scannerRequired = text.trim().length < 80 && !hasAccountingSignal;
  const extractedData = scannerRequired ? [] : extractAccountingFields(text);

  if (!scannerRequired && extractedData.length === 0) {
    throw new AccountancyUploadError(
      "extraction",
      "PDF_EXTRACTION_FAILED",
      "The PDF contains text, but no accounting fields could be extracted.",
      422,
      false,
    );
  }

  const rows = extractedData.length > 0
    ? buildAccountingDocumentRows(extractedData)
    : [{ document_status: "scanner_required", description: "OCR required", reason: "No embedded PDF text detected" }];

  return {
    route: scannerRequired ? "receipt_document_scanner" : uploadSpecs.pdf.route,
    columns: extractedData.length > 0
      ? ["transaction_date", "description", "supplier_customer", "amount", "currency", "vat_tax", "invoice_reference", "subtotal", "line_items"]
      : ["document_status", "description", "reason"],
    rows,
    rowCount: rows.length,
    columnCount: extractedData.length > 0 ? 9 : 3,
    columnTypes: extractedData.length > 0
      ? {
          transaction_date: "date",
          description: "text",
          supplier_customer: "text",
          amount: "decimal",
          currency: "text",
          vat_tax: "decimal",
          invoice_reference: "text",
          subtotal: "decimal",
          line_items: "json",
        }
      : { document_status: "text", description: "text", reason: "text" },
    previewRows: rows,
    extractedData,
    documentTextStatus: scannerRequired ? "scanner_required" : "embedded_text",
    warnings: scannerRequired ? ["No embedded text was detected, so the document was routed to the scanner flow."] : [],
  };
}

function parseReceiptUpload(buffer: Buffer, meta: AccountancyUploadMeta): AccountancyParsedUpload {
  const extension = getFileExtension(meta.fileName);

  if (extension === ".pdf") {
    const parsed = parsePdfUpload(buffer, meta);
    return { ...parsed, route: uploadSpecs.receipt.route };
  }

  const rows = [{ status: "image_scanner", fileType: extension.slice(1), extractionStatus: "queued" }];
  return {
    route: uploadSpecs.receipt.route,
    columns: ["status", "fileType", "extractionStatus"],
    rows,
    rowCount: rows.length,
    columnCount: 3,
    columnTypes: { status: "text", fileType: "text", extractionStatus: "text" },
    previewRows: rows,
    extractedData: [],
    documentTextStatus: "image_scanner",
    warnings: ["Image receipt was stored and routed to the document scanner flow."],
  };
}

function normalizeTabularRows(
  rawHeaders: string[],
  inputRows: Record<string, unknown>[],
  options: { route: string; warnings?: string[] },
): AccountancyParsedUpload {
  const { headers, duplicateColumns } = normalizeHeaders(rawHeaders);
  if (headers.length === 0) {
    throw new AccountancyUploadError("parsing", "NO_COLUMNS", "The file does not contain a usable header row.", 422, false);
  }

  const rows = inputRows
    .filter((row) => Object.values(row).some((value) => value !== null && value !== undefined && String(value).trim() !== ""))
    .map((row) => {
      const normalized: Record<string, unknown> = {};
      rawHeaders.forEach((rawHeader, index) => {
        normalized[headers[index]] = row[rawHeader] ?? null;
      });
      return normalized;
    });

  if (rows.length === 0) {
    throw new AccountancyUploadError("parsing", "NO_ROWS", "The file contains headers but no data rows.", 422, false);
  }

  return {
    route: options.route,
    columns: headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
    columnTypes: inferColumnTypes(headers, rows),
    previewRows: rows.slice(0, PREVIEW_ROW_COUNT),
    extractedData: rows.slice(0, PREVIEW_ROW_COUNT),
    duplicateColumns,
    warnings: [...(options.warnings || []), ...(duplicateColumns.length > 0 ? [`Duplicate columns renamed: ${duplicateColumns.join(", ")}.`] : [])],
  };
}

function normalizeHeaders(rawHeaders: string[]) {
  const seen = new Map<string, number>();
  const duplicateColumns: string[] = [];
  const headers = rawHeaders
    .map((header, index) => String(header || `Column ${index + 1}`).trim() || `Column ${index + 1}`)
    .map((header) => {
      const count = seen.get(header) || 0;
      seen.set(header, count + 1);
      if (count === 0) return header;
      duplicateColumns.push(header);
      return `${header}_${count + 1}`;
    });
  return { headers, duplicateColumns };
}

function detectDelimiter(text: string) {
  const firstLines = text.replace(/^\uFEFF/, "").split(/\r?\n/).slice(0, 10).join("\n");
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLines.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

function decodeText(buffer: Buffer) {
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function expandMergedCells(rows: unknown[][], merges: XLSX.Range[] | undefined) {
  const expanded = rows.map((row) => [...row]);

  for (const merge of merges || []) {
    const sourceValue = expanded[merge.s.r]?.[merge.s.c];
    if (sourceValue === null || sourceValue === undefined || String(sourceValue).trim() === "") continue;

    for (let rowIndex = merge.s.r; rowIndex <= merge.e.r; rowIndex += 1) {
      expanded[rowIndex] ||= [];
      for (let columnIndex = merge.s.c; columnIndex <= merge.e.c; columnIndex += 1) {
        if (expanded[rowIndex][columnIndex] === null || expanded[rowIndex][columnIndex] === undefined || String(expanded[rowIndex][columnIndex]).trim() === "") {
          expanded[rowIndex][columnIndex] = sourceValue;
        }
      }
    }
  }

  return expanded;
}

function isNonEmptyRow(row: unknown[]) {
  return row.some((value) => normalizeExcelCell(value) !== "");
}

function normalizeExcelCell(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function looksLikeMostlyNumeric(value: unknown) {
  const safeValue = typeof value === "string" ? value : String(value ?? "");
  const compact = safeValue.replace(/[^\dA-Za-z]/g, "");
  if (!compact) return false;
  const digitCount = (compact.match(/\d/g) || []).length;
  return digitCount / compact.length > 0.6;
}

function isFooterLikeRow(row: unknown[]) {
  const values = row.map((value) => normalizeExcelCell(value)).filter(Boolean);
  if (values.length !== 1) return false;
  return /^(total|subtotal|grand total|notes?|generated|exported|page \d+)/i.test(values[0] || "");
}

function countCellsInRange(row: unknown[], width: number) {
  return row.slice(0, width).filter((value) => normalizeExcelCell(value) !== "").length;
}

function inferColumnTypes(columns: string[], rows: Record<string, unknown>[]) {
  const types: Record<string, string> = {};
  for (const column of columns) {
    const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "");
    const sample = values.slice(0, 25).map(String);
    if (sample.length === 0) {
      types[column] = "unknown";
    } else if (sample.every((value) => /^-?\d+$/.test(value))) {
      types[column] = "integer";
    } else if (sample.every((value) => !Number.isNaN(parseLocalizedNumber(value)))) {
      types[column] = "decimal";
    } else if (sample.every((value) => /^\d{4}-\d{2}-\d{2}|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(value))) {
      types[column] = "date";
    } else {
      types[column] = "text";
    }
  }
  return types;
}

function detectBankColumns(columns: string[]) {
  const find = (pattern: RegExp) => columns.find((column) => pattern.test(column.toLowerCase()));
  return {
    date: find(/date|datum|posted|booking/),
    description: find(/description|details|memo|omschrijving|merchant|payee|name/),
    debit: find(/debit|withdrawal|paid out|afschrijving/),
    credit: find(/credit|deposit|paid in|bijschrijving/),
    amount: find(/^amount$|transaction amount|bedrag/),
    currency: find(/currency|valuta/),
    balance: find(/balance|saldo/),
    reference: find(/reference|ref|transaction id|iban/),
  };
}

function normalizeBankRow(row: Record<string, unknown>, columns: ReturnType<typeof detectBankColumns>) {
  const debit = columns.debit ? parseLocalizedNumber(row[columns.debit]) : Number.NaN;
  const credit = columns.credit ? parseLocalizedNumber(row[columns.credit]) : Number.NaN;
  const amount = columns.amount ? parseLocalizedNumber(row[columns.amount]) : Number.NaN;
  const normalizedAmount = Number.isFinite(amount)
    ? amount
    : Number.isFinite(credit)
      ? Math.abs(credit)
      : Number.isFinite(debit)
        ? -Math.abs(debit)
        : null;

  return {
    ...row,
    normalizedAmount,
    transactionDate: columns.date ? row[columns.date] : null,
    transactionDescription: columns.description ? row[columns.description] : null,
    transactionCurrency: columns.currency ? row[columns.currency] : null,
    transactionBalance: columns.balance ? row[columns.balance] : null,
    transactionReference: columns.reference ? row[columns.reference] : null,
  };
}

function parseLocalizedNumber(value: unknown) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim();
  if (!text) return Number.NaN;
  const cleaned = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  return Number(cleaned);
}

function tagValue(block: string, tag: string) {
  return new RegExp(`<${tag}>([^<\\r\\n]+)`, "i").exec(block)?.[1]?.trim() || null;
}

function extractPdfText(buffer: Buffer) {
  const text = `${buffer.toString("utf8")}\n${buffer.toString("latin1")}`;
  const literalStrings = Array.from(text.matchAll(/\(([^()]{2,200})\)/g)).map((match) => match[1]);
  const readable = literalStrings.length > 0 ? literalStrings.join("\n") : text;
  return readable.replace(/[^\S\r\n]+/g, " ").replace(/[^\x20-\x7E\r\n€£$-]/g, " ").trim();
}

function extractAccountingFields(text: string) {
  const fields: Record<string, unknown>[] = [];
  const add = (field: string, value: string | undefined, confidence = 0.8) => {
    if (value && value.trim()) fields.push({ field, value: value.trim(), confidence });
  };

  add("supplier", /(?:supplier|vendor|merchant|from)[:\s]+([A-Za-z0-9 &.,'-]{2,80})/i.exec(text)?.[1], 0.75);
  add("invoiceNumber", /(?:invoice|receipt)\s*(?:number|no|#)?[:\s#-]+([A-Z0-9-]{3,40})/i.exec(text)?.[1], 0.85);
  add("date", /(?:date|invoice date)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i.exec(text)?.[1], 0.8);
  add("currency", /\b(EUR|USD|GBP|CHF|HUF|RON|€|\$|£)\b/i.exec(text)?.[1], 0.75);
  add("subtotal", /(?:subtotal|net amount)[:\s]+([€$£]?\s?\d[\d.,]*)/i.exec(text)?.[1], 0.75);
  add("tax", /(?:vat|tax|gst)[:\s]+([€$£]?\s?\d[\d.,]*)/i.exec(text)?.[1], 0.75);
  add("total", /\b(?:total|amount due|grand total)[:\s]+([€$£]?\s?\d[\d.,]*)/i.exec(text)?.[1], 0.85);
  const lineItems = extractLineItems(text);
  if (lineItems.length > 0) fields.push({ field: "lineItems", value: lineItems, confidence: 0.65 });
  return fields;
}

function buildAccountingDocumentRows(extractedData: Record<string, unknown>[]) {
  const valueFor = (field: string) => extractedData.find((item) => item.field === field)?.value;
  const supplier = stringOrNull(valueFor("supplier"));
  const invoiceNumber = stringOrNull(valueFor("invoiceNumber"));
  const total = parseLocalizedNumber(valueFor("total"));
  const tax = parseLocalizedNumber(valueFor("tax"));
  const subtotal = parseLocalizedNumber(valueFor("subtotal"));
  const lineItems = valueFor("lineItems");

  return [
    {
      transaction_date: stringOrNull(valueFor("date")),
      description: [supplier, invoiceNumber ? `invoice ${invoiceNumber}` : null].filter(Boolean).join(" - ") || "Extracted accounting document",
      supplier_customer: supplier,
      amount: Number.isFinite(total) ? total : null,
      currency: normalizeCurrency(valueFor("currency")),
      vat_tax: Number.isFinite(tax) ? tax : null,
      invoice_reference: invoiceNumber,
      subtotal: Number.isFinite(subtotal) ? subtotal : null,
      line_items: Array.isArray(lineItems) ? lineItems : [],
    },
  ];
}

function extractLineItems(text: string) {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => /^(?:item|line item)[:\s-]+(.+?)\s+(?:qty[:\s]+)?(\d+(?:[.,]\d+)?)\s+(?:total[:\s]+)?([€$£]?\s?\d[\d.,]*)$/i.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({
      description: match[1]?.trim() || "",
      quantity: parseLocalizedNumber(match[2]),
      total: parseLocalizedNumber(match[3]),
    }))
    .filter((item) => item.description && Number.isFinite(item.quantity) && Number.isFinite(item.total))
    .filter((item) => {
      const key = `${item.description.toLowerCase()}|${item.quantity}|${item.total}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeCurrency(value: unknown) {
  const text = stringOrNull(value);
  if (!text) return null;
  if (text === "€") return "EUR";
  if (text === "$") return "USD";
  if (text === "£") return "GBP";
  return text.toUpperCase();
}

function inferMimeType(fileName: string) {
  const extension = getFileExtension(fileName);
  if (extension === ".csv") return "text/csv";
  if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === ".xls") return "application/vnd.ms-excel";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function displayUploadType(uploadType: AccountancyUploadType) {
  if (uploadType === "receipt") return "Receipts/Invoices";
  if (uploadType === "bank") return "Bank export";
  return uploadType.toUpperCase();
}

function safeLogMeta(
  input: { fileName: string; mimeType: string; uploadType: AccountancyUploadType; datasetType: AccountancyDatasetType },
  stage: AccountancyUploadStage,
  error: unknown,
) {
  return {
    fileName: input.fileName,
    extension: getFileExtension(input.fileName),
    mimeType: input.mimeType || "unknown",
    uploadType: input.uploadType,
    datasetType: input.datasetType,
    processingRoute: uploadSpecs[input.uploadType].route,
    stage,
    error: error instanceof Error ? error.message : String(error),
  };
}
