export type AccountancyUploadFormat = "csv" | "excel" | "pdf" | "receipt" | "bank"

export const ACCOUNTANCY_UPLOAD_UNSUPPORTED_MESSAGE =
  "Unsupported file format. Upload a CSV, Excel, PDF, or supported scan file."

// Extension routing mirrors the server-side Accountancy upload specs. When the
// same extension is claimed by several pipelines, the visible CSV / Excel /
// PDF-Scan formats win and scan extensions route to the receipt scanner.
const EXTENSION_UPLOAD_FORMATS: Record<string, AccountancyUploadFormat> = {
  ".csv": "csv",
  ".xlsx": "excel",
  ".xls": "excel",
  ".pdf": "pdf",
  ".jpg": "receipt",
  ".jpeg": "receipt",
  ".png": "receipt",
  ".webp": "receipt",
  ".ofx": "bank",
  ".qif": "bank",
  ".qfx": "bank",
}

// MIME fallback for files without a usable extension. Ambiguous catch-all MIME
// types (application/octet-stream, empty string) are accepted by the server but
// cannot identify a format, so they never match here.
const MIME_UPLOAD_FORMATS: Array<[AccountancyUploadFormat, string[]]> = [
  ["csv", ["text/csv", "application/csv", "text/plain"]],
  ["excel", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]],
  ["pdf", ["application/pdf"]],
  ["receipt", ["image/jpeg", "image/png", "image/webp"]],
  ["bank", ["application/x-ofx", "application/vnd.intu.qfx"]],
]

export function getFileUploadExtension(fileName: string) {
  const extensionMatch = /\.([a-z0-9]+)$/.exec(fileName.trim().toLowerCase())
  return extensionMatch ? `.${extensionMatch[1]}` : ""
}

export function detectAccountancyUploadFormat(fileName: string, mimeType: string): AccountancyUploadFormat | null {
  const extension = getFileUploadExtension(fileName)
  if (extension) {
    return EXTENSION_UPLOAD_FORMATS[extension] ?? null
  }

  const normalizedMime = (mimeType || "").trim().toLowerCase()
  if (!normalizedMime) return null
  for (const [format, mimes] of MIME_UPLOAD_FORMATS) {
    if (mimes.includes(normalizedMime)) return format
  }
  return null
}

// File-picker hint accepting every supported Accountancy upload format so the
// active tab never blocks selecting a valid file of another format.
export const ACCOUNTANCY_UPLOAD_ACCEPT = [
  ".csv",
  ".xlsx",
  ".xls",
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".ofx",
  ".qif",
  ".qfx",
  "text/csv",
  "application/csv",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/jpeg",
  "image/png",
  "image/webp",
].join(",")
