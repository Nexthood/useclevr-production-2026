import {
  buildSemanticSchema,
  parseBusinessNumber,
  semanticColumn,
  type SemanticSchema,
} from "@/lib/data/semantic-schema";

export type RetailInventoryDeterministicResult = {
  status: "success";
  answer: string;
  insight: string;
  explanation: string;
  recommendation?: string;
  data: Array<Record<string, string | number | null>>;
  chartType: "kpi" | "table";
  result: Record<string, unknown>;
};

type RetailInventoryInput = {
  question: string;
  datasetId: string;
  datasetType: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type RetailInventoryIntent =
  | "top_selling_products"
  | "low_stock_items"
  | "dead_stock_products"
  | "inventory_valuation"
  | "reorder_recommendations"
  | "highest_margin_products"
  | "supplier_revenue_or_risk"
  | "revenue_trends"
  | "slow_moving_inventory"
  | "inventory_cash_flow_risk"
  | "category_gross_profit"
  | "merchandise_actions"
  | "stock_coverage"
  | "inventory_turnover";

type RetailColumns = {
  product: string | null;
  stock: string | null;
  unitsSold: string | null;
  reorderPoint: string | null;
  revenue: string | null;
  unitCost: string | null;
  grossProfit: string | null;
  grossMargin: string | null;
  supplier: string | null;
  category: string | null;
  date: string | null;
  store: string | null;
};

type RetailProduct = {
  product: string;
  sku: string | null;
  store: string | null;
  category: string | null;
  supplier: string | null;
  revenue: number;
  unitsSold: number;
  grossProfit: number | null;
  marginPct: number | null;
  stock: number | null;
  reorderPoint: number | null;
  unitCost: number | null;
  inventoryValue: number | null;
  latestDateTime: number | null;
  latestRowIndex: number;
};

type RequiredConcept =
  | "product"
  | "stock"
  | "unitsSold"
  | "reorderPoint"
  | "revenue"
  | "unitCost"
  | "margin"
  | "supplier"
  | "category"
  | "date";

export function answerRetailInventoryQuestionDeterministically(
  input: RetailInventoryInput,
): RetailInventoryDeterministicResult | null {
  const intent = resolveRetailInventoryIntent(input.question);
  if (!intent) return null;

  const schema = buildSemanticSchema(input);
  const columns = retailColumns(schema);
  const missing = missingConcepts(intent, columns);
  if (missing.length > 0) return missingEvidence(input, intent, missing, columns);

  const products = aggregateProducts(input.rows, columns);
  switch (intent) {
    case "top_selling_products":
      return describeTopSellingProducts(input, columns, products);
    case "low_stock_items":
      return describeLowStockItems(input, columns, products, "low_stock_items");
    case "dead_stock_products":
      return describeDeadStockProducts(input, columns, products);
    case "inventory_valuation":
      return describeInventoryValuation(input, columns, products);
    case "reorder_recommendations":
      return describeLowStockItems(input, columns, products, "reorder_recommendations");
    case "highest_margin_products":
      return describeHighestMarginProducts(input, columns, products);
    case "supplier_revenue_or_risk":
      return describeSupplierRevenueOrRisk(input, columns, products);
    case "revenue_trends":
      return describeRevenueTrends(input, columns);
    case "slow_moving_inventory":
      return describeSlowMovingInventory(input, columns, products);
    case "inventory_cash_flow_risk":
      return describeInventoryCashFlowRisk(input, columns, products);
    case "category_gross_profit":
      return describeCategoryGrossProfit(input, columns, products);
    case "merchandise_actions":
      return describeMerchandiseActions(input, columns, products);
    case "stock_coverage":
      return describeStockCoverage(input, columns, products);
    case "inventory_turnover":
      return describeInventoryTurnover(input, columns, products);
  }
}

export function hasRetailInventoryDeterministicCapability(input: RetailInventoryInput) {
  const intent = resolveRetailInventoryIntent(input.question);
  if (!intent) return false;
  const columns = retailColumns(buildSemanticSchema(input));
  return missingConcepts(intent, columns).length === 0;
}

export function isRetailInventoryQuestion(question: string) {
  return resolveRetailInventoryIntent(question) !== null;
}

function resolveRetailInventoryIntent(question: string): RetailInventoryIntent | null {
  const text = question.toLowerCase();
  if (/revenue.*trend|sales.*trend|revenue.*over time|sales.*over time|daily.*revenue|weekly.*revenue|monthly.*revenue/.test(text)) return "revenue_trends";
  if (/top\s+selling|best\s+selling|sell\s+best|top.*product|product.*perform|highest.*units|highest.*quantity/.test(text)) return "top_selling_products";
  if (/below\s+reorder|low\s+stock|low\s+inventory|stockout|out\s+of\s+stock|at\s+risk\s+of\s+stockout/.test(text)) return "low_stock_items";
  if (/dead\s+stock|no\s+recent\s+movement|without.*sales|no.*sales\s+movement/.test(text)) return "dead_stock_products";
  if (/cash[-\s]*flow.*stock|stock.*cash[-\s]*flow|inventory.*cash[-\s]*flow|cash[-\s]*flow.*inventory|inventory\s+exposure|stock\s+value\s+stuck|too\s+much\s+stock/.test(text)) return "inventory_cash_flow_risk";
  if (/inventory\s+valuation|inventory\s+value|stock\s+value|total\s+inventory\s+value|current\s+inventory\s+value/.test(text)) return "inventory_valuation";
  if (/reorder.*recommend|reordered\s+first|reorder\s+risk|need\s+reorder|should.*reorder|reorder.*first/.test(text)) return "reorder_recommendations";
  if (/highest\s+margin|best\s+margin|product.*margin|margin.*product/.test(text)) return "highest_margin_products";
  if (/supplier|vendor|manufacturer/.test(text) && /revenue|risk|exposure|drive|largest|most/.test(text)) return "supplier_revenue_or_risk";
  if (/slow[-\s]*moving|slow\s+moving|inventory\s+turnover|fastest\s+inventory\s+turnover/.test(text)) return /turnover|fastest/.test(text) ? "inventory_turnover" : "slow_moving_inventory";
  if (/categor/.test(text) && /gross\s+profit|profit/.test(text)) return "category_gross_profit";
  if (/discount|bundle|bundled|stopped|stop|clearance/.test(text) && /sku|product|item|stock|inventory/.test(text)) return "merchandise_actions";
  if (/stock\s+coverage|how\s+long.*stock|current\s+stock\s+last|days\s+of\s+stock/.test(text)) return "stock_coverage";
  return null;
}

function retailColumns(schema: SemanticSchema): RetailColumns {
  const quantity = semanticColumn(schema, "quantity");
  const unitsSold = semanticColumn(schema, "units_sold") ?? (
    quantity && quantity !== semanticColumn(schema, "stock_on_hand") && quantity !== semanticColumn(schema, "reorder_point")
      ? quantity
      : null
  );
  return {
    product: semanticColumn(schema, "product"),
    stock: semanticColumn(schema, "stock_on_hand"),
    unitsSold,
    reorderPoint: semanticColumn(schema, "reorder_point"),
    revenue: semanticColumn(schema, "revenue"),
    unitCost: semanticColumn(schema, "unit_cost") ?? validatedUnitCostFromCogs(schema),
    grossProfit: semanticColumn(schema, "gross_profit"),
    grossMargin: semanticColumn(schema, "gross_margin"),
    supplier: semanticColumn(schema, "supplier") ?? semanticColumn(schema, "seller"),
    category: semanticColumn(schema, "category"),
    date: semanticColumn(schema, "date"),
    store: schema.columns.find((column) => /store|branch|location/i.test(column)) ?? null,
  };
}

function validatedUnitCostFromCogs(schema: SemanticSchema) {
  const cogsColumn = semanticColumn(schema, "cogs");
  if (!cogsColumn) return null;
  return /unit|product|purchase|supplier|vendor|procurement/i.test(cogsColumn) ? cogsColumn : null;
}

function missingConcepts(intent: RetailInventoryIntent, columns: RetailColumns): RequiredConcept[] {
  const requirements: Record<RetailInventoryIntent, RequiredConcept[]> = {
    top_selling_products: ["product"],
    low_stock_items: ["product", "stock", "reorderPoint"],
    dead_stock_products: ["product", "stock", "unitsSold"],
    inventory_valuation: ["stock", "unitCost"],
    reorder_recommendations: ["product", "stock", "reorderPoint"],
    highest_margin_products: ["product", "revenue", "margin"],
    supplier_revenue_or_risk: ["supplier"],
    revenue_trends: ["revenue", "date"],
    slow_moving_inventory: ["product", "stock", "unitsSold"],
    inventory_cash_flow_risk: ["product", "stock", "unitCost"],
    category_gross_profit: ["category", "revenue", "margin"],
    merchandise_actions: ["product", "stock", "unitsSold"],
    stock_coverage: ["product", "stock", "unitsSold", "date"],
    inventory_turnover: ["product", "stock", "unitsSold"],
  };
  const missing = requirements[intent].filter((concept) => !hasConcept(concept, columns));
  if (intent === "top_selling_products" && !columns.unitsSold && !columns.revenue) {
    missing.push("unitsSold", "revenue");
  }
  return missing;
}

function hasConcept(concept: RequiredConcept, columns: RetailColumns) {
  if (concept === "margin") return Boolean(columns.grossProfit || columns.unitCost || columns.grossMargin);
  if (concept === "supplier") return Boolean(columns.supplier && (columns.revenue || (columns.stock && columns.unitCost)));
  if (concept === "revenue") return Boolean(columns.revenue);
  return Boolean(columns[concept]);
}

function aggregateProducts(rows: Record<string, unknown>[], columns: RetailColumns): RetailProduct[] {
  const groups = new Map<string, RetailProduct>();
  rows.forEach((row, index) => {
    const product = textValue(row, columns.product) || `Product ${index + 1}`;
    const store = textValue(row, columns.store);
    const key = `${store ?? "all"}::${product}`;
    const revenue = numberValue(row, columns.revenue) ?? 0;
    const unitsSold = numberValue(row, columns.unitsSold) ?? 0;
    const grossProfit = rowGrossProfit(row, columns, revenue, unitsSold);
    const stock = numberValue(row, columns.stock);
    const reorderPoint = numberValue(row, columns.reorderPoint);
    const unitCost = numberValue(row, columns.unitCost);
    const dateTime = dateTimeValue(row, columns.date);
    const existing = groups.get(key);

    if (existing) {
      existing.revenue += revenue;
      existing.unitsSold += unitsSold;
      existing.grossProfit = addNullable(existing.grossProfit, grossProfit);
      existing.marginPct = existing.revenue > 0 && existing.grossProfit !== null ? (existing.grossProfit / existing.revenue) * 100 : existing.marginPct;
      if (stock !== null && isLaterSnapshot(dateTime, index, existing)) {
        existing.stock = stock;
        existing.reorderPoint = reorderPoint ?? existing.reorderPoint;
        existing.unitCost = unitCost ?? existing.unitCost;
        existing.inventoryValue = unitCost === null ? null : stock * unitCost;
        existing.latestDateTime = dateTime;
        existing.latestRowIndex = index;
      }
      return;
    }

    groups.set(key, {
      product,
      sku: textValue(row, columns.product),
      store,
      category: textValue(row, columns.category),
      supplier: textValue(row, columns.supplier),
      revenue,
      unitsSold,
      grossProfit,
      marginPct: marginForRow(row, columns, revenue, grossProfit),
      stock,
      reorderPoint,
      unitCost,
      inventoryValue: stock !== null && unitCost !== null ? stock * unitCost : null,
      latestDateTime: dateTime,
      latestRowIndex: index,
    });
  });

  return Array.from(groups.values()).map((product) => ({
    ...product,
    revenue: round(product.revenue),
    unitsSold: round(product.unitsSold),
    grossProfit: product.grossProfit === null ? null : round(product.grossProfit),
    marginPct: product.revenue > 0 && product.grossProfit !== null ? round((product.grossProfit / product.revenue) * 100, 1) : product.marginPct,
    inventoryValue: product.inventoryValue === null ? null : round(product.inventoryValue),
  }));
}

function isLaterSnapshot(dateTime: number | null, rowIndex: number, current: RetailProduct) {
  if (dateTime !== null && current.latestDateTime !== null) return dateTime > current.latestDateTime || (dateTime === current.latestDateTime && rowIndex > current.latestRowIndex);
  if (dateTime !== null && current.latestDateTime === null) return true;
  if (dateTime === null && current.latestDateTime !== null) return false;
  return rowIndex > current.latestRowIndex;
}

function rowGrossProfit(row: Record<string, unknown>, columns: RetailColumns, revenue: number, unitsSold: number) {
  const direct = numberValue(row, columns.grossProfit);
  if (direct !== null) return direct;
  const unitCost = numberValue(row, columns.unitCost);
  if (revenue > 0 && unitCost !== null) return revenue - unitCost * unitsSold;
  return null;
}

function marginForRow(row: Record<string, unknown>, columns: RetailColumns, revenue: number, grossProfit: number | null) {
  const direct = numberValue(row, columns.grossMargin);
  if (direct !== null) return Math.abs(direct) <= 1 ? direct * 100 : direct;
  if (revenue > 0 && grossProfit !== null) return (grossProfit / revenue) * 100;
  return null;
}

function describeTopSellingProducts(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const metric = columns.unitsSold ? "unitsSold" : "revenue";
  if (!columns.unitsSold && !columns.revenue) return missingEvidence(input, "top_selling_products", ["unitsSold", "revenue"], columns);
  const rows = products
    .filter((product) => product[metric] > 0)
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 10)
    .map(productRow);
  const top = rows[0];
  return success(input, "top_selling_products", rows, {
    answer: top ? `Answer: ${top.product} is the top selling product by ${metric === "unitsSold" ? "units sold" : "revenue"} (${metric === "revenue" ? formatValue(Number(top.revenue), inputCurrencyCode(input)) : `${formatNumber(Number(top.unitsSold))} units`}).` : "Answer: No products with detected sales movement were found.",
    insight: metric === "unitsSold" ? `Ranked products by validated units sold from "${columns.unitsSold}".` : `Ranked products by validated revenue from "${columns.revenue}".`,
    recommendation: "Protect availability for the top product set before discounting lower-moving inventory.",
  });
}

