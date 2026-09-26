import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildGoogleDriveListUrl,
  buildGoogleSheetsAuthorizationUrl,
  getGoogleSpreadsheetWorksheets,
  GoogleSheetsProviderError,
  listGoogleSpreadsheets,
  parseGoogleSpreadsheetId,
  requiresSpreadsheetListingScope,
} from "@/services/clevrsync/connectors/google-sheets";
import { getClevrSyncEntitlement } from "@/services/clevrsync/entitlement";

const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";

type StubResponse = {
  ok: boolean;
  status: number;
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

function jsonResponse(status: number, payload: unknown): StubResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function testAuthorizationUrlRequestsMinimumScopes() {
  process.env.GOOGLE_CLEVRSYNC_CLIENT_ID = "test-client-id";
  const url = buildGoogleSheetsAuthorizationUrl({
    state: "state-value",
    redirectUri: "https://app.useclevr.com/api/clevrsync/google/oauth/callback",
  });
  const scope = url.searchParams.get("scope") || "";
  assert.match(scope, /spreadsheets\.readonly/, "authorization must keep the Sheets read scope");
  assert.match(
    scope,
    /drive\.metadata\.readonly/,
    "authorization must add the Drive metadata scope for discovery",
  );
  assert.doesNotMatch(
    scope,
    /auth\/drive\b(?!\.metadata)/,
    "must not request full Drive content access",
  );
  assert.doesNotMatch(
    scope,
    /drive\.file\b/,
    "must not request per-file Drive scope without Picker",
  );
  assert.equal(
    url.searchParams.get("include_granted_scopes"),
    "true",
    "must use incremental authorization",
  );
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "state-value");
}

function testListingScopeDetection() {
  assert.equal(requiresSpreadsheetListingScope(null), true);
  assert.equal(requiresSpreadsheetListingScope(""), true);
  assert.equal(
    requiresSpreadsheetListingScope("https://www.googleapis.com/auth/spreadsheets.readonly"),
    true,
  );
  assert.equal(
    requiresSpreadsheetListingScope(
      "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly",
    ),
    false,
  );
}

function testDriveListUrl() {
  const url = buildGoogleDriveListUrl({});
  assert.equal(url.pathname, "/drive/v3/files");
  const query = url.searchParams.get("q") || "";
  assert.ok(
    query.includes(`mimeType='${SPREADSHEET_MIME}'`),
    "listing must filter to Google spreadsheet MIME type",
  );
  assert.ok(query.includes("trashed=false"), "listing must exclude trashed spreadsheets");
  assert.equal(
    url.searchParams.get("orderBy"),
    "modifiedTime desc",
    "listing must surface recently modified spreadsheets first",
  );
  assert.equal(
    url.searchParams.get("pageSize"),
    "30",
    "listing must use a bounded default page size",
  );
  const fields = url.searchParams.get("fields") || "";
  assert.match(fields, /nextPageToken/);
  assert.match(fields, /files\(id,name,modifiedTime,shared,ownedByMe\)/);
  assert.doesNotMatch(
    fields,
    /owners|permissions|tokens|credentials/,
    "listing fields must stay metadata-only",
  );

  const searched = buildGoogleDriveListUrl({ search: "O'Neill's Sheet" });
  assert.ok(
    (searched.searchParams.get("q") || "").includes("name contains 'O\\'Neill\\'s Sheet'"),
    "search must escape Drive query literals",
  );

  assert.equal(buildGoogleDriveListUrl({ pageSize: 0 }).searchParams.get("pageSize"), "30");
  assert.equal(buildGoogleDriveListUrl({ pageSize: 500 }).searchParams.get("pageSize"), "100");
  assert.equal(
    buildGoogleDriveListUrl({ pageToken: "tok" }).searchParams.get("pageToken"),
    "tok",
    "listing must pass Google pagination tokens through",
  );
}

