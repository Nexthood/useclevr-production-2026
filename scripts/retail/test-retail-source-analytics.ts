import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildRetailRecords,
  computeLowStock,
} from "@/lib/retail/retail-record-engine";
import {
  buildDatasetRetailSnapshot,
  buildSquareRetailSnapshot,
  formatRetailSourceParam,
  parseRetailSourceRef,
  type SquareSnapshotInput,
} from "@/lib/retail/retail-snapshot";

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const repoRoot = resolve(import.meta.dirname, "../..");

const tests: TestCase[] = [
  {
    name: "Retail source refs parse dataset, Square, and future providers, and reject garbage",
    run() {
      assert.deepEqual(parseRetailSourceRef("dataset:ds_123"), { type: "dataset", datasetId: "ds_123" });
      assert.deepEqual(parseRetailSourceRef("square:retconn_abc"), { type: "square", connectionId: "retconn_abc" });
      assert.deepEqual(parseRetailSourceRef("shopify:conn_1"), { type: "shopify", connectionId: "conn_1" });
      assert.equal(parseRetailSourceRef("dataset:"), null);
      assert.equal(parseRetailSourceRef(":abc"), null);
      assert.equal(parseRetailSourceRef("unknown:abc"), null);
      assert.equal(parseRetailSourceRef(null), null);
      assert.deepEqual(parseRetailSourceRef("dataset:ds_1:extra"), { type: "dataset", datasetId: "ds_1:extra" });
      assert.equal(
        formatRetailSourceParam({ type: "square", connectionId: "retconn_abc" }),
        "square:retconn_abc",
      );
    },
  },
  {
    name: "Uploaded retail dataset regression baseline: low stock, dead stock, and profit match historical calculations",
    run() {
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_retail_baseline",
        name: "01_local_retail",
        fileName: "01_local_retail.xlsx",
        rowCount: 5,
        columnCount: 10,
        createdAt: "2026-09-01T00:00:00.000Z",
        columns: ["product", "sku", "category", "store", "stock", "reorder point", "units sold", "revenue", "unit_cost", "date"],
        rows: datasetBaselineRows(),
      });

      assert.equal(snapshot.source.type, "dataset");
      assert.equal(snapshot.kpis.netSales, 534);
      assert.equal(snapshot.kpis.unitsSold, 24);
      assert.equal(snapshot.kpis.productCount, 4);

      assert.equal(snapshot.lowStock.status, "ok");
      assert.deepEqual(
        snapshot.lowStock.items.map((item) => [item.product, item.stock, item.reorderPoint]),
        [
          ["Gamma Lamp", 2, 5],
          ["Alpha Hoodie", 4, 10],
          ["Alpha Hoodie", 6, 10],
          ["Delta Chair", 9, 12],
        ],
      );

      assert.equal(snapshot.deadStock.items.length, 1);
      assert.equal(snapshot.deadStock.items[0].product, "Gamma Lamp");
      assert.equal(snapshot.deadStock.items[0].stockValue, 60);

      assert.equal(snapshot.topProfit.items.length, 2);
      assert.deepEqual(
        snapshot.topProfit.items.map((item) => item.product),
        ["Alpha Hoodie", "Delta Chair"],
      );
      assert.equal(snapshot.topProfit.items[0].profit, 200);
      assert.equal(snapshot.topProfit.items[0].margin, 50);
      assert.equal(snapshot.topProfit.items[1].profit, 29);
      assert.equal(snapshot.topProfit.items[1].margin?.toFixed(1), "32.6");

      assert.equal(snapshot.summary.deterministic, true);
      assert.ok(snapshot.summary.insight.includes("Analysis of 5 products complete"));
    },
  },
  {
    name: "Dataset without cost columns keeps historical engine behavior and warns about missing cost",
    run() {
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_no_cost",
        name: "no-cost-dataset",
        fileName: null,
        rowCount: 2,
        columnCount: 6,
        createdAt: null,
        columns: ["product", "stock", "units sold", "revenue", "reorder point", "date"],
        rows: [
          { product: "Alpha", stock: 3, "units sold": 12, revenue: 200, "reorder point": 10, date: "2026-08-01" },
          { product: "Beta", stock: 20, "units sold": 1, revenue: 50, "reorder point": 5, date: "2026-08-02" },
        ],
      });

      // Historical dataset semantics: missing cost is treated as zero cost by
      // the shared engine, with an explicit data-quality warning surfaced.
      assert.equal(snapshot.topProfit.status, "ok");
      assert.equal(snapshot.topProfit.items.length, 2);
      assert.ok(snapshot.dataQualityWarnings.some((warning) => warning.includes("cost")));
    },
  },
  {
    name: "Square catalog-only state: 3 products visible, sales-dependent metrics are unavailable, nothing is fabricated",
    run() {
      const snapshot = buildSquareRetailSnapshot(squareCatalogOnlyInput());

      const source = snapshot.source;
      assert.ok(source.type === "square", "Square snapshot reports a square source");
      assert.equal(source.type === "square" ? source.counts.locations : -1, 1);
      assert.equal(source.type === "square" ? source.counts.products : -1, 3);
      assert.equal(source.type === "square" ? source.counts.variants : -1, 3);
      assert.equal(source.type === "square" ? source.counts.orders : -1, 0);

      assert.equal(snapshot.kpis.productCount, 3);
      assert.equal(snapshot.kpis.variantCount, 3);
      assert.equal(snapshot.kpis.locationCount, 1);
      assert.equal(snapshot.kpis.totalOnHand, 14);
      assert.equal(snapshot.kpis.netSales, null);
      assert.equal(snapshot.kpis.unitsSold, null);
      assert.equal(snapshot.kpis.orderCount, null);

      assert.equal(snapshot.sales.hasSalesData, false);
      assert.ok(snapshot.sales.message?.includes("No synchronized sales history"));

      assert.equal(snapshot.lowStock.status, "no_reorder_thresholds");
      assert.equal(snapshot.lowStock.hasReorderThresholds, false);
      assert.ok(snapshot.lowStock.message.includes("does not provide reorder thresholds"));
      assert.equal(snapshot.lowStock.items.length, 2);

      assert.equal(snapshot.deadStock.status, "insufficient_data");
      assert.equal(snapshot.deadStock.message, "Not enough sales history to identify slow-moving products.");
      assert.equal(snapshot.deadStock.items.length, 0);

      assert.equal(snapshot.topSellers.status, "insufficient_data");
      assert.equal(snapshot.topProfit.status, "insufficient_data");
      assert.equal(snapshot.topProfit.message, "No sales data available yet.");

      assert.ok(snapshot.summary.insight.includes("3 products and 3 variants synchronized across 1 location"));
      assert.ok(snapshot.summary.explanation.includes("no sales history is available yet"));
      assert.equal(snapshot.summary.deterministic, true);
      assert.ok(snapshot.dataQualityWarnings.some((warning) => warning.includes("reorder thresholds")));
    },
  },
  {
    name: "Square with orders: revenue, units, top sellers, trend, and refunds are computed deterministically",
    run() {
      const input = squareCatalogOnlyInput();
      input.variants[0].unitCost = 4;
      input.variants[2].unitCost = 2.5;
      input.orders = [
        {
          id: "COMPLETED:EUR:2026-08",
          status: "COMPLETED",
          currency: "EUR",
          totalAmount: 90,
          discountAmount: 10,
          refundAmount: 5,
          orderedAt: "2026-08-01T00:00:00.000Z",
          orderCount: 3,
        },
        {
          id: "COMPLETED:EUR:2026-09",
          status: "COMPLETED",
          currency: "EUR",
          totalAmount: 60,
          discountAmount: 0,
          refundAmount: 0,
          orderedAt: "2026-09-01T00:00:00.000Z",
          orderCount: 2,
        },
        {
          id: "CANCELED:EUR:2026-09",
          status: "CANCELED",
          currency: "EUR",
          totalAmount: 25,
          discountAmount: 0,
          refundAmount: 0,
          orderedAt: "2026-09-20T00:00:00.000Z",
          orderCount: 1,
        },
      ];
      input.orderItems = [
        { variantId: "var-1", sku: "SKU-1", itemName: "Crew Neck", units: 8, revenue: 80, orderCount: 3, lastSaleAt: "2026-09-01T00:00:00.000Z" },
        { variantId: "var-2", sku: null, itemName: "Mug", units: 2, revenue: 30, orderCount: 1, lastSaleAt: "2026-08-15T00:00:00.000Z" },
        { variantId: "var-3", sku: "SKU-3", itemName: "Cap", units: 4, revenue: 25, orderCount: 2, lastSaleAt: "2026-08-20T00:00:00.000Z" },
      ];

      const snapshot = buildSquareRetailSnapshot(input);

      assert.equal(snapshot.sales.hasSalesData, true);
      assert.equal(snapshot.kpis.netSales, 135);
      assert.equal(snapshot.kpis.unitsSold, 14);
      assert.equal(snapshot.kpis.orderCount, 5);
      assert.equal(snapshot.kpis.averageOrderValue, 27);
      assert.deepEqual(snapshot.sales.trend, [
        { period: "2026-08", revenue: 75 },
        { period: "2026-09", revenue: 60 },
      ]);

      assert.deepEqual(
        snapshot.topSellers.items.map((item) => [item.product, item.unitsSold, item.revenue]),
        [
          ["Crew Neck", 8, 80],
          ["Cap", 4, 25],
          ["Mug", 2, 30],
        ],
      );

      // Profit only for variants that actually have a synchronized cost basis.
      assert.equal(snapshot.topProfit.status, "ok");
      assert.deepEqual(
        snapshot.topProfit.items.map((item) => [item.product, item.profit, item.cost]),
        [
          ["Crew Neck", 48, 32],
          ["Cap", 15, 10],
        ],
      );

      assert.equal(snapshot.deadStock.status, "empty");
      assert.equal(snapshot.currency, "EUR");
    },
  },
  {
    name: "Square missing inventory: products still render and low stock reports unknown stock",
    run() {
      const input = squareCatalogOnlyInput();
      input.inventory = [];
      const snapshot = buildSquareRetailSnapshot(input);

      assert.equal(snapshot.kpis.productCount, 3);
      assert.equal(snapshot.kpis.totalOnHand, null);
      assert.equal(snapshot.lowStock.status, "no_inventory");
      assert.equal(snapshot.lowStock.items.length, 0);
      assert.ok(snapshot.lowStock.message.includes("not been synchronized"));
    },
  },
  {
    name: "Square missing cost with orders: revenue rankings work but profit stays unavailable",
    run() {
      const input = squareCatalogOnlyInput();
      input.orders = [{
        id: "COMPLETED:EUR:2026-09",
        status: "COMPLETED",
        currency: "EUR",
        totalAmount: 50,
        discountAmount: 0,
        refundAmount: 0,
        orderedAt: "2026-09-05T00:00:00.000Z",
        orderCount: 2,
      }];
      input.orderItems = [
        { variantId: "var-1", sku: "SKU-1", itemName: "Crew Neck", units: 3, revenue: 30, orderCount: 1, lastSaleAt: "2026-09-05T00:00:00.000Z" },
      ];
      const snapshot = buildSquareRetailSnapshot(input);

      assert.equal(snapshot.sales.hasSalesData, true);
      assert.equal(snapshot.topSellers.items[0].unitsSold, 3);
      assert.equal(snapshot.topProfit.status, "no_cost_data");
      assert.ok(snapshot.topProfit.message.includes("cost basis"));
    },
  },
  {
    name: "Source switch keeps dataset and Square analytics isolated",
    run() {
      const datasetSnapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_retail_baseline",
        name: "01_local_retail",
        fileName: "01_local_retail.xlsx",
        rowCount: 5,
        columnCount: 10,
        createdAt: null,
        columns: ["product", "sku", "stock", "reorder point", "units sold", "revenue", "unit_cost", "date"],
        rows: datasetBaselineRows(),
      });
      const squareSnapshot = buildSquareRetailSnapshot(squareCatalogOnlyInput());

      // Each source snapshot only reflects its own data: the dataset keeps
      // its own sales totals while Square reports zero synchronized sales.
      assert.equal(datasetSnapshot.source.id, "ds_retail_baseline");
      assert.equal(squareSnapshot.source.id, "retconn_square_test");
      assert.equal(datasetSnapshot.kpis.netSales, 534);
      assert.equal(squareSnapshot.kpis.netSales, null);
      assert.equal(squareSnapshot.source.type === "square" ? squareSnapshot.source.counts.products : -1, 3);
      assert.equal(squareSnapshot.kpis.orderCount, null);
    },
  },
  {
    name: "Tenant isolation: analytics and source routes resolve ownership server-side",
    run() {
      const analyticsRoute = readProjectFile("src/app/api/retail/analytics/route.ts");
      assert.ok(analyticsRoute.includes("getOwnedRetailConnection"), "Square connections resolve through ownership check");
      assert.ok(analyticsRoute.includes("eq(datasets.userId, userId)"), "datasets resolve through owner-scoped query");
      assert.ok(analyticsRoute.includes("404"), "unowned sources return not found");

      const sourcesRoute = readProjectFile("src/app/api/retail/sources/route.ts");
      assert.ok(sourcesRoute.includes("listRetailAnalyticsSources"), "sources list is owner-scoped");

      const sourcesService = readProjectFile("src/integrations/retail/analytics/square-analytics.service.ts");
      assert.ok(sourcesService.includes('eq(datasets.userId, userId)'), "dataset listing filters by owner");
      assert.ok(
        sourcesService.includes('"Business"."userId" = ${userId}'),
        "connection listing filters through the owning business",
      );

      const questionService = readProjectFile("src/integrations/retail/analytics/square-question.service.ts");
      assert.ok(questionService.includes("getOwnedRetailConnection"), "assistant answers resolve connection ownership");

      const analyticsEngine = readProjectFile("src/integrations/retail/analytics/square-analytics.service.ts");
      assert.ok(analyticsEngine.includes("eq(retailLocations.connectionId, connection.id)"), "location reads are connection-scoped");
      assert.ok(analyticsEngine.includes("eq(retailOrders.connectionId, connection.id)"), "order reads are connection-scoped");
    },
  },
  {
    name: "Dashboard renders snapshot data and source-aware empty states without regressing the upload flow",
    run() {
      const clientSource = readProjectFile("src/components/retail/retail-inventory-client.tsx");
      assert.ok(clientSource.includes("/api/retail/sources"), "dashboard loads owner-scoped sources");
      assert.ok(clientSource.includes("/api/retail/analytics"), "dashboard consumes the normalized analytics endpoint");
      assert.ok(clientSource.includes("snapshot?.deadStock.message"), "Square insufficient-sales message renders from the snapshot");
      assert.ok(clientSource.includes("EMPTY_STATE_HINT"), "no-source state explains connecting a retail system or uploading");
      assert.ok(clientSource.includes("Sync now"), "Square source header offers sync");
      assert.ok(clientSource.includes("/app/retail/integrations"), "Square header links to connection management");
      assert.ok(clientSource.includes("computeLowStock(retailRecords)"), "upload flow still uses the shared retail engine");
      assert.ok(clientSource.includes("Deterministic summary from synchronized Square data"), "Square summary is labeled deterministic");
      assert.ok(
        !clientSource.includes("SquareRetailAnalyticsEngine"),
        "no duplicate Square analytics engine was introduced",
      );
    },
  },
  {
    name: "Usy routes retail questions to the selected Square source without dataset fallback",
    run() {
      const chatRoute = readProjectFile("src/app/api/hybrid-ai/chat/route.ts");
      assert.ok(chatRoute.includes("retailSource"), "hybrid chat accepts the active retail source");
      assert.ok(chatRoute.includes("answerSquareRetailQuestion"), "Square retail questions answer deterministically");

      const workspace = readProjectFile("src/components/chat/ai-assistant-workspace.tsx");
      assert.ok(workspace.includes("getActiveRetailSource"), "assistant workspace reads the active retail source");
      assert.ok(
        workspace.includes("isRetailAssistantPath() && activeRetailSquareSourceContext()"),
        "assistant workspace avoids silent dataset fallback while a Square source is selected",
      );

      const legacyChatRoute = readProjectFile("src/app/api/chat/route.ts");
      assert.ok(legacyChatRoute.includes("answerSquareRetailQuestion"), "legacy chat route also routes Square retail questions");
    },
  },
  {
    name: "Dataset records engine keeps dataset defaults and null semantics for connected sources",
    run() {
      const detected = detectColumnsForTest();
      const rows = datasetBaselineRows();
      const records = buildRetailRecords(rows, detected);
      assert.equal(records.length, 5);
      assert.equal(records[0].reorderPoint, 10);
      const lowStock = computeLowStock(records);
      assert.ok(lowStock.length >= 3);

      const posRecords = buildRetailRecords(
        [{ product: "Crew Neck", stock: null, "units sold": null, revenue: null }],
        {
          skuCol: null,
          productCol: "product",
          categoryCol: null,
          storeCol: null,
          stockCol: "stock",
          reorderPointCol: null,
          salesCol: "units sold",
          revenueCol: "revenue",
          costCol: null,
          dateCol: null,
          orderCol: null,
        },
        { defaultReorderPoint: null, defaultMissingNumbersToZero: false },
      );
      assert.equal(posRecords[0].stock, null);
      assert.equal(posRecords[0].unitsSold, null);
      assert.equal(posRecords[0].reorderPoint, null);
      assert.equal(posRecords[0].stockValue, null);
    },
  },
];

