import type { BusinessModel } from "@/lib/data/business-model"

export type BbscPerspectiveKey = "financial" | "customer" | "processes" | "growth"
export type BbscTrend = "positive" | "stable" | "negative" | "unknown"
export type BbscStatus = "available" | "insufficient_data"
export type BbscReportModel = BusinessModel | "business_consulting" | "profitability" | "accountancy" | "prebookkeeping"

export type BbscKpi = {
  label: string
  value: string
  score: number
  sourceFields: string[]
}

export type BbscPerspective = {
  key: BbscPerspectiveKey
  title: string
  shortTitle: string
  status: BbscStatus
  score: number | null
  weight: number
  kpis: BbscKpi[]
  trend: BbscTrend
  findings: string[]
  risks: string[]
  recommendedActions: string[]
  dataConfidence: number
  requiredFields: string[]
}

export type BusinessBalancedScorecard = {
  title: "Business Balanced Scorecard"
  alsoKnownAs: "Balanced Scorecard (BSC)"
  overallScore: number | null
  availablePerspectiveCount: number
  perspectives: Record<BbscPerspectiveKey, BbscPerspective>
  strongestPerspective: BbscPerspective | null
  weakestPerspective: BbscPerspective | null
  topPriorities: string[]
  recommendedNextActions: string[]
  confidenceNote: string
  scoringInputs: {
    businessModel: string
    rowCount: number
    detectedFields: string[]
    excludedPerspectives: string[]
  }
  scoreExplanation: string
}

type DataRow = Record<string, unknown>
type ColumnMap = ReturnType<typeof detectBbscColumns>
type Metric = {
  label: string
  value: string
  score: number
  sourceFields: string[]
  finding: string
  risk?: string
  action?: string
  trend?: BbscTrend
}

const perspectiveMeta: Record<BbscPerspectiveKey, { title: string; shortTitle: string }> = {
  financial: { title: "Financial Performance", shortTitle: "Financial" },
  customer: { title: "Customer Performance", shortTitle: "Customer" },
  processes: { title: "Internal Business Processes", shortTitle: "Processes" },
  growth: { title: "Learning, Innovation & Growth", shortTitle: "Growth" },
}

export const bbscTranslations = {
  en: {
    title: "Business Balanced Scorecard",
    alsoKnownAs: "Also known as Balanced Scorecard (BSC)",
    perspectives: {
      financial: "Financial Performance",
      customer: "Customer Performance",
      processes: "Internal Business Processes",
      growth: "Learning, Innovation & Growth",
    },
  },
  de: {
    title: "Business Balanced Scorecard",
    alsoKnownAs: "Auch bekannt als Balanced Scorecard (BSC)",
    perspectives: {
      financial: "Finanzielle Leistung",
      customer: "Kundenleistung",
      processes: "Interne Geschäftsprozesse",
      growth: "Lernen, Innovation und Wachstum",
    },
  },
} as const

export function calculateBusinessBalancedScorecard(input: {
  rows: DataRow[]
  columns: string[]
  businessModel: BbscReportModel | string
}): BusinessBalancedScorecard {
  const rows = input.rows.filter(isRecord)
  const columns = input.columns.filter(Boolean)
  const model = normalizeReportModel(input.businessModel)
  const columnMap = detectBbscColumns(columns)
  const trend = valueTrend(rows, columnMap.date, columnMap.revenue || columnMap.gmv || columnMap.mrr || columnMap.valuation)
  const perspectives = {
    financial: buildPerspective("financial", model, rows, columnMap, trend),
    customer: buildPerspective("customer", model, rows, columnMap, trend),
    processes: buildPerspective("processes", model, rows, columnMap, trend),
    growth: buildPerspective("growth", model, rows, columnMap, trend),
  }
  const available = Object.values(perspectives).filter((perspective) => perspective.status === "available" && perspective.score !== null)
  const weight = available.length > 0 ? 1 / available.length : 0

  for (const perspective of Object.values(perspectives)) {
    perspective.weight = perspective.status === "available" ? weight : 0
  }

  const overallScore = available.length > 0
    ? Math.round(available.reduce((total, perspective) => total + (perspective.score || 0) * perspective.weight, 0))
    : null
  const strongestPerspective = available.length >= 2 ? [...available].sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null : null
  const weakestPerspective = available.length >= 2 ? [...available].sort((a, b) => (a.score || 0) - (b.score || 0))[0] || null : null
  const excludedPerspectives = Object.values(perspectives)
    .filter((perspective) => perspective.status === "insufficient_data")
    .map((perspective) => perspective.title)
  const recommendedNextActions = Object.values(perspectives)
    .flatMap((perspective) => perspective.recommendedActions)
    .slice(0, 5)
  const topPriorities = [
    ...(weakestPerspective?.recommendedActions.slice(0, 2) || []),
    ...Object.values(perspectives).flatMap((perspective) => perspective.risks.map((risk) => `Reduce risk: ${risk}`)),
  ].slice(0, 3)

  return {
    title: "Business Balanced Scorecard",
    alsoKnownAs: "Balanced Scorecard (BSC)",
    overallScore,
    availablePerspectiveCount: available.length,
    perspectives,
    strongestPerspective,
    weakestPerspective,
    topPriorities,
    recommendedNextActions,
    confidenceNote: buildConfidenceNote(available.length, excludedPerspectives),
    scoringInputs: {
      businessModel: model,
      rowCount: rows.length,
      detectedFields: detectedFieldList(columnMap),
      excludedPerspectives,
    },
    scoreExplanation: overallScore === null
      ? "No overall score is calculated because none of the four BBSC perspectives has sufficient source fields."
      : `Overall score ${overallScore}/100 is the equally weighted average of ${available.length} available BBSC perspective score${available.length === 1 ? "" : "s"}; insufficient perspectives are excluded instead of estimated.`,
  }
}