function describeLowStockItems(
  input: RetailInventoryInput,
  columns: RetailColumns,
  products: RetailProduct[],
  intent: "low_stock_items" | "reorder_recommendations",
): RetailInventoryDeterministicResult {
  const rows = products
    .filter((product) => product.stock !== null && product.reorderPoint !== null && product.stock <= product.reorderPoint)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(productRow);
  const top = rows[0];
  return success(input, intent, rows, {
    answer: top ? `Answer: ${top.product} needs attention because stock on hand (${top.stock}) is at or below reorder point (${top.reorderPoint}).` : "Answer: No products are at or below their reorder point.",
    insight: `Checked latest product inventory snapshots using "${columns.stock}" and "${columns.reorderPoint}".`,
    recommendation: top ? "Reorder qualified items in revenue order and review reorder points against recent sales movement." : "No reorder exception is present in the mapped stock and reorder-point fields.",
  });
}

function describeDeadStockProducts(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const rows = products
    .filter((product) => (product.stock ?? 0) > 0 && product.unitsSold <= 0)
    .sort((a, b) => (b.inventoryValue ?? b.stock ?? 0) - (a.inventoryValue ?? a.stock ?? 0))
    .slice(0, 10)
    .map(productRow);
  const top = rows[0];
  return success(input, "dead_stock_products", rows, {
    answer: top ? `Answer: ${top.product} is a dead-stock candidate because it has ${top.stock} units on hand and no detected sales movement.` : "Answer: No dead-stock products were detected from stock and movement fields.",
    insight: `Dead stock uses stock on hand greater than zero plus zero detected units sold from "${columns.unitsSold}".`,
    recommendation: top ? "Review the listed products for clearance, bundling, or reorder suppression." : "Keep monitoring products with stock on hand and low movement.",
  });
}

