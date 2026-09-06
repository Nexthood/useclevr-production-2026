import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import * as XLSX from "xlsx"

import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_COLUMNS,
  MAX_UPLOAD_ROWS,
  UploadValidationError,
} from "../../src/lib/upload/upload-security"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

function makeXlsxFile(name = "valid.xlsx") {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["month", "revenue"],
    ["2026-01", 1200],
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data")
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
  return new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

function oversizedFile(name: string, type: string) {
  let textCalled = false
  let arrayBufferCalled = false
  return {
    name,
    type,
    size: MAX_UPLOAD_BYTES + 1,
    get textCalled() {
      return textCalled
    },
    get arrayBufferCalled() {
      return arrayBufferCalled
    },
    async text() {
      textCalled = true
      throw new Error("file.text must not be called for oversized uploads")
    },
    async arrayBuffer() {
      arrayBufferCalled = true
      throw new Error("file.arrayBuffer must not be called for oversized uploads")
    },
    slice() {
      throw new Error("file.slice must not be called for oversized uploads")
    },
  } as unknown as File & { textCalled: boolean; arrayBufferCalled: boolean }
}

async function assertUploadError(
  action: () => Promise<unknown>,
  code: string,
  message: string,
) {
  await assert.rejects(
    action,
    (error: unknown) => error instanceof UploadValidationError && error.code === code,
    message,
  )
}

async function main() {
  const validCsv = await parseCSVStreaming(
    new File(["month,revenue\n2026-01,1200\n"], "valid.csv", { type: "text/csv" }),
    MAX_UPLOAD_ROWS,
  )
  assert.deepEqual(validCsv.columns, ["month", "revenue"], "valid small CSV is accepted")
  assert.equal(validCsv.rowCount, 1, "valid small CSV row count is preserved")

  const validXlsx = await parseCSVStreaming(makeXlsxFile(), MAX_UPLOAD_ROWS)
  assert.deepEqual(validXlsx.columns, ["month", "revenue"], "valid small XLSX is accepted")
  assert.equal(validXlsx.rowCount, 1, "valid small XLSX row count is preserved")

  await assertUploadError(
    () => parseCSVStreaming(new File(["not a csv"], "renamed.csv", { type: "text/csv" }), MAX_UPLOAD_ROWS),
    "UPLOAD_CSV_STRUCTURE_INVALID",
    ".txt content renamed to .csv is rejected",
  )

  await assertUploadError(
    () => parseCSVStreaming(new File(["not zip"], "renamed.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }), MAX_UPLOAD_ROWS),
    "UPLOAD_SPREADSHEET_STRUCTURE_INVALID",
    "invalid ZIP renamed to .xlsx is rejected",
  )

  await assertUploadError(
    () => parseCSVStreaming(new File(["month,revenue\n2026-01,1200\n"], "mime-only.txt", { type: "text/csv" }), MAX_UPLOAD_ROWS),
    "UPLOAD_FILE_TYPE_INVALID",
    "CSV MIME type without an allowed extension is rejected",
  )

  await assertUploadError(
    () => parseCSVStreaming(new File(["month,revenue\n2026-01,1200\n"], "image.csv", { type: "image/png" }), MAX_UPLOAD_ROWS),
    "UPLOAD_FILE_TYPE_INVALID",
    "clearly incompatible MIME type is rejected even with a CSV extension",
  )

  const tooLargeCsv = oversizedFile("large.csv", "text/csv")
  await assertUploadError(
    () => parseCSVStreaming(tooLargeCsv, MAX_UPLOAD_ROWS),
    "UPLOAD_FILE_TOO_LARGE",
    "oversized CSV is rejected",
  )
  assert.equal(tooLargeCsv.textCalled, false, "oversized CSV is rejected before file.text")

  const tooLargeXlsx = oversizedFile("large.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  await assertUploadError(
    () => parseCSVStreaming(tooLargeXlsx, MAX_UPLOAD_ROWS),
    "UPLOAD_FILE_TOO_LARGE",
    "oversized XLSX is rejected",
  )
  assert.equal(tooLargeXlsx.arrayBufferCalled, false, "oversized XLSX is rejected before file.arrayBuffer")

  await assertUploadError(
    () => parseCSVStreaming(new File(["PK\u0003\u0004"], "macro.xlsm", { type: "application/vnd.ms-excel.sheet.macroEnabled.12" }), MAX_UPLOAD_ROWS),
    "UPLOAD_FILE_TYPE_INVALID",
    ".xlsm uploads are rejected",
  )

  const excessiveRows = `value\n${Array.from({ length: MAX_UPLOAD_ROWS + 1 }, (_, index) => index).join("\n")}\n`
  await assertUploadError(
    () => parseCSVStreaming(new File([excessiveRows], "too-many-rows.csv", { type: "text/csv" }), MAX_UPLOAD_ROWS),
    "UPLOAD_ROW_LIMIT_EXCEEDED",
    "CSV row limits are enforced",
  )

  const excessiveColumns = Array.from({ length: MAX_UPLOAD_COLUMNS + 1 }, (_, index) => `c${index}`)
  await assertUploadError(
    () => parseCSVStreaming(new File([`${excessiveColumns.join(",")}\n${excessiveColumns.map(() => "1").join(",")}\n`], "too-many-columns.csv", { type: "text/csv" }), MAX_UPLOAD_ROWS),
    "UPLOAD_COLUMN_LIMIT_EXCEEDED",
    "CSV column limits are enforced",
  )

  await assertUploadError(
    () => parseCSVStreaming(new File(["a,b\n1,2\n"], "~$temporary.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }), MAX_UPLOAD_ROWS),
    "UPLOAD_TEMPORARY_FILE_REJECTED",
    "temporary Office filenames are rejected",
  )

  const parserSource = readProjectFile("src/lib/data/csvLoader.ts")
  assert.ok(parserSource.includes("assertWorkbookHasSheets(workbookMetadata)"), "workbooks with no sheets fail before worksheet conversion")
  assert.ok(parserSource.includes("assertWorksheetBounds(worksheetRowCount, worksheetColumnCount)"), "Excel worksheet bounds are checked before sheet_to_json")
  const streamingExcelParser = parserSource.slice(parserSource.indexOf("async function parseExcelStreaming"))
  assert.ok(streamingExcelParser.indexOf("assertWorksheetBounds(worksheetRowCount, worksheetColumnCount)") < streamingExcelParser.indexOf("sheet_to_json(worksheet"), "Excel bounds are checked before materializing rows")
  assert.ok(parserSource.includes("cellFormula: false"), "Excel parsing does not retain formula definitions")
  assert.ok(parserSource.includes("bookVBA: false"), "Excel parsing does not retain VBA project data")

  const simpleRoute = readProjectFile("src/app/api/upload/simple/route.ts")
  assert.ok(simpleRoute.includes("await assertStandardUploadFile(uploadFile)"), "standard simple route validates file before parsing")
  assert.ok(simpleRoute.includes("payload.status"), "standard simple route preserves upload validation status")
  assert.ok(simpleRoute.includes("isSaasMrrMovementUpload(businessModel, parsed.columns)"), "simple upload detects SaaS MRR movement datasets before row persistence")
  assert.ok(simpleRoute.includes("storeFullRowsForSaasMrrMovement ? parsed.previewRows.length : SIMPLE_ROW_INSERT_LIMIT"), "simple upload stores full rows only for SaaS MRR movement datasets")

  const uploadRoute = readProjectFile("src/app/api/upload/route.ts")
  assert.ok(uploadRoute.includes("UPLOAD_FILE_TOO_LARGE"), "canonical upload API maps file-size failures")
  assert.ok(uploadRoute.includes("? 413"), "canonical upload API returns HTTP 413 for oversized files")

  const uploadAction = readProjectFile("src/app/actions/upload.ts")
  assert.ok(uploadAction.includes("await assertStandardUploadFile(uploadFile)"), "authenticated normal upload flow uses shared pre-parse validation")
  assert.ok(uploadAction.includes("parseCSVStreaming(file, rowLimit)"), "authenticated normal upload flow still reaches the standard parser")

  const standardUploadUi = readProjectFile("src/components/forms/csv-upload.tsx")
  assert.ok(standardUploadUi.includes("MAX_UPLOAD_BYTES"), "Standard upload UI uses the shared upload byte limit")
  assert.ok(standardUploadUi.includes("formatUploadBytes(MAX_UPLOAD_BYTES)"), "Standard upload UI renders the shared upload byte limit")
  assert.equal(standardUploadUi.includes("50MB for standard uploads"), false, "Standard upload UI no longer hardcodes the old size limit")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
