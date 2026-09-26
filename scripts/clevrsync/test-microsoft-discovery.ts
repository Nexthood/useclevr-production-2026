/**
 * Regression tests for the shared ClevrSync Microsoft Graph infrastructure
 * (OneDrive + SharePoint).
 *
 * Run: pnpm test:clevrsync-microsoft-discovery
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildMicrosoftAuthorizationUrl,
  getMicrosoftScopes,
  getMicrosoftWorkbookMeta,
  hasMicrosoftScope,
  listOneDriveWorkbooks,
  listSharePointDrives,
  listSharePointWorkbooks,
  microsoftPreviewToCsvFile,
  MicrosoftGraphError,
  previewMicrosoftWorksheet,
  requiresMicrosoftFileScope,
  requiresSharePointSitesScope,
  searchSharePointSites,
} from "@/services/clevrsync/connectors/microsoft-graph";
import { getClevrSyncEntitlement } from "@/services/clevrsync/entitlement";

process.env.MICROSOFT_CLEVRSYNC_CLIENT_ID = "test-client-id";
process.env.MICROSOFT_CLEVRSYNC_CLIENT_SECRET = "test-client-secret";

type StubResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
};

function withStubbedFetch(
  stub: (url: URL, init?: RequestInit) => StubResponse | Promise<StubResponse>,
) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(String(input));
    calls.push({ url, init });
    return stub(url, init);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function jsonResponse(status: number, payload: unknown, headers?: Record<string, string>): StubResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers?.[name.toLowerCase()] ?? null },
    json: async () => payload,
  };
}

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function testAuthorizationUrlRequestsLeastPrivilegeScopes() {
  const onedriveUrl = buildMicrosoftAuthorizationUrl({
    state: "state-value",
    redirectUri: "https://app.useclevr.com/api/clevrsync/microsoft/oauth/callback",
    connectorType: "onedrive",
  });
  const onedriveScope = (getMicrosoftScopes("onedrive") || []).join(" ");
  assert.match(onedriveUrl.searchParams.get("scope") || onedriveScope, /Files\.Read\.All/);
  assert.match(onedriveUrl.searchParams.get("scope") || onedriveScope, /offline_access/);
  assert.match(onedriveUrl.searchParams.get("scope") || onedriveScope, /User\.Read/);
  assert.doesNotMatch(
    onedriveUrl.searchParams.get("scope") || onedriveScope,
    /Sites\.Read\.All/,
    "OneDrive consent must not request SharePoint site scopes",
  );
  assert.doesNotMatch(
    onedriveUrl.searchParams.get("scope") || onedriveScope,
    /ReadWrite|ReadWrite\.All|Sites\.ReadWrite\.All|Files\.ReadWrite/,
    "ClevrSync is read-only: no write scopes may be requested",
  );
  assert.equal(onedriveUrl.searchParams.get("response_type"), "code");
  assert.equal(onedriveUrl.searchParams.get("response_mode"), "query");
  assert.equal(onedriveUrl.searchParams.get("state"), "state-value");
  assert.match(onedriveUrl.toString(), /login\.microsoftonline\.com/);
  assert.match(onedriveUrl.toString(), /\/oauth2\/v2\.0\/authorize/);

  const sharepointScope = getMicrosoftScopes("sharepoint").join(" ");
  assert.match(sharepointScope, /Sites\.Read\.All/);
  assert.doesNotMatch(sharepointScope, /Sites\.ReadWrite\.All|Sites\.FullControl\.All/);
}

function testScopeCoverageHelpers() {
  assert.equal(
    hasMicrosoftScope("Files.Read.All User.Read offline_access", "Files.Read.All"),
    true,
  );
  assert.equal(
    hasMicrosoftScope(
      "https://graph.microsoft.com/Files.Read.All https://graph.microsoft.com/User.Read",
      "Files.Read.All",
    ),
    true,
    "granted scopes may arrive as full resource URIs",
  );
  assert.equal(
    hasMicrosoftScope("User.Read offline_access", "Sites.Read.All"),
    false,
    "a OneDrive-only grant must not satisfy SharePoint scopes",
  );
  assert.equal(hasMicrosoftScope(null, "Files.Read.All"), false);
  assert.equal(requiresMicrosoftFileScope(null), true);
  assert.equal(
    requiresMicrosoftFileScope("Files.Read.All User.Read offline_access"),
    false,
  );
  assert.equal(requiresSharePointSitesScope("Files.Read.All"), true);
  assert.equal(
    requiresSharePointSitesScope("Files.Read.All Sites.Read.All offline_access"),
    false,
  );
}

async function testOneDriveWorkbookListing() {
  const stub = withStubbedFetch(() =>
    jsonResponse(200, {
      value: [
        {
          id: "item01ONE",
          name: "Retail Sales.xlsx",
          file: { mimeType: EXCEL_MIME },
          size: 15360,
          lastModifiedDateTime: "2026-09-20T10:00:00.000Z",
          parentReference: { path: "/drive/root:/Reports" },
        },
        {
          id: "item02ONE",
          name: "Notes.docx",
          file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
          parentReference: { path: "/drive/root:/Reports" },
        },
        {
          id: "item03ONE",
          name: "Legacy.xls",
          file: { mimeType: "application/vnd.ms-excel" },
          parentReference: { path: "/drive/root:/" },
        },
        {
          id: "item04ONE",
          name: "Archive",
          folder: { childCount: 2 },
        },
        { name: "broken entry" },
      ],
      "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/drive/root/search(q='x')?$skiptoken=abc",
    }),
  );
  try {
    const result = await listOneDriveWorkbooks({ accessToken: "ms-token", search: "sales" });
    assert.equal(stub.calls.length, 1, "listing must issue exactly one Graph request");
    const request = stub.calls[0];
    assert.equal(
      request.init?.headers && (request.init.headers as Record<string, string>).Authorization,
      "Bearer ms-token",
    );
    assert.match(request.url.pathname, /\/me\/drive\/root\/search\(q='sales'\)$/);
    assert.equal(request.url.searchParams.get("$top"), "30");

    assert.equal(result.workbooks.length, 1, "listing must keep only .xlsx workbooks");
    assert.deepEqual(result.workbooks[0], {
      driveId: null,
      itemId: "item01ONE",
      name: "Retail Sales.xlsx",
      folderPath: "Reports",
      lastModified: "2026-09-20T10:00:00.000Z",
      size: 15360,
    });
    assert.equal(
      JSON.stringify(result).includes("ms-token"),
      false,
      "listing results must never contain tokens",
    );
    assert.equal(result.nextPageToken, "/v1.0/me/drive/root/search(q='x')?$skiptoken=abc");
  } finally {
    stub.restore();
  }
}

async function testOneDriveRootChildrenListing() {
  const stub = withStubbedFetch(() => jsonResponse(200, { value: [] }));
  try {
    await listOneDriveWorkbooks({ accessToken: "ms-token" });
    assert.equal(stub.calls[0].url.pathname, "/v1.0/me/drive/root/children");
  } finally {
    stub.restore();
  }
}

async function testSharePointSiteSearch() {
  const noSearch = await searchSharePointSites({ accessToken: "t", search: "  " });
  assert.deepEqual(noSearch.sites, [], "empty search must not hit Graph");

  const stub = withStubbedFetch(() =>
    jsonResponse(200, {
      value: [
        { id: "contoso.com,site-guid-1,web-guid-1", displayName: "Retail HQ", webUrl: "https://contoso.com/sites/retail" },
        { id: "bad site id", displayName: "Broken" },
        { displayName: "No id" },
      ],
    }),
  );
  try {
    const result = await searchSharePointSites({ accessToken: "t", search: "retail" });
    assert.match(stub.calls[0].url.pathname, /\/v1\.0\/sites$/);
    assert.equal(stub.calls[0].url.searchParams.get("search"), "retail");
    assert.deepEqual(result.sites, [
      {
        id: "contoso.com,site-guid-1,web-guid-1",
        displayName: "Retail HQ",
        webUrl: "https://contoso.com/sites/retail",
      },
    ]);
  } finally {
    stub.restore();
  }
}

async function testSharePointDriveListing() {
  const stub = withStubbedFetch(() =>
    jsonResponse(200, {
      value: [
        { id: "b!drive01", name: "Documents", driveType: "documentLibrary", webUrl: "https://contoso.com/Documents", lastModifiedDateTime: "2026-09-01T00:00:00Z" },
        { id: "ab", name: "Broken" },
      ],
    }),
  );
  try {
    const result = await listSharePointDrives({
      accessToken: "t",
      siteId: "contoso.com,site-guid-1,web-guid-1",
    });
    assert.match(stub.calls[0].url.pathname, /\/sites\/contoso\.com%2Csite-guid-1%2Cweb-guid-1\/drives$/);
    assert.equal(result.drives.length, 1);
    assert.equal(result.drives[0].id, "b!drive01");
    assert.equal(result.drives[0].name, "Documents");
  } finally {
    stub.restore();
  }

  await assert.rejects(
    () => listSharePointDrives({ accessToken: "t", siteId: "../evil" }),
    (error: unknown) =>
      error instanceof MicrosoftGraphError && error.code === "invalid_identifier",
    "site id traversal must be rejected without touching Graph",
  );
  assert.equal(stub.calls.length, 1, "rejected identifiers must not issue Graph requests");
}

async function testSharePointWorkbookListing() {
  const stub = withStubbedFetch(() =>
    jsonResponse(200, {
      value: [
        {
          id: "item01SPO",
          name: "Budget.xlsx",
          file: { mimeType: EXCEL_MIME },
          parentReference: { path: "/drives/b!drive01/root:/Finance" },
        },
      ],
    }),
  );
  try {
    const result = await listSharePointWorkbooks({
      accessToken: "t",
      driveId: "b!drive01",
      search: "budget",
    });
    assert.match(
      stub.calls[0].url.pathname,
      /\/drives\/b!drive01\/root\/search\(q='budget'\)$/,
    );
    assert.equal(result.workbooks.length, 1);
    assert.equal(result.workbooks[0].driveId, "b!drive01");
    assert.equal(result.workbooks[0].folderPath, "Finance");
  } finally {
    stub.restore();
  }

  await assert.rejects(
    () => listSharePointWorkbooks({ accessToken: "t", driveId: "%2e%2e%2f" }),
    MicrosoftGraphError,
  );
  await assert.rejects(
    () => listSharePointWorkbooks({ accessToken: "t", driveId: "b!drive01", pageToken: "https://evil.example/v1.0/x" }),
    (error: unknown) => error instanceof MicrosoftGraphError && error.code === "invalid_page_token",
    "cross-host pagination tokens must be rejected",
  );
}

async function testThrottledRequestHonorsRetryAfterWithBoundedRetries() {
  const retryAt = new Date(Date.now() + 100).toUTCString();
  let attempts = 0;
  const stub = withStubbedFetch(() => {
    attempts += 1;
    if (attempts < 3) {
      return jsonResponse(429, { error: { code: "tooManyRequests", message: "throttled" } }, {
        "retry-after": retryAt,
      });
    }
    return jsonResponse(200, { value: [] });
  });
  try {
    const result = await listOneDriveWorkbooks({ accessToken: "t" });
    assert.equal(attempts, 3, "throttled responses must be retried within bounds");
    assert.deepEqual(result.workbooks, []);
  } finally {
    stub.restore();
  }

  let exhaustedAttempts = 0;
  const exhausted = withStubbedFetch(() => {
    exhaustedAttempts += 1;
    return jsonResponse(429, { error: { code: "tooManyRequests" } }, { "retry-after": retryAt });
  });
  try {
    await assert.rejects(
      () => listOneDriveWorkbooks({ accessToken: "t" }),
      (error: unknown) =>
        error instanceof MicrosoftGraphError && error.code === "provider_throttled",
      "persistent throttling must surface a deterministic throttled state",
    );
    assert.equal(exhaustedAttempts, 4, "retries must stay bounded (initial + 3)");
  } finally {
    exhausted.restore();
  }
}

async function testGraphErrorMapping() {
  const cases: { status: number; payload: unknown; code?: string; status2: "reconnect_required" | "error" }[] = [
    { status: 401, payload: {}, status2: "reconnect_required" },
    { status: 403, payload: { error: { code: "accessDenied" } }, code: "insufficient_permission", status2: "error" },
    { status: 404, payload: { error: { code: "itemNotFound" } }, code: "not_found", status2: "error" },
    { status: 502, payload: {}, code: "provider_unavailable", status2: "error" },
  ];
  for (const testCase of cases) {
    const stub = withStubbedFetch(() => jsonResponse(testCase.status, testCase.payload));
    try {
      await assert.rejects(
        () => listOneDriveWorkbooks({ accessToken: "t" }),
        (error: unknown) =>
          error instanceof MicrosoftGraphError &&
          error.connectorStatus === testCase.status2 &&
          (!testCase.code || error.code === testCase.code),
        `Graph ${testCase.status} must map to ${testCase.status2}`,
      );
    } finally {
      stub.restore();
    }
  }
}

async function testWorksheetMetadataLoading() {
  const stub = withStubbedFetch((url) => {
    assert.doesNotMatch(
      url.pathname,
      /usedRange|\/values/,
      "worksheet loading must stay metadata-only",
    );
    if (url.pathname.endsWith("/workbook/worksheets")) {
      return jsonResponse(200, {
        value: [
          { id: "{BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}", name: "Notes", position: 2 },
          { id: "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}", name: "Sales 2026", position: 1 },
        ],
      });
    }
    return jsonResponse(200, {
      name: "Retail.xlsx",
      parentReference: { path: "/drive/root:/Reports" },
    });
  });
  try {
    const meta = await getMicrosoftWorkbookMeta({ accessToken: "t", itemId: "item01ONE" });
    assert.equal(meta.workbookName, "Retail.xlsx");
    assert.deepEqual(meta.worksheets, [
      { id: "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}", name: "Sales 2026", position: 1 },
      { id: "{BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}", name: "Notes", position: 2 },
    ]);
  } finally {
    stub.restore();
  }

  const emptyStub = withStubbedFetch((url) => {
    if (url.pathname.endsWith("/workbook/worksheets")) return jsonResponse(200, { value: [] });
    return jsonResponse(200, { name: "Empty.xlsx" });
  });
  try {
    await assert.rejects(
      () => getMicrosoftWorkbookMeta({ accessToken: "t", itemId: "item01ONE" }),
      (error: unknown) => error instanceof MicrosoftGraphError && error.code === "workbook_empty",
      "a workbook without worksheets must fail deterministically",
    );
  } finally {
    emptyStub.restore();
  }
}

async function testPreviewUsesCanonicalNormalization() {
  const stub = withStubbedFetch((url, init) => {
    assert.equal(init?.method ?? "GET", "GET", "Microsoft flows are read-only");
    if (url.pathname.endsWith("/workbook/worksheets")) {
      return jsonResponse(200, {
        value: [{ id: "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}", name: "Sales 2026", position: 1 }],
      });
    }
    if (url.pathname.includes("/usedRange")) {
      assert.match(url.pathname, /usedRange\(valuesOnly=true\)/);
      return jsonResponse(200, {
        values: [
          ["Date", "Revenue", "Cost"],
          ["2026-09-01", 1200, 400],
          ["2026-09-02", 1500, 500],
        ],
      });
    }
    return jsonResponse(200, { name: "Retail.xlsx", parentReference: { path: "/drive/root:/Reports" } });
  });
  try {
    const preview = await previewMicrosoftWorksheet({
      accessToken: "ms-token",
      connectorType: "onedrive",
      itemId: "item01ONE",
    });
    assert.equal(preview.sourceType, "onedrive");
    assert.equal(preview.activeWorksheet, "Sales 2026");
    assert.equal(preview.rowCount, 2);
    assert.equal(preview.columnCount, 3);
    assert.deepEqual(
      preview.microsoft,
      {
        connectorType: "onedrive",
        driveId: null,
        itemId: "item01ONE",
        workbookName: "Retail.xlsx",
        folderPath: "Reports",
        worksheetId: "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}",
        worksheetName: "Sales 2026",
        worksheets: [
          { id: "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}", name: "Sales 2026", position: 1 },
        ],
      },
      "preview must carry the provenance needed to refresh the same source",
    );
    assert.equal(preview.columns.find((column) => column.name === "Revenue")?.type, "number");
    assert.equal(
      JSON.stringify(preview).includes("ms-token"),
      false,
      "preview must never embed tokens",
    );

    const csvFile = microsoftPreviewToCsvFile(preview);
    assert.equal(csvFile.name, "Retail.xlsx - Sales 2026.csv");
    const csv = await csvFile.text();
    assert.match(csv, /Date,Revenue,Cost/);
    assert.match(csv, /2026-09-01,1200,400/);
  } finally {
    stub.restore();
  }
}

function extractJsonPayloads(source: string) {
  const needle = "NextResponse.json(";
  const payloads: string[] = [];
  let index = source.indexOf(needle);
  while (index !== -1) {
    let depth = 0;
    let started = false;
    let end = index + needle.length;
    for (; end < source.length; end++) {
      const char = source[end];
      if (char === "{") {
        depth += 1;
        started = true;
      } else if (char === "}") {
        depth -= 1;
        if (started && depth === 0) {
          end += 1;
          break;
        }
      }
    }
    payloads.push(source.slice(index + needle.length, end));
    index = source.indexOf(needle, end);
  }
  return payloads;
}

function testRouteSecurityInvariants() {
  const routes = [
    "src/app/api/clevrsync/microsoft/onedrive/files/route.ts",
    "src/app/api/clevrsync/microsoft/sharepoint/sites/route.ts",
    "src/app/api/clevrsync/microsoft/sharepoint/drives/route.ts",
    "src/app/api/clevrsync/microsoft/sharepoint/files/route.ts",
    "src/app/api/clevrsync/microsoft/worksheets/route.ts",
  ];
  for (const route of routes) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /const session = await auth\(\)/, `${route} must require a session`);
    assert.match(source, /requireBuiltinUserRecord\(session\.user\.id\)/, `${route} must require a builtin user`);
    assert.match(source, /requireClevrSyncAccess\(session\.user\)/, `${route} must enforce entitlements`);
    assert.match(
      source,
      /resolveOwnedMicrosoftConnector\(/,
      `${route} must resolve connector ownership server-side`,
    );
    assert.match(source, /code: "microsoft_not_connected"/);
    for (const payload of extractJsonPayloads(source)) {
      assert.doesNotMatch(
        payload,
        /accessToken|refreshToken|access_token|refresh_token|client_secret/i,
        `${route} responses must never serialize tokens or secrets`,
      );
    }
  }

  const startRoute = readFileSync("src/app/api/clevrsync/microsoft/oauth/start/route.ts", "utf8");
  assert.match(startRoute, /requireClevrSyncAccess\(session\.user\)/);
  assert.match(startRoute, /createMicrosoftOAuthState\(/);
  assert.match(startRoute, /buildMicrosoftAuthorizationUrl\(/);
  assert.match(startRoute, /microsoftConnectorCoversScope\(/);
  assert.match(
    startRoute,
    /searchParams\.get\("connector"\)/,
    "start must read the target connector type from the request",
  );

  const callbackRoute = readFileSync("src/app/api/clevrsync/microsoft/oauth/callback/route.ts", "utf8");
  assert.match(callbackRoute, /verifyMicrosoftOAuthState\(stateValue, session\.user\.id\)/);
  assert.match(callbackRoute, /exchangeMicrosoftCode\(/);
  assert.match(callbackRoute, /encryptClevrSyncToken\(tokens\.accessToken\)/);
  assert.match(callbackRoute, /encryptClevrSyncToken\(tokens\.refreshToken\)/);
  assert.match(callbackRoute, /microsoft=cancelled/, "cancelled consent must return a distinct state");
  assert.match(callbackRoute, /upsertMicrosoftConnector\(/);

  const syncRoute = readFileSync("src/app/api/clevrsync/sync/route.ts", "utf8");
  assert.match(syncRoute, /microsoftPreviewToCsvFile\(preview\)/);
  assert.match(syncRoute, /uploadCSV\(uploadFormData/);
  assert.match(syncRoute, /clevrsync_connector_type", connectorType/);
  assert.match(syncRoute, /\/app\/dashboard\?datasetId=/);
  assert.match(
    syncRoute,
    /status: "syncing"/,
    "sync must surface the syncing connector state",
  );
  const fetchIndex = syncRoute.indexOf("previewMicrosoftWorksheet(");
  const uploadIndex = syncRoute.indexOf("await uploadCSV(");
  assert.ok(
    fetchIndex !== -1 && uploadIndex !== -1 && fetchIndex < uploadIndex,
    "Microsoft fetch happens before uploadCSV: transient Graph failures never reserve credits",
  );

  const previewRoute = readFileSync("src/app/api/clevrsync/preview/route.ts", "utf8");
  assert.match(previewRoute, /previewMicrosoftWorksheet\(/);
  assert.match(previewRoute, /parseMicrosoftConnectorType\(/);
  assert.doesNotMatch(
    previewRoute,
    /reserveCredits|finalizeCredits|releaseCredits|credit-engine/,
    "preview must stay credit-free",
  );

  for (const route of routes) {
    assert.doesNotMatch(
      readFileSync(route, "utf8"),
      /reserveCredits|finalizeCredits|releaseCredits|credit-engine/,
      `${route} discovery must stay credit-free`,
    );
  }

  const graphSource = readFileSync("src/services/clevrsync/connectors/microsoft-graph.ts", "utf8");
  assert.doesNotMatch(graphSource, /ReadWrite|FullControl|Sites\.Manage/, "no write scopes anywhere");
  assert.match(graphSource, /MAX_THROTTLE_RETRIES = 3/, "throttle retries must stay bounded");
  assert.match(graphSource, /Retry-After/i, "throttling must honor Retry-After");
  assert.match(graphSource, /isSafeGraphId|isSafeGraphSiteId/, "Graph identifiers must be validated");
  assert.match(graphSource, /encodeURIComponent/, "Graph path segments must be URL-encoded");

  const authStore = readFileSync("src/services/clevrsync/microsoft-auth-store.ts", "utf8");
  assert.match(authStore, /getOwnedClevrSyncConnector/, "token access must check ownership");
  assert.match(authStore, /refreshMicrosoftAccessToken/);
  assert.match(authStore, /reconnect_required/, "refresh failure must mark reconnect_required");
  assert.match(authStore, /decryptClevrSyncToken|encryptClevrSyncToken/, "tokens must flow through the shared vault");

  const stateSource = readFileSync("src/services/clevrsync/microsoft-oauth-state.ts", "utf8");
  assert.match(stateSource, /createHmac/);
  assert.match(stateSource, /timingSafeEqual/);
  assert.match(stateSource, /usedNonces/, "state verification must include replay protection");
}

function testUiInvariants() {
  const page = readFileSync("src/app/(auth)/app/settings/data-connections/page.tsx", "utf8");
  assert.match(page, /label: "OneDrive", status: "Available"/);
  assert.match(page, /label: "SharePoint", status: "Available"/);
  assert.doesNotMatch(page, /Coming Soon/);
  assert.match(page, /api\/clevrsync\/microsoft\/oauth\/start\?connector=/);
  assert.match(page, /api\/clevrsync\/microsoft\/onedrive\/files/);
  assert.match(page, /api\/clevrsync\/microsoft\/sharepoint\/sites/);
  assert.match(page, /api\/clevrsync\/microsoft\/sharepoint\/drives/);
  assert.match(page, /api\/clevrsync\/microsoft\/sharepoint\/files/);
  assert.match(page, /api\/clevrsync\/microsoft\/worksheets/);
  assert.match(page, /Search workbooks\.\.\./);
  assert.match(page, /Search sites by name/);
  assert.match(page, /Choose document library/);
  assert.match(page, /Connect & Analyze/);
  assert.match(page, /Sync now/);
  assert.match(page, /Last synced/);
  assert.match(page, /Linked workbook:/);
  assert.match(page, /Reconnect required/);
}

function testEntitlementGating() {
  const free = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: false });
  assert.equal(free.enabled, false, "Free accounts must stay blocked from ClevrSync");
  assert.equal(free.connectors.oneDrive, false);
  assert.equal(free.connectors.sharePoint, false);

  const pro = getClevrSyncEntitlement({ subscriptionTier: "pro", unlimited: false });
  assert.equal(pro.enabled, true);
  assert.equal(pro.connectors.oneDrive, true);
  assert.equal(pro.connectors.sharePoint, true);

  const business = getClevrSyncEntitlement({ subscriptionTier: "business", unlimited: false });
  assert.equal(business.connectors.oneDrive, true);
  assert.equal(business.connectors.sharePoint, true);

  const superadmin = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: true });
  assert.equal(superadmin.enabled, true);
  assert.equal(superadmin.connectors.oneDrive, true);
  assert.equal(superadmin.connectors.sharePoint, true);
}

async function main() {
  testAuthorizationUrlRequestsLeastPrivilegeScopes();
  testScopeCoverageHelpers();
  await testOneDriveWorkbookListing();
  await testOneDriveRootChildrenListing();
  await testSharePointSiteSearch();
  await testSharePointDriveListing();
  await testSharePointWorkbookListing();
  await testThrottledRequestHonorsRetryAfterWithBoundedRetries();
  await testGraphErrorMapping();
  await testWorksheetMetadataLoading();
  await testPreviewUsesCanonicalNormalization();
  testRouteSecurityInvariants();
  testUiInvariants();
  testEntitlementGating();
  console.log("Microsoft discovery regression tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
