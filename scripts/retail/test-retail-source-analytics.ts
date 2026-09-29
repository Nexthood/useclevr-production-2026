import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

import { parseCSVStreaming } from "@/lib/data/csvLoader";
import {
  RETAIL_DEAD_STOCK_AFTER_DAYS,
  RETAIL_SLOW_MOVER_AFTER_DAYS,
  aggregateRetailInventoryRecords,
  buildRetailRecords,
  computeLowStock,
  computeTopProfit,
  computeTopSellers,
  detectColumns,
  isUnitCostColumn,
  resolveRetailSchema,
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
    name: "Uploaded retail dataset regression baseline: low stock, dead stock, and profit match canonical calculations",
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
      assert.equal(snapshot.kpis.inventoryItemCount, 4);

      assert.equal(snapshot.lowStock.status, "ok");
      assert.deepEqual(
        snapshot.lowStock.items.map((item) => [item.product, item.stock, item.reorderPoint]),
        [
          ["Gamma Lamp", 2, 5],
          ["Alpha Hoodie", 6, 10],
          ["Delta Chair", 9, 12],
        ],
      );
      assert.equal(snapshot.kpis.totalOnHand, 42);
      assert.equal(snapshot.kpis.locationCount, 1);

      assert.equal(snapshot.deadStock.items.length, 1);
      assert.equal(snapshot.deadStock.items[0].product, "Gamma Lamp");
      assert.equal(snapshot.deadStock.items[0].stockValue, 60);
      assert.equal(snapshot.deadStock.items[0].classification, "dead_stock");

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
      assert.ok(snapshot.summary.insight.includes("Analysis of 4 product/location items complete"));
      assert.ok(snapshot.summary.explanation.includes("from 5 transaction rows"));
      assert.ok(
        snapshot.summary.explanation.includes("at or below their reorder point"),
        "summary states the reorder-point rule, not a hardcoded unit threshold",
      );
    },
  },
  {
    name: "Dataset without cost columns keeps historical engine behavior, warns, and states the revenue-as-profit caveat",
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
      // the shared engine, with an explicit data-quality warning surfaced and
      // a section message that says profit equals revenue.
      assert.equal(snapshot.topProfit.status, "ok");
      assert.equal(snapshot.topProfit.items.length, 2);
      assert.ok(snapshot.topProfit.message.includes("No cost column was detected"));
      assert.ok(snapshot.dataQualityWarnings.some((warning) => warning.includes("cost")));
    },
  },
  {
    name: "GOLDEN 01_local_retail.xlsx: canonical results independently derived from the real workbook",
    run() {
      const rows = parseXlsxFixture("test-fixtures/business-models/01_local_retail.xlsx");
      const columns = Object.keys(rows[0] || {});
      assert.equal(rows.length, 180, "fixture must contain 180 transaction rows");

      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_01_local_retail",
        name: "01_local_retail",
        fileName: "01_local_retail.xlsx",
        rowCount: rows.length,
        columnCount: columns.length,
        createdAt: null,
        columns,
        rows,
      });

      // Column detection: product_id wins identity, store_id wins location,
      // product_name is the display label, transaction_id/customer_id carry
      // distinct counts, and reorder_point is never read as an order id.
      const detected = detectColumns(columns);
      assert.equal(columns.length, 17);
      assert.deepEqual(columns, [
        "date",
        "store_id",
        "transaction_id",
        "customer_id",
        "product_id",
        "product_name",
        "category",
        "units_sold",
        "unit_price",
        "revenue",
        "unit_cost",
        "cogs",
        "gross_profit",
        "stock_on_hand",
        "reorder_point",
        "supplier",
        "city",
      ]);
      assert.equal(detected.productIdCol, "product_id");
      assert.equal(detected.productCol, "product_name");
      assert.equal(detected.storeCol, "store_id");
      assert.equal(detected.costCol, "unit_cost");
      assert.equal(detected.orderCol, "transaction_id");
      assert.equal(detected.customerCol, "customer_id");
      assert.equal(detected.skuCol, null);

      // Canonical entities stay at product/location grain, never collapsed to
      // products only and never expanded to the 180 transaction rows.
      assert.equal(snapshot.kpis.productCount, 35, "35 canonical products");
      assert.equal(snapshot.kpis.inventoryItemCount, 106, "106 product/location entities");
      assert.equal(snapshot.kpis.locationCount, 4);

      // Additive KPIs across all transaction rows.
      assert.equal(snapshot.kpis.unitsSold, 1216);
      assert.equal(snapshot.kpis.netSales, 79764.51);
      assert.equal(snapshot.kpis.orderCount, 180);
      assert.equal(snapshot.kpis.customerCount, 73);
      assert.equal(snapshot.kpis.averageOrderValue, 443.14);

      // Latest-snapshot inventory semantics.
      assert.equal(snapshot.kpis.totalOnHand, 6341);
      assert.equal(snapshot.kpis.inventoryValue, 263566.08);
      assert.equal(snapshot.kpis.lastSaleAt, "2026-03-31T00:00:00.000Z");

      // Low stock / reorder alerts: latest stock <= reorder point.
      assert.equal(snapshot.lowStock.status, "ok");
      assert.equal(snapshot.lowStock.hasReorderThresholds, true);
      assert.equal(snapshot.lowStock.items.length, 11);
      assert.deepEqual(
        snapshot.lowStock.items.map((item) => [item.product, item.store, item.stock, item.reorderPoint]),
        [
          ["Protein Bar", "RTM-01", 4, 19],
          ["Coffee Maker", "UTR-01", 5, 30],
          ["Desk Chair", "EIN-01", 6, 11],
          ["Desk Chair", "UTR-01", 7, 10],
          ["Protein Bar", "UTR-01", 8, 12],
          ["Protein Bar", "AMS-01", 9, 25],
          ["Skin Serum", "RTM-01", 11, 22],
          ["Desk Chair", "EIN-01", 16, 26],
          ["LED Lamp", "EIN-01", 17, 22],
          ["Skin Serum", "RTM-01", 18, 21],
          ["LED Lamp", "AMS-01", 20, 20],
        ],
      );
      assert.ok(
        snapshot.lowStock.message.includes("reorder point"),
        "banner states the reorder-point rule",
      );

      // Dead stock / slow movers use the dataset reference date, 2026-03-31.
      assert.equal(snapshot.deadStock.status, "ok");
      assert.equal(snapshot.deadStock.items.length, 20, "the dead/slow section shows the top 20 items by stock value");
      assert.equal(snapshot.deadStock.items.filter((item) => item.classification === "dead_stock").length, 7);
      assert.equal(snapshot.deadStock.items.filter((item) => item.classification === "slow_mover").length, 13);
      assert.ok(snapshot.deadStock.message.includes("23 dead-stock and 39 slow-mover items"), "the section message states the true uncapped classification counts");

      // Top profit ranks product/location entities without merging locations.
      assert.equal(snapshot.topProfit.status, "ok");
      assert.equal(snapshot.topProfit.items.length, 20);
      assert.equal(snapshot.topProfit.items[0].product, "Protein Bar");
      assert.equal(snapshot.topProfit.items[0].store, "RTM-01");
      assert.equal(snapshot.topProfit.items[0].unitsSold, 43);
      assert.equal(snapshot.topProfit.items[0].revenue, 3722.79);
      assert.equal(snapshot.topProfit.items[0].cost, 2258.7);
      assert.equal(snapshot.topProfit.items[0].profit?.toFixed(2), "1464.09");
      assert.equal(snapshot.topProfit.items[0].margin?.toFixed(2), "39.33");

      // Summary agrees with the deterministic sections.
      assert.ok(
        snapshot.summary.explanation.includes("106 product/location inventory items for 35 products from 180 transaction rows"),
      );
      assert.ok(snapshot.summary.explanation.includes("11 items are at or below their reorder point"));
      assert.ok(snapshot.summary.explanation.includes("23 dead-stock and 39 slow-mover items"));
      assert.ok(snapshot.summary.explanation.includes("Protein Bar (RTM-01)"));
      assert.ok(snapshot.summary.recommendation.includes("Restock 11 low-inventory product/location items"));
    },
  },
  {
    name: "Production-parity upload parser: 01_local_retail.xlsx direct and uploaded row shapes produce identical Retail findings",
    async run() {
      const fixturePath = "test-fixtures/business-models/01_local_retail.xlsx";
      const directRows = parseXlsxFixture(fixturePath);
      const directColumns = Object.keys(directRows[0] || {});
      const fileBuffer = readFileSync(resolve(repoRoot, fixturePath));
      const uploadParse = await parseCSVStreaming(
        new File([fileBuffer], "01_local_retail.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        10_000,
      );
      const serializedRows = JSON.parse(JSON.stringify(uploadParse.previewRows)) as Record<string, unknown>[];

      assert.equal(uploadParse.rowCount, directRows.length);
      assert.deepEqual(uploadParse.columns, directColumns);
      assert.equal(uploadParse.columns.length, 17);
      assert.deepEqual(uploadParse.columns, [
        "date",
        "store_id",
        "transaction_id",
        "customer_id",
        "product_id",
        "product_name",
        "category",
        "units_sold",
        "unit_price",
        "revenue",
        "unit_cost",
        "cogs",
        "gross_profit",
        "stock_on_hand",
        "reorder_point",
        "supplier",
        "city",
      ]);

      const directSnapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_direct_01_local_retail",
        name: "01_local_retail",
        fileName: "01_local_retail.xlsx",
        rowCount: directRows.length,
        columnCount: directColumns.length,
        createdAt: null,
        columns: directColumns,
        rows: directRows,
      });
      const uploadedSnapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_uploaded_01_local_retail",
        name: "01_local_retail",
        fileName: "01_local_retail.xlsx",
        rowCount: uploadParse.rowCount,
        columnCount: uploadParse.columns.length,
        createdAt: null,
        columns: uploadParse.columns,
        rows: serializedRows,
      });

      assertSnapshotParity(uploadedSnapshot, directSnapshot);
      assert.equal(uploadedSnapshot.kpis.productCount, 35);
      assert.equal(uploadedSnapshot.kpis.locationCount, 4);
      assert.equal(uploadedSnapshot.kpis.inventoryItemCount, 106);
      assert.equal(uploadedSnapshot.lowStock.items.length, 11);
      assert.equal(uploadedSnapshot.deadStock.items.filter((item) => item.classification === "dead_stock").length, 7);
      assert.equal(uploadedSnapshot.deadStock.items.filter((item) => item.classification === "slow_mover").length, 13);
      assert.equal(uploadedSnapshot.kpis.netSales, 79764.51);
      assert.equal(uploadedSnapshot.kpis.unitsSold, 1216);
      assert.equal(uploadedSnapshot.kpis.inventoryValue, 263566.08);
      assert.equal(uploadedSnapshot.kpis.lastSaleAt, "2026-03-31T00:00:00.000Z");
      assert.equal(uploadedSnapshot.kpis.orderCount, 180);
      assert.equal(uploadedSnapshot.kpis.customerCount, 73);
      assert.equal(uploadedSnapshot.topProfit.items[0].product, "Protein Bar");
      assert.equal(uploadedSnapshot.topProfit.items[0].store, "RTM-01");
      assert.equal(uploadedSnapshot.topProfit.items[0].profit?.toFixed(2), "1464.09");
    },
  },
  {
    name: "GOLDEN 02_retail_alternative_structure.xlsx: alternative naming convention resolves through the semantic schema and matches independently derived results",
    async run() {
      const fixturePath = "test-fixtures/business-models/02_retail_alternative_structure.xlsx";
      const fileBuffer = readFileSync(resolve(repoRoot, fixturePath));
      const uploadParse = await parseCSVStreaming(
        new File([fileBuffer], "02_retail_alternative_structure.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        10_000,
      );
      const rows = JSON.parse(JSON.stringify(uploadParse.previewRows)) as Record<string, unknown>[];
      const columns = uploadParse.columns;

      // Workbook shape: 164 rows, 16 differently named columns.
      assert.equal(uploadParse.rowCount, 164);
      assert.equal(columns.length, 16);
      assert.deepEqual(columns, [
        "sale_date", "branch_code", "receipt_no", "client_ref", "sku", "item_description",
        "department", "qty", "selling_price", "net_sales", "purchase_cost", "total_cost",
        "inventory_qty", "min_stock_level", "vendor_name", "region",
      ]);
      // Date-only workbook cells serialize deterministically as calendar dates,
      // so the reference date is machine-independent.
      assert.equal(typeof rows[0].sale_date, "string");
      assert.match(String(rows[0].sale_date), /^\d{4}-\d{2}-\d{2}$/);

      // Exact source-column mapping pinned from the real alternative headers.
      const { detected, mapping, warnings } = resolveRetailSchema(columns, rows);
      const columnFor = (field: string) => mapping.find((entry) => entry.field === field)?.column ?? null;
      assert.equal(detected.dateCol, "sale_date");
      assert.equal(detected.orderCol, "receipt_no");
      assert.equal(detected.customerCol, "client_ref");
      assert.equal(detected.skuCol, "sku");
      assert.equal(detected.productIdCol, null, "no stable product ID column exists; SKU carries identity");
      assert.equal(detected.productCol, "item_description");
      assert.equal(detected.categoryCol, "department");
      assert.equal(detected.storeCol, "branch_code");
      assert.equal(detected.supplierCol, "vendor_name");
      assert.equal(detected.reorderPointCol, "min_stock_level");
      assert.equal(detected.stockCol, "inventory_qty");
      assert.equal(detected.salesCol, "qty");
      assert.equal(detected.unitPriceCol, "selling_price");
      assert.equal(detected.revenueCol, "net_sales");
      assert.equal(detected.costCol, "purchase_cost");
      // Negative mapping assertions: the historical failure modes stay impossible.
      assert.notEqual(detected.productCol, "vendor_name", "supplier/brand data must never become the product name");
      assert.notEqual(detected.salesCol, "net_sales", "monetary line totals must never become units sold");
      assert.notEqual(detected.revenueCol, "selling_price", "unit price must not replace the monetary revenue total");
      assert.notEqual(detected.stockCol, "min_stock_level", "reorder thresholds must never become stock on hand");
      assert.notEqual(detected.stockCol, "qty", "transaction quantity must never double as stock");
      assert.notEqual(detected.orderCol, "min_stock_level", "reorder fields must never become order identity");
      assert.notEqual(detected.storeCol, "region", "geography metadata must not replace branch identity");
      for (const entry of mapping) {
        if (entry.column) assert.equal(entry.confidence, "exact", `fixture 02 maps every field at exact confidence, got ${entry.confidence} for ${entry.field}`);
      }
      assert.ok(warnings.length === 0, `complete schema resolves without mapping warnings, got: ${warnings.join("; ")}`);

      // The real upload pipeline output matches the independently derived values.
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_02_retail_alternative",
        name: "02_retail_alternative_structure",
        fileName: "02_retail_alternative_structure.xlsx",
        rowCount: uploadParse.rowCount,
        columnCount: columns.length,
        createdAt: null,
        columns,
        rows,
      });

      assert.equal(snapshot.kpis.productCount, 12, "12 canonical products keyed by SKU even where display names repeat");
      assert.equal(snapshot.kpis.locationCount, 4, "4 branch identities");
      assert.equal(snapshot.kpis.inventoryItemCount, 43, "43 product/location entities");
      assert.equal(snapshot.kpis.orderCount, 164, "164 distinct receipt numbers");
      assert.equal(snapshot.kpis.customerCount, 54, "54 distinct client references");
      assert.equal(snapshot.kpis.unitsSold, 561);
      assert.equal(snapshot.kpis.netSales, 12237.8);
      assert.equal(snapshot.kpis.averageOrderValue, 74.62);
      assert.equal(snapshot.kpis.totalOnHand, 706);
      assert.equal(snapshot.kpis.inventoryValue, 6257);
      assert.equal(snapshot.kpis.lastSaleAt, "2026-07-31T00:00:00.000Z", "reference date is the dataset max sale date");

      // Low stock / reorder alerts: latest snapshot stock <= own reorder point.
      // The visible list caps at 20 items; the summary states the true 22.
      assert.equal(snapshot.lowStock.items.length, 20);
      assert.deepEqual(
        snapshot.lowStock.items.map((item) => `${item.sku}@${item.store}:${item.stock}<=${item.reorderPoint}`),
        [
          "SKU-E501@NL-RTM:3<=8",
          "SKU-E501@NL-AMS:4<=8", "SKU-A102@NL-EIN:4<=10",
          "SKU-E501@NL-EIN:5<=8", "SKU-B202@NL-EIN:5<=12", "SKU-B202@NL-RTM:5<=12", "SKU-B202@NL-UTR:5<=12",
          "SKU-E501@NL-UTR:6<=8", "SKU-X901@NL-AMS:6<=9", "SKU-X901@NL-RTM:6<=9", "SKU-A102@NL-AMS:6<=10",
          "SKU-D401@NL-AMS:7<=10", "SKU-B202@NL-AMS:7<=12", "SKU-X902@NL-AMS:7<=9", "SKU-X902@NL-RTM:7<=9",
          "SKU-D401@NL-RTM:9<=10", "SKU-A102@NL-RTM:9<=10",
          "SKU-D401@NL-EIN:10<=10", "SKU-C301@NL-RTM:10<=16",
          "SKU-C301@NL-UTR:11<=16",
        ],
      );

      // Dead stock (60+ days) and slow movers (30-59 days) at the dataset
      // reference date; the 60-day boundary case classifies as dead stock.
      assert.equal(snapshot.deadStock.items.filter((item) => item.classification === "dead_stock").length, 3);
      assert.equal(snapshot.deadStock.items.filter((item) => item.classification === "slow_mover").length, 8);
      assert.ok(
        snapshot.deadStock.items.some((item) => item.sku === "SKU-E502" && item.store === "NL-EIN" && item.classification === "dead_stock" && item.daysSinceLastSale === 60),
        "the exact 60-day boundary classifies as dead stock",
      );
      assert.ok(snapshot.deadStock.message.includes("3 dead-stock and 8 slow-mover items"));

      // Top profit at the canonical product/location grain.
      assert.equal(snapshot.topProfit.status, "ok");
      assert.equal(snapshot.topProfit.items.length, 20);
      assert.equal(snapshot.topProfit.items[0].product, "Yoga Mat");
      assert.equal(snapshot.topProfit.items[0].sku, "SKU-C301");
      assert.equal(snapshot.topProfit.items[0].store, "NL-EIN");
      assert.equal(snapshot.topProfit.items[0].unitsSold, 33);
      assert.equal(snapshot.topProfit.items[0].revenue, 986.7);
      assert.equal(snapshot.topProfit.items[0].cost, 495);
      assert.equal(snapshot.topProfit.items[0].profit?.toFixed(2), "491.70");
      assert.equal(snapshot.topProfit.items[0].margin?.toFixed(2), "49.83");

      // Top sellers rank by real units sold, not monetary totals.
      assert.equal(snapshot.topSellers.items[0].product, "Yoga Mat");
      assert.equal(snapshot.topSellers.items[0].sku, "SKU-C301");
      assert.equal(snapshot.topSellers.items[0].unitsSold, 74);
      assert.equal(snapshot.topSellers.items[0].revenue.toFixed(2), "2212.60");

      // Summary stays deterministic and names the alternative-structure findings.
      assert.equal(snapshot.summary.deterministic, true);
      assert.ok(snapshot.summary.explanation.includes("43 product/location inventory items for 12 products from 164 transaction rows"));
      assert.ok(snapshot.summary.explanation.includes("22 items are at or below their reorder point"));
      assert.ok(snapshot.summary.explanation.includes("Yoga Mat (NL-EIN)"));
      assert.ok(snapshot.summary.recommendation.includes("Restock 22 low-inventory product/location items"));
    },
  },
  {
    name: "Adversarial schema collisions: tiered semantic matching keeps canonical concepts independent",
    run() {
      // A. order_id + reorder_point map independently (token-aware matching
      //    never lets the "order" token inside "reorder" capture identity).
      {
        const { detected } = resolveRetailSchema(["order_id", "reorder_point"]);
        assert.equal(detected.orderCol, "order_id");
        assert.equal(detected.reorderPointCol, "reorder_point");
      }
      // B. qty = sold quantity, inventory_qty = stock; neither doubles up.
      {
        const { detected, mapping } = resolveRetailSchema(["qty", "inventory_qty"]);
        assert.equal(detected.salesCol, "qty");
        assert.equal(detected.stockCol, "inventory_qty");
        assert.notEqual(columnOf(mapping, "sales"), columnOf(mapping, "stock"));
      }
      // C. item_description beats supplier/vendor/brand for the product name.
      {
        const { detected } = resolveRetailSchema(["item_description", "supplier_name"]);
        assert.equal(detected.productCol, "item_description");
        assert.equal(detected.supplierCol, "supplier_name");
        assert.notEqual(detected.productCol, "supplier_name");
      }
      // D. price = unit price, sales_amount = revenue; price never replaces
      //    the monetary total when an explicit one exists.
      {
        const { detected } = resolveRetailSchema(["price", "sales_amount"]);
        assert.equal(detected.unitPriceCol, "price");
        assert.equal(detected.revenueCol, "sales_amount");
        assert.notEqual(detected.revenueCol, "price");
      }
      // E. unit cost and aggregate cost stay distinct; the unit-cost family
      //    wins the cost basis so the engine multiplies by units sold.
      {
        const { detected } = resolveRetailSchema(["cost_price", "total_cost"]);
        assert.equal(detected.costCol, "cost_price");
        assert.ok(isUnitCostColumn(detected.costCol), "cost_price keeps unit-cost semantics");
      }
      // F. branch_code = location identity; city stays geography metadata.
      {
        const { detected } = resolveRetailSchema(["branch_code", "city"]);
        assert.equal(detected.storeCol, "branch_code");
        assert.notEqual(detected.storeCol, "city");
      }
      // G. Decimal quantities are legitimate when mapped from an explicit
      //    qty-family column; they are never rejected globally.
      {
        const columns = ["product", "qty", "revenue", "date"];
        const rows = [
          { product: "A", qty: 1.5, revenue: 30, date: "2026-01-01" },
          { product: "A", qty: 2.5, revenue: 50, date: "2026-01-02" },
        ];
        const { detected } = resolveRetailSchema(columns, rows);
        assert.equal(detected.salesCol, "qty");
        const records = buildRetailRecords(rows, detected);
        assert.equal(records.reduce((sum, record) => sum + (record.unitsSold ?? 0), 0), 4);
      }
      // H. Unknown ambiguous numeric columns receive no critical semantics.
      {
        const columns = ["product", "revenue", "mystery_metric", "date"];
        const rows = [
          { product: "A", revenue: 30, mystery_metric: 42, date: "2026-01-01" },
          { product: "B", revenue: 50, mystery_metric: 17, date: "2026-01-02" },
        ];
        const { detected, mapping } = resolveRetailSchema(columns, rows);
        assert.equal(detected.stockCol, null);
        assert.equal(detected.salesCol, null);
        assert.equal(detected.costCol, null);
        assert.equal(detected.unitPriceCol, null);
        assert.ok(mapping.every((entry) => entry.column !== "mystery_metric"), "unknown numeric columns never drive critical fields");
      }
      // I. Heuristic failsafe: without any revenue-like column, the unit price
      //    column falls back to revenue with an explicit data-quality warning
      //    instead of silently misreporting.
      {
        const columns = ["product", "qty", "price", "date"];
        const rows = [
          { product: "A", qty: 2, price: 10, date: "2026-01-01" },
        ];
        const { detected, warnings } = resolveRetailSchema(columns, rows);
        assert.equal(detected.unitPriceCol, "price");
        assert.equal(detected.revenueCol, "price");
        assert.ok(warnings.some((warning) => warning.includes("Revenue could not be confidently identified")), "revenue fallback is flagged, not silent");
      }
      // J. Value-shape validation: a text column never maps into a numeric
      //    field even when its name matches.
      {
        const columns = ["product", "stock", "cost_code", "date"];
        const rows = [
          { product: "A", stock: "many", cost_code: "PREMIUM", date: "2026-01-01" },
        ];
        const { detected } = resolveRetailSchema(columns, rows);
        assert.equal(detected.stockCol, null, "non-numeric stock candidates are rejected");
        assert.equal(detected.costCol, null, "non-numeric cost candidates are rejected");
        assert.equal(detected.dateCol, "date");
      }
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
      assert.equal(snapshot.kpis.inventoryItemCount, 3);
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
    name: "Square variants sharing a display name stay separate through Square-native variant IDs",
    run() {
      const input = squareCatalogOnlyInput();
      // Two variants of the same product, no SKUs, same display name.
      input.variants = [
        { productId: "p2", productName: "Mug", productCategory: "Home", productStatus: "ACTIVE", variantId: "var-2a", sku: null, variantName: "Blue", unitCost: 2, retailPrice: 10, currency: "EUR" },
        { productId: "p2", productName: "Mug", productCategory: "Home", productStatus: "ACTIVE", variantId: "var-2b", sku: null, variantName: "Red", unitCost: 2, retailPrice: 10, currency: "EUR" },
      ];
      input.inventory = [
        { variantId: "var-2a", locationId: "loc-1", quantityOnHand: 5, quantityAvailable: 5, reorderPoint: null, providerUpdatedAt: null },
        { variantId: "var-2b", locationId: "loc-1", quantityOnHand: 9, quantityAvailable: 9, reorderPoint: null, providerUpdatedAt: null },
      ];
      input.orders = [{
        id: "COMPLETED:EUR:2026-09", status: "COMPLETED", currency: "EUR",
        totalAmount: 40, discountAmount: 0, refundAmount: 0,
        orderedAt: "2026-09-01T00:00:00.000Z", orderCount: 2,
      }];
      input.orderItems = [
        { variantId: "var-2a", sku: null, itemName: "Mug", units: 1, revenue: 10, orderCount: 1, lastSaleAt: "2026-09-01T00:00:00.000Z" },
        { variantId: "var-2b", sku: null, itemName: "Mug", units: 3, revenue: 30, orderCount: 1, lastSaleAt: "2026-09-01T00:00:00.000Z" },
      ];

      const snapshot = buildSquareRetailSnapshot(input);
      assert.equal(snapshot.kpis.inventoryItemCount, 2, "variants never merge via name");
      assert.deepEqual(
        snapshot.topProfit.items.map((item) => [item.stock, item.profit]),
        [[9, 24], [5, 8]],
        "each variant keeps its own stock and profit",
      );
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
    name: "Q: Square + upload built from disjoint data never contaminate each other",
    run() {
      const datasetSnapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_only_upload",
        name: "upload-only",
        fileName: null,
        rowCount: 2,
        columnCount: 5,
        createdAt: null,
        columns: ["product", "sku", "store", "stock", "reorder point", "units sold", "revenue", "unit_cost", "date"],
        rows: [
          { product: "Upload Widget", sku: "UW-1", store: "Webshop", stock: 3, "reorder point": 5, "units sold": 2, revenue: 20, unit_cost: 2, date: "2026-09-01" },
          { product: "Upload Gadget", sku: "UG-1", store: "Webshop", stock: 9, "reorder point": 5, "units sold": 1, revenue: 9, unit_cost: 1, date: "2026-09-01" },
        ],
      });
      const squareSnapshot = buildSquareRetailSnapshot(squareCatalogOnlyInput());

      const datasetNames = new Set(datasetSnapshot.topSellers.items.map((item) => item.product));
      assert.ok(datasetNames.has("Upload Widget"), "dataset snapshot lists dataset products");
      assert.ok(!datasetNames.has("Crew Neck"), "dataset snapshot never lists Square products");
      const squareNames = new Set(squareSnapshot.topSellers.items.map((item) => item.product));
      assert.ok(!squareNames.has("Upload Widget"), "Square snapshot never lists upload products");
      assert.equal(squareSnapshot.source.type, "square");
      assert.equal(datasetSnapshot.source.type, "dataset");
      assert.equal(squareSnapshot.kpis.unitsSold, null, "Square without synchronized sales stays null");
      assert.equal(datasetSnapshot.kpis.unitsSold, 3);
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

      const syncRoute = readProjectFile("src/app/api/integrations/retail/[connectionId]/sync/route.ts");
      assert.ok(syncRoute.includes("getOwnedRetailConnection"), "sync route re-validates connection ownership server-side");
    },
  },
  {
    name: "Dashboard renders snapshot data and source-aware empty states without regressing the upload flow",
    run() {
      const clientSource = readProjectFile("src/components/retail/retail-inventory-client.tsx");
      assert.ok(clientSource.includes("/api/retail/sources"), "dashboard loads owner-scoped sources");
      assert.ok(clientSource.includes("/api/retail/analytics"), "dashboard consumes the normalized analytics endpoint");
      assert.ok(clientSource.includes("deadStockSection?.message ?? \"No dead stock or slow movers detected\""), "Square insufficient-sales message renders from the snapshot");
      assert.ok(clientSource.includes("EMPTY_STATE_HINT"), "no-source state explains connecting a retail system or uploading");
      assert.ok(clientSource.includes("Sync now"), "Square source header offers sync");
      assert.ok(clientSource.includes("/app/retail/integrations"), "Square header links to connection management");
      assert.ok(
        clientSource.includes("buildDatasetRetailSnapshot({"),
        "upload flow produces findings through the one canonical dataset snapshot builder",
      );
      assert.ok(
        clientSource.includes("buildRetailFindingsPayload(datasetSnapshot)"),
        "AI enrichment receives deterministic retail findings",
      );
      assert.ok(
        clientSource.includes("Low Stock &amp; Reorder Alerts"),
        "low stock section is titled Low Stock & Reorder Alerts to match the reorder-point rule",
      );
      assert.ok(clientSource.includes("options.length === 1"), "dashboard auto-selects only when one source exists");
      assert.ok(
        !clientSource.includes("const square = available.connections[0]"),
        "dashboard no longer silently prefers Square over uploaded datasets",
      );
      assert.ok(
        clientSource.includes("AI enrichment is temporarily unavailable"),
        "upload flow warns when AI enrichment fails without hiding the deterministic result",
      );
      assert.ok(
        clientSource.includes("aiSummary = datasetSnapshot.summary.insight"),
        "generic AI upload insights cannot replace the deterministic Retail summary",
      );
      assert.ok(
        clientSource.includes("Reason: ${analyzeResult.error}"),
        "the AI enrichment warning surfaces the server-provided error reason instead of hiding it",
      );
      assert.ok(clientSource.includes("Deterministic summary from synchronized Square data"), "Square summary is labeled deterministic");
      assert.ok(
        !clientSource.includes("SquareRetailAnalyticsEngine"),
        "no duplicate Square analytics engine was introduced",
      );
    },
  },
  {
    name: "AI enrichment consumes deterministic findings and never recalculates retail numbers",
    run() {
      const analyzeRoute = readProjectFile("src/app/api/analyze/route.ts");
      assert.ok(analyzeRoute.includes("buildRetailFindingsPrompt"), "analyze route builds a deterministic findings block");
      assert.ok(
        analyzeRoute.includes("DETERMINISTIC RETAIL FINDINGS (AUTHORITATIVE)"),
        "findings block tells the AI the numbers are authoritative",
      );
      assert.ok(
        analyzeRoute.includes("Do NOT recalculate inventory"),
        "findings block forbids recalculating retail numbers",
      );

      const validation = readProjectFile("src/lib/validation.ts");
      assert.ok(validation.includes("retailFindings"), "analyze request schema accepts deterministic retail findings");

      // Cloud/BYOK routing fix stays intact.
      assert.ok(analyzeRoute.includes("generateWithUniversalAiAdapter"), "BYOK routing unchanged");
      assert.ok(analyzeRoute.includes("getManagedCloudLanguageModel"), "managed cloud routing unchanged");
      assert.ok(analyzeRoute.includes("BYOK_PROVIDER_REQUIRED"), "BYOK provider-required handling unchanged");
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
      const inventoryRecords = aggregateRetailInventoryRecords(records);
      const lowStock = computeLowStock(inventoryRecords);
      assert.equal(inventoryRecords.length, 4);
      assert.equal(lowStock.length, 3);

      const posRecords = buildRetailRecords(
        [{ product: "Crew Neck", stock: null, "units sold": null, revenue: null }],
        {
          productIdCol: null,
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
          customerCol: null,
        },
        { defaultReorderPoint: null, defaultMissingNumbersToZero: false },
      );
      assert.equal(posRecords[0].stock, null);
      assert.equal(posRecords[0].unitsSold, null);
      assert.equal(posRecords[0].reorderPoint, null);
      assert.equal(posRecords[0].stockValue, null);
    },
  },
  {
    name: "Repeated transaction rows aggregate to one product/location inventory item",
    run() {
      const detected = detectColumnsForTest();
      const records = buildRetailRecords([
        { product: "Protein Bar", sku: "PB-1", category: "Food", store: "North", stock: 3, "reorder point": 8, "units sold": 4, revenue: 40, unit_cost: 2, date: "2026-08-01" },
        { product: "Protein Bar", sku: "PB-1", category: "Food", store: "North", stock: 5, "reorder point": 8, "units sold": 6, revenue: 60, unit_cost: 2, date: "2026-08-03" },
        { product: "Protein Bar", sku: "PB-1", category: "Food", store: "North", stock: 2, "reorder point": 8, "units sold": 1, revenue: 10, unit_cost: 2, date: "2026-07-31" },
      ], detected);

      const inventoryRecords = aggregateRetailInventoryRecords(records);
      assert.equal(inventoryRecords.length, 1);
      assert.equal(inventoryRecords[0].stock, 5, "latest dated stock snapshot wins; stock is never summed");
      assert.equal(inventoryRecords[0].unitsSold, 11);
      assert.equal(inventoryRecords[0].revenue, 110);
      assert.equal(inventoryRecords[0].cost, 22);
      assert.equal(inventoryRecords[0].grossProfit, 88);
      assert.equal(inventoryRecords[0].margin, 80);

      const lowStock = computeLowStock(inventoryRecords);
      assert.equal(lowStock.length, 1);
      assert.equal(lowStock[0].product, "Protein Bar");
    },
  },
  {
    name: "Same product in two stores remains location-specific",
    run() {
      const detected = detectColumnsForTest();
      const records = buildRetailRecords([
        { product: "Protein Bar", sku: "PB-1", category: "Food", store: "North", stock: 5, "reorder point": 8, "units sold": 10, revenue: 100, unit_cost: 2, date: "2026-08-03" },
        { product: "Protein Bar", sku: "PB-1", category: "Food", store: "South", stock: 20, "reorder point": 8, "units sold": 3, revenue: 30, unit_cost: 2, date: "2026-08-03" },
      ], detected);

      const inventoryRecords = aggregateRetailInventoryRecords(records);
      assert.equal(inventoryRecords.length, 2);
      assert.deepEqual(
        inventoryRecords.map((record) => [record.product, record.store, record.stock]).sort(),
        [
          ["Protein Bar", "North", 5],
          ["Protein Bar", "South", 20],
        ],
      );
      assert.deepEqual(computeLowStock(inventoryRecords).map((item) => [item.product, item.stock]), [["Protein Bar", 5]]);
    },
  },
  {
    name: "A: same product name, different product IDs, same store stay separate entities",
    run() {
      const columns = ["product_id", "product_name", "store", "stock", "reorder point", "units sold", "revenue", "unit_cost", "date"];
      const rows = [
        { product_id: "P-1", product_name: "Yoga Mat", store: "Main", stock: 16, "reorder point": 19, "units sold": 5, revenue: 500, unit_cost: 10, date: "2026-08-01" },
        { product_id: "P-2", product_name: "Yoga Mat", store: "Main", stock: 30, "reorder point": 5, "units sold": 5, revenue: 500, unit_cost: 10, date: "2026-08-01" },
      ];
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_same_name", name: "same-name", fileName: null, rowCount: rows.length,
        columnCount: columns.length, createdAt: null, columns, rows,
      });
      assert.equal(snapshot.kpis.inventoryItemCount, 2, "distinct product IDs never merge by display name");
      assert.equal(snapshot.kpis.productCount, 2);
      assert.ok(
        snapshot.topProfit.items.every((item) => item.stock === 16 || item.stock === 30),
        "top profit rows keep per-entity stock",
      );
    },
  },
  {
    name: "B: same product ID, same store, many rows collapse to one entity",
    run() {
      const detected = detectColumnsWithIds();
      const records = buildRetailRecords([
        { product_id: "P-1", product: "Widget", store: "Main", stock: 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
        { product_id: "P-1", product: "Widget", store: "Main", stock: 4, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-02" },
        { product_id: "P-1", product: "Widget", store: "Main", stock: 3, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-03" },
      ], detected);
      const entities = aggregateRetailInventoryRecords(records);
      assert.equal(entities.length, 1);
      assert.equal(entities[0].transactionRows, 3);
      assert.equal(entities[0].stock, 3, "latest snapshot wins");
      assert.equal(entities[0].unitsSold, 3);
    },
  },
  {
    name: "C: same product ID in different stores stays separate inventory entities",
    run() {
      const detected = detectColumnsWithIds();
      const records = buildRetailRecords([
        { product_id: "P-1", product: "Widget", store: "Main", stock: 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
        { product_id: "P-1", product: "Widget", store: "East", stock: 9, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
      ], detected);
      const entities = aggregateRetailInventoryRecords(records);
      assert.equal(entities.length, 2);
      assert.deepEqual(entities.map((entity) => entity.store).sort(), ["East", "Main"]);
    },
  },
  {
    name: "D: different product IDs sharing one SKU stay separate (ID precedence over SKU)",
    run() {
      const columns = ["product_id", "sku", "product_name", "store", "stock", "units sold", "revenue", "unit_cost", "date"];
      const rows = [
        { product_id: "P-1", sku: "SHARED-SKU", product_name: "Widget A", store: "Main", stock: 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
        { product_id: "P-2", sku: "SHARED-SKU", product_name: "Widget B", store: "Main", stock: 7, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
      ];
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_shared_sku", name: "shared-sku", fileName: null, rowCount: rows.length,
        columnCount: columns.length, createdAt: null, columns, rows,
      });
      assert.equal(snapshot.kpis.inventoryItemCount, 2, "product ID takes precedence over a shared SKU");
      assert.equal(snapshot.kpis.productCount, 2);
    },
  },
  {
    name: "E: no product ID but SKU present uses SKU identity in both directions",
    run() {
      const columns = ["sku", "product_name", "store", "stock", "units sold", "revenue", "unit_cost", "date"];
      // Same SKU, different display names -> one entity.
      const sameSku = buildDatasetRetailSnapshot({
        datasetId: "ds_sku_same", name: "sku-same", fileName: null, rowCount: 2, columnCount: columns.length, createdAt: null, columns,
        rows: [
          { sku: "S-1", product_name: "Red Mug", store: "Main", stock: 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
          { sku: "S-1", product_name: "Mug (red)", store: "Main", stock: 4, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-02" },
        ],
      });
      assert.equal(sameSku.kpis.inventoryItemCount, 1, "same SKU merges when no product ID exists");
      // Different SKUs, same display name -> two entities.
      const differentSku = buildDatasetRetailSnapshot({
        datasetId: "ds_sku_diff", name: "sku-diff", fileName: null, rowCount: 2, columnCount: columns.length, createdAt: null, columns,
        rows: [
          { sku: "S-1", product_name: "Red Mug", store: "Main", stock: 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
          { sku: "S-2", product_name: "Red Mug", store: "Main", stock: 6, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
        ],
      });
      assert.equal(differentSku.kpis.inventoryItemCount, 2, "different SKUs never merge by name");
    },
  },
  {
    name: "F: no ID and no SKU falls back to the normalized display name",
    run() {
      const columns = ["product_name", "store", "stock", "units sold", "revenue", "unit_cost", "date"];
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_name_fallback", name: "name-fallback", fileName: null, rowCount: 3, columnCount: columns.length, createdAt: null, columns,
        rows: [
          { product_name: "Yoga  Mat", store: "Main", stock: 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
          { product_name: "yoga mat", store: "Main", stock: 4, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-02" },
          { product_name: "Yoga Mat Pro", store: "Main", stock: 9, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
        ],
      });
      assert.equal(snapshot.kpis.inventoryItemCount, 2, "case/whitespace normalize, different names do not");
      assert.equal(snapshot.kpis.productCount, 2);
    },
  },
  {
    name: "G + H: repeated stock snapshots are never summed and the latest valid snapshot wins; equal dates keep the first row",
    run() {
      const detected = detectColumnsForTest();
      const records = buildRetailRecords([
        { product: "Chair", sku: "C-1", store: "Main", stock: 10, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
        { product: "Chair", sku: "C-1", store: "Main", stock: 20, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-05" },
        { product: "Chair", sku: "C-1", store: "Main", stock: 30, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-03" },
      ], detected);
      const entities = aggregateRetailInventoryRecords(records);
      assert.equal(entities[0].stock, 20, "newest date wins, stock is not summed to 60");

      const equalDates = buildRetailRecords([
        { product: "Desk", sku: "D-1", store: "Main", stock: 10, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-05" },
        { product: "Desk", sku: "D-1", store: "Main", stock: 20, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-05" },
      ], detected);
      const equalEntities = aggregateRetailInventoryRecords(equalDates);
      assert.equal(equalEntities[0].stock, 10, "equal timestamps keep the first row deterministically");

      const undated = buildRetailRecords([
        { product: "Lamp", sku: "L-1", store: "Main", stock: 7, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1 },
        { product: "Lamp", sku: "L-1", store: "Main", stock: 12, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1 },
      ], detected);
      const undatedEntities = aggregateRetailInventoryRecords(undated);
      assert.equal(undatedEntities[0].stock, 7, "undated rows fall back to first-occurrence order");
    },
  },
  {
    name: "I + J: revenue/cost/profit are additive and margin is recomputed, never averaged",
    run() {
      const detected = detectColumnsForTest();
      const records = buildRetailRecords([
        // Margin 50%: revenue 100, cost 50.
        { product: "Bottle", sku: "B-1", store: "Main", stock: 5, "units sold": 10, revenue: 100, unit_cost: 5, date: "2026-08-01" },
        // Margin 0%: revenue 100, cost 100.
        { product: "Bottle", sku: "B-1", store: "Main", stock: 5, "units sold": 10, revenue: 100, unit_cost: 10, date: "2026-08-02" },
      ], detected);
      const entities = aggregateRetailInventoryRecords(records);
      assert.equal(entities[0].revenue, 200);
      assert.equal(entities[0].cost, 150);
      assert.equal(entities[0].grossProfit, 50);
      assert.equal(entities[0].margin, 25, "margin derives from aggregated profit/revenue, not the 50%/0% row average");
    },
  },
  {
    name: "K: repeated order IDs count as one distinct order per entity",
    run() {
      const columns = ["product", "sku", "store", "stock", "reorder point", "units sold", "revenue", "unit_cost", "date", "order_id"];
      const detected = detectColumns(columns);
      assert.equal(detected.orderCol, "order_id");
      const records = buildRetailRecords([
        { product: "Sock", sku: "SO-1", store: "Main", stock: 5, "reorder point": 5, "units sold": 2, revenue: 10, unit_cost: 1, date: "2026-08-01", order_id: "O-1" },
        { product: "Sock", sku: "SO-1", store: "Main", stock: 5, "reorder point": 5, "units sold": 3, revenue: 15, unit_cost: 1, date: "2026-08-01", order_id: "O-1" },
        { product: "Sock", sku: "SO-1", store: "Main", stock: 5, "reorder point": 5, "units sold": 1, revenue: 5, unit_cost: 1, date: "2026-08-02", order_id: "O-2" },
      ], detected);
      const entities = aggregateRetailInventoryRecords(records);
      assert.equal(entities[0].orderCount, 2, "O-1 twice plus O-2 counts as two distinct orders");
      assert.equal(entities[0].orderId, "2 orders");

      const topSellers = computeTopSellers(records);
      assert.equal(topSellers[0].orderCount, 2, "top seller order counts are distinct order IDs, not row counts");
    },
  },
  {
    name: "L: repeated customer IDs count once in the dataset KPIs",
    run() {
      const columns = ["product", "store", "stock", "units sold", "revenue", "unit_cost", "date", "customer_id"];
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_customers", name: "customers", fileName: null, rowCount: 3, columnCount: columns.length, createdAt: null, columns,
        rows: [
          { product: "A", store: "Main", stock: 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01", customer_id: "C-1" },
          { product: "A", store: "Main", stock: 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01", customer_id: "C-1" },
          { product: "A", store: "Main", stock: 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-02", customer_id: "C-2" },
        ],
      });
      assert.equal(snapshot.kpis.customerCount, 2);
    },
  },
  {
    name: "M + N + O: reorder boundary behavior and the documented default threshold",
    run() {
      const columns = ["product", "store", "stock", "reorder point", "units sold", "revenue", "unit_cost", "date"];
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_boundary", name: "boundary", fileName: null, rowCount: 4, columnCount: columns.length, createdAt: null, columns,
        rows: [
          { product: "Mat-20-20", store: "Main", stock: 20, "reorder point": 20, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
          { product: "Mat-16-19", store: "Main", stock: 16, "reorder point": 19, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
          { product: "Mat-21-20", store: "Main", stock: 21, "reorder point": 20, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
        ],
      });
      const alerted = snapshot.lowStock.items.map((item) => item.product).sort();
      assert.deepEqual(alerted, ["Mat-16-19", "Mat-20-20"], "stock <= reorder point alerts; stock 21 does not");
      assert.equal(snapshot.kpis.inventoryItemCount, 3);
      assert.ok(
        snapshot.summary.explanation.includes("2 items are at or below their reorder point"),
        "summary matches the section count even when stock is above 10",
      );

      // No reorder column: the default threshold applies and the wording says so.
      const defaultColumns = ["product", "store", "stock", "units sold", "revenue", "unit_cost", "date"];
      const defaultSnapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_default_threshold", name: "default-threshold", fileName: null, rowCount: 2, columnCount: defaultColumns.length, createdAt: null, columns: defaultColumns,
        rows: [
          { product: "Low", store: "Main", stock: 8, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
          { product: "High", store: "Main", stock: 12, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
        ],
      });
      assert.equal(defaultSnapshot.lowStock.hasReorderThresholds, false);
      assert.deepEqual(defaultSnapshot.lowStock.items.map((item) => [item.product, item.reorderPoint]), [["Low", 10]]);
      assert.ok(defaultSnapshot.lowStock.message.includes("default threshold of 10 units"));
      assert.ok(defaultSnapshot.summary.explanation.includes("default 10-unit threshold"));
    },
  },
  {
    name: "P: missing stock or movement evidence reports insufficient data instead of false certainty",
    run() {
      // Stock column but no sales and no date column: movement cannot be judged.
      const stockOnly = buildDatasetRetailSnapshot({
        datasetId: "ds_stock_only", name: "stock-only", fileName: null, rowCount: 1, columnCount: 2, createdAt: null,
        columns: ["product", "store", "stock"],
        rows: [{ product: "Mystery", store: "Main", stock: 12 }],
      });
      assert.equal(stockOnly.deadStock.status, "insufficient_data");
      assert.equal(stockOnly.deadStock.items.length, 0);
      assert.ok(stockOnly.deadStock.message.includes("No sales or date columns"));

      // No stock column at all: no inventory claims whatsoever.
      const noStock = buildDatasetRetailSnapshot({
        datasetId: "ds_no_stock", name: "no-stock", fileName: null, rowCount: 1, columnCount: 3, createdAt: null,
        columns: ["product", "store", "revenue"],
        rows: [{ product: "Mystery", store: "Main", revenue: 100 }],
      });
      assert.equal(noStock.lowStock.status, "no_inventory");
      assert.equal(noStock.lowStock.items.length, 0);
      assert.equal(noStock.kpis.totalOnHand, null);
      assert.equal(noStock.kpis.inventoryValue, null);
      assert.equal(noStock.deadStock.status, "insufficient_data");
      assert.ok(noStock.deadStock.message.includes("No stock column"));

      // Sales and dates exist: zero recorded units is real dead-stock evidence.
      const neverSold = buildDatasetRetailSnapshot({
        datasetId: "ds_never_sold", name: "never-sold", fileName: null, rowCount: 1, columnCount: 6, createdAt: null,
        columns: ["product", "store", "stock", "units sold", "revenue", "unit_cost", "date"],
        rows: [{ product: "Dust Collector", store: "Main", stock: 9, "units sold": 0, revenue: 0, unit_cost: 5, date: "2026-08-01" }],
      });
      assert.equal(neverSold.deadStock.status, "ok");
      assert.equal(neverSold.deadStock.items.length, 1);
      assert.equal(neverSold.deadStock.items[0].classification, "dead_stock");
      assert.ok(neverSold.deadStock.items[0].suggestedAction.includes("Discount"));
    },
  },
  {
    name: "Slow movers: stock with no sale inside the slow-mover window is classified separately",
    run() {
      const columns = ["product", "store", "stock", "units sold", "revenue", "unit_cost", "date"];
      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_slow", name: "slow", fileName: null, rowCount: 3, columnCount: columns.length, createdAt: null, columns,
        rows: [
          // Reference date is 2026-09-10 (max across rows). A last sale 40
          // days back lands inside the slow-mover window (30-59 days).
          { product: "Stale", store: "Main", stock: 5, "units sold": 4, revenue: 40, unit_cost: 2, date: "2026-08-01" },
          { product: "Recent", store: "Main", stock: 5, "units sold": 4, revenue: 40, unit_cost: 2, date: "2026-09-10" },
          { product: "NeverMoved", store: "Main", stock: 5, "units sold": 0, revenue: 0, unit_cost: 2, date: "2026-09-10" },
        ],
      });
      const byProduct = new Map(snapshot.deadStock.items.map((item) => [item.product, item]));
      assert.equal(byProduct.get("Stale")?.classification, "slow_mover");
      assert.ok((byProduct.get("Stale")?.daysSinceLastSale ?? 0) >= RETAIL_SLOW_MOVER_AFTER_DAYS);
      assert.ok((byProduct.get("Stale")?.daysSinceLastSale ?? 0) < RETAIL_DEAD_STOCK_AFTER_DAYS);
      assert.equal(byProduct.get("NeverMoved")?.classification, "dead_stock");
      assert.equal(byProduct.get("Recent"), undefined, "fresh movement is neither dead nor slow");
      assert.ok(snapshot.deadStock.message.includes("1 dead-stock and 1 slow-mover item"));
    },
  },
  {
    name: "Category conflicts on one canonical entity resolve deterministically and raise a data-quality warning",
    run() {
      const detected = detectColumnsForTest();
      const records = buildRetailRecords([
        { product: "Mug", sku: "M-1", category: "Home", store: "Main", stock: 5, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
        { product: "Mug", sku: "M-1", category: "Kitchen", store: "Main", stock: 5, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-02" },
      ], detected);
      const entities = aggregateRetailInventoryRecords(records);
      assert.equal(entities.length, 1);
      assert.equal(entities[0].category, "Kitchen", "latest snapshot's category wins deterministically");
      assert.equal(entities[0].categoryAmbiguous, true);

      const snapshot = buildDatasetRetailSnapshot({
        datasetId: "ds_category_conflict", name: "category-conflict", fileName: null, rowCount: 2, columnCount: 7, createdAt: null,
        columns: ["product", "sku", "category", "store", "stock", "reorder point", "units sold", "revenue", "unit_cost", "date"],
        rows: [
          { product: "Mug", sku: "M-1", category: "Home", store: "Main", stock: 5, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-01" },
          { product: "Mug", sku: "M-1", category: "Kitchen", store: "Main", stock: 5, "reorder point": 5, "units sold": 1, revenue: 10, unit_cost: 1, date: "2026-08-02" },
        ],
      });
      assert.ok(
        snapshot.dataQualityWarnings.some((warning) => warning.includes("conflicting category")),
        "ambiguity is flagged, never silently randomized",
      );
    },
  },
  {
    name: "R: sync and disconnect routes reject unowned connections server-side",
    run() {
      const syncRoute = readProjectFile("src/app/api/integrations/retail/[connectionId]/sync/route.ts");
      assert.ok(syncRoute.includes("404"), "unowned connection ids return not found");
      const disconnectRoute = readProjectFile("src/app/api/integrations/retail/[connectionId]/disconnect/route.ts");
      assert.ok(disconnectRoute.includes("404"), "unowned disconnect targets return not found");
      const sourcesRoute = readProjectFile("src/app/api/retail/sources/route.ts");
      assert.ok(sourcesRoute.includes("401"), "sources require an authenticated session");
    },
  },
];

function detectColumnsForTest() {
  return {
    productIdCol: null,
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
    customerCol: null,
    unitPriceCol: null,
    supplierCol: null,
  };
}

function columnOf(mapping: { field: string; column: string | null }[], field: string): string | null {
  return mapping.find((entry) => entry.field === field)?.column ?? null;
}

function detectColumnsWithIds() {
  return {
    ...detectColumnsForTest(),
    productIdCol: "product_id",
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

function assertSnapshotParity(
  actual: ReturnType<typeof buildDatasetRetailSnapshot>,
  expected: ReturnType<typeof buildDatasetRetailSnapshot>,
) {
  assert.deepEqual(actual.kpis, expected.kpis);
  assert.deepEqual(actual.lowStock, expected.lowStock);
  assert.deepEqual(actual.deadStock, expected.deadStock);
  assert.deepEqual(actual.topProfit, expected.topProfit);
  assert.deepEqual(actual.topSellers, expected.topSellers);
  assert.deepEqual(actual.summary, expected.summary);
  assert.deepEqual(actual.dataQualityWarnings, expected.dataQualityWarnings);
}

/** Parse the REAL workbook exactly like the browser upload path does. */
function parseXlsxFixture(path: string): Record<string, unknown>[] {
  const buffer = readFileSync(resolve(repoRoot, path));
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
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