function detectColumnsForTest() {
  return {
    skuCol: "sku",
    productCol: "product",
    categoryCol: "category",
    storeCol: "store",
    stockCol: "stock",
    reorderPointCol: "reorder point",
    salesCol: "units sold",
    revenueCol: "revenue",
    costCol: "unit_cost",
    dateCol: "date",
    orderCol: null,
  };
}

function datasetBaselineRows(): Record<string, unknown>[] {
  return [
    { product: "Alpha Hoodie", sku: "AH-01", category: "Apparel", store: "Main", stock: 4, "reorder point": 10, "units sold": 12, revenue: 240, unit_cost: 10, date: "2026-08-01" },
    { product: "Beta Mug", sku: "BM-02", category: "Home", store: "Main", stock: 25, "reorder point": 10, "units sold": 3, revenue: 45, unit_cost: 15, date: "2026-08-15" },
    { product: "Alpha Hoodie", sku: "AH-01", category: "Apparel", store: "Main", stock: 6, "reorder point": 10, "units sold": 8, revenue: 160, unit_cost: 10, date: "2026-08-20" },
    { product: "Gamma Lamp", sku: "GL-03", category: "Home", store: "Main", stock: 2, "reorder point": 5, "units sold": 0, revenue: 0, unit_cost: 30, date: "2026-07-20" },
    { product: "Delta Chair", sku: "DC-04", category: "Furniture", store: "Main", stock: 9, "reorder point": 12, "units sold": 1, revenue: 89, unit_cost: 60, date: "2026-09-01" },
  ];
}

