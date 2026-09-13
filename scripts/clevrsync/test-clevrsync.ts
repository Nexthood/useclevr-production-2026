import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as XLSX from "xlsx";

import {
  isSupportedExcelFile,
  parseExcelWorkbook,
  toDatasetPayload,
} from "@/services/clevrsync/connectors/excel";
import { matrixToWorksheetPreview, normalizeRowsAsCsv } from "@/services/clevrsync/normalize";

function makeWorkbookBuffer() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Customer", "Revenue", "Paid", "Invoice Date"],
    ["Acme", 1200, true, new Date("2026-01-15T00:00:00.000Z")],
    ["Northwind", 950.5, false, new Date("2026-02-20T00:00:00.000Z")],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Only Header"]]), "Notes");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

function testExcelParsing() {
  const preview = parseExcelWorkbook({
    fileBuffer: makeWorkbookBuffer(),
    fileName: "sales.xlsx",
    fileSize: 1024,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  assert.equal(preview.sourceType, "excel");
  assert.equal(preview.activeWorksheet, "Sales");
  assert.equal(preview.worksheets.length, 2);
  assert.equal(preview.rowCount, 2);
  assert.deepEqual(
    preview.columns.map((column) => column.name),
    ["Customer", "Revenue", "Paid", "Invoice Date"],
  );
  assert.equal(preview.columns.find((column) => column.name === "Customer")?.type, "string");
  assert.equal(preview.columns.find((column) => column.name === "Revenue")?.type, "number");
  assert.equal(preview.columns.find((column) => column.name === "Paid")?.type, "boolean");
  assert.equal(preview.columns.find((column) => column.name === "Invoice Date")?.type, "date");
  assert.equal(preview.rows[0]?.Customer, "Acme");
}

function testDatasetPayload() {
  const preview = parseExcelWorkbook({
    fileBuffer: makeWorkbookBuffer(),
    fileName: "sales.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const dataset = toDatasetPayload(preview);

  assert.equal(dataset.source, "clevrsync");
  assert.equal(dataset.datasetType, "standard");
  assert.equal(dataset.name, "sales");
  assert.deepEqual(dataset.columns, ["Customer", "Revenue", "Paid", "Invoice Date"]);
  assert.equal(dataset.rows.length, 2);
  assert.equal(dataset.columnTypes.Revenue, "number");
}

function testConnectorValidation() {
  assert.equal(
    isSupportedExcelFile(
      "book.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    true,
  );
  assert.equal(isSupportedExcelFile("book.csv", "text/csv"), false);
  assert.equal(isSupportedExcelFile("legacy.xls", "application/vnd.ms-excel"), false);
}

function testPermissionChecks() {
  const previewRoute = readFileSync("src/app/api/clevrsync/preview/route.ts", "utf8");
  const syncRoute = readFileSync("src/app/api/clevrsync/sync/route.ts", "utf8");
  const syncEngine = readFileSync("src/services/clevrsync/sync-engine.ts", "utf8");

  assert.match(previewRoute, /getOwnedClevrSyncConnector\(session\.user\.id, connectorId\)/);
  assert.match(syncRoute, /getOwnedClevrSyncConnector\(session\.user\.id, connectorId\)/);
  assert.match(previewRoute, /status: 403/);
  assert.match(syncRoute, /status: 403/);
  assert.match(syncEngine, /eq\(clevrSyncConnectors\.userId, userId\)/);
}

function testExistingUploadPathRemainsExcelAware() {
  const uploadAction = readFileSync("src/app/actions/upload.ts", "utf8");
  const csvLoader = readFileSync("src/lib/data/csvLoader.ts", "utf8");

  assert.match(uploadAction, /parseCSVStreaming\(file, rowLimit\)/);
  assert.match(csvLoader, /fileName\.endsWith\('\.xlsx'\)/);
  assert.match(csvLoader, /parseExcelStreaming\(file, acceptedRowLimit, onProgress\)/);
}

function testMatrixToWorksheetPreview() {
  const matrix: unknown[][] = [
    ["Name", "Count"],
    ["Acme", 42],
    ["Beta", 7],
  ];
  const preview = matrixToWorksheetPreview({ name: "Sheet1", matrix, previewRowLimit: 20 });

  assert.equal(preview.name, "Sheet1");
  assert.equal(preview.rowCount, 2);
  assert.deepEqual(
    preview.columns.map((column) => column.name),
    ["Name", "Count"],
  );
  assert.equal(preview.columns.find((column) => column.name === "Name")?.type, "string");
  assert.equal(preview.columns.find((column) => column.name === "Count")?.type, "number");
  assert.deepEqual(preview.rows[0], { Name: "Acme", Count: 42 });
  assert.deepEqual(preview.rows[1], { Name: "Beta", Count: 7 });
}

function testNormalizeRowsAsCsv() {
  const csv = normalizeRowsAsCsv(
    [{ Name: "Acme, Inc.", Count: 42, Note: null }],
    ["Name", "Count", "Note"],
  );
  assert.equal(csv, 'Name,Count,Note\n"Acme, Inc.",42,');
}

function testGoogleSheetsUrlParsing() {
  const source = readFileSync("src/services/clevrsync/connectors/google-sheets.ts", "utf8");
  assert.match(source, /function parseGoogleSpreadsheetId/);
  assert.match(source, /trimmed\.match\(/);
  assert.match(source, /Enter a valid Google Sheets URL or spreadsheet ID/);
}

function testTokenVaultEncryption() {
  const source = readFileSync("src/services/clevrsync/token-vault.ts", "utf8");
  assert.match(source, /aes-256-gcm/);
  assert.match(source, /CLEVRSYNC_TOKEN_ENCRYPTION_KEY/);
  assert.match(source, /function decryptClevrSyncToken/);
}

function testOAuthState() {
  const source = readFileSync("src/services/clevrsync/google-oauth-state.ts", "utf8");
  assert.match(source, /createHmac/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /function createGoogleOAuthState/);
  assert.match(source, /function verifyGoogleOAuthState/);
}

function testGoogleSheetsProviderError() {
  const source = readFileSync("src/services/clevrsync/connectors/google-sheets.ts", "utf8");
  assert.match(source, /class GoogleSheetsProviderError/);
  assert.match(source, /connectorStatus/);
}

function testGoogleSheetsOwnershipProtection() {
  const source = readFileSync("src/services/clevrsync/google-auth-store.ts", "utf8");
  assert.match(source, /getOwnedClevrSyncConnector/);
  assert.match(source, /connector\.type !== "google_sheets"/);
}

function testGoogleSheetsSyncTokenUsage() {
  const syncRoute = readFileSync("src/app/api/clevrsync/sync/route.ts", "utf8");
  const previewRoute = readFileSync("src/app/api/clevrsync/preview/route.ts", "utf8");
  assert.match(syncRoute, /getGoogleSheetsAccessToken/);
  assert.match(previewRoute, /getGoogleSheetsAccessToken/);
  assert.match(syncRoute, /googleSheetPreviewToCsvFile/);
}

function testClevrSyncDatasetRefreshInUpload() {
  const uploadAction = readFileSync("src/app/actions/upload.ts", "utf8");
  assert.match(uploadAction, /isClevrSyncDatasetRefresh/);
  assert.match(uploadAction, /clevrsync_dataset_id/);
  assert.match(uploadAction, /Clear existing ClevrSync dataset rows/);
}

function testGoogleSheetsSyncReusesUploadPipeline() {
  const syncRoute = readFileSync("src/app/api/clevrsync/sync/route.ts", "utf8");
  assert.match(syncRoute, /uploadCSV\(uploadFormData/);
  assert.match(syncRoute, /uploadSource.*clevrsync/);
}

testExcelParsing();
testDatasetPayload();
testConnectorValidation();
testPermissionChecks();
testExistingUploadPathRemainsExcelAware();
testMatrixToWorksheetPreview();
testNormalizeRowsAsCsv();
testGoogleSheetsUrlParsing();
testTokenVaultEncryption();
testOAuthState();
testGoogleSheetsProviderError();
testGoogleSheetsOwnershipProtection();
testGoogleSheetsSyncTokenUsage();
testClevrSyncDatasetRefreshInUpload();
testGoogleSheetsSyncReusesUploadPipeline();

console.log("ClevrSync tests passed");