function describeInventoryValuation(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const total = products.reduce((sum, product) => sum + (product.inventoryValue ?? 0), 0);
  const rows = products
    .filter((product) => product.inventoryValue !== null)
    .sort((a, b) => (b.inventoryValue ?? 0) - (a.inventoryValue ?? 0))
    .slice(0, 10)
    .map(productRow);
  return success(input, "inventory_valuation", rows.length ? rows : [{ metric: "Inventory value", value: round(total) }], {
    answer: `Answer: Current inventory valuation is ${formatValue(total, inputCurrencyCode(input))}.`,
    insight: `Calculated latest stock snapshots from "${columns.stock}" multiplied by validated unit cost from "${columns.unitCost}".`,
    recommendation: "Review the highest-value stocked products first for aging, movement, and reorder decisions.",
  });
}

function describeHighestMarginProducts(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const rows = products
    .filter((product) => product.marginPct !== null)
    .sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0))
    .slice(0, 10)
    .map(productRow);
  const top = rows[0];
  return success(input, "highest_margin_products", rows, {
    answer: top ? `Answer: ${top.product} has the highest detected margin at ${Number(top.marginPct).toFixed(1)}%.` : "Answer: Product margin could not be calculated for any product.",
    insight: `Margin uses revenue from "${columns.revenue}" plus ${columns.grossProfit ? `"${columns.grossProfit}"` : columns.grossMargin ? `"${columns.grossMargin}"` : `unit cost from "${columns.unitCost}"`}.`,
    recommendation: "Protect high-margin products from stockouts and compare low-margin products against discount plans.",
  });
}

