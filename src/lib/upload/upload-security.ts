import * as XLSX from "xlsx"

import { isTemporaryUploadFileName, temporaryUploadFileMessage } from "@/lib/upload/temporary-files"
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_COLUMNS,
  MAX_UPLOAD_ROWS,
  formatUploadBytes,
} from "@/lib/upload/upload-limits"

export { MAX_UPLOAD_BYTES, MAX_UPLOAD_COLUMNS, MAX_UPLOAD_ROWS } from "@/lib/upload/upload-limits"

export type StandardUploadFileKind = "csv" | "xlsx" | "xls"

export class UploadValidationError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 422) {
    super(message)
    this.name = "UploadValidationError"
    this.code = code
    this.status = status
  }
}

export function uploadValidationErrorPayload(error: unknown, fallbackCode = "UPLOAD_PARSE_FAILED") {
  if (error instanceof UploadValidationError) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
    }
  }

  return {
    code: fallbackCode,
    status: 422,
    message: "Unable to parse this CSV or Excel file. Check that it has a header row and at least one data row.",
  }
}

export function sanitizeUploadFileNameForLog(fileName: string) {
  return fileName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "_")
    .replace(/\.\.+/g, ".")
    .trim()
    .slice(0, 180) || "upload"
}

export function getStandardUploadFileKind(fileName: string): StandardUploadFileKind | null {
  const normalized = fileName.toLowerCase()
  if (normalized.endsWith(".csv")) return "csv"
  if (normalized.endsWith(".xlsx")) return "xlsx"
  if (normalized.endsWith(".xls")) return "xls"
  return null
}

export function assertStandardUploadFileName(fileName: string): StandardUploadFileKind {
  if (isTemporaryUploadFileName(fileName)) {
    throw new UploadValidationError("UPLOAD_TEMPORARY_FILE_REJECTED", temporaryUploadFileMessage(), 422)
  }

  const kind = getStandardUploadFileKind(fileName)
  if (!kind) {
    throw new UploadValidationError(
      "UPLOAD_FILE_TYPE_INVALID",
      "File must be a CSV or Excel file (.csv, .xlsx, .xls).",
      422,
    )
  }

  return kind
}

export function assertStandardUploadSize(file: Pick<File, "size">) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(
      "UPLOAD_FILE_TOO_LARGE",
      `File must be ${formatUploadBytes(MAX_UPLOAD_BYTES)} or smaller.`,
      413,
    )
  }
}

export function assertStandardUploadMime(kind: StandardUploadFileKind, mimeType?: string | null) {
  const mime = String(mimeType || "").trim().toLowerCase()
  if (!mime) return

  if (kind === "csv") {
    if (
      mime === "text/csv" ||
      mime === "application/csv" ||
      mime === "text/plain" ||
      mime === "application/vnd.ms-excel" ||
      mime === "application/octet-stream"
    ) {
      return
    }
  }

  if (kind === "xlsx") {
    if (
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/zip" ||
      mime === "application/octet-stream"
    ) {
      return
    }
  }

  if (kind === "xls") {
    if (mime === "application/vnd.ms-excel" || mime === "application/octet-stream") {
      return
    }
  }

  throw new UploadValidationError(
    "UPLOAD_FILE_TYPE_INVALID",
    "The file type does not match the file extension.",
    422,
  )
}

export async function assertStandardUploadFile(file: File) {
  const kind = assertStandardUploadFileName(file.name)
  assertStandardUploadSize(file)
  assertStandardUploadMime(kind, file.type)

  if (kind === "csv") {
    await assertCsvLooksParseable(file)
  } else {
    await assertExcelSignature(file, kind)
  }

  return kind
}

export function assertWorksheetBounds(rowCount: number, columnCount: number) {
  if (rowCount > MAX_UPLOAD_ROWS) {
    throw new UploadValidationError(
      "UPLOAD_ROW_LIMIT_EXCEEDED",
      `File has more than ${MAX_UPLOAD_ROWS.toLocaleString("en-US")} supported data rows.`,
      422,
    )
  }

  if (columnCount > MAX_UPLOAD_COLUMNS) {
    throw new UploadValidationError(
      "UPLOAD_COLUMN_LIMIT_EXCEEDED",
      `File has more than ${MAX_UPLOAD_COLUMNS.toLocaleString("en-US")} supported columns.`,
      422,
    )
  }
}

export function assertWorkbookHasSheets(workbook: XLSX.WorkBook) {
  if (!Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    throw new UploadValidationError(
      "UPLOAD_SPREADSHEET_STRUCTURE_INVALID",
      "Spreadsheet contains no worksheets.",
      422,
    )
  }
}

async function assertCsvLooksParseable(file: File) {
  const sample = await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer()
  let text = ""

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(sample)
  } catch {
    throw new UploadValidationError(
      "UPLOAD_CSV_STRUCTURE_INVALID",
      "CSV file must be valid UTF-8 text.",
      422,
    )
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new UploadValidationError(
      "UPLOAD_CSV_STRUCTURE_INVALID",
      "CSV file must contain a header row and at least one data row.",
      422,
    )
  }

  const header = lines[0] || ""
  const hasDelimitedHeader = [",", ";", "\t", "|"].some((delimiter) => header.includes(delimiter))
  const hasSingleColumnRows = header.length > 0 && lines.slice(1).some((line) => line.length > 0)
  if (!hasDelimitedHeader && !hasSingleColumnRows) {
    throw new UploadValidationError(
      "UPLOAD_CSV_STRUCTURE_INVALID",
      "CSV file must contain a plausible header and data structure.",
      422,
    )
  }
}

async function assertExcelSignature(file: File, kind: Exclude<StandardUploadFileKind, "csv">) {
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer())

  if (kind === "xlsx") {
    const hasZipSignature =
      signature[0] === 0x50 &&
      signature[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(signature[2] ?? -1) &&
      [0x04, 0x06, 0x08].includes(signature[3] ?? -1)

    if (!hasZipSignature) {
      throw new UploadValidationError(
        "UPLOAD_SPREADSHEET_STRUCTURE_INVALID",
        "XLSX file is not a valid ZIP-based spreadsheet.",
        422,
      )
    }
    return
  }

  const expectedOle = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
  const hasOleSignature = expectedOle.every((byte, index) => signature[index] === byte)
  if (!hasOleSignature) {
    throw new UploadValidationError(
      "UPLOAD_SPREADSHEET_STRUCTURE_INVALID",
      "XLS file is not a valid legacy Excel spreadsheet.",
      422,
    )
  }
}
