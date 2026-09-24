import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

import {
  ACCOUNTANCY_UPLOAD_ACCEPT,
  ACCOUNTANCY_UPLOAD_UNSUPPORTED_MESSAGE,
  detectAccountancyUploadFormat,
} from "../../src/lib/accountancy/upload-detection"
import { getAccountancyUploadSpec } from "../../src/lib/accountancy/upload-processing"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8")
}

const accountancyPage = readProjectFile("src/app/(auth)/app/accountancy/page.tsx")
const accountancyErrorPage = readProjectFile("src/app/(auth)/app/accountancy/error.tsx")
const prebookkeepingPage = readProjectFile("src/app/(auth)/app/prebookkeeping/page.tsx")
const uploadComponent = readProjectFile("src/components/accountancy/accountancy-upload.tsx")
const reviewWorkspace = readProjectFile("src/components/accountancy/prebookkeeping-review-workspace.tsx")
const categorizationActions = readProjectFile("src/components/accountancy/prebookkeeping-categorization-actions.tsx")
const uploadRoute = readProjectFile("src/app/api/accountancy/upload/route.ts")
const processor = readProjectFile("src/lib/accountancy/upload-processing.ts")
const datasetLimits = readProjectFile("src/lib/usage/dataset-limits.ts")
const datasetAccess = readProjectFile("src/lib/data/dataset-access.ts")

function listAccountancyAppFiles(dir: string): string[] {
  const entries = readdirSync(join(repoRoot, dir))
  return entries.flatMap((entry) => {
    const relative = `${dir}/${entry}`
    const absolute = join(repoRoot, relative)
    return statSync(absolute).isDirectory() ? listAccountancyAppFiles(relative) : [relative]
  })
}

// 1. Accountancy contains no full bookkeeping uploader.
for (const file of listAccountancyAppFiles("src/app/(auth)/app/accountancy")) {
  const source = readProjectFile(file)
  assert.ok(!source.includes("AccountancyUpload"), `${file} renders no bookkeeping uploader`)
  assert.ok(!source.includes("AccountancyPackageForm"), `${file} renders no bookkeeping package form`)
  assert.ok(!source.includes('type="file"'), `${file} instantiates no hidden file input`)
  assert.ok(!source.includes("onDrop"), `${file} instantiates no dropzone`)
  assert.ok(!source.includes("DataProcessingFlow"), `${file} instantiates no upload processing flow`)
  assert.ok(!source.includes("BookkeepingQueue"), `${file} renders no operational bookkeeping queue`)
}

// 2. Accountancy retains "Open Pre-bookkeeping".
assert.ok(accountancyPage.includes("Open Pre-bookkeeping"), "Accountancy keeps the Open Pre-bookkeeping quick action")
assert.ok(accountancyErrorPage.includes("Open Pre-bookkeeping"), "Accountancy error state keeps the Open Pre-bookkeeping action")

// 3. CTA resolves to the canonical Pre-bookkeeping route.
assert.ok(accountancyPage.includes('href="/app/prebookkeeping"'), "Accountancy CTA href points at /app/prebookkeeping")
assert.ok(existsSync(join(repoRoot, "src/app/(auth)/app/prebookkeeping/page.tsx")), "the canonical Pre-bookkeeping route exists")

// 4. Pre-bookkeeping renders exactly ONE uploader.
assert.equal(
  (prebookkeepingPage.match(/<AccountancyUpload/g) || []).length,
  1,
  "Pre-bookkeeping renders exactly one canonical uploader instance",
)

// 5. Empty state does not instantiate another uploader.
const emptyStateStart = prebookkeepingPage.indexOf("{!focusedDataset && (")
assert.ok(emptyStateStart > -1, "Pre-bookkeeping keeps an explicit no-dataset branch")
const emptyStateSource = prebookkeepingPage.slice(emptyStateStart, prebookkeepingPage.indexOf("</Card>", emptyStateStart))
assert.ok(emptyStateSource.includes("No pre-bookkeeping dataset selected"), "the no-dataset state shows the neutral empty-state message")
assert.ok(!emptyStateSource.includes("AccountancyUpload"), "the empty state instantiates no second uploader")