function describeSupplierRevenueOrRisk(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const groups = groupProducts(products, "supplier");
  const rows = groups
    .sort((a, b) => (b.revenue + b.inventoryValue) - (a.revenue + a.inventoryValue))
    .slice(0, 10);
  const top = rows[0];
  return success(input, "supplier_revenue_or_risk", rows, {
    answer: top ? `Answer: ${top.segment} is the leading supplier signal with ${formatValue(top.revenue, inputCurrencyCode(input))} revenue and ${formatValue(top.inventoryValue, inputCurrencyCode(input))} inventory exposure.` : "Answer: No supplier groups were available after semantic validation.",
    insight: `Grouped products by supplier field "${columns.supplier}".`,
    recommendation: "Review suppliers with high revenue dependence, high inventory exposure, or reorder exceptions first.",
  });
}

function describeRevenueTrends(input: RetailInventoryInput, columns: RetailColumns): RetailInventoryDeterministicResult {
  const periods = groupByPeriod(input.rows, columns.date!, columns.revenue!);
  const latest = periods.at(-1);
  const previous = periods.at(-2);
  const changePct = latest && previous && previous.value !== 0 ? ((latest.value - previous.value) / previous.value) * 100 : null;
  return success(input, "revenue_trends", periods.map((row) => ({ period: row.period, revenue: round(row.value), rows: row.rows })), {
    answer: latest ? `Answer: Latest revenue is ${formatValue(latest.value, inputCurrencyCode(input))} in ${latest.period}${changePct === null ? "" : ` (${formatSignedPercent(changePct)} vs previous period)`}.` : "Answer: No valid revenue periods were found.",
    insight: `Grouped "${columns.revenue}" by "${columns.date}".`,
    recommendation: "Compare the latest change against product, category, and supplier movements.",
  });
}