function buildPerspective(
  key: BbscPerspectiveKey,
  model: BbscReportModel,
  rows: DataRow[],
  columns: ColumnMap,
  overallTrend: BbscTrend,
): BbscPerspective {
  const metrics = buildMetrics(key, model, rows, columns, overallTrend)
  const requiredFields = requiredFieldsFor(key, model)
  const meta = perspectiveMeta[key]

  if (metrics.length === 0) {
    return {
      key,
      title: meta.title,
      shortTitle: meta.shortTitle,
      status: "insufficient_data",
      score: null,
      weight: 0,
      kpis: [],
      trend: "unknown",
      findings: [`Insufficient data for ${meta.title}.`],
      risks: [],
      recommendedActions: [`Add ${requiredFields.join(", ")} fields to score ${meta.shortTitle.toLowerCase()}.`],
      dataConfidence: 0,
      requiredFields,
    }
  }

  const score = Math.round(metrics.reduce((total, metric) => total + metric.score, 0) / metrics.length)
  const risks = metrics.map((metric) => metric.risk).filter((risk): risk is string => Boolean(risk))
  const actions = metrics.map((metric) => metric.action).filter((action): action is string => Boolean(action))
  const trend = metrics.find((metric) => metric.trend && metric.trend !== "unknown")?.trend || overallTrend

  return {
    key,
    title: meta.title,
    shortTitle: meta.shortTitle,
    status: "available",
    score,
    weight: 0,
    kpis: metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      score: metric.score,
      sourceFields: metric.sourceFields,
    })),
    trend,
    findings: metrics.map((metric) => metric.finding),
    risks,
    recommendedActions: actions.length > 0 ? actions : [`Monitor ${meta.shortTitle.toLowerCase()} KPIs as new data arrives.`],
    dataConfidence: Math.min(100, Math.round((metrics.length / Math.max(2, requiredFields.length)) * 100)),
    requiredFields,
  }
}