async function testSpreadsheetListing() {
  const stub = withStubbedFetch(() =>
    jsonResponse(200, {
      nextPageToken: "page-2",
      files: [
        {
          id: "sheet_1",
          name: "UseClevr Retail Test 500",
          modifiedTime: "2026-09-01T10:00:00.000Z",
          shared: false,
          ownedByMe: true,
        },
        {
          id: "sheet_2",
          name: "Monthly Sales 2026",
          modifiedTime: "2026-08-20T10:00:00.000Z",
          shared: true,
          ownedByMe: false,
        },
        { name: "broken entry" },
      ],
    }),
  );
  try {
    const result = await listGoogleSpreadsheets({
      accessToken: "secret-access-token",
      search: "sales",
      pageSize: 50,
      pageToken: "page-1",
    });

    assert.equal(stub.calls.length, 1, "listing must issue exactly one Drive metadata request");
    const request = stub.calls[0];
    assert.equal(
      request.init?.headers && (request.init.headers as Record<string, string>).Authorization,
      "Bearer secret-access-token",
      "listing must authorize with the refreshed access token",
    );
    assert.ok((request.url.searchParams.get("q") || "").includes("name contains 'sales'"));
    assert.equal(request.url.searchParams.get("pageToken"), "page-1");

    assert.deepEqual(
      result,
      {
        spreadsheets: [
          {
            id: "sheet_1",
            name: "UseClevr Retail Test 500",
            modifiedTime: "2026-09-01T10:00:00.000Z",
            shared: false,
            ownedByMe: true,
          },
          {
            id: "sheet_2",
            name: "Monthly Sales 2026",
            modifiedTime: "2026-08-20T10:00:00.000Z",
            shared: true,
            ownedByMe: false,
          },
        ],
        nextPageToken: "page-2",
      },
      "listing must expose metadata-only spreadsheet summaries and drop malformed entries",
    );
    assert.equal(
      JSON.stringify(result).includes("secret-access-token"),
      false,
      "listing results must never contain tokens or secrets",
    );
  } finally {
    stub.restore();
  }
}

async function testListingErrorMapping() {
  const cases: {
    status: number;
    payload: unknown;
    expectedStatus: "reconnect_required" | "error";
  }[] = [
    {
      status: 401,
      payload: { error: { message: "Invalid Credentials" } },
      expectedStatus: "reconnect_required",
    },
    {
      status: 403,
      payload: { error: { message: "The user does not have sufficient permissions" } },
      expectedStatus: "error",
    },
    { status: 400, payload: { error: { message: "Invalid query" } }, expectedStatus: "error" },
  ];
  for (const testCase of cases) {
    const stub = withStubbedFetch(() => jsonResponse(testCase.status, testCase.payload));
    try {
      await assert.rejects(
        listGoogleSpreadsheets({ accessToken: "t" }),
        (error: unknown) =>
          error instanceof GoogleSheetsProviderError &&
          error.connectorStatus === testCase.expectedStatus,
        `Drive ${testCase.status} must map to ${testCase.expectedStatus}`,
      );
    } finally {
      stub.restore();
    }
  }
}

async function testWorksheetMetadataLoading() {
  const stub = withStubbedFetch((url) => {
    assert.equal(
      url.hostname,
      "sheets.googleapis.com",
      "worksheet loading must use the Sheets API",
    );
    assert.doesNotMatch(
      url.pathname,
      /\/values\//,
      "worksheet loading must not download sheet values",
    );
    return jsonResponse(200, {
      spreadsheetId: "sheet_1",
      properties: { title: "UseClevr Retail Test 500" },
      sheets: [
        { properties: { sheetId: 7, title: "Retail Sales 2026", index: 1 } },
        { properties: { sheetId: 3, title: "Notes", index: 0 } },
      ],
    });
  });
  try {
    const result = await getGoogleSpreadsheetWorksheets({
      accessToken: "t",
      spreadsheetId: "sheet_1",
    });
    assert.equal(stub.calls.length, 1, "worksheet loading must stay metadata-only");
    assert.deepEqual(result, {
      spreadsheetId: "sheet_1",
      spreadsheetName: "UseClevr Retail Test 500",
      worksheets: [
        { id: 3, title: "Notes", index: 0 },
        { id: 7, title: "Retail Sales 2026", index: 1 },
      ],
    });
  } finally {
    stub.restore();
  }
}