function describeSlowMovingInventory(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const rows = products
    .filter((product) => (product.stock ?? 0) > 0)
    .sort((a, b) => a.unitsSold - b.unitsSold || (b.stock ?? 0) - (a.stock ?? 0))
    .slice(0, 10)
    .map(productRow);
  const top = rows[0];
  return success(input, "slow_moving_inventory", rows, {
    answer: top ? `Answer: ${top.product} is the slowest-moving stocked product with ${top.unitsSold} detected units sold and ${top.stock} units on hand.` : "Answer: No stocked products were found for slow-moving inventory analysis.",
    insight: `Ranked stocked products by units sold from "${columns.unitsSold}".`,
    recommendation: "Prioritize discount, bundle, or reorder-stop reviews for stocked products with the lowest movement.",
  });
}

function describeInventoryCashFlowRisk(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const rows = products
    .filter((product) => product.inventoryValue !== null && (product.stock ?? 0) > 0)
    .sort((a, b) => (b.inventoryValue ?? 0) - (a.inventoryValue ?? 0))
    .slice(0, 10)
    .map((product) => ({ ...productRow(product), risk: riskLabel(product) }));
  const top = rows[0];
  return success(input, "inventory_cash_flow_risk", rows, {
    answer: top ? `Answer: ${top.product} creates the largest inventory cash-flow exposure at ${formatValue(Number(top.inventoryValue), inputCurrencyCode(input))}.` : "Answer: No inventory cash-flow exposure could be calculated.",
    insight: `Calculated inventory exposure from latest stock in "${columns.stock}" and unit cost in "${columns.unitCost}".`,
    recommendation: "Review high-value stocked products for movement, reorder status, and clearance decisions.",
  });
}