function buildMetrics(
  key: BbscPerspectiveKey,
  model: BbscReportModel,
  rows: DataRow[],
  columns: ColumnMap,
  _trend: BbscTrend,
): Metric[] {
  const revenue = sumColumn(rows, columns.revenue) ?? sumColumn(rows, columns.gmv)
  const cost = sumColumn(rows, columns.cost) ?? sumColumn(rows, columns.shippingCost) ?? sumColumn(rows, columns.returnCost)
  const profit = sumColumn(rows, columns.profit) ?? (revenue !== null && cost !== null ? revenue - cost : null)
  const margin = revenue && profit !== null ? (profit / revenue) * 100 : averageColumn(rows, columns.margin)
  const orders = columns.order ? uniqueCount(rows, columns.order) : sumColumn(rows, columns.quantity)
  const customers = columns.customer ? uniqueCount(rows, columns.customer) : null
  const repeatRate = columns.customer ? repeatCustomerRate(rows, columns.customer) : null
  const growthRate = trendPercent(rows, columns.date, columns.revenue || columns.gmv || columns.mrr || columns.valuation)
  const metrics: Metric[] = []

  if (key === "financial") {
    addMetric(metrics, "Revenue", revenue, "currency", scorePositiveValue(revenue), columns.revenue || columns.gmv, "Revenue is available as a financial performance input.", undefined, "Review revenue trend monthly.")
    addMetric(metrics, "Gross profit", profit, "currency", scoreMargin(margin), columns.profit || columns.cost, "Profitability is calculated from profit or revenue/cost fields.", margin !== null && margin < 10 ? "Margin is below 10%." : undefined, "Review pricing, COGS, and operating costs.")
    addMetric(metrics, "Margin", margin, "percent", scoreMargin(margin), columns.margin || columns.profit || columns.cost, "Margin is included in the financial score.", margin !== null && margin < 10 ? "Low margin limits reinvestment capacity." : undefined, "Set margin targets by product, service, or channel.")
    if (model === "saas" || model === "startup") {
      addMetric(metrics, "MRR", sumColumn(rows, columns.mrr), "currency", scorePositiveValue(sumColumn(rows, columns.mrr)), columns.mrr, "MRR is included for SaaS/startup financial performance.")
      addMetric(metrics, "ARR", sumColumn(rows, columns.arr), "currency", scorePositiveValue(sumColumn(rows, columns.arr)), columns.arr, "ARR is included for SaaS/startup financial performance.")
      addMetric(metrics, "Runway", averageColumn(rows, columns.runway), "number", scoreTarget(averageColumn(rows, columns.runway), 12, false), columns.runway, "Runway is scored against a 12-month target.", undefined, "Extend runway through revenue growth or cost control.")
    }
    if (model === "investor") {
      addMetric(metrics, "Invested capital", sumColumn(rows, columns.investedAmount), "currency", 70, columns.investedAmount, "Invested capital is available for portfolio scoring.")
      addMetric(metrics, "Latest valuation", sumColumn(rows, columns.valuation), "currency", scorePositiveValue(sumColumn(rows, columns.valuation)), columns.valuation, "Portfolio valuation is included in financial performance.")
    }
    if (model === "marketplace") {
      const marketplaceRevenue = sumColumn(rows, columns.commission)
      const takeRate = revenue !== null && marketplaceRevenue !== null && revenue > 0 ? (marketplaceRevenue / revenue) * 100 : null
      addMetric(metrics, "GMV", revenue, "currency", scorePositiveValue(revenue), columns.gmv, "GMV is included for marketplace financial performance.")
      addMetric(metrics, "Marketplace Revenue", marketplaceRevenue, "currency", scorePositiveValue(marketplaceRevenue), columns.commission, "Marketplace revenue is included from platform fee or commission fields.")
      addMetric(metrics, "Take Rate", takeRate, "percent", scorePositiveValue(takeRate), columns.commission && columns.gmv ? columns.commission : undefined, "Take rate is calculated from marketplace revenue divided by GMV.")
      addMetric(metrics, "Seller Payout", sumColumn(rows, columns.sellerPayout), "currency", scorePositiveValue(sumColumn(rows, columns.sellerPayout)), columns.sellerPayout, "Seller payout is included for marketplace financial performance.")
      const refunds = sumColumn(rows, columns.refund)
      if (revenue !== null) {
        addMetric(metrics, "Refunds", refunds, "currency", scoreLowerIsBetter(refunds, revenue * 0.05, revenue * 0.2), columns.refund, "Refunds are included for marketplace financial performance.")
      } else if (refunds !== null) {
        addMetric(metrics, "Refunds", refunds, "currency", scoreLowerIsBetter(refunds, 0, 0), columns.refund, "Refunds are included for marketplace financial performance.")
      }
    }
  }

  if (key === "customer") {
    addMetric(metrics, "Customers", customers, "number", scorePositiveValue(customers), columns.customer, "Customer count is available as a customer performance input.")
    addMetric(metrics, "Transactions", orders, "number", scorePositiveValue(orders), columns.order || columns.quantity, "Transaction volume is included in customer performance.")
    addMetric(metrics, "Repeat customers", repeatRate, "percent", scoreTarget(repeatRate, 35, false), columns.customer, "Repeat customer rate is calculated from repeated customer IDs.", repeatRate !== null && repeatRate < 15 ? "Repeat customer rate is low." : undefined, "Create retention offers for returning customers.")
    addMetric(metrics, "Basket value", revenue !== null && orders ? revenue / orders : null, "currency", scorePositiveValue(revenue !== null && orders ? revenue / orders : null), columns.revenue && (columns.order || columns.quantity) ? columns.revenue : undefined, "Basket value uses revenue divided by transactions.")
    if (model === "saas" || model === "startup") {
      addMetric(metrics, "Churn", churnRate(rows, columns.churned), "percent", scoreLowerIsBetter(churnRate(rows, columns.churned), 5, 20), columns.churned, "Churn is scored as a customer-retention risk.", churnRate(rows, columns.churned) !== null && (churnRate(rows, columns.churned) || 0) > 10 ? "Churn is above 10%." : undefined, "Investigate churn causes by segment.")
      addMetric(metrics, "LTV", averageColumn(rows, columns.ltv), "currency", scorePositiveValue(averageColumn(rows, columns.ltv)), columns.ltv, "LTV is included in SaaS/startup customer value.")
    }
    if (model === "business_consulting") {
      addMetric(metrics, "Client concentration", concentrationScore(rows, columns.customer, columns.revenue), "percent", concentrationScore(rows, columns.customer, columns.revenue), columns.customer && columns.revenue ? columns.customer : undefined, "Client concentration uses revenue distribution by client.", undefined, "Reduce dependency on the largest client.")
    }
    if (model === "marketplace") {
      const buyers = columns.buyer ? uniqueCount(rows, columns.buyer) : null
      const sellers = columns.seller ? uniqueCount(rows, columns.seller) : null
      addMetric(metrics, "Buyers", buyers, "number", scorePositiveValue(buyers), columns.buyer, "Buyer count is available for marketplace customer performance.")
      addMetric(metrics, "Sellers", sellers, "number", scorePositiveValue(sellers), columns.seller, "Seller count is available for marketplace customer performance.")
      addMetric(metrics, "New buyers", countDistinctPositiveStatus(rows, columns.buyer, columns.newBuyer), "number", scorePositiveValue(countDistinctPositiveStatus(rows, columns.buyer, columns.newBuyer)), columns.newBuyer, "New buyer count is calculated from normalized new-buyer statuses.")
      addMetric(metrics, "New sellers", countDistinctPositiveStatus(rows, columns.seller, columns.newSeller), "number", scorePositiveValue(countDistinctPositiveStatus(rows, columns.seller, columns.newSeller)), columns.newSeller, "New seller count is calculated from normalized new-seller statuses.")
    }
  }

  if (key === "processes") {
    if (model === "local_retail") {
      const lowStock = lowStockRate(rows, columns)
      addMetric(metrics, "Low stock / stockouts", lowStock, "percent", scoreLowerIsBetter(lowStock, 5, 25), columns.stock && columns.reorderPoint ? columns.stock : undefined, "Low stock risk is scored from stock and reorder-point fields.", lowStock !== null && lowStock > 15 ? "Stockout/reorder risk is elevated." : undefined, "Prioritize replenishment for items below reorder point.")
      addMetric(metrics, "Dead stock", zeroMovementRate(rows, columns), "percent", scoreLowerIsBetter(zeroMovementRate(rows, columns), 5, 25), columns.stock && columns.quantity ? columns.stock : undefined, "Dead stock risk uses stock and movement columns.", undefined, "Discount or bundle slow-moving products.")
    } else if (model === "ecommerce") {
      addMetric(metrics, "Shipping cost ratio", ratioPercent(sumColumn(rows, columns.shippingCost), revenue), "percent", scoreLowerIsBetter(ratioPercent(sumColumn(rows, columns.shippingCost), revenue), 8, 20), columns.shippingCost, "Shipping cost ratio is scored from shipping and revenue fields.", undefined, "Review fulfillment and shipping rates.")
      addMetric(metrics, "Return cost ratio", ratioPercent(sumColumn(rows, columns.returnCost), revenue), "percent", scoreLowerIsBetter(ratioPercent(sumColumn(rows, columns.returnCost), revenue), 5, 15), columns.returnCost, "Return cost ratio is scored from return/refund fields.", undefined, "Identify high-return products and channels.")
      addMetric(metrics, "Channel performance", groupedCount(rows, columns.channel), "number", scorePositiveValue(groupedCount(rows, columns.channel)), columns.channel, "Channel count is included for process coverage.")
    } else if (model === "saas" || model === "startup") {
      addMetric(metrics, "CAC", averageColumn(rows, columns.cac), "currency", scoreLowerIsBetter(averageColumn(rows, columns.cac), 100, 1000), columns.cac, "CAC is included as acquisition-efficiency input.", undefined, "Compare CAC with LTV by acquisition channel.")
      addMetric(metrics, "Product usage", averageColumn(rows, columns.usage), "number", scorePositiveValue(averageColumn(rows, columns.usage)), columns.usage, "Product usage is included where available.")
    } else if (model === "investor") {
      addMetric(metrics, "Portfolio monitoring", groupedCount(rows, columns.stage), "number", scorePositiveValue(groupedCount(rows, columns.stage)), columns.stage, "Stage coverage supports portfolio monitoring.")
      addMetric(metrics, "Risk exposure", concentrationScore(rows, columns.sector, columns.valuation || columns.investedAmount), "percent", concentrationScore(rows, columns.sector, columns.valuation || columns.investedAmount), columns.sector, "Sector concentration is included as risk-management input.", undefined, "Review concentration by sector and stage.")
    } else if (model === "business_consulting") {
      addMetric(metrics, "Billable utilization", sumColumn(rows, columns.billableHours), "number", scorePositiveValue(sumColumn(rows, columns.billableHours)), columns.billableHours, "Billable hours are included for utilization.")
      addMetric(metrics, "Cost efficiency", ratioPercent(cost, revenue), "percent", scoreLowerIsBetter(ratioPercent(cost, revenue), 50, 85), columns.cost, "Cost efficiency uses cost as a percentage of revenue.")
    } else if (model === "marketplace") {
      const completedTransactions = countDistinctPositiveStatus(rows, columns.order, columns.completed)
      const totalTransactions = columns.order ? uniqueCount(rows, columns.order) : sumColumn(rows, columns.quantity)
      const completionRate = totalTransactions !== null && totalTransactions > 0 && completedTransactions !== null ? (completedTransactions / totalTransactions) * 100 : null
      addMetric(metrics, "Completion rate", completionRate, "percent", scoreTarget(completionRate, 95, true), columns.completed, "Completion rate is calculated from completed transaction statuses.", completionRate !== null && completionRate < 90 ? "Completion rate is below 90%." : undefined, "Investigate incomplete transactions by seller and category.")
      addMetric(metrics, "Active sellers", sumColumn(rows, columns.activeSellers), "number", scorePositiveValue(sumColumn(rows, columns.activeSellers)), columns.activeSellers, "Active sellers are included for marketplace process coverage.")
      addMetric(metrics, "Listings", sumColumn(rows, columns.listingCount), "number", scorePositiveValue(sumColumn(rows, columns.listingCount)), columns.listingCount, "Listings are included for marketplace process coverage.")
    } else {
      addMetric(metrics, "Process volume", orders, "number", scorePositiveValue(orders), columns.order || columns.quantity, "Operational volume is included from order or quantity fields.")
    }
  }

  if (key === "growth") {
    addMetric(metrics, "Growth trend", growthRate, "percent", scoreGrowth(growthRate), columns.date, "Growth trend is calculated from dated values.", growthRate !== null && growthRate < 0 ? "Recent trend is negative." : undefined, "Review the drivers behind the latest trend.")
    addMetric(metrics, "Product expansion", groupedCount(rows, columns.product || columns.category), "number", scorePositiveValue(groupedCount(rows, columns.product || columns.category)), columns.product || columns.category, "Product/category breadth is included as a growth input.")
    if (model === "ecommerce") {
      addMetric(metrics, "Market expansion", groupedCount(rows, columns.country), "number", scorePositiveValue(groupedCount(rows, columns.country)), columns.country, "Country/region coverage is included for market expansion.")
      addMetric(metrics, "Channel growth", groupedCount(rows, columns.channel), "number", scorePositiveValue(groupedCount(rows, columns.channel)), columns.channel, "Channel breadth is included for ecommerce growth.")
    } else if (model === "investor") {
      addMetric(metrics, "Sector diversification", diversificationScore(rows, columns.sector), "number", diversificationScore(rows, columns.sector), columns.sector, "Sector diversification is included for investor growth.")
      addMetric(metrics, "Stage diversification", diversificationScore(rows, columns.stage), "number", diversificationScore(rows, columns.stage), columns.stage, "Stage diversification is included for follow-on opportunity review.")
    } else if (model === "saas" || model === "startup") {
      addMetric(metrics, "Expansion MRR", sumColumn(rows, columns.expansionMrr), "currency", scorePositiveValue(sumColumn(rows, columns.expansionMrr)), columns.expansionMrr, "Expansion MRR is included where available.")
      addMetric(metrics, "Scalability", averageColumn(rows, columns.usage), "number", scorePositiveValue(averageColumn(rows, columns.usage)), columns.usage, "Usage/adoption is included where available.")
    } else if (model === "marketplace") {
      addMetric(metrics, "Market expansion", groupedCount(rows, columns.country), "number", scorePositiveValue(groupedCount(rows, columns.country)), columns.country, "Country coverage is included for marketplace growth.")
      addMetric(metrics, "Category breadth", groupedCount(rows, columns.category), "number", scorePositiveValue(groupedCount(rows, columns.category)), columns.category, "Category breadth is included for marketplace growth.")
    }
  }

  return metrics
}

