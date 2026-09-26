/**
 * Regression tests proving Microsoft ClevrSync credit semantics and dataset
 * isolation by construction:
 *
 *   - discovery and preview consume 0 credits (no credit-engine access)
 *   - Connect & Analyze bills exactly the standard 10-credit upload+analysis
 *     feature once, through the central reserve/finalize/release engine
 *   - transient Microsoft failures happen before reservation and can never
 *     charge credits
 *   - Sync now refreshes the same dataset and bypasses refresh credits
 *   - datasets imported from OneDrive/SharePoint flow into the canonical
 *     dataset pipeline and stay strictly selected-dataset scoped
 *
 * Run: pnpm test:clevrsync-microsoft-credits-isolation
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  isSafeGraphId,
  isSafeGraphSiteId,
  isSafeWorksheetId,
} from "@/services/clevrsync/connectors/microsoft-graph";

function read(path: string) {
  return readFileSync(path, "utf8");
}

function testDiscoveryAndPreviewStayCreditFree() {
  const creditFreeRoutes = [
    "src/app/api/clevrsync/microsoft/onedrive/files/route.ts",
    "src/app/api/clevrsync/microsoft/sharepoint/sites/route.ts",
    "src/app/api/clevrsync/microsoft/sharepoint/drives/route.ts",
    "src/app/api/clevrsync/microsoft/sharepoint/files/route.ts",
    "src/app/api/clevrsync/microsoft/worksheets/route.ts",
    "src/app/api/clevrsync/preview/route.ts",
  ];
  for (const route of creditFreeRoutes) {
    const source = read(route);
    assert.doesNotMatch(
      source,
      /credit-engine|reserveCredits|finalizeCredits|releaseCredits/,
      `${route} must not touch the credit engine`,
    );
  }

  const graphConnector = read("src/services/clevrsync/connectors/microsoft-graph.ts");
  assert.doesNotMatch(
    graphConnector,
    /credit|reserve|charge/i,
    "the Graph connector layer must stay credit-agnostic",
  );
}

function testConnectAndAnalyzeBillsOnceThroughCentralEngine() {
  const syncRoute = read("src/app/api/clevrsync/sync/route.ts");
  const uploadAction = read("src/app/actions/upload.ts");

  // Microsoft Connect & Analyze re-enters the canonical upload pipeline as one
  // bundled operation; no separate charging per fetch/parse/analysis step.
  assert.match(syncRoute, /uploadCSV\(uploadFormData/);
  assert.match(syncRoute, /uploadFormData\.set\("uploadSource", "clevrsync"\)/);
  assert.match(syncRoute, /clevrsync_connector_type", connectorType/);

  // The upload action reserves the single standard_upload_analysis feature cost.
  assert.match(uploadAction, /feature: "standard_upload_analysis"/);
  assert.match(
    uploadAction,
    /releaseCredits\(uploadCreditOperationId/,
    "failed imports release the reservation",
  );
  assert.match(
    uploadAction,
    /finalizeCredits\(/,
    "successful imports finalize the reservation",
  );

  // Transient Microsoft failures occur before the reservation is created.
  const fetchIndex = syncRoute.indexOf("previewMicrosoftWorksheet(");
  const uploadIndex = syncRoute.indexOf("await uploadCSV(");
  assert.ok(
    fetchIndex !== -1 && uploadIndex !== -1 && fetchIndex < uploadIndex,
    "Microsoft fetch must complete before uploadCSV reserves credits",
  );

  // Retry cannot double-charge: the reservation operation id is dataset-scoped
  // and the refresh path is credit-bypassed entirely.
  assert.match(uploadAction, /clevrSyncRefreshOperationId/);
  assert.match(uploadAction, /shouldBypassClevrSyncRefreshCredits/);
}

function testSyncNowReusesPersistedSourceIdentity() {
  const syncRoute = read("src/app/api/clevrsync/sync/route.ts");

  // Sync now falls back to the persisted authoritative identifiers.
  for (const metaKey of ["driveId", "itemId", "worksheetId", "worksheetName"]) {
    assert.match(
      syncRoute,
      new RegExp(`sourceMeta\\.${metaKey}`),
      `Sync now must reuse the persisted ${metaKey}`,
    );
  }
  assert.match(
    syncRoute,
    /clevrsync_dataset_id/,
    "Sync now must refresh the linked dataset instead of creating duplicates",
  );
  assert.match(
    syncRoute,
    /lastSuccessfulSync/,
    "the connector must record the last successful sync",
  );
}

function testDatasetProvenanceVocabulary() {
  const datasetSource = read("src/lib/data/dataset-source.ts");
  assert.match(datasetSource, /"onedrive"/, "dataset source vocabulary must include onedrive");
  assert.match(datasetSource, /"sharepoint"/, "dataset source vocabulary must include sharepoint");
  assert.match(datasetSource, /onedrive: "OneDrive"/);
  assert.match(datasetSource, /sharepoint: "SharePoint"/);

  const uploadAction = read("src/app/actions/upload.ts");
  assert.match(
    uploadAction,
    /value === "google_sheets" \|\| value === "onedrive" \|\| value === "sharepoint"/,
    "Microsoft connector types must resolve the canonical dataset source",
  );

  const syncRoute = read("src/app/api/clevrsync/sync/route.ts");
  for (const provenanceKey of ["workbookName", "siteId", "driveId", "itemId", "worksheetId", "lastSuccessfulSync"]) {
    assert.match(
      syncRoute,
      new RegExp(provenanceKey),
      `Microsoft sync must persist ${provenanceKey} provenance`,
    );
  }
}

function testDatasetIsolationInvariants() {
  const aggregation = read("src/lib/data/dashboard-dataset-aggregation.ts");

  assert.match(
    aggregation,
    /eq\(datasets\.userId, userId\)/,
    "dashboard aggregation must always stay user-scoped",
  );
  assert.match(
    aggregation,
    /eq\(datasets\.id, options\.datasetId\)/,
    "dashboard aggregation must scope to the selected dataset when one is provided",
  );

  const dashboard = read("src/app/(auth)/app/page.tsx");
  assert.match(dashboard, /parseDatasetId/);
  assert.match(dashboard, /selectDashboardDataset/);
  assert.match(
    dashboard,
    /selectedDatasetId \?\? stats\.latestDataset\?\.id/,
    "the latest-dataset fallback only applies when no dataset is selected",
  );
  assert.match(
    dashboard,
    /\/app\/dashboard\?datasetId=/,
    "dashboards open through the selected-dataset URL",
  );

  // Cross-user dataset access stays impossible: every dataset API enforces
  // owner equality together with the id filter.
  const datasetRoute = read("src/app/api/datasets/[id]/route.ts");
  assert.match(
    datasetRoute,
    /eq\(datasets\.userId, session\.user\.id\)/,
    "dataset APIs must enforce ownership",
  );
}

function testSecurityInvariants() {
  const startRoute = read("src/app/api/clevrsync/microsoft/oauth/start/route.ts");
  const callbackRoute = read("src/app/api/clevrsync/microsoft/oauth/callback/route.ts");
  const syncRoute = read("src/app/api/clevrsync/sync/route.ts");
  const discoveryRoutes = [
    "src/app/api/clevrsync/microsoft/onedrive/files/route.ts",
    "src/app/api/clevrsync/microsoft/sharepoint/sites/route.ts",
    "src/app/api/clevrsync/microsoft/sharepoint/drives/route.ts",
    "src/app/api/clevrsync/microsoft/sharepoint/files/route.ts",
    "src/app/api/clevrsync/microsoft/worksheets/route.ts",
  ];

  // Ownership: connector access is always resolved server-side for the session user.
  assert.match(startRoute, /session\.user\.id/);
  assert.match(callbackRoute, /session\.user\.id/);
  assert.match(syncRoute, /getOwnedClevrSyncConnector\(user\.id, connectorId\)/);
  assert.match(syncRoute, /status: 403/, "cross-user connector access must be forbidden");
  for (const route of discoveryRoutes) {
    const source = read(route);
    assert.match(source, /resolveOwnedMicrosoftConnector\(/);
    assert.match(source, /microsoft_not_connected/);
    assert.doesNotMatch(
      source,
      /request\.body/,
      "discovery routes must not trust client-sent connector ownership",
    );
  }

  // No secrets in serialized payloads.
  const payloadsSource = [syncRoute, ...discoveryRoutes];
  for (const source of payloadsSource) {
    assert.doesNotMatch(
      source,
      /JSON\.stringify\(\{[^}]*accessToken/,
      "connector payloads must never serialize tokens",
    );
  }

  // Identifier validation lives in the Graph layer.
  const graph = read("src/services/clevrsync/connectors/microsoft-graph.ts");
  for (const guard of [
    "isSafeGraphId",
    "isSafeGraphSiteId",
    "isSafeWorksheetId",
    "isSafeGraphPath",
    "assertSafeGraphId",
    "assertSafeGraphSiteId",
    "assertSafeWorksheetId",
  ]) {
    assert.match(graph, new RegExp(guard), `the Graph layer must keep the ${guard} guard`);
  }
}

function testGraphIdentifierGuards() {
  assert.ok(isSafeGraphId("b!AbcDefGhi-Jklmnop123456"), "benign Graph ids must pass");
  assert.ok(isSafeGraphId("01BYE5RZ6QN3ZWBTUFOFD3GJKN2XG2BGCP"));
  for (const evil of [
    "../../etc/passwd",
    "a/b",
    "a?b",
    "a#b",
    "a b",
    "%2e%2e",
    "a%00b",
    "",
    "a",
  ]) {
    assert.equal(
      isSafeGraphId(evil),
      false,
      `hostile identifier ${JSON.stringify(evil)} must be rejected by the Graph id guard`,
    );
  }

  assert.ok(isSafeGraphSiteId("contoso.com,site-guid-1,web-guid-1"));
  for (const evil of ["../sites/x", "a..b", "a/b", "a b", ""]) {
    assert.equal(
      isSafeGraphSiteId(evil),
      false,
      `hostile site identifier ${JSON.stringify(evil)} must be rejected`,
    );
  }

  assert.ok(isSafeWorksheetId("{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}"));
  assert.ok(isSafeWorksheetId("A1B2C3D4E5F6"));
  for (const evil of ["{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}/x", "short", "a{b}c{}d", ""]) {
    assert.equal(
      isSafeWorksheetId(evil),
      false,
      `hostile worksheet identifier ${JSON.stringify(evil)} must be rejected`,
    );
  }
}

function testEntitlementGateStillCentral() {
  const entitlement = read("src/services/clevrsync/entitlement.ts");
  assert.match(entitlement, /oneDrive: enabled/);
  assert.match(entitlement, /sharePoint: enabled/);
  assert.match(entitlement, /googleSheets: enabled/);
  assert.match(entitlement, /scheduledSync: false/);
  assert.match(entitlement, /PAID_CLEVRSYNC_TIERS/);

  // No duplicate plan logic inside the Microsoft connector or auth store.
  const graphConnector = read("src/services/clevrsync/connectors/microsoft-graph.ts");
  const authStore = read("src/services/clevrsync/microsoft-auth-store.ts");
  for (const source of [graphConnector, authStore]) {
    assert.doesNotMatch(
      source,
      /subscriptionTier|upgradeRequired|PAID_CLEVRSYNC/,
      "Microsoft connector code must not duplicate plan logic",
    );
  }
}

async function main() {
  testDiscoveryAndPreviewStayCreditFree();
  testConnectAndAnalyzeBillsOnceThroughCentralEngine();
  testSyncNowReusesPersistedSourceIdentity();
  testDatasetProvenanceVocabulary();
  testDatasetIsolationInvariants();
  testSecurityInvariants();
  testGraphIdentifierGuards();
  testEntitlementGateStillCentral();
  console.log("Microsoft credits + isolation regression tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
