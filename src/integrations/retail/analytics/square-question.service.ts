import { getOwnedRetailConnection } from "@/integrations/retail/core/connection.service";
import { loadSquareRetailAnalytics } from "@/integrations/retail/analytics/square-analytics.service";
import { resolveRetailInventoryIntent, type RetailInventoryIntent } from "@/lib/data/retail-inventory-intents";
import type { RetailAnalyticsSnapshot } from "@/lib/retail/retail-snapshot";

/**
 * Deterministic retail answers for a connected Square source.
 *
 * The assistant never routes Square questions through an uploaded dataset.
 * Answers are computed from the synchronized snapshot facts only, so
 * catalog presence is never presented as sales performance.
 */
export async function answerSquareRetailQuestion(input: {
  userId: string;
  connectionId: string;
  question: string;
}): Promise<SquareRetailAnswer | null> {
  const intent = resolveRetailInventoryIntent(input.question);
  const catalogIntent = resolveSquareCatalogIntent(input.question);
  if (!intent && !catalogIntent) return null;

  const connection = await getOwnedRetailConnection({ userId: input.userId, connectionId: input.connectionId });
  if (!connection) {
    return {
      status: "source_unavailable",
      answer: "Answer: The selected Square connection is not available for this account.",
      result: { intent: "retail_square.source_unavailable", status: "source_unavailable" },
    };
  }

  const snapshot = await loadSquareRetailAnalytics(connection);
  if (intent) return describeIntent(intent, snapshot);
  if (catalogIntent) return describeCatalog(catalogIntent, snapshot);
  return null;
}

export type SquareRetailAnswer = {
  status: "success" | "source_unavailable";
  answer: string;
  result: Record<string, unknown>;
};

type SquareCatalogIntent = "product_count" | "inventory_overview" | "revenue" | "square_status";

function resolveSquareCatalogIntent(question: string): SquareCatalogIntent | null {
  const text = question.toLowerCase();
  if (/revenue|sales.*total|total.*sales|how much.*sold|money.*made/.test(text)) return "revenue";
  if (/how many products|product count|number of products|how many items|variant/.test(text)) return "product_count";
  if (/inventory|stock|on hand/.test(text)) return "inventory_overview";
  if (/square.*(status|sync|connected)|connection/.test(text)) return "square_status";
  return null;
}

function describeIntent(intent: RetailInventoryIntent, snapshot: RetailAnalyticsSnapshot): SquareRetailAnswer {
  const source = snapshot.source;
  const context = source.type === "square"
    ? ` Source: Square (${source.counts.products} products, ${source.counts.variants} variants, ${source.counts.orders} synchronized orders).`
    : "";

  switch (intent) {
    case "top_selling_products": {
      if (!snapshot.sales.hasSalesData) {
        return salesUnavailable("top-selling products", snapshot);
      }
      const top = snapshot.topSellers.items[0];
      return {
        status: "success",
        answer: top
          ? `Answer: ${top.product} is the top selling product by units sold (${formatCount(top.unitsSold)} units, ${formatMoney(top.revenue, snapshot.currency)} net revenue).`
          : "Answer: No synchronized sales movement was found for any product.",
        result: { intent: `retail_inventory.${intent}`, status: "success", items: snapshot.topSellers.items.slice(0, 10) },
      };
    }
    case "low_stock_items":
    case "reorder_recommendations": {
      if (snapshot.lowStock.status === "no_inventory") {
        return {
          status: "success",
          answer: `Answer: Square inventory has not been synchronized yet, so stock levels are unknown.${context}`,
          result: { intent: `retail_inventory.${intent}`, status: "insufficient_data" },
        };
      }
      if (snapshot.lowStock.status === "no_reorder_thresholds") {
        return {
          status: "success",
          answer: `Answer: Low-stock alerts are unavailable because Square does not provide reorder thresholds. Known stock levels are synchronized for ${snapshot.lowStock.items.length} variant${snapshot.lowStock.items.length === 1 ? "" : "s"}${context}`,
          result: { intent: `retail_inventory.${intent}`, status: "no_reorder_thresholds", items: snapshot.lowStock.items.slice(0, 10) },
        };
      }
      const top = snapshot.lowStock.items[0];
      return {
        status: "success",
        answer: top
          ? `Answer: ${top.product} needs attention because stock on hand (${top.stock}) is at or below reorder point (${top.reorderPoint}).`
          : "Answer: No products are at or below their reorder point.",
        result: { intent: `retail_inventory.${intent}`, status: "success", items: snapshot.lowStock.items.slice(0, 10) },
      };
    }
    case "dead_stock_products":
    case "slow_moving_inventory": {
      if (!snapshot.sales.hasSalesData) {
        return {
          status: "success",
          answer: `Answer: There is not enough synchronized sales history to identify slow-moving products. UseClevr does not classify products as dead stock without sales history.${context}`,
          result: { intent: `retail_inventory.${intent}`, status: "insufficient_data" },
        };
      }
      const top = snapshot.deadStock.items[0];
      return {
        status: "success",
        answer: top
          ? `Answer: ${top.product} is a dead-stock candidate with ${top.stock} units on hand and no synchronized sales movement.`
          : "Answer: No dead-stock products were detected in synchronized sales history.",
        result: { intent: `retail_inventory.${intent}`, status: "success", items: snapshot.deadStock.items.slice(0, 10) },
      };
    }
    case "highest_margin_products":
    case "category_gross_profit": {
      if (!snapshot.sales.hasSalesData) return salesUnavailable("margin analysis", snapshot);
      if (snapshot.topProfit.status === "no_cost_data") {
        return {
          status: "success",
          answer: `Answer: Margin is unavailable because Square does not provide a synchronized cost basis. UseClevr does not estimate profit without cost data.${context}`,
          result: { intent: `retail_inventory.${intent}`, status: "no_cost_data" },
        };
      }
      const top = snapshot.topProfit.items[0];
      return {
        status: "success",
        answer: top
          ? `Answer: ${top.product} has the highest synchronized margin at ${(top.margin ?? 0).toFixed(1)}%.`
          : "Answer: No margin could be calculated from synchronized sales.",
        result: { intent: `retail_inventory.${intent}`, status: "success", items: snapshot.topProfit.items.slice(0, 10) },
      };
    }
    case "revenue_trends": {
      if (!snapshot.sales.hasSalesData) return salesUnavailable("revenue trends", snapshot);
      const latest = snapshot.sales.trend.at(-1);
      const previous = snapshot.sales.trend.at(-2);
      const change = latest && previous && previous.revenue !== 0
        ? (((latest.revenue - previous.revenue) / Math.abs(previous.revenue)) * 100).toFixed(1)
        : null;
      return {
        status: "success",
        answer: latest
          ? `Answer: Latest synchronized revenue is ${formatMoney(latest.revenue, snapshot.currency)} in ${latest.period}${change ? ` (${change}% vs previous period)` : ""}.`
          : "Answer: No synchronized revenue periods were found.",
        result: { intent: `retail_inventory.${intent}`, status: "success", trend: snapshot.sales.trend },
      };
    }
    case "inventory_valuation":
    case "inventory_cash_flow_risk": {
      if (snapshot.kpis.inventoryValue === null) {
        return {
          status: "success",
          answer: `Answer: Inventory valuation is unavailable because Square does not synchronize a unit cost basis. Known stock on hand is ${snapshot.kpis.totalOnHand === null ? "not synchronized" : formatCount(snapshot.kpis.totalOnHand)} units.${context}`,
          result: { intent: `retail_inventory.${intent}`, status: "no_cost_data" },
        };
      }
      return {
        status: "success",
        answer: `Answer: Current synchronized inventory valuation is ${formatMoney(snapshot.kpis.inventoryValue, snapshot.currency)} across ${formatCount(snapshot.kpis.totalOnHand ?? 0)} units on hand.`,
        result: { intent: `retail_inventory.${intent}`, status: "success" },
      };
    }
    default:
      return salesUnavailable("that retail analysis", snapshot);
  }
}