function detectBbscColumns(columns: string[]) {
  return {
    revenue: findColumn(columns, [/revenue/, /^sales$/, /amount/, /turnover/, /income/, /net_sales/]),
    cost: findColumn(columns, [/^cost$/, /cogs/, /expense/, /unit_cost/, /spend/, /consultant_cost/]),
    profit: findColumn(columns, [/profit/, /gross_margin/, /project_margin/]),
    margin: findColumn(columns, [/margin_pct/, /margin_percent/, /^margin$/]),
    quantity: findColumn(columns, [/quantity/, /^qty$/, /units_sold/, /units/, /volume/]),
    order: findColumn(columns, [/order_id/, /^order$/, /transaction/, /invoice/]),
    customer: findColumn(columns, [/customer_id/, /customer/, /client_id/, /client/, /account_id/]),
    date: findColumn(columns, [/date/, /month/, /period/, /created_at/]),
    product: findColumn(columns, [/product_id/, /product/, /^sku$/, /item/]),
    category: findColumn(columns, [/category/, /service_line/]),
    stock: findColumn(columns, [/stock_on_hand/, /stock/, /inventory/]),
    reorderPoint: findColumn(columns, [/reorder_point/, /reorder/]),
    supplier: findColumn(columns, [/supplier/, /vendor/]),
    country: findColumn(columns, [/country/, /region/, /market/, /location/]),
    channel: findColumn(columns, [/channel/, /source/]),
    shippingCost: findColumn(columns, [/shipping_cost/, /shipping/, /fulfillment/]),
    returnCost: findColumn(columns, [/return_cost/, /refund/, /returns/]),
    mrr: findColumn(columns, [/^mrr$/, /monthly_recurring_revenue/]),
    arr: findColumn(columns, [/^arr$/, /annual_recurring_revenue/]),
    expansionMrr: findColumn(columns, [/expansion_mrr/, /upsell/, /expansion/]),
    churned: findColumn(columns, [/churned/, /churn/]),
    cac: findColumn(columns, [/^cac$/, /customer_acquisition_cost/, /acquisition_cost/]),
    ltv: findColumn(columns, [/^ltv$/, /customer_lifetime_value/, /lifetime_value/]),
    burn: findColumn(columns, [/burn/]),
    runway: findColumn(columns, [/runway/]),
    usage: findColumn(columns, [/active_user/, /usage/, /sessions/, /tickets/, /support/]),
    gmv: findColumn(columns, [/^gmv$/, /gross_merchandise/]),
    investedAmount: findColumn(columns, [/invested_amount/, /invested_capital/, /investment/]),
    valuation: findColumn(columns, [/latest_valuation/, /valuation/]),
    ownership: findColumn(columns, [/ownership/]),
    sector: findColumn(columns, [/sector/, /industry/]),
    stage: findColumn(columns, [/stage/]),
    billableHours: findColumn(columns, [/billable_hours/, /hours/]),
    commission: findColumn(columns, [/commission/, /take_rate/, /platform_fee/]),
    sellerPayout: findColumn(columns, [/seller_payout/, /merchant_payout/, /payout/]),
    refund: findColumn(columns, [/refund/, /return_amount/]),
    seller: findColumn(columns, [/seller/, /vendor/, /merchant/]),
    buyer: findColumn(columns, [/buyer/]),
    newBuyer: findColumn(columns, [/new_buyer/, /newbuyer/]),
    newSeller: findColumn(columns, [/new_seller/, /newseller/]),
    activeSellers: findColumn(columns, [/active_sellers/, /active_seller/]),
    listingCount: findColumn(columns, [/listing_count/, /listing/]),
    completed: findColumn(columns, [/completed/, /completion_status/]),
  }
}