function describeCategoryGrossProfit(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const rows = groupProducts(products, "category")
    .filter((row) => row.grossProfit !== null)
    .sort((a, b) => (b.grossProfit ?? 0) - (a.grossProfit ?? 0))
    .slice(0, 10);
  const top = rows[0];
  return success(input, "category_gross_profit", rows, {
    answer: top ? `Answer: ${top.segment} generates the most gross profit at ${formatValue(top.grossProfit ?? 0, inputCurrencyCode(input))}.` : "Answer: No category gross profit could be calculated.",
    insight: `Grouped products by category field "${columns.category}".`,
    recommendation: "Protect high-gross-profit categories and review weak categories for pricing, mix, or cost actions.",
  });
}

function describeMerchandiseActions(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const rows = products
    .filter((product) => (product.stock ?? 0) > 0)
    .map((product) => ({ ...productRow(product), action: merchandiseAction(product) }))
    .filter((row) => row.action !== "Monitor")
    .sort((a, b) => Number(b.inventoryValue ?? b.stock ?? 0) - Number(a.inventoryValue ?? a.stock ?? 0))
    .slice(0, 10);
  const top = rows[0];
  return success(input, "merchandise_actions", rows, {
    answer: top ? `Answer: Start with ${top.product}: ${top.action}.` : "Answer: No SKU discount, bundle, or stop-action candidates were detected from stock and movement fields.",
    insight: `Actions use stock from "${columns.stock}" and units sold from "${columns.unitsSold}".`,
    recommendation: "Confirm merchandising context before changing prices, then suppress reorders for no-movement stocked items.",
  });
}

function describeStockCoverage(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const days = datasetDays(input.rows, columns.date!);
  if (days === null || days <= 0) return missingEvidence(input, "stock_coverage", ["date"], columns);
  const rows = products
    .filter((product) => (product.stock ?? 0) > 0 && product.unitsSold > 0)
    .map((product) => ({
      ...productRow(product),
      coverageDays: round((product.stock ?? 0) / (product.unitsSold / days), 1),
    }))
    .sort((a, b) => Number(a.coverageDays) - Number(b.coverageDays))
    .slice(0, 10);
  const top = rows[0];
  return success(input, "stock_coverage", rows, {
    answer: top ? `Answer: ${top.product} has the shortest detected stock coverage at ${top.coverageDays} days.` : "Answer: Stock coverage could not be calculated because no stocked products had detected unit sales.",
    insight: `Estimated coverage from stock on hand, units sold, and the detected date range in "${columns.date}".`,
    recommendation: "Reorder short-coverage products before reviewing long-coverage products for discounting or bundling.",
  });
}

