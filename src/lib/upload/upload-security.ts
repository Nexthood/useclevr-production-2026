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
export const STANDARD_UPLOAD_FORMAT_EXTENSIONS = [".csv", ".xlsx", ".xls"] as const

export type UploadSecurityCode = "UNSAFE_FILE_TYPE" | "FILE_TYPE_MISMATCH"

export const UNSAFE_FILE_TYPE_MESSAGE =
  "UseClevr blocked this file because its actual file type does not match the document format indicated by its filename."

export const FILE_TYPE_MISMATCH_MESSAGE =
  "UseClevr blocked this file because its contents do not match the document format indicated by its filename."

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

// ============================================================================
// SECURITY REJECTION LOGGING
// ============================================================================

export interface UploadSecurityRejectionEvent {
  source: string
  fileName: string
  claimedMimeType?: string | null
  detectedType?: string | null
  code: string
  reason: string
  userId?: string | null
}

/**
 * Logs a file-security rejection for investigation. Logs only sanitized
 * metadata (timestamp, source, sanitized filename, claimed/detected type,
 * rejection code). Never logs file contents, headers, tokens, or secrets.
 */
export function logUploadSecurityRejection(event: UploadSecurityRejectionEvent) {
  const record = {
    event: "upload_security_rejection",
    timestamp: new Date().toISOString(),
    source: String(event.source || "unknown").slice(0, 80),
    fileName: sanitizeUploadFileNameForLog(event.fileName),
    claimedMimeType: String(event.claimedMimeType || "").slice(0, 100) || null,
    detectedType: event.detectedType ? String(event.detectedType).slice(0, 40) : null,
    code: event.code,
    reason: String(event.reason || "").slice(0, 200),
    userId: event.userId ? String(event.userId).slice(0, 64) : null,
  }
  console.warn(`[UPLOAD-SECURITY] ${JSON.stringify(record)}`)
}

// ============================================================================
// FILENAME NORMALIZATION AND DOUBLE-EXTENSION ANALYSIS
// ============================================================================

/**
 * Executable or browser-renderable file types. When one of these appears in
 * an upload filename's extension chain, the filename is treated as deceptive
 * regardless of position (final extension, penultimate extension used for
 * social engineering, or a null-byte-hidden extension). Ordinary multi-dot
 * business names like `sales.report.september.xlsx` remain valid because
 * their extra segments are not executable or renderable formats.
 */
const DANGEROUS_UPLOAD_FILE_EXTENSIONS = new Set([
  // Browser-renderable / scriptable document formats
  "html", "htm", "xhtml", "shtml", "xht", "svg", "svgz",
  // Client-side script formats
  "js", "mjs", "cjs", "jse", "vbs", "vbe", "wsf", "wsh", "ws", "ps1", "ps1xml", "ps2", "psc1",
  // Server-page and interpreter formats
  "php", "phtml", "asp", "aspx", "asax", "ascx", "jsp", "jspx", "py", "pyw", "rb", "pl", "cgi",
  // Native executables and installers
  "exe", "msi", "msix", "bat", "cmd", "com", "pif", "scr", "hta", "jar", "apk", "app", "gadget",
  "dll", "sys", "drv", "cpl", "msc", "lnk", "scf", "sh", "bash", "zsh", "jnlp", "deb", "rpm",
])

export interface AnalyzedUploadFileName {
  normalizedFileName: string
  baseName: string
  /** All dot-separated suffixes of the normalized filename, lowercased, in order. */
  extensions: string[]
  /** Final normalized extension including the leading dot, or "" when none. */
  finalExtension: string
  /** Extensions from the chain that are executable/renderable and must never appear in an upload name. */
  dangerousExtensions: string[]
  /** True when percent-encoded sequences were decoded during normalization. */
  wasEncoded: boolean
}

const ZERO_WIDTH_CHARACTER_PATTERN = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufeff]/g
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b-\u001f\u007f]/g

function decodeFileNameTokens(fileName: string) {
  let decoded = fileName
  let wasEncoded = false
  for (let pass = 0; pass < 2; pass += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      break
    }
    if (next === decoded) break
    decoded = next
    wasEncoded = true
  }
  return { decoded, wasEncoded }
}