function squareCatalogOnlyInput(): SquareSnapshotInput {
  return {
    connectionId: "retconn_square_test",
    label: "Square",
    merchantId: "MLBQAXAFNETJG",
    environment: "production",
    connectionStatus: "connected",
    syncStatus: "completed",
    lastSuccessfulSyncAt: "2026-09-26T19:54:00.000Z",
    lastSyncAttemptAt: "2026-09-26T19:54:00.000Z",
    syncError: null,
    locations: [
      { id: "loc-1", name: "Main Street", status: "ACTIVE", currency: "EUR" },
    ],
    variants: [
      { productId: "p1", productName: "Crew Neck", productCategory: "Apparel", productStatus: "ACTIVE", variantId: "var-1", sku: "SKU-1", variantName: "Blue / M", unitCost: null, retailPrice: 12.99, currency: "EUR" },
      { productId: "p2", productName: "Mug", productCategory: "Home", productStatus: "ACTIVE", variantId: "var-2", sku: null, variantName: "Regular", unitCost: null, retailPrice: 15, currency: "EUR" },
      { productId: "p3", productName: "Cap", productCategory: "Apparel", productStatus: "ACTIVE", variantId: "var-3", sku: "SKU-3", variantName: "One size", unitCost: null, retailPrice: 12.5, currency: "EUR" },
    ],
    inventory: [
      { variantId: "var-1", locationId: "loc-1", quantityOnHand: 10, quantityAvailable: 10, reorderPoint: null, providerUpdatedAt: "2026-09-26T19:00:00.000Z" },
      { variantId: "var-2", locationId: "loc-1", quantityOnHand: 4, quantityAvailable: 4, reorderPoint: null, providerUpdatedAt: "2026-09-26T19:00:00.000Z" },
    ],
    orders: [],
    orderItems: [],
  };
}

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

async function main() {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
  console.log(`Retail source analytics verification passed (${tests.length} checks).`);
}

void main();