function describeInventoryTurnover(input: RetailInventoryInput, columns: RetailColumns, products: RetailProduct[]): RetailInventoryDeterministicResult {
  const rows = products
    .filter((product) => (product.stock ?? 0) > 0)
    .map((product) => ({ ...productRow(product), turnover: round(product.unitsSold / Math.max(product.stock ?? 0, 1), 2) }))
    .sort((a, b) => Number(b.turnover) - Number(a.turnover))
    .slice(0, 10);
  const top = rows[0];
  return success(input, "inventory_turnover", rows, {
    answer: top ? `Answer: ${top.product} has the fastest detected inventory turnover ratio at ${top.turnover}.` : "Answer: No stocked products were available for inventory turnover analysis.",
    insight: `Calculated units sold from "${columns.unitsSold}" divided by current stock from "${columns.stock}".`,
    recommendation: "Keep fast-turning products available and review low-turning products for trapped cash.",
  });
}

function success(
  input: RetailInventoryInput,
  intent: RetailInventoryIntent,
  data: Array<Record<string, string | number | null>>,
  content: { answer: string; insight: string; recommendation: string },
): RetailInventoryDeterministicResult {
  return {
    status: "success",
    answer: [content.answer, `Insight: ${content.insight}`, `Takeaway: No provider-generated values were used.`, `Next question: ${content.recommendation}`].join("\n\n"),
    insight: content.insight,
    explanation: "Direct retail inventory analysis matched the question to a deterministic handler after semantic field validation.",
    recommendation: content.recommendation,
    data,
    chartType: "table",
    result: {
      intent: `retail_inventory.${intent}`,
      status: "success",
      confidence: 0.9,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
    },
  };
}

function missingEvidence(
  input: RetailInventoryInput,
  intent: RetailInventoryIntent,
  missing: RequiredConcept[],
  columns: RetailColumns,
): RetailInventoryDeterministicResult {
  const missingLabels = missing.map(humanizeConcept);
  return {
    status: "success",
    answer: [
      `Answer: ${retailIntentLabel(intent)} is unavailable because ${formatList(missingLabels)} ${missingLabels.length === 1 ? "is" : "are"} missing from validated dataset semantics.`,
      `Evidence: Detected retail fields include ${availableRetailEvidence(columns) || "no required retail inventory fields"}.`,
      "Takeaway: UseClevr will not substitute arbitrary numeric columns or route this deterministic retail KPI to a provider.",
      "Next question: Ask a suggested question backed by mapped product, stock, sales, cost, supplier, category, or date fields.",
    ].join("\n\n"),
    insight: `Missing evidence: ${formatList(missingLabels)}.`,
    explanation: "Direct retail inventory analysis recognized the intent and refused calculation because semantic evidence was incomplete.",
    recommendation: "Upload or map the missing retail fields before asking this inventory question.",
    data: missing.map((field) => ({ field: humanizeConcept(field), status: "missing" })),
    chartType: "table",
    result: {
      intent: `retail_inventory.${intent}`,
      status: "missing_evidence",
      confidence: 0.86,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      missingFields: missing,
    },
  };
}

function groupProducts(products: RetailProduct[], field: "supplier" | "category") {
  const groups = new Map<string, { segment: string; revenue: number; grossProfit: number | null; inventoryValue: number; stock: number; products: number }>();
  for (const product of products) {
    const segment = product[field] || (field === "supplier" ? "Unknown supplier" : "Uncategorized");
    const current = groups.get(segment) ?? { segment, revenue: 0, grossProfit: null, inventoryValue: 0, stock: 0, products: 0 };
    current.revenue += product.revenue;
    current.grossProfit = addNullable(current.grossProfit, product.grossProfit);
    current.inventoryValue += product.inventoryValue ?? 0;
    current.stock += product.stock ?? 0;
    current.products += 1;
    groups.set(segment, current);
  }
  return Array.from(groups.values()).map((row) => ({
    segment: row.segment,
    revenue: round(row.revenue),
    grossProfit: row.grossProfit === null ? null : round(row.grossProfit),
    inventoryValue: round(row.inventoryValue),
    stock: round(row.stock),
    products: row.products,
  }));
}