/**
 * Normalizes an upload filename for security analysis: strips control,
 * zero-width, and null bytes, applies Unicode NFKC normalization (fullwidth
 * dots and lookalike compatibility forms collapse to ASCII), decodes
 * percent-encoded sequences including double encoding, and trims trailing
 * spaces and dots that desktop file handling would otherwise drop.
 */
export function normalizeUploadFileName(fileName: string): AnalyzedUploadFileName {
  const raw = String(fileName || "")
  let normalized = raw.normalize("NFKC").replace(CONTROL_CHARACTER_PATTERN, "").replace(ZERO_WIDTH_CHARACTER_PATTERN, "")

  const { decoded, wasEncoded } = decodeFileNameTokens(normalized)
  normalized = decoded.normalize("NFKC").replace(CONTROL_CHARACTER_PATTERN, "").replace(ZERO_WIDTH_CHARACTER_PATTERN, "")

  const baseName = normalized.split(/[\\/]/).pop() || ""
  const trimmedBaseName = baseName.replace(/[\s.]+$/g, "")

  const extensions = trimmedBaseName
    .toLowerCase()
    .split(".")
    .slice(1)
    .filter((extension) => extension.length > 0)

  const finalExtension = extensions.length > 0 ? `.${extensions[extensions.length - 1]}` : ""
  const dangerousExtensions = extensions.filter((extension) => DANGEROUS_UPLOAD_FILE_EXTENSIONS.has(extension))

  return {
    normalizedFileName: trimmedBaseName,
    baseName: trimmedBaseName.replace(/\.[^.]*$/, ""),
    extensions,
    finalExtension,
    dangerousExtensions,
    wasEncoded,
  }
}

export interface UploadFileNameAnalysis extends AnalyzedUploadFileName {
  isTemporary: boolean
  dangerous: boolean
}

/**
 * Full filename security analysis. Detects temporary lock files, percent
 * encoding tricks, null-byte chains, and deceptive extension chains such as
 * `invoice.pdf.html` or `report.xlsx.exe`.
 */
export function analyzeUploadFileName(fileName: string): UploadFileNameAnalysis {
  const analyzed = normalizeUploadFileName(fileName)
  return {
    ...analyzed,
    isTemporary: isTemporaryUploadFileName(analyzed.normalizedFileName),
    dangerous: analyzed.dangerousExtensions.length > 0,
  }
}

export function getStandardUploadFileKind(fileName: string): StandardUploadFileKind | null {
  const analyzed = normalizeUploadFileName(fileName)
  if ((STANDARD_UPLOAD_FORMAT_EXTENSIONS as readonly string[]).includes(analyzed.finalExtension)) {
    return analyzed.finalExtension.slice(1) as StandardUploadFileKind
  }
  return null
}

export function assertStandardUploadFileName(
  fileName: string,
  options: { trustedFileName?: boolean } = {},
): StandardUploadFileKind {
  const analyzed = analyzeUploadFileName(fileName)

  if (analyzed.isTemporary) {
    throw new UploadValidationError("UPLOAD_TEMPORARY_FILE_REJECTED", temporaryUploadFileMessage(), 422)
  }

  if (analyzed.dangerous && !options.trustedFileName) {
    logUploadSecurityRejection({
      source: "standard-upload",
      fileName,
      code: "UNSAFE_FILE_TYPE",
      reason: `deceptive filename extension chain: ${analyzed.dangerousExtensions.join(", ")}`,
    })
    throw new UploadValidationError("UNSAFE_FILE_TYPE", UNSAFE_FILE_TYPE_MESSAGE, 422)
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

// ============================================================================
// CONTENT SNIFFING (SERVER-SIDE, NEVER CLIENT-DECLARED)
// ============================================================================

export type DetectedFileContentKind =
  | "pdf"
  | "zip"
  | "xlsx"
  | "ole"
  | "jpeg"
  | "png"
  | "webp"
  | "gif"
  | "html"
  | "svg"
  | "xml"
  | "text"
  | "binary"

export interface ZipArchiveEntry {
  name: string
  compressedSize: number
  uncompressedSize: number
}

export interface ZipArchiveInspection {
  entries: ZipArchiveEntry[]
  totalUncompressedBytes: number
  totalCompressedBytes: number
}

const MAX_ZIP_DIRECTORY_ENTRIES = 2048

function findZipEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 22 - 65535)
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (
      buffer[offset] === 0x50 &&
      buffer[offset + 1] === 0x4b &&
      buffer[offset + 2] === 0x05 &&
      buffer[offset + 3] === 0x06
    ) {
      return offset
    }
  }
  return -1
}

