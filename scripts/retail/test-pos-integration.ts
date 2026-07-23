import assert from "node:assert/strict";

import {
  calculateReorderQuantity,
  calculateRetailSalesKpis,
  calculateStockoutRisk,
} from "@/integrations/retail/analytics/retail-kpis";
import { encryptRetailSecret, decryptRetailSecret } from "@/integrations/retail/core/encryption.service";
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

const tests: TestCase[] = [
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

async function main() {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
  console.log(`Retail POS integration verification passed (${tests.length} checks).`);
}

void main();
