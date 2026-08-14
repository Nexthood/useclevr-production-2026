import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { validateAccountancyUpload } from "../../src/lib/accountancy/upload-processing"
import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import { isTemporaryUploadFileName, temporaryUploadFileMessage } from "../../src/lib/upload/temporary-files"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

async function assertRejectsTemporaryParse(fileName: string) {
  await assert.rejects(
    () => parseCSVStreaming(new File(["a,b\n1,2"], fileName, { type: "text/csv" }), 100),
    new RegExp(temporaryUploadFileMessage().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${fileName} must be rejected before parsing`,
  )
}

async function main() {
  for (const fileName of ["~$04_marketplace_startup.xlsx", ".~10_accountancy_ledger.xlsx", "~04_marketplace_startup.xlsx", "~/~10_accountancy_ledger.xlsx"]) {
    assert.equal(isTemporaryUploadFileName(fileName), true, `${fileName} must be classified as temporary`)
  }

  for (const fileName of ["04_marketplace_startup.xlsx", "10_accountancy_ledger.xlsx", "01_local_retail.csv"]) {
    assert.equal(isTemporaryUploadFileName(fileName), false, `${fileName} must remain uploadable`)
  }

  await assertRejectsTemporaryParse("~04_marketplace_startup.xlsx")
  await assertRejectsTemporaryParse("~$10_accountancy_ledger.csv")

  assert.throws(
    () => validateAccountancyUpload({
      fileName: "~10_accountancy_ledger.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 128,
      uploadType: "excel",
      datasetType: "accountancy",
    }),
    /Temporary spreadsheet lock files cannot be uploaded/,
    "accountancy validation rejects temporary lock files before ingestion",
  )

  const simpleUploadRoute = readProjectFile("src/app/api/upload/simple/route.ts")
  assert.ok(simpleUploadRoute.includes("UPLOAD_TEMPORARY_FILE_REJECTED"), "simple upload route returns a temporary-file rejection code")
  assert.ok(simpleUploadRoute.includes("isTemporaryUploadFileName(uploadFile.name)"), "simple upload checks the selected file name before parsing")

  const canonicalUploadAction = readProjectFile("src/app/actions/upload.ts")
  assert.ok(canonicalUploadAction.includes("TEMPORARY_FILE_REJECTED"), "canonical upload action returns a temporary-file rejection code")
  assert.ok(canonicalUploadAction.includes("isTemporaryUploadFileName(uploadFile.name)"), "canonical upload action checks the selected file before demo or parsing branches")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