/**
 * Reads the ZIP central directory without decompressing anything. Used to
 * verify OOXML structure and enforce decompressed-size, compression-ratio,
 * entry-count, and worksheet-count limits before any parser inflates the
 * archive.
 */
export function inspectZipCentralDirectory(buffer: Buffer): ZipArchiveInspection | null {
  const eocdOffset = findZipEndOfCentralDirectory(buffer)
  if (eocdOffset < 0) return null

  const entryCount = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12)
  let centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)

  if (centralDirectoryOffset + centralDirectorySize > buffer.length) return null

  const entries: ZipArchiveEntry[] = []
  let totalUncompressedBytes = 0
  let totalCompressedBytes = 0
  let visited = 0

  while (
    visited < entryCount &&
    entries.length < MAX_ZIP_DIRECTORY_ENTRIES &&
    centralDirectoryOffset + 46 <= buffer.length &&
    buffer.readUInt32LE(centralDirectoryOffset) === 0x02014b50
  ) {
    const compressedSize = buffer.readUInt32LE(centralDirectoryOffset + 20)
    const uncompressedSize = buffer.readUInt32LE(centralDirectoryOffset + 24)
    const nameLength = buffer.readUInt16LE(centralDirectoryOffset + 28)
    const extraLength = buffer.readUInt16LE(centralDirectoryOffset + 30)
    const commentLength = buffer.readUInt16LE(centralDirectoryOffset + 32)

    const nameStart = centralDirectoryOffset + 46
    const name = buffer.toString("utf8", nameStart, Math.min(nameStart + nameLength, buffer.length))

    entries.push({ name, compressedSize, uncompressedSize })
    totalUncompressedBytes += uncompressedSize
    totalCompressedBytes += compressedSize
    centralDirectoryOffset = nameStart + nameLength + extraLength + commentLength
    visited += 1
  }

  if (visited < entryCount && entryCount <= MAX_ZIP_DIRECTORY_ENTRIES) return null

  return { entries, totalUncompressedBytes, totalCompressedBytes }
}

const HTML_DOCUMENT_MARKERS = ["<!doctype html", "<html", "<svg"] as const

/**
 * Infers the real file type from bytes. Filename and browser MIME type are
 * never consulted. HTML and SVG documents are reported as active content so
 * callers can reject them even when the extension looks like a safe data
 * format.
 */
export function detectFileContentKind(buffer: Buffer): DetectedFileContentKind {
  if (buffer.length === 0) return "binary"

  const head = buffer.subarray(0, Math.min(buffer.length, 4096))

  const pdfWindow = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("latin1")
  if (pdfWindow.includes("%PDF-")) {
    return "pdf"
  }

  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => head[offset + index] === byte)

  if (startsWith([0x50, 0x4b]) && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07)) {
    return "zip"
  }

  if (startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return "ole"
  }

  if (startsWith([0xff, 0xd8, 0xff])) return "jpeg"
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return "png"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && head.subarray(8, 12).toString("latin1") === "WEBP") return "webp"
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return "gif"

  // Text-based detection. NUL bytes mean this is not plain text.
  if (head.includes(0)) return "binary"

  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(head)
  } catch {
    return "binary"
  }

  const trimmed = text.replace(/^\uFEFF/, "").replace(/^\s+/, "").toLowerCase().slice(0, 256)
  const loweredHead = text.toLowerCase().slice(0, 1024)

  if (trimmed.startsWith("<svg")) return "svg"
  if (HTML_DOCUMENT_MARKERS.some((marker) => trimmed.startsWith(marker))) return "html"
  if (trimmed.startsWith("<?xml") && loweredHead.includes("<svg")) return "svg"
  if (trimmed.startsWith("<?xml")) return "xml"

  return "text"
}

// ============================================================================
// CONTENT-VERSUS-EXTENSION VERIFICATION
// ============================================================================