function requiredFieldsFor(key: BbscPerspectiveKey, model: BbscReportModel) {
  const common = {
    financial: ["revenue", "cost or profit", "date"],
    customer: ["customer or transaction", "revenue"],
    processes: ["order, inventory, cost, channel, stage, or utilization"],
    growth: ["date", "product, category, market, sector, or usage"],
  }
  if (model === "local_retail" && key === "processes") return ["stock", "reorder point", "quantity sold", "supplier"]
  if (model === "ecommerce" && key === "processes") return ["shipping cost", "returns", "channel", "order"]
  if ((model === "saas" || model === "startup") && key === "financial") return ["MRR", "ARR", "burn", "runway"]
  if ((model === "saas" || model === "startup") && key === "customer") return ["customer", "churn", "retention", "LTV"]
  if (model === "investor" && key === "financial") return ["invested capital", "latest valuation", "ownership"]
  if (model === "business_consulting" && key === "processes") return ["billable hours", "cost", "project delivery", "revenue"]
  if (model === "marketplace" && key === "financial") return ["GMV", "platform revenue", "seller payout", "refunds"]
  if (model === "marketplace" && key === "customer") return ["buyer", "seller", "transactions"]
  if (model === "marketplace" && key === "processes") return ["completion status", "active sellers", "listings"]
  if (model === "marketplace" && key === "growth") return ["date", "category", "country"]
  return common[key]
}

