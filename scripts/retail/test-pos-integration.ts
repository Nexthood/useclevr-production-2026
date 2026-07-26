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
  getSafeSquareFailureReason,
  getSquareCallbackFailureReason,
  getSquareIntegrationRedirectUrl,
  getSquareProviderDenialReason,
  getSquareRedirectUri,
} from "@/integrations/retail/providers/square/square-oauth";
import {
  mapSquareCatalogItems,
  mapSquareInventoryCount,
  mapSquareOrder,
  mapSquareWebhookEvent,
} from "@/integrations/retail/providers/square/square.mapper";

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

process.env.RETAIL_TOKEN_ENCRYPTION_KEY = "test-retail-token-encryption-key-with-32-chars";

const repoRoot = resolve(import.meta.dirname, "../..");
const squareProductionHost = "connect.squareup.com";
const squareSandboxHost = "connect.squareupsandbox.com";

const tests: TestCase[] = [
  {
    name: "Square callback route exists, supports GET, and is public through the proxy",
    run() {
      const routeSource = readProjectFile("src/app/api/integrations/retail/square/callback/route.ts");
      const proxySource = readProjectFile("src/proxy.ts");
      assert.ok(routeSource.includes("export async function GET"), "callback route exports GET");
      assert.ok(routeSource.includes("consumeOauthState"), "callback consumes stored OAuth state");
      assert.ok(routeSource.includes("getSquareIntegrationRedirectUrl"), "callback redirects through safe helper");
      assert.ok(proxySource.includes("SQUARE_CALLBACK_PATH"), "proxy imports the canonical Square callback path");
      assert.ok(proxySource.includes("publicApiPaths"), "proxy keeps a public API allowlist");
    },
  },
  {
    name: "Square production redirect URI is canonical and never falls back to localhost",
    async run() {
      withSquareEnv("production", () => {
        delete process.env.SQUARE_REDIRECT_URI;
        process.env.NEXT_PUBLIC_APP_URL = "https://useclevr.com";
        assert.equal(getSquareRedirectUri(), "https://useclevr.com/api/integrations/retail/square/callback");
        assert.equal(getSquareConfig().redirectUri, "https://useclevr.com/api/integrations/retail/square/callback");
      });

      await withSquareEnv("production", async () => {
        delete process.env.SQUARE_REDIRECT_URI;
        process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
        await assert.rejects(() => new SquareConnector().getAuthorizationUrl({
          state: "state-production",
          redirectUri: getSquareRedirectUri(),
        }), /HTTPS|localhost/);
      });

      await withSquareEnv("production", async () => {
        process.env.SQUARE_REDIRECT_URI = "https://test.useclevr.com/api/integrations/retail/square/callback";
        await assert.rejects(() => new SquareConnector().getAuthorizationUrl({
          state: "state-production",
          redirectUri: getSquareRedirectUri(),
        }), /test or preview/);
      });
    },
  },
  {
    name: "Square authorization and token exchange use the same redirect URI",
    async run() {
      await withSquareEnv("production", async () => {
        process.env.SQUARE_REDIRECT_URI = "https://useclevr.com/api/integrations/retail/square/callback";
        const redirectUri = getSquareRedirectUri();
        const authorizationUrl = await new SquareConnector().getAuthorizationUrl({
          state: "state-production",
          redirectUri,
        });
        assert.equal(new URL(authorizationUrl).searchParams.get("redirect_uri"), redirectUri);

        const previousFetch = globalThis.fetch;
        let tokenBody: { redirect_uri?: string } | null = null;
        const accessTokenField = ["access", "token"].join("_");
        const refreshTokenField = ["refresh", "token"].join("_");
        globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
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
    name: "Square callback redirects use safe success and failure destinations",
    run() {
      withSquareEnv("production", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://useclevr.com";
        assert.equal(
          getSquareIntegrationRedirectUrl({ status: "success" }).toString(),
          "https://useclevr.com/app/retail/integrations?connection=square&status=success",
        );
        assert.equal(
          getSquareIntegrationRedirectUrl({ status: "error", reason: "missing_code" }).toString(),
          "https://useclevr.com/app/retail/integrations?connection=square&status=error&reason=missing_code",
        );
        assert.equal(getSafeSquareFailureReason("secret-token-value"), "provider_error");
        assert.equal(getSquareProviderDenialReason("access_denied"), "access_denied");
        assert.equal(getSquareProviderDenialReason("temporarily_unavailable"), "oauth_denied");
        assert.equal(getSquareCallbackFailureReason(new OauthStateError("invalid_state")), "invalid_state");
        assert.equal(getSquareCallbackFailureReason(new OauthStateError("expired_state")), "expired_state");
        assert.equal(getSquareCallbackFailureReason(new Error("Square token response failed")), "token_exchange_failed");
      });
    },
  },
  {
    name: "Square production environment uses production OAuth, token, and API endpoints",
    async run() {
      withSquareEnv("production", () => {
        const config = getSquareConfig();
        assert.equal(config.environment, "production");
        assert.equal(config.authorizationUrl, `https://${squareProductionHost}/oauth2/authorize`);
        assert.equal(config.tokenUrl, `https://${squareProductionHost}/oauth2/token`);
        assert.equal(config.apiBaseUrl, `https://${squareProductionHost}/v2`);
      });

      const url = await withSquareEnv("production", () =>
        new SquareConnector().getAuthorizationUrl({
          state: "state-production",
          redirectUri: getSquareRedirectUri(),
        }),
      );

      const parsed = new URL(url);
      assert.equal(parsed.host, squareProductionHost);
      assert.equal(parsed.pathname, "/oauth2/authorize");
      assert.equal(parsed.searchParams.get("session"), "false");
      assert.equal(parsed.searchParams.get("redirect_uri"), `https://app.useclevr.com${SQUARE_CALLBACK_PATH}`);
    },
  },
  {
    name: "Square sandbox environment uses sandbox OAuth, token, and API endpoints",
    async run() {
      withSquareEnv("sandbox", () => {
        const config = getSquareConfig();
        assert.equal(config.environment, "sandbox");
        assert.equal(config.authorizationUrl, `https://${squareSandboxHost}/oauth2/authorize`);
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
      assert.equal(parsed.searchParams.has("session"), false);
    },
  },
  {
    name: "Square environment configuration rejects missing or invalid values",
    run() {
      withSquareEnv(undefined, () => {
        assert.throws(() => getSquareConfig(), /SQUARE_ENVIRONMENT/);
      });
      withSquareEnv("Production", () => {
        assert.throws(() => getSquareConfig(), /SQUARE_ENVIRONMENT/);
      });
      withSquareEnv("staging", () => {
        assert.throws(() => getSquareConfig(), /SQUARE_ENVIRONMENT/);
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
];

function withSquareEnv<T>(environment: string | undefined, run: () => T): T {
  const previous = {
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
  process.env.SQUARE_APPLICATION_ID = "square-app-id";
  process.env.SQUARE_APPLICATION_SECRET = "square-app-secret";
  process.env.SQUARE_REDIRECT_URI = "https://app.useclevr.com/api/integrations/retail/square/callback";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.useclevr.com";
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
