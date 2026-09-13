import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as XLSX from "xlsx";

import {
  isSupportedExcelFile,
  parseExcelWorkbook,
  toDatasetPayload,
} from "@/services/clevrsync/connectors/excel";
import { getClevrSyncEntitlement } from "@/services/clevrsync/entitlement";
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
  const connectorRoute = readFileSync("src/app/api/clevrsync/connectors/route.ts", "utf8");
  const oauthStartRoute = readFileSync("src/app/api/clevrsync/google/oauth/start/route.ts", "utf8");
  const syncEngine = readFileSync("src/services/clevrsync/sync-engine.ts", "utf8");

  assert.match(previewRoute, /getOwnedClevrSyncConnector\(session\.user\.id, connectorId\)/);
  assert.match(syncRoute, /getOwnedClevrSyncConnector\(session\.user\.id, connectorId\)/);
  assert.match(connectorRoute, /requireClevrSyncAccess\(session\.user\)/);
  assert.match(previewRoute, /requireClevrSyncAccess\(session\.user\)/);
  assert.match(syncRoute, /requireClevrSyncAccess\(session\.user\)/);
  assert.match(oauthStartRoute, /requireClevrSyncAccess\(session\.user\)/);
  assert.match(previewRoute, /status: 403/);
  assert.match(syncRoute, /status: 403/);
  assert.match(syncEngine, /eq\(clevrSyncConnectors\.userId, userId\)/);
}

function testClevrSyncEntitlements() {
  const free = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: false });
  assert.equal(free.enabled, false);
  assert.equal(free.connectors.excel, false);
  assert.equal(free.connectors.googleSheets, false);
  assert.equal(free.upgradeRequired, true);
  assert.match(free.upgradeHref, /pro_monthly/);

  const pro = getClevrSyncEntitlement({ subscriptionTier: "pro", unlimited: false });
  assert.equal(pro.enabled, true);
  assert.equal(pro.connectors.excel, true);
  assert.equal(pro.connectors.googleSheets, true);
  assert.equal(pro.connectors.scheduledSync, false);

  const business = getClevrSyncEntitlement({ subscriptionTier: "business", unlimited: false });
  assert.equal(business.enabled, true);
  assert.equal(business.connectors.oneDrive, false);
  assert.equal(business.connectors.sharePoint, false);

  const superadmin = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: true });
  assert.equal(superadmin.enabled, true);
  assert.equal(superadmin.connectors.googleSheets, true);
}

function testSidebarClevrSyncEntry() {
  const sidebar = readFileSync("src/components/layout/app-sidebar.tsx", "utf8");
  assert.match(sidebar, /name: "Datasets", href: "\/app\/datasets"/);
  assert.match(sidebar, /name: "ClevrSync", href: "\/app\/settings\/data-connections"/);
  assert.ok(
    sidebar.indexOf('name: "Datasets"') < sidebar.indexOf('name: "ClevrSync"'),
    "ClevrSync appears directly after Datasets in the sidebar source order",
  );
}

function testFreeUiPremiumLock() {
  const page = readFileSync("src/app/(auth)/app/settings/data-connections/page.tsx", "utf8");
  assert.match(page, /PremiumLock/);
  assert.match(page, /Upgrade to Pro/);
  assert.match(page, /ClevrSync requires Pro or Business/);
  assert.match(page, /manual CSV\/XLSX uploads available/);
  assert.match(page, /disabled=\{!access\?\.enabled/);
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
  const syncEngine = readFileSync("src/services/clevrsync/sync-engine.ts", "utf8");
  assert.match(syncEngine, /sanitizeConnector/);
  assert.match(syncEngine, /accessTokenEncrypted: _accessTokenEncrypted/);
  assert.match(syncEngine, /refreshTokenEncrypted: _refreshTokenEncrypted/);
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

function testGoogleOAuthMinimumScope() {
  const source = readFileSync("src/services/clevrsync/connectors/google-sheets.ts", "utf8");
  assert.match(source, /spreadsheets\.readonly/);
  assert.doesNotMatch(source, /drive\.readonly/);
  assert.doesNotMatch(source, /drive\.file/);
}

function testDowngradeKeepsData() {
  const access = readFileSync("src/services/clevrsync/access.ts", "utf8");
  const connectorRoute = readFileSync("src/app/api/clevrsync/connectors/route.ts", "utf8");
  assert.match(access, /ClevrSync requires a Pro or Business plan/);
  assert.doesNotMatch(connectorRoute, /delete\(clevrSyncConnectors\)/);
  assert.doesNotMatch(connectorRoute, /delete\(datasets\)/);
}

testExcelParsing();
testDatasetPayload();
testConnectorValidation();
testPermissionChecks();
testClevrSyncEntitlements();
testSidebarClevrSyncEntry();
testFreeUiPremiumLock();
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
testGoogleOAuthMinimumScope();
testDowngradeKeepsData();

console.log("ClevrSync tests passed");