function countDistinctPositiveStatus(rows: DataRow[], idColumn?: string, statusColumn?: string): number | null {
  if (!idColumn || !statusColumn) return null
  const values = new Set<string>()
  rows.forEach((row) => {
    const id = String(row[idColumn] || "").trim()
    const status = String(row[statusColumn] || "").trim().toLowerCase()
    if (!id) return
    if (["true", "1", "yes", "completed", "success", "active"].includes(status)) values.add(id)
  })
  return values.size > 0 ? values.size : null
}

function normalizeReportModel(value: string): BbscReportModel {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (normalized === "business_consulting") return "business_consulting"
  if (normalized === "profitability") return "profitability"
  if (normalized === "accountancy") return "accountancy"
  if (normalized === "prebookkeeping") return "prebookkeeping"
  if (normalized === "local_retail" || normalized === "ecommerce" || normalized === "saas" || normalized === "startup" || normalized === "investor" || normalized === "marketplace") return normalized
  return "generic"
}

function addMetric(
  metrics: Metric[],
  label: string,
  rawValue: number | null,
  format: "currency" | "number" | "percent",
  score: number | null,
  sourceField: string | undefined,
  finding: string,
  risk?: string,
  action?: string,
  trend?: BbscTrend,
) {
  if (rawValue === null || score === null || !sourceField) return
  metrics.push({
    label,
    value: formatValue(rawValue, format),
    score,
    sourceFields: [sourceField],
    finding,
    risk,
    action,
    trend,
  })
}

