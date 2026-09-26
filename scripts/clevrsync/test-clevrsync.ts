import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getClevrSyncEntitlement } from "@/services/clevrsync/entitlement";
import { matrixToWorksheetPreview, normalizeRowsAsCsv } from "@/services/clevrsync/normalize";

function testExcelConnectorRemoved() {
  const connectorsDir = "src/services/clevrsync/connectors";
  const indexSource = readFileSync("src/services/clevrsync/index.ts", "utf8");
  const previewRoute = readFileSync("src/app/api/clevrsync/preview/route.ts", "utf8");
  const syncRoute = readFileSync("src/app/api/clevrsync/sync/route.ts", "utf8");
  const page = readFileSync("src/app/(auth)/app/settings/data-connections/page.tsx", "utf8");

  assert.equal(tryRead(`${connectorsDir}/excel.ts`), null, "the Excel connector service is removed");
  assert.doesNotMatch(indexSource, /connectors\/excel/);
  assert.doesNotMatch(indexSource, /parseExcelWorkbook|isSupportedExcelFile|toDatasetPayload/);
  assert.doesNotMatch(previewRoute, /parseExcelWorkbook/);
  assert.doesNotMatch(syncRoute, /parseExcelWorkbook/);
  assert.doesNotMatch(page, /Excel Connector/);
  assert.doesNotMatch(
    page,
    /Excel ClevrSync|ClevrSync Excel connector/,
    "the local Excel ClevrSync connector stays removed; Microsoft workbooks are connector sources",
  );
  assert.doesNotMatch(page, /ensureExcelConnector/);
  assert.doesNotMatch(syncRoute, /formData\.get\("file"\)/, "ClevrSync sync no longer accepts uploaded workbook files");
  assert.doesNotMatch(previewRoute, /formData\.get\("file"\)/, "ClevrSync preview no longer accepts uploaded workbook files");
}

function testConnectorTypeGuards() {
  const connectorRoute = readFileSync("src/app/api/clevrsync/connectors/route.ts", "utf8");
  const syncEngine = readFileSync("src/services/clevrsync/sync-engine.ts", "utf8");

  assert.match(connectorRoute, /type === "excel"/, "Excel connector creation is explicitly rejected");
  assert.match(
    connectorRoute,
    /Excel is not a ClevrSync connector/,
    "the rejection message points users to the normal upload",
  );
  assert.match(
    syncEngine,
    /return type === "google_sheets" \|\| type === "onedrive" \|\| type === "sharepoint";/,
    "Google Sheets, OneDrive, and SharePoint remain the available connector types",
  );
}

function testPermissionChecks() {
  const previewRoute = readFileSync("src/app/api/clevrsync/preview/route.ts", "utf8");
  const syncRoute = readFileSync("src/app/api/clevrsync/sync/route.ts", "utf8");
  const connectorRoute = readFileSync("src/app/api/clevrsync/connectors/route.ts", "utf8");
  const oauthStartRoute = readFileSync("src/app/api/clevrsync/google/oauth/start/route.ts", "utf8");
  const syncEngine = readFileSync("src/services/clevrsync/sync-engine.ts", "utf8");

  assert.match(previewRoute, /getGoogleSheetsAccessToken\(\{ userId, connectorId \}\)/);
  assert.match(syncRoute, /getOwnedClevrSyncConnector\(user\.id, connectorId\)/);
  assert.match(connectorRoute, /requireClevrSyncAccess\(session\.user\)/);
  assert.match(previewRoute, /requireClevrSyncAccess\(session\.user\)/);
  assert.match(syncRoute, /requireClevrSyncAccess\(session\.user\)/);
  assert.match(oauthStartRoute, /requireClevrSyncAccess\(session\.user\)/);
  assert.match(syncRoute, /status: 403/);
  assert.match(syncEngine, /eq\(clevrSyncConnectors\.userId, userId\)/);
}

function testClevrSyncEntitlements() {
  const free = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: false });
  assert.equal(free.enabled, false);
  assert.equal(free.connectors.googleSheets, false);
  assert.equal(free.upgradeRequired, true);
  assert.match(free.upgradeHref, /pro_monthly/);

  const pro = getClevrSyncEntitlement({ subscriptionTier: "pro", unlimited: false });
  assert.equal(pro.enabled, true);
  assert.equal(pro.connectors.googleSheets, true);
  assert.equal(pro.connectors.scheduledSync, false);

  const business = getClevrSyncEntitlement({ subscriptionTier: "business", unlimited: false });
  assert.equal(business.enabled, true);
  assert.equal(business.connectors.oneDrive, true);
  assert.equal(business.connectors.sharePoint, true);

  const superadmin = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: true });
  assert.equal(superadmin.enabled, true);
  assert.equal(superadmin.connectors.googleSheets, true);
  assert.equal(superadmin.connectors.oneDrive, true);
  assert.equal(superadmin.connectors.sharePoint, true);

  const freeEntitlement = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: false });
  assert.equal(freeEntitlement.connectors.oneDrive, false);
  assert.equal(freeEntitlement.connectors.sharePoint, false);
}