const EXPECTED_CONTENT_KINDS_BY_EXTENSION: Record<string, DetectedFileContentKind> = {
  csv: "text",
  xlsx: "xlsx",
  xls: "ole",
  pdf: "pdf",
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
}

export const MAX_XLSX_DECOMPRESSED_BYTES = 512 * 1024 * 1024
export const MAX_XLSX_COMPRESSION_RATIO = 200
export const MAX_XLSX_WORKSHEET_COUNT = 255

const XLSX_WORKSHEET_NAME_PATTERN = /^xl\/worksheets\/sheet\d+\.xml$/i

function isXlsxWorkbookArchive(inspection: ZipArchiveInspection) {
  const names = new Set(inspection.entries.map((entry) => entry.name.toLowerCase()))
  const hasContentTypes = names.has("[content_types].xml")
  const hasWorkbook = names.has("xl/workbook.xml") || names.has("xl/workbook.bin")
  return hasContentTypes && hasWorkbook
}

function isOfxText(text: string) {
  const lowered = text.toLowerCase()
  return lowered.includes("<ofx") || lowered.includes("ofxheader")
}

/**
 * QIF files are line-oriented with single-letter codes. The `!Type` header is
 * conventional but not mandatory, so record lines (D date, T amount, ^
 * record separator) also identify the format.
 */
function isQifText(text: string) {
  const lowered = text.toLowerCase()
  if (lowered.startsWith("!type") || lowered.startsWith("!account")) return true

  const lines = lowered.split(/\r?\n/).slice(0, 40)
  const hasDateLine = lines.some((line) => /^d\d{1,4}[/-]\d{1,2}/.test(line))
  const hasAmountLine = lines.some((line) => /^t-?[\d.,]+/.test(line))
  const hasRecordSeparator = lines.some((line) => line.trim() === "^")
  return (hasDateLine && hasAmountLine) || (hasAmountLine && hasRecordSeparator)
}

export interface UploadContentCheckOptions {
  source?: string
  claimedMimeType?: string | null
  trustedFileName?: boolean
}

/**
 * Verifies that file contents match the format claimed by the filename
 * extension. Rejects HTML/SVG documents masquerading as data files, generic
 * ZIP or OLE containers without the expected workbook parts, images with
 * wrong signatures, XLSX archives with macro projects, and XLSX archives
 * exceeding decompressed-size, compression-ratio, entry-count, or
 * worksheet-count limits. Runs entirely before any document parser receives
 * the bytes.
 */