function findColumn(columns: string[], patterns: RegExp[]) {
  return columns.find((column) => patterns.some((pattern) => pattern.test(column.toLowerCase().trim().replace(/[\s-]+/g, "_"))))
}

function detectedFieldList(columns: ColumnMap) {
  return Object.values(columns).filter((value): value is string => Boolean(value))
}

function buildConfidenceNote(availableCount: number, excluded: string[]) {
  if (availableCount === 4) return "All four BBSC perspectives have source data. Scores are deterministic and based only on uploaded fields."
  if (availableCount > 0) return `${availableCount} of 4 BBSC perspectives have source data. ${excluded.join(", ")} ${excluded.length === 1 ? "is" : "are"} excluded from the overall score.`
  return "No BBSC perspective has enough source data to calculate a score."
}

function scorePositiveValue(value: number | null) {
  if (value === null) return null
  if (value <= 0) return 35
  return 70
}

function scoreMargin(value: number | null) {
  if (value === null) return null
  return clamp(Math.round(50 + value), 0, 100)
}

function scoreTarget(value: number | null, target: number, allowZero = true) {
  if (value === null || (!allowZero && value <= 0)) return null
  return clamp(Math.round((value / target) * 80), 0, 100)
}

function scoreLowerIsBetter(value: number | null, good: number, poor: number) {
  if (value === null) return null
  if (value <= good) return 85
  if (value >= poor) return 35
  return clamp(Math.round(85 - ((value - good) / (poor - good)) * 50), 35, 85)
}

function scoreGrowth(value: number | null) {
  if (value === null) return null
  return clamp(Math.round(60 + value), 0, 100)
}