// 6. Selected-dataset state does not instantiate another uploader.
assert.ok(prebookkeepingPage.includes("PrebookkeepingReviewWorkspace"), "the selected dataset renders the canonical review workspace")
for (const [name, source] of [
  ["prebookkeeping review workspace", reviewWorkspace],
  ["pre-bookkeeping categorization actions", categorizationActions],
] as const) {
  assert.ok(!source.includes("AccountancyUpload"), `${name} instantiates no second uploader`)
  assert.ok(!source.includes('type="file"'), `${name} instantiates no hidden file input`)
  assert.ok(!source.includes("onDrop"), `${name} instantiates no dropzone`)
}

// 7-11. Automatic file-format routing: the file determines its format.
const formatExpectations: Array<[string, string, "csv" | "excel" | "pdf" | "receipt" | "bank"]> = [
  ["ledger.csv", "text/csv", "csv"],
  ["LEDGER.CSV", "", "csv"],
  ["ledger.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "excel"],
  ["ledger.xls", "application/vnd.ms-excel", "excel"],
  ["invoice.pdf", "application/pdf", "pdf"],
  ["receipt.jpg", "image/jpeg", "receipt"],
  ["receipt.jpeg", "image/jpeg", "receipt"],
  ["receipt.png", "image/png", "receipt"],
  ["receipt.webp", "image/webp", "receipt"],
  ["bank.ofx", "application/octet-stream", "bank"],
  ["bank.qif", "application/octet-stream", "bank"],
  ["bank.qfx", "application/vnd.intu.qfx", "bank"],
  ["ledger.csv ", "text/csv", "csv"],
]

for (const [fileName, mimeType, expectedFormat] of formatExpectations) {
  assert.equal(detectAccountancyUploadFormat(fileName, mimeType), expectedFormat, `${fileName} detects as ${expectedFormat}`)
  const spec = getAccountancyUploadSpec(expectedFormat)
  const extension = `.${fileName.trim().toLowerCase().split(".").pop()}`
  assert.ok(
    spec.extensions.includes(extension),
    `detected ${expectedFormat} maps to the existing supported extension list ${spec.extensions.join(", ")}`,
  )
}

// CSV tab + valid .xlsx → Excel is recognized and accepted (no CSV rejection).
assert.equal(detectAccountancyUploadFormat("10_accountancy_ledger.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "excel")
// Excel tab + valid .csv → CSV is recognized and accepted.
assert.equal(detectAccountancyUploadFormat("10_accountancy_ledger.csv", "text/csv"), "csv")
// The extension stays authoritative when the browser MIME disagrees.
assert.equal(detectAccountancyUploadFormat("ledger.csv", "application/vnd.ms-excel"), "csv")
assert.equal(detectAccountancyUploadFormat("ledger.xlsx", "text/csv"), "excel")

// Extension-less files still resolve through their MIME type.
assert.equal(detectAccountancyUploadFormat("download", "text/csv"), "csv")
assert.equal(detectAccountancyUploadFormat("download", "application/pdf"), "pdf")
assert.equal(detectAccountancyUploadFormat("download", "image/png"), "receipt")

// 12. Unsupported extensions produce the neutral supported-formats error.
assert.equal(detectAccountancyUploadFormat("notes.txt", "text/plain"), null, "unsupported extensions never map to a pipeline")
assert.equal(detectAccountancyUploadFormat("report.docx", ""), null)
assert.equal(detectAccountancyUploadFormat("file", ""), null)
assert.equal(detectAccountancyUploadFormat("file", "application/octet-stream"), null, "ambiguous catch-all MIME never identifies a format")
assert.equal(ACCOUNTANCY_UPLOAD_UNSUPPORTED_MESSAGE, "Unsupported file format. Upload a CSV, Excel, PDF, or supported scan file.")
assert.ok(uploadComponent.includes("ACCOUNTANCY_UPLOAD_UNSUPPORTED_MESSAGE"), "the uploader renders the neutral unsupported-format message")
assert.ok(!uploadComponent.includes("Please upload a valid"), "the misleading tab-based CSV error is removed")

// Dropped and picked files share the same detection entry point.
assert.ok(uploadComponent.includes("detectAccountancyUploadFormat(file.name, file.type)"), "drop and picker uploads resolve the format from the actual file")
assert.ok(uploadComponent.includes("setSelectedType(detectedFormat)"), "the active format tab follows the detected format")
assert.ok(uploadComponent.includes("accept={ACCOUNTANCY_UPLOAD_ACCEPT}"), "the file picker accepts every supported format regardless of the active tab")
for (const accepted of [".csv", ".xlsx", ".xls", ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".ofx", ".qif", ".qfx"]) {
  assert.ok(ACCOUNTANCY_UPLOAD_ACCEPT.includes(accepted), `picker accept list includes ${accepted}`)
}

// 13. One upload creates at most one dataset.
assert.equal((processor.match(/tx\.insert\(datasets\)/g) || []).length, 1, "the processor inserts at most one dataset row per upload")
const duplicateIndex = processor.indexOf("eq(datasets.checksum, checksum)")
const insertIndex = processor.indexOf("tx.insert(datasets)")
assert.ok(duplicateIndex > -1 && duplicateIndex < insertIndex, "duplicate uploads return the existing dataset before any insert")
assert.ok(uploadComponent.includes("if (uploading) return"), "the uploader blocks a second concurrent upload action")
assert.ok(uploadComponent.includes("if (isUploadBlocked || uploading) return"), "dropping a file cannot start a second concurrent upload")

// 14. Retry clears only the upload failure state.
const retryIndex = uploadComponent.indexOf("Upload failed</h3>")
assert.ok(retryIndex > -1, "the uploader keeps an upload-failed state")
const retryBlock = uploadComponent.slice(retryIndex, uploadComponent.indexOf(") : uploadStatus === \"limit-reached\"", retryIndex))
assert.ok(retryBlock.includes('setUploadStatus("idle")'), "retry resets the failure status")
assert.ok(retryBlock.includes('setErrorMessage("")'), "retry clears the error message")
assert.ok(retryBlock.includes("setProcessingStep(0)"), "retry resets the processing step")
assert.ok(retryBlock.includes("checkConnection()"), "retry re-checks the connection")
assert.ok(!retryBlock.includes("setUploadedFiles"), "retry keeps already uploaded files")

// 15. Dataset limits remain enforced.
const limitCheckStart = uploadRoute.indexOf('if (datasetType === "prebookkeeping")')
const processCallStart = uploadRoute.indexOf("await processAccountancyUpload")
assert.ok(limitCheckStart > -1 && limitCheckStart < processCallStart, "the pre-bookkeeping limit check runs before processing")
assert.ok(uploadRoute.includes("DATASET_LIMIT_REACHED"), "limit breaches return DATASET_LIMIT_REACHED")
assert.ok(processor.includes("getAccountancyLimitInfo") && processor.includes("getAccountancyLimitError"), "accountancy dataset limits stay enforced in the processor")
assert.ok(processor.indexOf("getAccountancyLimitInfo") > -1, "accountancy limit check exists")
const processorInsertIndex = processor.indexOf("tx.insert(datasets)")
assert.ok(processor.indexOf("getAccountancyLimitError") < processorInsertIndex, "accountancy limit check runs before the dataset insert")

// 16. Normal-user dataset isolation remains intact.
assert.ok(accountancyPage.includes("and(eq(datasets.id, focusedDatasetId), eq(datasets.userId, userId))"), "Accountancy focused datasets stay owner-scoped")
assert.ok(prebookkeepingPage.includes("and(eq(datasets.id, focusedDatasetId), eq(datasets.userId, userId))"), "Pre-bookkeeping focused datasets stay owner-scoped")
assert.ok(processor.includes("userId: input.userId"), "uploads stay owned by the authenticated user")
assert.ok(datasetLimits.includes('ne(datasets.datasetType, "prebookkeeping")'), "workspace dataset limits exclude pre-bookkeeping datasets from the standard count")

// 17. Superadmin behavior remains intentional.
assert.ok(datasetLimits.includes('role === "superadmin"') || datasetLimits.includes("isSuperadmin"), "dataset limits keep the explicit superadmin bypass")
assert.ok(existsSync(join(repoRoot, "src/lib/data/dataset-access.ts")), "the shared dataset access helper keeps explicit superadmin handling")

// 18. The canonical Pre-bookkeeping ownership structure stays intact.
assert.ok(prebookkeepingPage.includes("id=\"prebookkeeping-upload\""), "Pre-bookkeeping keeps its single upload section")
assert.ok(prebookkeepingPage.includes("StartCategorizationButton"), "Pre-bookkeeping keeps the categorization action for legacy datasets")
assert.ok(reviewWorkspace.includes("AI Review Summary"), "Pre-bookkeeping keeps the AI review summary")
assert.ok(uploadComponent.includes("useclevr_active_prebookkeeping_dataset_id"), "successful uploads keep persisting the active pre-bookkeeping dataset ID")

console.log("Accountancy ownership and upload format routing regression tests passed.")