export function assertUploadFileContentMatchesExtension(
  input: Buffer | Uint8Array,
  fileName: string,
  options: UploadContentCheckOptions = {},
): DetectedFileContentKind {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
  const analyzed = normalizeUploadFileName(fileName)
  const extension = analyzed.finalExtension.replace(/^\./, "")
  const detected = detectFileContentKind(buffer)
  const source = options.source || "standard-upload"

  const buildRejection = (code: UploadSecurityCode | "UPLOAD_SPREADSHEET_STRUCTURE_INVALID", reason: string) => {
    logUploadSecurityRejection({
      source,
      fileName,
      claimedMimeType: options.claimedMimeType,
      detectedType: detected,
      code,
      reason,
    })
    return new UploadValidationError(
      code,
      code === "UNSAFE_FILE_TYPE"
        ? UNSAFE_FILE_TYPE_MESSAGE
        : code === "FILE_TYPE_MISMATCH"
          ? FILE_TYPE_MISMATCH_MESSAGE
          : "The spreadsheet file is not a valid Excel workbook.",
      422,
    )
  }

  // Active content (HTML/SVG documents) is never accepted as a business
  // data file, regardless of the extension it carries.
  if (detected === "html" || detected === "svg") {
    throw buildRejection("UNSAFE_FILE_TYPE", `active ${detected} document uploaded as .${extension || "no-extension"} file`)
  }

  if (extension === "csv") {
    if (detected !== "text") {
      throw buildRejection("FILE_TYPE_MISMATCH", `csv file contains ${detected} content instead of plain text`)
    }
    return detected
  }

  if (extension === "xlsx") {
    if (detected !== "zip") {
      throw buildRejection("UPLOAD_SPREADSHEET_STRUCTURE_INVALID", "xlsx file content is not a ZIP-based spreadsheet")
    }

    const inspection = inspectZipCentralDirectory(buffer)
    if (!inspection) {
      throw buildRejection("UPLOAD_SPREADSHEET_STRUCTURE_INVALID", "xlsx file has an unreadable or malformed ZIP structure")
    }

    if (!isXlsxWorkbookArchive(inspection)) {
      throw buildRejection("FILE_TYPE_MISMATCH", "ZIP archive does not contain an Excel workbook structure")
    }

    const worksheetCount = inspection.entries.filter((entry) => XLSX_WORKSHEET_NAME_PATTERN.test(entry.name)).length
    if (worksheetCount > MAX_XLSX_WORKSHEET_COUNT) {
      throw buildRejection("UNSAFE_FILE_TYPE", `xlsx archive declares ${worksheetCount} worksheets, above the supported limit`)
    }

    if (inspection.totalUncompressedBytes > MAX_XLSX_DECOMPRESSED_BYTES) {
      throw buildRejection("UNSAFE_FILE_TYPE", `xlsx archive decompresses to ${inspection.totalUncompressedBytes} bytes, above the supported limit`)
    }

    const ratio = inspection.totalCompressedBytes > 0
      ? inspection.totalUncompressedBytes / inspection.totalCompressedBytes
      : 1
    if (ratio > MAX_XLSX_COMPRESSION_RATIO) {
      throw buildRejection("UNSAFE_FILE_TYPE", `xlsx archive compression ratio ${ratio.toFixed(1)}x exceeds the supported limit`)
    }

    const hasMacroProject = inspection.entries.some((entry) => /vbaProject\.bin$/i.test(entry.name))
    if (hasMacroProject) {
      throw buildRejection("UNSAFE_FILE_TYPE", "xlsx archive contains a VBA macro project")
    }

    return "xlsx"
  }

  if (extension === "xls") {
    if (detected !== "ole") {
      throw buildRejection("UPLOAD_SPREADSHEET_STRUCTURE_INVALID", "xls file content is not a legacy Excel binary")
    }
    return detected
  }

  if (extension === "ofx" || extension === "qfx") {
    const text = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8")
    if (!isOfxText(text)) {
      throw buildRejection("FILE_TYPE_MISMATCH", `${extension} file does not contain OFX markup`)
    }
    return detected
  }

  if (extension === "qif") {
    const text = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8")
    if (detected !== "text" || !isQifText(text)) {
      throw buildRejection("FILE_TYPE_MISMATCH", "qif file does not contain Quicken transaction records")
    }
    return detected
  }

  const expectedKind = EXPECTED_CONTENT_KINDS_BY_EXTENSION[extension]
  if (expectedKind && detected !== expectedKind) {
    throw buildRejection("FILE_TYPE_MISMATCH", `${extension} file contains ${detected} content instead of ${expectedKind}`)
  }

  return detected
}

// ============================================================================
// STANDARD UPLOAD ENTRYPOINT (CSV / XLSX / XLS)
// ============================================================================

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

/**
 * Server-side security validation for standard uploads. Verifies the
 * normalized filename (temporary files, deceptive extension chains), size,
 * declared MIME compatibility, and real content signatures. Filename,
 * extension, and browser MIME type are never trusted on their own; content
 * verification runs before any parser receives the bytes.
 */
export async function assertStandardUploadFile(
  file: File,
  options: UploadContentCheckOptions = {},
): Promise<StandardUploadFileKind> {
  const kind = assertStandardUploadFileName(file.name, options)
  assertStandardUploadSize(file)
  assertStandardUploadMime(kind, file.type)

  if (kind === "csv") {
    const head = new Uint8Array(await file.slice(0, Math.min(file.size, 4096)).arrayBuffer())
    assertUploadFileContentMatchesExtension(head, file.name, {
      ...options,
      claimedMimeType: file.type,
    })
    await assertCsvLooksParseable(file)
    return kind
  }

  const buffer = new Uint8Array(await file.arrayBuffer())
  assertUploadFileContentMatchesExtension(buffer, file.name, {
    ...options,
    claimedMimeType: file.type,
  })

  return kind
}