function testSidebarClevrSyncEntry() {
  const sidebar = readFileSync("src/components/layout/app-sidebar.tsx", "utf8");
  assert.match(sidebar, /name: "Datasets", href: "\/app\/datasets"/);
  assert.match(sidebar, /name: "ClevrSync", href: "\/app\/settings\/data-connections"/);
  assert.ok(
    sidebar.indexOf('name: "Datasets"') < sidebar.indexOf('name: "ClevrSync"'),
    "ClevrSync appears directly after Datasets in the sidebar source order",
  );
  assert.match(
    sidebar,
    /isClevrSyncEnabled/,
    "the sidebar resolves ClevrSync visibility through the plan entitlement",
  );
  assert.match(
    sidebar,
    /item\.name !== "ClevrSync" \|\| isClevrSyncEnabled/,
    "Free users never see the ClevrSync navigation entry",
  );
}

function testFreeUiPremiumLock() {
  const page = readFileSync("src/app/(auth)/app/settings/data-connections/page.tsx", "utf8");
  assert.match(page, /PremiumLock/);
  assert.match(page, /Upgrade to Pro/);
  assert.match(page, /ClevrSync requires Pro or Business/);
  assert.match(page, /upload CSV and XLSX files directly through the Datasets page/);
  assert.match(page, /disabled=\{!access\?\.enabled/);
}

function testFinalConnectorArea() {
  const page = readFileSync("src/app/(auth)/app/settings/data-connections/page.tsx", "utf8");
  const labels = [
    /label: "Google Sheets", status: "Available"/,
    /label: "OneDrive", status: "Available"/,
    /label: "SharePoint", status: "Available"/,
  ];
  for (const pattern of labels) {
    assert.match(page, pattern);
  }
  assert.doesNotMatch(page, /Coming Soon/, "no connector card may advertise Coming Soon");
  assert.doesNotMatch(page, /type: "excel"/, "Excel is not a ClevrSync connector option");
  assert.doesNotMatch(page, /Excel Connector/, "the Excel Connector card is removed");
  assert.doesNotMatch(
    page,
    /Excel ClevrSync|ClevrSync Excel connector/,
    "the removed local Excel ClevrSync connector must not reappear",
  );
}

function testExistingUploadPathRemainsExcelAware() {
  const uploadAction = readFileSync("src/app/actions/upload.ts", "utf8");
  const csvLoader = readFileSync("src/lib/data/csvLoader.ts", "utf8");

  assert.match(uploadAction, /parseCSVStreaming\(file, rowLimit/);
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
  assert.match(uploadAction, /shouldBypassClevrSyncRefreshCredits/);
  assert.match(uploadAction, /Credit reservation bypassed for ClevrSync dataset refresh/);
  assert.match(uploadAction, /feature: "standard_upload_analysis"/);
}

function testGoogleSheetsSyncReusesUploadPipeline() {
  const syncRoute = readFileSync("src/app/api/clevrsync/sync/route.ts", "utf8");
  assert.match(syncRoute, /uploadCSV\(uploadFormData/);
  assert.match(syncRoute, /uploadSource.*clevrsync/);
  assert.match(syncRoute, /clevrsync_connector_type", connector\.type/);
  assert.match(syncRoute, /const datasetId = uploadResult\.datasetId \?\? existingDatasetId/);
  assert.match(syncRoute, /buildClevrSyncSyncResponse/);
  assert.match(syncRoute, /\/app\/dashboard\?datasetId=/);
  assert.match(syncRoute, /redirectTo: redirectUrl/);
}

function testClevrSyncConnectAnalyzeNavigatesToDatasetDashboard() {
  const page = readFileSync("src/app/(auth)/app/settings/data-connections/page.tsx", "utf8");
  assert.match(page, /useRouter/);
  assert.match(page, /router\.push\(nextHref\)/);
  assert.match(page, /getClevrSyncDatasetHref/);
  assert.match(page, /\/app\/dashboard\?datasetId=/);
  assert.match(page, /encodeURIComponent\(datasetId\)/);
  assert.match(page, /Google Sheet synced, but UseClevr did not return an analysis destination/);
  assert.match(page, /selectedGoogleConnector\.sourceMeta\?\.datasetId \? "Sync now" : "Connect & Analyze"/);
}

function testClevrSyncGoogleSourcePersistsCanonicalDatasetSource() {
  const syncRoute = readFileSync("src/app/api/clevrsync/sync/route.ts", "utf8");
  const uploadAction = readFileSync("src/app/actions/upload.ts", "utf8");
  const datasetSource = readFileSync("src/lib/data/dataset-source.ts", "utf8");

  assert.match(syncRoute, /uploadFormData\.set\("clevrsync_connector_type", connector\.type\)/);
  assert.match(uploadAction, /resolveUploadDatasetSource\(formData/);
  assert.match(uploadAction, /clevrSyncConnectorTypeIn/);
  assert.match(uploadAction, /value === "google_sheets"/);
  assert.match(uploadAction, /return clevrSyncConnectorTypeIn\(clevrSyncConnectorType\) \?\? "clevrsync"/);
  assert.match(datasetSource, /"google_sheets"/);
}

function testGoogleOAuthMinimumScope() {
  const source = readFileSync("src/services/clevrsync/connectors/google-sheets.ts", "utf8");
  assert.match(source, /spreadsheets\.readonly/);
  assert.match(source, /drive\.metadata\.readonly/);
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

function tryRead(path: string) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

testExcelConnectorRemoved();
testConnectorTypeGuards();
testPermissionChecks();
testClevrSyncEntitlements();
testSidebarClevrSyncEntry();
testFreeUiPremiumLock();
testFinalConnectorArea();
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
testClevrSyncConnectAnalyzeNavigatesToDatasetDashboard();
testClevrSyncGoogleSourcePersistsCanonicalDatasetSource();
testGoogleOAuthMinimumScope();
testDowngradeKeepsData();

console.log("ClevrSync tests passed");