function formatValue(value: number, format: "currency" | "number" | "percent") {
  if (format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
  if (format === "percent") return `${value.toFixed(1)}%`
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function sumColumn(rows: DataRow[], column?: string) {
  if (!column) return null
  let total = 0
  let found = false
  for (const row of rows) {
    const value = getNumber(row[column])
    if (value === null) continue
    total += value
    found = true
  }
  return found ? total : null
}

function averageColumn(rows: DataRow[], column?: string) {
  if (!column) return null
  const values = rows.map((row) => getNumber(row[column])).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function uniqueCount(rows: DataRow[], column: string) {
  return new Set(rows.map((row) => String(row[column] || "").trim()).filter(Boolean)).size
}

function groupedCount(rows: DataRow[], column?: string) {
  if (!column) return null
  return uniqueCount(rows, column)
}

function repeatCustomerRate(rows: DataRow[], column: string) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = String(row[column] || "").trim()
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  if (counts.size === 0) return null
  const repeat = Array.from(counts.values()).filter((count) => count > 1).length
  return (repeat / counts.size) * 100
}

function churnRate(rows: DataRow[], column?: string) {
  if (!column || rows.length === 0) return null
  const churned = rows.filter((row) => ["true", "yes", "1", "churned"].includes(String(row[column]).toLowerCase())).length
  return (churned / rows.length) * 100
}

function lowStockRate(rows: DataRow[], columns: ColumnMap) {
  if (!columns.stock || !columns.reorderPoint || rows.length === 0) return null
  const validRows = rows.filter((row) => getNumber(row[columns.stock!]) !== null && getNumber(row[columns.reorderPoint!]) !== null)
  if (validRows.length === 0) return null
  const low = validRows.filter((row) => {
    const stock = getNumber(row[columns.stock!])
    const reorder = getNumber(row[columns.reorderPoint!])
    return stock !== null && reorder !== null && stock <= reorder
  }).length
  return (low / validRows.length) * 100
}

function zeroMovementRate(rows: DataRow[], columns: ColumnMap) {
  if (!columns.stock || !columns.quantity || rows.length === 0) return null
  const stocked = rows.filter((row) => (getNumber(row[columns.stock!]) || 0) > 0)
  if (stocked.length === 0) return null
  const noMovement = stocked.filter((row) => (getNumber(row[columns.quantity!]) || 0) <= 0).length
  return (noMovement / stocked.length) * 100
}

function ratioPercent(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null
  return (numerator / Math.abs(denominator)) * 100
}

function concentrationScore(rows: DataRow[], groupColumn?: string, valueColumn?: string) {
  if (!groupColumn || !valueColumn) return null
  const grouped = groupValues(rows, groupColumn, valueColumn)
  const total = Array.from(grouped.values()).reduce((sum, value) => sum + Math.abs(value), 0)
  if (total === 0 || grouped.size === 0) return null
  const topShare = Math.max(...Array.from(grouped.values()).map((value) => Math.abs(value))) / total * 100
  return scoreLowerIsBetter(topShare, 25, 65)
}

function diversificationScore(rows: DataRow[], groupColumn?: string) {
  if (!groupColumn) return null
  const count = groupedCount(rows, groupColumn)
  if (count === null) return null
  return clamp(40 + count * 10, 40, 90)
}

function trendPercent(rows: DataRow[], dateColumn?: string, valueColumn?: string) {
  const trend = trendValues(rows, dateColumn, valueColumn)
  if (trend.length < 2) return null
  const first = trend[0].value
  const last = trend[trend.length - 1].value
  if (first === 0) return null
  return ((last - first) / Math.abs(first)) * 100
}

function valueTrend(rows: DataRow[], dateColumn?: string, valueColumn?: string): BbscTrend {
  const percent = trendPercent(rows, dateColumn, valueColumn)
  if (percent === null) return "unknown"
  if (percent > 3) return "positive"
  if (percent < -3) return "negative"
  return "stable"
}

function trendValues(rows: DataRow[], dateColumn?: string, valueColumn?: string) {
  if (!dateColumn || !valueColumn) return []
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const date = parseDate(row[dateColumn])
    const value = getNumber(row[valueColumn])
    if (!date || value === null) continue
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    grouped.set(key, (grouped.get(key) || 0) + value)
  }
  return Array.from(grouped.entries()).map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key))
}

function groupValues(rows: DataRow[], groupColumn: string, valueColumn: string) {
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const key = String(row[groupColumn] || "").trim()
    const value = getNumber(row[valueColumn])
    if (!key || value === null) continue
    grouped.set(key, (grouped.get(key) || 0) + value)
  }
  return grouped
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function parseDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function isRecord(value: unknown): value is DataRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