function groupByPeriod(rows: Record<string, unknown>[], dateColumn: string, valueColumn: string) {
  const groups = new Map<string, { value: number; rows: number }>();
  for (const row of rows) {
    const period = monthKey(row[dateColumn]);
    const value = numberValue(row, valueColumn);
    if (!period || value === null) continue;
    const current = groups.get(period) ?? { value: 0, rows: 0 };
    current.value += value;
    current.rows += 1;
    groups.set(period, current);
  }
  return Array.from(groups.entries())
    .map(([period, value]) => ({ period, value: round(value.value), rows: value.rows }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function datasetDays(rows: Record<string, unknown>[], dateColumn: string) {
  const dates = rows.map((row) => dateTimeValue(row, dateColumn)).filter((value): value is number => value !== null);
  if (dates.length < 2) return null;
  const span = Math.max(...dates) - Math.min(...dates);
  return Math.max(1, Math.ceil(span / 86_400_000) + 1);
}

function productRow(product: RetailProduct) {
  return {
    product: product.product,
    category: product.category,
    supplier: product.supplier,
    revenue: round(product.revenue),
    unitsSold: round(product.unitsSold),
    stock: product.stock === null ? null : round(product.stock),
    reorderPoint: product.reorderPoint === null ? null : round(product.reorderPoint),
    unitCost: product.unitCost === null ? null : round(product.unitCost),
    inventoryValue: product.inventoryValue === null ? null : round(product.inventoryValue),
    grossProfit: product.grossProfit === null ? null : round(product.grossProfit),
    marginPct: product.marginPct === null ? null : round(product.marginPct, 1),
  };
}

function riskLabel(product: RetailProduct) {
  if ((product.stock ?? 0) > 0 && product.unitsSold <= 0) return "Dead-stock cash tied up";
  if (product.reorderPoint !== null && product.stock !== null && product.stock <= product.reorderPoint) return "Stockout and reorder risk";
  if (product.stock !== null && product.unitsSold > 0 && product.stock > product.unitsSold * 4) return "High stock coverage";
  return "Inventory exposure";
}

function merchandiseAction(product: RetailProduct) {
  if ((product.stock ?? 0) > 0 && product.unitsSold <= 0) return "Stop reorder and review clearance";
  if (product.stock !== null && product.unitsSold > 0 && product.stock > product.unitsSold * 4) return "Discount or bundle";
  if (product.marginPct !== null && product.marginPct < 15) return "Review margin before discount";
  return "Monitor";
}

function textValue(row: Record<string, unknown>, column: string | null) {
  if (!column) return null;
  const value = row[column];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function numberValue(row: Record<string, unknown>, column: string | null) {
  if (!column) return null;
  return parseBusinessNumber(row[column]);
}

function dateTimeValue(row: Record<string, unknown>, column: string | null) {
  if (!column) return null;
  const value = row[column];
  if (!value) return null;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function monthKey(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const monthMatch = text.match(/^(\d{4})-(\d{2})/);
  if (monthMatch) return `${monthMatch[1]}-${monthMatch[2]}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addNullable(a: number | null, b: number | null) {
  if (a === null) return b;
  if (b === null) return a;
  return a + b;
}

function inputCurrencyCode(input: RetailInventoryInput) {
  return buildSemanticSchema(input).currencyCode;
}

function availableRetailEvidence(columns: RetailColumns) {
  return Object.entries(columns)
    .filter(([, column]) => Boolean(column))
    .map(([concept, column]) => `${humanizeConcept(concept as RequiredConcept)} "${column}"`)
    .join(", ");
}

function retailIntentLabel(intent: RetailInventoryIntent) {
  return intent.replace(/_/g, " ");
}

function humanizeConcept(concept: RequiredConcept) {
  const labels: Record<RequiredConcept, string> = {
    product: "product or SKU",
    stock: "stock on hand",
    unitsSold: "units sold",
    reorderPoint: "reorder point",
    revenue: "revenue",
    unitCost: "unit cost",
    margin: "gross profit, unit cost, or margin",
    supplier: "supplier",
    category: "category",
    date: "date or period",
  };
  return labels[concept] ?? String(concept);
}

function formatList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function formatValue(value: number, currencyCode: string | null) {
  if (!currencyCode) return formatNumber(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