function testManualUrlFallbackParsing() {
  assert.equal(
    parseGoogleSpreadsheetId(
      "https://docs.google.com/spreadsheets/d/1AbC_dEf-123456789012345/edit#gid=0",
    ),
    "1AbC_dEf-123456789012345",
  );
  assert.equal(parseGoogleSpreadsheetId("1AbC_dEf-123456789012345"), "1AbC_dEf-123456789012345");
  assert.throws(
    () => parseGoogleSpreadsheetId("https://example.com/not-a-sheet"),
    "invalid manual input must fail clearly",
  );
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
  const spreadsheetsRoute = readFileSync(
    "src/app/api/clevrsync/google/spreadsheets/route.ts",
    "utf8",
  );
  const worksheetsRoute = readFileSync("src/app/api/clevrsync/google/worksheets/route.ts", "utf8");
  const page = readFileSync("src/app/(auth)/app/settings/data-connections/page.tsx", "utf8");
  const callbackRoute = readFileSync(
    "src/app/api/clevrsync/google/oauth/callback/route.ts",
    "utf8",
  );
  const syncEngine = readFileSync("src/services/clevrsync/sync-engine.ts", "utf8");

  for (const route of [spreadsheetsRoute, worksheetsRoute]) {
    assert.match(
      route,
      /const session = await auth\(\)/,
      "listing routes must require a UseClevr session",
    );
    assert.match(
      route,
      /requireBuiltinUserRecord\(session\.user\.id\)/,
      "listing routes must require a builtin user record",
    );
    assert.match(
      route,
      /requireClevrSyncAccess\(session\.user\)/,
      "listing routes must enforce Pro/Business entitlements",
    );
    assert.match(
      route,
      /resolveOwnedGoogleSheetsConnector\(/,
      "listing routes must resolve connector ownership server-side",
    );
    assert.doesNotMatch(
      route,
      /body\?\.connectorId|request\.body/,
      "listing routes must not trust client-sent connector ownership",
    );
    assert.match(
      route,
      /code: "reconnect_required"/,
      "listing routes must return a clean reconnect payload",
    );
    for (const payload of extractJsonPayloads(route)) {
      assert.doesNotMatch(
        payload,
        /accessToken|refreshToken|access_token|refresh_token/i,
        "listing route responses must never serialize tokens",
      );
    }
  }

  assert.match(
    syncEngine,
    /getNewestOwnedGoogleSheetsConnector/,
    "connector resolution must resolve the newest owned Google connector",
  );
  assert.match(syncEngine, /eq\(clevrSyncConnectors\.type, "google_sheets"\)/);
  assert.match(
    syncEngine,
    /eq\(clevrSyncConnectors\.userId, userId\)/,
    "connector resolution must stay user-scoped",
  );

  assert.match(
    callbackRoute,
    /scope: tokens\.scope \|\| getGoogleSheetsScope\(\)/,
    "callback must keep storing the granted scope for upgrade detection",
  );

  assert.match(page, /Paste Sheet URL manually/, "page must keep the manual URL fallback");
  assert.match(page, /Google Sheets URL or spreadsheet ID/, "page must keep the manual URL field");
  assert.match(
    page,
    /role="combobox"/,
    "page must render a keyboard-accessible spreadsheet picker",
  );
  assert.match(page, /Search spreadsheets/, "picker must support search");
  assert.match(page, /Load more/, "picker must paginate large accounts");
  assert.match(
    page,
    /\/api\/clevrsync\/google\/spreadsheets\?/,
    "picker must load spreadsheets from the discovery endpoint",
  );
  assert.match(
    page,
    /\/api\/clevrsync\/google\/worksheets\?/,
    "selecting a spreadsheet must load worksheets metadata",
  );
  assert.match(
    page,
    /"Load more"|Loading spreadsheets…|No spreadsheets found/,
    "picker must implement loading, empty, and pagination states",
  );
  assert.match(
    page,
    /connectorId: selectedGoogleConnector\.id,\s*\n\s*spreadsheetId: googleSpreadsheet,\s*\n\s*worksheetName: googleWorksheet \|\| null,\s*\n\s*\}\),\s*\n\s*\}\);\s*\n\s*const payload = await response\.json\(\);\s*\n\s*if \(!response\.ok\) throw new Error\(payload\.error \|\| "Unable to preview Google Sheet"\);/,
    "preview must keep using the canonical ClevrSync preview endpoint with the selected spreadsheet",
  );
  assert.match(
    page,
    /\/api\/clevrsync\/sync/,
    "Connect & Analyze must keep the canonical sync endpoint",
  );
  assert.match(
    page,
    /\/app\/dashboard\?datasetId=/,
    "Connect & Analyze must navigate to the canonical dashboard destination",
  );
  assert.match(
    page,
    /"Sync now" : "Connect & Analyze"/,
    "linked sheets must expose Sync now after the first analysis",
  );
  assert.match(page, /Last synced/, "returning users must see the last sync time");
  assert.match(page, /Linked sheet:/, "returning users must see the linked spreadsheet by name");
}

function testEntitlementGating() {
  const free = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: false });
  assert.equal(free.enabled, false, "Free accounts must stay blocked from ClevrSync");
  const pro = getClevrSyncEntitlement({ subscriptionTier: "pro", unlimited: false });
  assert.equal(pro.enabled, true, "Pro accounts must keep ClevrSync access");
  const business = getClevrSyncEntitlement({ subscriptionTier: "business", unlimited: false });
  assert.equal(business.enabled, true, "Business accounts must keep ClevrSync access");
  const superadmin = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: true });
  assert.equal(superadmin.enabled, true, "superadmin behavior must be preserved");
}

async function main() {
  testAuthorizationUrlRequestsMinimumScopes();
  testListingScopeDetection();
  testDriveListUrl();
  await testSpreadsheetListing();
  await testListingErrorMapping();
  await testWorksheetMetadataLoading();
  testManualUrlFallbackParsing();
  testRouteSecurityInvariants();
  testEntitlementGating();
  console.log("Google Sheets discovery regression tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
