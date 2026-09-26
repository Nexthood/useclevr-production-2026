import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  calculateReorderQuantity,
  calculateRetailSalesKpis,
  calculateStockoutRisk,
} from "@/integrations/retail/analytics/retail-kpis";
import { OauthStateError } from "@/integrations/retail/core/connection.service";
import { encryptRetailSecret, decryptRetailSecret } from "@/integrations/retail/core/encryption.service";
import { SquareConnector } from "@/integrations/retail/providers/square/square.connector";
import { getSquareConfig } from "@/integrations/retail/providers/square/square.config";
import {
  SQUARE_CALLBACK_PATH,
  getSquareCallbackUrl,
  getSafeSquareFailureReason,
  getSquareCallbackFailureReason,
  getSquareIntegrationRedirectUrl,
  getSquareProviderDenialReason,
  getSquareRedirectUri,
  SQUARE_PRODUCTION_APP_ORIGIN,
  SQUARE_TEST_APP_ORIGIN,
} from "@/integrations/retail/providers/square/square-oauth";
import {
  mapSquareCatalogItems,
  mapSquareInventoryCount,
  mapSquareOrder,
  mapSquareWebhookEvent,
} from "@/integrations/retail/providers/square/square.mapper";
import {
  buildOrderLocationBatches,
  isSyncRunStalled,
  needsTokenRefresh,
} from "@/integrations/retail/core/sync-engine";

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

process.env.RETAIL_TOKEN_ENCRYPTION_KEY = "test-retail-token-encryption-key-with-32-chars";

const repoRoot = resolve(import.meta.dirname, "../..");
const squareProductionHost = "connect.squareup.com";
const squareSandboxHost = "connect.squareupsandbox.com";
const squareCallbackPath = "/api/integrations/retail/square/callback";