function describeCatalog(intent: SquareCatalogIntent, snapshot: RetailAnalyticsSnapshot): SquareRetailAnswer {
  const source = snapshot.source;
  if (source.type !== "square") {
    return { status: "success", answer: "Answer: The selected retail source is not available.", result: { intent: `retail_square.${intent}`, status: "source_unavailable" } };
  }
  const counts = source.counts;
  switch (intent) {
    case "product_count":
      return {
        status: "success",
        answer: `Answer: Your synchronized Square catalog has ${counts.products} product${counts.products === 1 ? "" : "s"} with ${counts.variants} variant${counts.variants === 1 ? "" : "s"}.`,
        result: { intent: "retail_square.product_count", status: "success", counts },
      };
    case "inventory_overview":
      return {
        status: "success",
        answer: snapshot.kpis.totalOnHand === null
          ? "Answer: Square inventory has not been synchronized yet, so stock levels are unknown."
          : `Answer: Your synchronized Square stock on hand is ${formatCount(snapshot.kpis.totalOnHand)} units across ${counts.variants} variant${counts.variants === 1 ? "" : "s"}.`,
        result: { intent: "retail_square.inventory_overview", status: "success", totalOnHand: snapshot.kpis.totalOnHand },
      };
    case "revenue":
      return snapshot.sales.hasSalesData
        ? {
          status: "success",
          answer: `Answer: Synchronized Square net sales are ${formatMoney(snapshot.kpis.netSales ?? 0, snapshot.currency)} across ${formatCount(snapshot.kpis.orderCount ?? 0)} orders.`,
          result: { intent: "retail_square.revenue", status: "success", netSales: snapshot.kpis.netSales },
        }
        : salesUnavailable("revenue", snapshot);
    case "square_status":
      return {
        status: "success",
        answer: `Answer: Square is ${source.connectionStatus.replaceAll("_", " ") || "connected"}. Last successful sync: ${source.lastSuccessfulSyncAt ? new Date(source.lastSuccessfulSyncAt).toLocaleString() : "not yet completed"}. ${counts.products} products, ${counts.variants} variants, ${counts.orders} orders synchronized.`,
        result: { intent: "retail_square.square_status", status: "success", counts },
      };
  }
}

function salesUnavailable(topic: string, snapshot: RetailAnalyticsSnapshot): SquareRetailAnswer {
  const source = snapshot.source;
  const context = source.type === "square"
    ? ` Source: Square (${source.counts.products} products synchronized, 0 orders).`
    : "";
  return {
    status: "success",
    answer: `Answer: There is not enough synchronized sales history to answer questions about ${topic}. Connect sales activity or run Sync now after orders exist, and UseClevr will not substitute another data source for this answer.${context}`,
    result: { intent: "retail_square.insufficient_sales", status: "insufficient_data" },
  };
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatMoney(value: number, currency: string | null): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