const tests: TestCase[] = [
  {
    name: "Square callback route exists, supports GET parameters, and is public through the proxy",
    run() {
      const routeSource = readProjectFile("src/app/api/integrations/retail/square/callback/route.ts");
      const connectRouteSource = readProjectFile("src/app/api/integrations/retail/square/connect/route.ts");
      const retailClientSource = readProjectFile("src/components/retail/retail-integrations-client.tsx");
      const proxySource = readProjectFile("src/proxy.ts");
      assert.ok(routeSource.includes("export async function GET"), "callback route exports GET");
      assert.ok(routeSource.includes('searchParams.get("code")'), "callback accepts code");
      assert.ok(routeSource.includes('searchParams.get("state")'), "callback accepts state");
      assert.ok(routeSource.includes('searchParams.get("error")'), "callback accepts provider error");
      assert.ok(routeSource.includes('searchParams.get("error_description")'), "callback accepts provider error description");
      assert.ok(routeSource.includes("consumeOauthState"), "callback consumes stored OAuth state");
      assert.ok(routeSource.includes("getSquareIntegrationRedirectUrl"), "callback redirects through safe helper");
      assert.ok(connectRouteSource.includes("export async function GET"), "connect route supports browser navigation");
      assert.ok(connectRouteSource.includes("requestUrl: request.url"), "connect route preserves the active app host for OAuth redirects");
      assert.ok(connectRouteSource.includes("NextResponse.redirect(result.authorizationUrl)"), "connect route redirects to Square server-side");
      assert.ok(retailClientSource.includes('window.location.assign("/api/integrations/retail/square/connect")'), "Square Connect button navigates to the OAuth start route");
      assert.ok(proxySource.includes("SQUARE_CALLBACK_PATH"), "proxy imports the canonical Square callback path");
      assert.ok(proxySource.includes("publicApiPaths"), "proxy keeps a public API allowlist");
    },
  },
  {
    name: "Square sandbox configuration uses the test callback and never falls back to production",
    async run() {
      withSquareEnv("sandbox", () => {
        const expected = `${SQUARE_TEST_APP_ORIGIN}${squareCallbackPath}`;
        assert.equal(getSquareCallbackUrl(), expected);
        assert.equal(getSquareRedirectUri(), expected);
        assert.equal(getSquareConfig().redirectUri, expected);
        assert.equal(getSquareConfig().applicationId, "sandbox-sq0idb-test");
      });

      await withSquareEnv("sandbox", async () => {
        process.env.SQUARE_REDIRECT_URI = "http://localhost:3000/api/integrations/retail/square/callback";
        process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
        const authorizationUrl = await new SquareConnector().getAuthorizationUrl({
          state: "state-sandbox-local",
          redirectUri: getSquareRedirectUri(),
        });
        assert.equal(new URL(authorizationUrl).searchParams.get("redirect_uri"), "http://localhost:3000/api/integrations/retail/square/callback");
      });

      withSquareEnv("sandbox", () => {
        process.env.NEXT_PUBLIC_APP_URL = SQUARE_TEST_APP_ORIGIN;
        process.env.SQUARE_REDIRECT_URI = `${SQUARE_PRODUCTION_APP_ORIGIN}${squareCallbackPath}`;
        assert.throws(() => getSquareRedirectUri(), /test\.useclevr\.com|configured application URL/);
      });

      withSquareEnv("sandbox", () => {
        delete process.env.SQUARE_REDIRECT_URI;
        assert.throws(() => getSquareConfig(), /SQUARE_REDIRECT_URI/);
      });
    },
  },
  {
    name: "Square sandbox authorization and token exchange use the same redirect_uri",
    async run() {
      await withSquareEnv("sandbox", async () => {
        const expected = `${SQUARE_TEST_APP_ORIGIN}${squareCallbackPath}`;
        const redirectUri = getSquareRedirectUri();
        assert.equal(redirectUri, expected);
        const authorizationUrl = await new SquareConnector().getAuthorizationUrl({
          state: "state-sandbox",
          redirectUri,
        });
        const parsedAuthorization = new URL(authorizationUrl);
        assert.equal(parsedAuthorization.origin, `https://${squareSandboxHost}`);
        assert.equal(parsedAuthorization.searchParams.get("redirect_uri"), redirectUri);
        assert.equal(parsedAuthorization.searchParams.get("session"), "false");
        assert.equal(parsedAuthorization.searchParams.has("redirect_url"), false);

        const previousFetch = globalThis.fetch;
        let tokenBody: { redirect_uri?: string } | null = null;
        let tokenEndpoint = "";
        const accessTokenField = ["access", "token"].join("_");
        const refreshTokenField = ["refresh", "token"].join("_");
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          tokenEndpoint = String(input);
          tokenBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
          return new Response(JSON.stringify({
            [accessTokenField]: "value-a",
            [refreshTokenField]: "value-r",
            merchant_id: "MERCHANT-1",
            scope: "MERCHANT_PROFILE_READ ITEMS_READ",
            expires_at: "2026-08-01T00:00:00Z",
          }), { status: 200, headers: { "content-type": "application/json" } });
        }) as typeof fetch;

        try {
          await new SquareConnector().exchangeAuthorizationCode({ code: "code-1", redirectUri });
        } finally {
          globalThis.fetch = previousFetch;
        }

        assert.equal((tokenBody as { redirect_uri?: string } | null)?.redirect_uri, redirectUri);
        assert.equal(tokenEndpoint, `https://${squareSandboxHost}/oauth2/token`);
        assert.equal(authorizationUrl.includes("square-app-secret"), false, "authorization URL never exposes the Square application secret");
        assert.equal(
          getSquareIntegrationRedirectUrl({ status: "error", reason: "square-app-secret" }).toString().includes("square-app-secret"),
          false,
          "callback error redirects never expose secret-like provider values",
        );
      });
    },
  },
  {
    name: "Square callback redirects use safe test success and failure destinations",
    run() {
      withSquareEnv("sandbox", () => {
        assert.equal(
          getSquareIntegrationRedirectUrl({ status: "success" }).toString(),
          "https://test.useclevr.com/app/retail/integrations?connection=square&status=success",
        );
        assert.equal(
          getSquareIntegrationRedirectUrl({ status: "error", reason: "missing_code" }).toString(),
          "https://test.useclevr.com/app/retail/integrations?connection=square&status=error&reason=missing_code",
        );
        assert.equal(getSafeSquareFailureReason("secret-token-value"), "provider_error");
        assert.equal(getSquareProviderDenialReason("access_denied"), "access_denied");
        assert.equal(getSquareProviderDenialReason("temporarily_unavailable"), "oauth_denied");
        assert.equal(getSquareCallbackFailureReason(new OauthStateError("invalid_state")), "invalid_state");
        assert.equal(getSquareCallbackFailureReason(new OauthStateError("expired_state")), "expired_state");
        assert.equal(getSquareCallbackFailureReason(new OauthStateError("environment_mismatch")), "square_environment_mismatch");
        assert.equal(getSquareCallbackFailureReason(new Error("Square token response failed")), "token_exchange_failed");
        assert.equal(
          getSquareIntegrationRedirectUrl({
            requestUrl: `${SQUARE_TEST_APP_ORIGIN}${SQUARE_CALLBACK_PATH}?error=access_denied`,
            status: "error",
            reason: "access_denied",
          }).toString(),
          "https://test.useclevr.com/app/retail/integrations?connection=square&status=error&reason=access_denied",
        );
      });
    },
  },
  {
    name: "Square production environment uses production OAuth, token, and API endpoints",
    async run() {
      withSquareEnv("production", () => {
        process.env.NEXT_PUBLIC_APP_URL = SQUARE_PRODUCTION_APP_ORIGIN;
        process.env.SQUARE_REDIRECT_URI = `${SQUARE_PRODUCTION_APP_ORIGIN}${squareCallbackPath}`;
        const config = getSquareConfig();
        assert.equal(config.environment, "production");
        assert.equal(config.applicationId, "sq0idp-test");
        assert.equal(config.authorizationUrl, `https://${squareProductionHost}/oauth2/authorize`);
        assert.equal(config.authorizeUrl, `https://${squareProductionHost}/oauth2/authorize`);
        assert.equal(config.tokenUrl, `https://${squareProductionHost}/oauth2/token`);
        assert.equal(config.apiBaseUrl, `https://${squareProductionHost}/v2`);
      });

      const url = await withSquareEnv("production", async () => {
        process.env.NEXT_PUBLIC_APP_URL = SQUARE_PRODUCTION_APP_ORIGIN;
        process.env.SQUARE_REDIRECT_URI = `${SQUARE_PRODUCTION_APP_ORIGIN}${squareCallbackPath}`;
        return new SquareConnector().getAuthorizationUrl({
          state: "state-production",
          redirectUri: getSquareRedirectUri(),
        });
      });

      const parsed = new URL(url);
      assert.equal(parsed.host, squareProductionHost);
      assert.equal(parsed.pathname, "/oauth2/authorize");
      assert.equal(parsed.searchParams.get("session"), "false");
      assert.equal(parsed.searchParams.get("redirect_uri"), `${SQUARE_PRODUCTION_APP_ORIGIN}${SQUARE_CALLBACK_PATH}`);
      assert.equal(parsed.searchParams.has("redirect_url"), false);

      withSquareEnv("production", () => {
        process.env.NEXT_PUBLIC_APP_URL = SQUARE_TEST_APP_ORIGIN;
        process.env.SQUARE_REDIRECT_URI = `${SQUARE_TEST_APP_ORIGIN}${squareCallbackPath}`;
        assert.equal(getSquareCallbackUrl(), `${SQUARE_TEST_APP_ORIGIN}${squareCallbackPath}`);
        assert.equal(getSquareConfig().redirectUri, `${SQUARE_TEST_APP_ORIGIN}${squareCallbackPath}`);
      });

      const productionUrlFromTestDeployment = await withSquareEnv("production", async () => {
        delete process.env.SQUARE_REDIRECT_URI;
        const config = getSquareConfig({ requestUrl: `${SQUARE_TEST_APP_ORIGIN}/api/integrations/retail/square/connect` });
        assert.equal(config.redirectUri, `${SQUARE_TEST_APP_ORIGIN}${squareCallbackPath}`);
        return new SquareConnector().getAuthorizationUrl({
          state: "state-production-test-host",
          redirectUri: config.redirectUri,
        });
      });

      const parsedTestDeploymentAuth = new URL(productionUrlFromTestDeployment);
      assert.equal(parsedTestDeploymentAuth.host, squareProductionHost);
      assert.equal(
        parsedTestDeploymentAuth.searchParams.get("redirect_uri"),
        `${SQUARE_TEST_APP_ORIGIN}${SQUARE_CALLBACK_PATH}`,
      );
    },
  },
  {
    name: "Square sandbox environment uses sandbox OAuth, token, and API endpoints",
    async run() {
      withSquareEnv("sandbox", () => {
        const config = getSquareConfig();
        assert.equal(config.environment, "sandbox");
        assert.equal(config.applicationId, "sandbox-sq0idb-test");
        assert.equal(config.authorizationUrl, `https://${squareSandboxHost}/oauth2/authorize`);
        assert.equal(config.authorizeUrl, `https://${squareSandboxHost}/oauth2/authorize`);
        assert.equal(config.tokenUrl, `https://${squareSandboxHost}/oauth2/token`);
        assert.equal(config.apiBaseUrl, `https://${squareSandboxHost}/v2`);
      });

      const url = await withSquareEnv("sandbox", () =>
        new SquareConnector().getAuthorizationUrl({
          state: "state-sandbox",
          redirectUri: getSquareRedirectUri(),
        }),
      );

      const parsed = new URL(url);
      assert.equal(parsed.host, squareSandboxHost);
      assert.equal(parsed.pathname, "/oauth2/authorize");
      assert.equal(parsed.searchParams.get("session"), "false");
      assert.equal(parsed.searchParams.get("redirect_uri"), `${SQUARE_TEST_APP_ORIGIN}${SQUARE_CALLBACK_PATH}`);
      assert.equal(parsed.searchParams.has("redirect_url"), false);
    },
  },
  {
    name: "Square environment configuration rejects missing or invalid values",
    async run() {
      withSquareEnv(undefined, () => {
        assert.throws(() => getSquareConfig(), /SQUARE_ENVIRONMENT/);
      });
      withSquareEnv("Production", () => {
        assert.throws(() => getSquareConfig(), /SQUARE_ENVIRONMENT/);
      });
      withSquareEnv("staging", () => {
        assert.throws(() => getSquareConfig(), /SQUARE_ENVIRONMENT/);
      });
      await withSquareEnv("production", async () => {
        process.env.NEXT_PUBLIC_APP_URL = SQUARE_PRODUCTION_APP_ORIGIN;
        process.env.SQUARE_REDIRECT_URI = `${SQUARE_PRODUCTION_APP_ORIGIN}${squareCallbackPath}`;
        process.env.SQUARE_APPLICATION_ID = "sandbox-sq0idb-test";
        await assert.rejects(() => new SquareConnector().getAuthorizationUrl({
          state: "state-production",
          redirectUri: getSquareRedirectUri(),
        }), /production environment must not use a sandbox application ID/);
      });
      await withSquareEnv("sandbox", async () => {
        process.env.SQUARE_APPLICATION_ID = "sq0idp-test";
        await assert.rejects(() => new SquareConnector().getAuthorizationUrl({
          state: "state-sandbox",
          redirectUri: getSquareRedirectUri(),
        }), /sandbox environment must not use a production application ID/);
      });
      await withSquareEnv("sandbox", async () => {
        await assert.rejects(() => new SquareConnector().getAuthorizationUrl({
          state: "state-sandbox",
          redirectUri: `${SQUARE_PRODUCTION_APP_ORIGIN}${squareCallbackPath}`,
        }), /must match the configured callback URI/);
      });
    },
  },
  {
    name: "Square catalog mapper preserves products, variants, SKUs, and prices",
    run() {
      const [product] = mapSquareCatalogItems([
        {
          id: "ITEM-1",
          type: "ITEM",
          created_at: "2026-07-01T10:00:00Z",
          updated_at: "2026-07-02T10:00:00Z",
          item_data: {
            name: "Crew Neck",
            description: "Cotton shirt",
            category_id: "CAT-1",
            variations: [
              {
                id: "VAR-1",
                type: "ITEM_VARIATION",
                item_variation_data: {
                  item_id: "ITEM-1",
                  name: "Blue / M",
                  sku: "SKU-1",
                  upc: "123456",
                  price_money: { amount: 1299, currency: "EUR" },
                  track_inventory: true,
                },
              },
            ],
          },
        },
      ]);

      assert.equal(product.externalProductId, "ITEM-1");
      assert.equal(product.variants[0].externalVariantId, "VAR-1");
      assert.equal(product.variants[0].sku, "SKU-1");
      assert.equal(product.variants[0].retailPrice, "12.99");
      assert.equal(product.variants[0].currency, "EUR");
    },
  },
  {
    name: "Square inventory mapper maps IN_STOCK to available inventory only",
    run() {
      const count = mapSquareInventoryCount({
        catalog_object_id: "VAR-1",
        location_id: "LOC-1",
        state: "IN_STOCK",
        quantity: "3.5",
        calculated_at: "2026-07-03T10:00:00Z",
      });

      assert.equal(count.externalCatalogObjectId, "VAR-1");
      assert.equal(count.externalLocationId, "LOC-1");
      assert.equal(count.quantityOnHand, "3.5");
      assert.equal(count.quantityAvailable, "3.5");
      assert.equal(count.quantityReserved, null);
    },
  },
  {
    name: "Square order mapper separates discounts, refunds, taxes, tips, and net line values",
    run() {
      const order = mapSquareOrder({
        id: "ORDER-1",
        location_id: "LOC-1",
        state: "COMPLETED",
        created_at: "2026-07-04T10:00:00Z",
        total_money: { amount: 5000, currency: "EUR" },
        total_discount_money: { amount: 500, currency: "EUR" },
        total_tax_money: { amount: 800, currency: "EUR" },
        tenders: [{ tip_money: { amount: 300, currency: "EUR" } }],
        refunds: [{ amount_money: { amount: 1000, currency: "EUR" } }],
        line_items: [
          {
            uid: "LINE-1",
            catalog_object_id: "VAR-1",
            name: "Crew Neck",
            variation_name: "Blue / M",
            quantity: "2",
            base_price_money: { amount: 2500, currency: "EUR" },
            gross_sales_money: { amount: 5000, currency: "EUR" },
            total_discount_money: { amount: 500, currency: "EUR" },
            total_tax_money: { amount: 800, currency: "EUR" },
            total_money: { amount: 4500, currency: "EUR" },
          },
        ],
      });

      assert.equal(order.refundAmount, "10.00");
      assert.equal(order.discountAmount, "5.00");
      assert.equal(order.taxAmount, "8.00");
      assert.equal(order.tipAmount, "3.00");
      assert.equal(order.items[0].netAmount, "45.00");
    },
  },
  {
    name: "Retail KPI engine never counts refunds as new sales",
    run() {
      const [kpi] = calculateRetailSalesKpis([
        {
          status: "COMPLETED",
          currency: "EUR",
          totalAmount: "100.00",
          discountAmount: "10.00",
          refundAmount: "25.00",
          taxAmount: "12.00",
          tipAmount: "5.00",
        },
      ]);

      assert.equal(kpi.grossSales, 100);
      assert.equal(kpi.netSales, 65);
      assert.equal(kpi.refunds, 25);
      assert.equal(kpi.averageOrderValue, 65);
    },
  },
  {
    name: "Stockout and reorder calculations handle zero sales and positive demand",
    run() {
      assert.deepEqual(calculateStockoutRisk({ availableInventory: 10, unitsSold: 0, activeSalesDays: 30 }), {
        category: "zero_sales",
        daysRemaining: null,
      });
      assert.equal(
        calculateStockoutRisk({ availableInventory: 5, unitsSold: 30, activeSalesDays: 30 }).category,
        "high",
      );
      assert.equal(
        calculateReorderQuantity({
          averageDailySales: 2,
          coverageDays: 14,
          safetyStock: 5,
          availableStock: 10,
          incomingStock: 3,
        }),
        20,
      );
    },
  },
  {
    name: "Retail token encryption round-trips without plaintext payload storage",
    run() {
      const encrypted = encryptRetailSecret("square-access-token");
      assert.notEqual(encrypted.includes("square-access-token"), true);
      assert.equal(decryptRetailSecret(encrypted), "square-access-token");
    },
  },
  {
    name: "Square webhook mapper stores sanitized event metadata",
    run() {
      const event = mapSquareWebhookEvent({
        event_id: "evt_123",
        type: "order.updated",
        merchant_id: "MERCHANT-1",
        data: { id: "ORDER-1", object: { id: "ORDER-1", location_id: "LOC-1" } },
      });

      assert.equal(event.providerEventId, "evt_123");
      assert.equal(event.externalMerchantId, "MERCHANT-1");
      assert.equal(event.sanitizedPayload.object_id, "ORDER-1");
    },
  },
  {
    name: "Queued Square syncs execute after connect and manual sync",
    run() {
      const callbackRouteSource = readProjectFile("src/app/api/integrations/retail/square/callback/route.ts");
      const syncRouteSource = readProjectFile("src/app/api/integrations/retail/[connectionId]/sync/route.ts");
      const syncEngineSource = readProjectFile("src/integrations/retail/core/sync-engine.ts");
      const connectionServiceSource = readProjectFile("src/integrations/retail/core/connection.service.ts");

      assert.ok(
        callbackRouteSource.includes("executeQueuedRetailSync(run.id)"),
        "callback route executes the queued initial sync",
      );
      assert.ok(
        syncRouteSource.includes("executeQueuedRetailSync(run.id)"),
        "manual sync route executes the queued sync",
      );
      assert.ok(syncEngineSource.includes("export async function executeQueuedRetailSync"), "sync engine exposes queued execution");
      assert.ok(
        syncEngineSource.includes("run.status !== \"queued\"") || syncEngineSource.includes('run.status !== "queued"'),
        "queued execution only runs a run once",
      );
      assert.ok(
        syncEngineSource.includes("getRetailConnectionById(run.connectionId)"),
        "queued execution resolves the owning connection",
      );
      assert.ok(
        connectionServiceSource.includes("export async function getRetailConnectionById"),
        "connection service exposes internal lookup for background execution",
      );
    },
  },
  {
    name: "Square orders sync batches location IDs and SearchOrders always receives location_ids",
    async run() {
      assert.deepEqual(buildOrderLocationBatches([]), []);
      assert.deepEqual(buildOrderLocationBatches(["L1"]), [["L1"]]);
      assert.deepEqual(
        buildOrderLocationBatches(["L1", "L2", "L3"], 2),
        [["L1", "L2"], ["L3"]],
      );
      assert.equal(buildOrderLocationBatches(Array.from({ length: 23 }, (_, index) => `L${index}`)).length, 3);

      const seenRequests: Array<{ endpoint: string; body: Record<string, unknown> }> = [];
      await withSquareEnv("sandbox", async () => {
        const previousFetch = globalThis.fetch;
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          seenRequests.push({
            endpoint: String(input),
            body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown>,
          });
          return new Response(JSON.stringify({ orders: [], cursor: null }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch;

        try {
          await new SquareConnector().getOrders(
            makeTestConnection(),
            { locationIds: ["LOC-1", "LOC-2"], createdAfter: new Date("2026-07-01T00:00:00Z") },
          );
          await new SquareConnector().getOrders(
            makeTestConnection(),
            { cursor: "cursor-page-2", createdAfter: new Date("2026-07-01T00:00:00Z") },
          );
        } finally {
          globalThis.fetch = previousFetch;
        }
      });

      assert.equal(seenRequests.length, 2);
      assert.equal(seenRequests[0]?.endpoint, `https://${squareSandboxHost}/v2/orders/search`);
      assert.deepEqual(seenRequests[0]?.body.location_ids, ["LOC-1", "LOC-2"]);
      assert.equal(seenRequests[1]?.body.cursor, "cursor-page-2");    },
  },
  {
    name: "Square sync refreshes expired access tokens before provider calls",
    run() {
      const now = Date.now();
      assert.equal(needsTokenRefresh(null, now), false, "missing expiry does not trigger refresh");
      assert.equal(needsTokenRefresh(new Date(now + 60 * 60 * 1000), now), false, "fresh token does not trigger refresh");
      assert.equal(needsTokenRefresh(new Date(now + 60 * 1000), now), true, "token inside the refresh margin triggers refresh");
      assert.equal(needsTokenRefresh(new Date(now - 1000), now), true, "expired token triggers refresh");
      assert.equal(needsTokenRefresh(new Date(now + 6 * 60 * 1000), now), false, "token just outside the margin does not trigger refresh");
    },
  },
  {
    name: "Square sync engine bounds pagination and refreshes tokens server-side",
    run() {
      const syncEngineSource = readProjectFile("src/integrations/retail/core/sync-engine.ts");
      assert.ok(syncEngineSource.includes("MAX_PAGES_PER_RESOURCE"), "pagination page cap exists");
      assert.ok(syncEngineSource.includes("assertPaginationLimit("), "catalog, inventory, and order pages are capped");
      assert.ok(syncEngineSource.includes("ensureFreshConnectionToken"), "sync refreshes expiring tokens before provider calls");
      assert.ok(syncEngineSource.includes("locationIds: locationBatch"), "orders search receives explicit location batches");
    },
  },
  {
    name: "Square sync emits always-on stage logs without secrets",
    run() {
      const syncEngineSource = readProjectFile("src/integrations/retail/core/sync-engine.ts");
      assert.ok(syncEngineSource.includes('"[SQUARE_SYNC]"'), "sync stage logger uses the [SQUARE_SYNC] prefix");
      assert.ok(syncEngineSource.includes("console.warn(\"[SQUARE_SYNC]\""), "stage logs are always-on, not debug-gated");
      for (const stage of [
        "started",
        "token_resolved",
        "merchant_resolved",
        "locations_fetched",
        "catalog_fetched",
        "inventory_fetched",
        "orders_fetched",
        "completed",
        "failed",
      ]) {
        assert.ok(
          syncEngineSource.includes(`logSyncStage("${stage}")`) || syncEngineSource.includes(`"${stage}"`),
          `stage ${stage} is logged`,
        );
      }
      const failedLog = syncEngineSource.slice(syncEngineSource.indexOf('logSyncStage("failed"'));
      assert.ok(failedLog.includes("errorCode"), "failure log includes the safe error code");
      assert.ok(failedLog.includes("httpStatus"), "failure log includes the HTTP status");
      const logFields = syncEngineSource.slice(
        syncEngineSource.indexOf("logSyncStage("),
        syncEngineSource.indexOf("export async function runRetailSync"),
      );
      assert.equal(
        /accessToken|refreshToken|applicationSecret|Bearer\s/.test(logFields),
        false,
        "sync logs never reference token or secret values",
      );
    },
  },
  {
    name: "Stalled Square sync runs are released so Sync now can never be permanently blocked",
    run() {
      const now = Date.now();
      assert.equal(isSyncRunStalled(new Date(now - 1000), now), false, "fresh run is not stalled");
      assert.equal(isSyncRunStalled(new Date(now - 11 * 60 * 1000), now), true, "run older than the stall window is stalled");
      assert.equal(isSyncRunStalled(null, now), false, "missing creation date is not treated as stalled");

      const syncEngineSource = readProjectFile("src/integrations/retail/core/sync-engine.ts");
      assert.ok(
        syncEngineSource.includes("status: \"failed\"") && syncEngineSource.includes('"SYNC_STALLED"'),
        "stalled runs are marked failed with a SYNC_STALLED code",
      );
      assert.ok(
        syncEngineSource.includes("isSyncRunStalled(row.createdAt)"),
        "active-sync detection excludes stalled runs",
      );
      assert.ok(
        syncEngineSource.includes("SYNC_RUN_STALL_MS"),
        "stall window is an explicit constant",
      );
    },
  },
  {
    name: "Minimal Square product imports as one product with at least one variant",
    run() {
      const products = mapSquareCatalogItems([
        {
          id: "ITEM-USECLEVR-TEST",
          type: "ITEM",
          created_at: "2026-09-26T10:00:00Z",
          updated_at: "2026-09-26T10:00:00Z",
          item_data: {
            name: "Useclevr Test",
            variations: [
              {
                id: "VAR-USECLEVR-TEST",
                type: "ITEM_VARIATION",
                item_variation_data: {
                  item_id: "ITEM-USECLEVR-TEST",
                  name: "Regular",
                  price_money: { amount: 100, currency: "EUR" },
                },
              },
            ],
          },
        },
      ]);

      assert.equal(products.length, 1);
      assert.equal(products[0]?.name, "Useclevr Test");
      assert.equal(products[0]?.externalProductId, "ITEM-USECLEVR-TEST");
      assert.ok(products[0] && products[0].variants.length >= 1, "variant is imported without SKU or category");
      assert.equal(products[0]?.variants[0]?.retailPrice, "1.00");
      assert.equal(products[0]?.variants[0]?.currency, "EUR");
      assert.equal(products[0]?.variants[0]?.sku, null);
    },
  },
];

function withSquareEnv<T>(environment: string | undefined, run: () => T): T {  const previous = {
    environment: process.env.SQUARE_ENVIRONMENT,
    applicationId: process.env.SQUARE_APPLICATION_ID,
    applicationSecret: process.env.SQUARE_APPLICATION_SECRET,
    redirectUri: process.env.SQUARE_REDIRECT_URI,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    authUrl: process.env.AUTH_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL,
  };
  if (environment === undefined) {
    delete process.env.SQUARE_ENVIRONMENT;
  } else {
    process.env.SQUARE_ENVIRONMENT = environment;
  }
  process.env.SQUARE_APPLICATION_ID = environment === "production" ? "sq0idp-test" : "sandbox-sq0idb-test";
  process.env.SQUARE_APPLICATION_SECRET = environment === "production" ? "sq0csp-test" : "sandbox-sq0csp-test";
  process.env.SQUARE_REDIRECT_URI = environment === "production"
    ? `${SQUARE_PRODUCTION_APP_ORIGIN}${squareCallbackPath}`
    : `${SQUARE_TEST_APP_ORIGIN}${squareCallbackPath}`;
  process.env.NEXT_PUBLIC_APP_URL = environment === "production" ? SQUARE_PRODUCTION_APP_ORIGIN : SQUARE_TEST_APP_ORIGIN;
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;

  const restore = () => {
    restoreEnv("SQUARE_ENVIRONMENT", previous.environment);
    restoreEnv("SQUARE_APPLICATION_ID", previous.applicationId);
    restoreEnv("SQUARE_APPLICATION_SECRET", previous.applicationSecret);
    restoreEnv("SQUARE_REDIRECT_URI", previous.redirectUri);
    restoreEnv("NEXT_PUBLIC_APP_URL", previous.appUrl);
    restoreEnv("AUTH_URL", previous.authUrl);
    restoreEnv("NEXTAUTH_URL", previous.nextAuthUrl);
  };

  try {
    const result = run();
    const maybePromise = result as unknown;
    if (maybePromise && typeof (maybePromise as Promise<unknown>).finally === "function") {
      return (maybePromise as Promise<unknown>).finally(restore) as T;
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function makeTestConnection() {
  return {
    id: "retconn_test",
    organizationId: "biz_test",
    provider: "square" as const,
    providerEnvironment: "sandbox" as const,
    externalMerchantId: "MERCHANT-1",
    displayName: "Square",
    connectionStatus: "active" as const,
    accessTokenEncrypted: encryptRetailSecret("test-access-token"),
    refreshTokenEncrypted: null,
    tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    grantedScopes: ["MERCHANT_PROFILE_READ", "ITEMS_READ", "INVENTORY_READ", "ORDERS_READ"],
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

async function main() {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
  console.log(`Retail POS integration verification passed (${tests.length} checks).`);
}

void main();
