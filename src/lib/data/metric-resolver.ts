import {
  buildSemanticSchema,
  parseBusinessNumber,
  semanticColumn,
  type SemanticField,
  type SemanticSchema,
} from "@/lib/data/semantic-schema";
import {
  buildBusinessSemanticProfile,
  conceptColumn,
} from "@/lib/data/business-semantics";
import {
  classifyQuestionIntent,
  type QuestionIntent,
  type QuestionIntentClassification,
} from "@/lib/data/question-intent-engine";

export type MetricResolutionResult =
  | {
      status: "success";
      intent: QuestionIntent;
      classification: QuestionIntentClassification;
      answer: string;
      insight: string;
      takeaway: string;
      nextQuestion: string;
      explanation: string;
      data: Array<Record<string, string | number | null>>;
      chartType: "kpi" | "table";
      result: Record<string, unknown>;
    }
  | {
      status: "unsupported";
      intent: QuestionIntent;
      classification: QuestionIntentClassification;
      missingFields: string[];
      message: string;
      schema: Pick<SemanticSchema, "datasetId" | "datasetType" | "mappings" | "ambiguous" | "currencyCode" | "mixedCurrency">;
    }
  | {
      status: "not_matched";
      intent: "unknown";
      classification: QuestionIntentClassification;
    };

type MetricResolverInput = {
  question: string;
  datasetId: string;
  datasetType: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type RequiredMetric = SemanticField | "margin" | "any_region";
type RevenuePeriodRow = { period: string; revenue: number; rows: number; complete?: boolean };

export function resolveQuestionMetric(input: MetricResolverInput): MetricResolutionResult {
  const classification = classifyQuestionIntent(input.question);
  if (classification.intent === "unknown") return { status: "not_matched", intent: "unknown", classification };

  const schema = buildSemanticSchema(input);
  const missingFields = missingRequiredFields(classification.intent, schema);
  if (missingFields.length > 0) {
    return unsupported(classification, schema, missingFields);
  }

  const result = calculateIntent({ ...input, schema, classification });
  if (!result) return unsupported(classification, schema, ["supported calculation"]);

  return validateAnswer(result, classification, schema);
}

function calculateIntent(input: MetricResolverInput & {
  schema: SemanticSchema;
  classification: QuestionIntentClassification;
}): MetricResolutionResult | null {
  const { intent } = input.classification;
  if (intent === "metric.total_revenue") return totalRevenue(input);
  if (intent === "metric.average_order_value") return averageOrderValue(input);
  if (intent === "metric.average_selling_price") return averageSellingPrice(input);
  if (intent === "metric.total_orders") return totalOrders(input);
  if (intent === "metric.total_customers") return totalCustomers(input);
  if (intent === "analysis.revenue_by_country") return groupedRevenue(input, "country");
  if (intent === "analysis.revenue_by_category") return groupedRevenue(input, "category");
  if (intent === "ranking.top_customers") return groupedRevenue(input, "customer", "Top customers");
  if (intent === "ranking.top_products") return groupedRevenue(input, "product", "Top products");
  if (intent === "ranking.top_regions") return groupedRevenue(input, bestAvailableDimension(input.schema, ["region", "country"]), "Top regions");
  if (intent === "analysis.sales_concentration") return concentration(input, bestAvailableDimension(input.schema, ["customer", "product", "region", "country", "category"]));
  if (intent === "risk.customer_concentration") return concentration(input, "customer");
  if (intent === "risk.revenue") return revenueRisk(input);
  if (intent === "trend.monthly_revenue") return monthlyRevenue(input);
  if (intent === "trend.customer_growth") return customerGrowth(input);
  if (intent === "forecast.revenue") return revenueForecastBaseline(input);
  if (intent === "comparison.segment") return groupedRevenue(input, fallbackGrouping(input, ["category", "customer", "product"]));
  if (intent === "comparison.region") return groupedRevenue(input, bestAvailableDimension(input.schema, ["region", "country"]));
  if (intent === "comparison.period") return monthlyRevenue(input);
  if (intent === "analysis.margin") return marginAnalysis(input);
  return null;
}

function totalRevenue(input: MetricInput): MetricResolutionResult {
  const revenueColumn = requiredColumn(input.schema, "revenue");
  const total = sum(input.rows, revenueColumn);
  if (isInvestorPortfolioAnnualRevenueMetric(input, revenueColumn)) {
    return success(input, {
      metricLabel: "Combined portfolio company annual revenue",
      answer: `Combined annual revenue of the portfolio companies is ${formatValue(total, input.schema.currencyCode)}.`,
      insight: `UseClevr summed ${input.rows.length.toLocaleString("en-US")} validated portfolio company row${input.rows.length === 1 ? "" : "s"} from "${revenueColumn}".`,
      takeaway: "This is portfolio-company annual revenue, not investor revenue.",
      nextQuestion: "Ask: Which portfolio companies generate the most annual revenue?",
      data: [{ metric: "Combined portfolio company annual revenue", value: round(total), unit: input.schema.currencyCode ?? "number", sourceColumn: revenueColumn }],
      chartType: "kpi",
      result: {
        portfolioCompanyAnnualRevenue: round(total),
        revenueColumn,
        annualRevenueColumn: revenueColumn,
        lineage: [revenueColumn],
      },
    });
  }
  if (isMarketplaceGmvMetric(input, revenueColumn)) {
    return success(input, {
      metricLabel: "Total GMV",
      answer: `Total GMV is ${formatValue(total, input.schema.currencyCode)}.`,
      insight: `UseClevr summed ${input.rows.length.toLocaleString("en-US")} validated row${input.rows.length === 1 ? "" : "s"} from "${revenueColumn}".`,
      takeaway: "GMV is gross merchandise value, not generic company revenue.",
      nextQuestion: "Ask: Which buyers or sellers drive the most GMV?",
      data: [{ metric: "Total GMV", value: round(total), unit: input.schema.currencyCode ?? "number" }],
      chartType: "kpi",
      result: { gmv: round(total), gmvColumn: revenueColumn, revenueColumn },
    });
  }
  return success(input, {
    metricLabel: "Total revenue",
    answer: `Total revenue is ${formatValue(total, input.schema.currencyCode)}.`,
    insight: `UseClevr summed ${input.rows.length.toLocaleString("en-US")} validated row${input.rows.length === 1 ? "" : "s"} from "${revenueColumn}".`,
    takeaway: "This is the full detected revenue total for the selected dataset.",
    nextQuestion: "Ask: What is average order value?",
    data: [{ metric: "Total revenue", value: round(total), unit: input.schema.currencyCode ?? "number" }],
    chartType: "kpi",
    result: { revenue: round(total), revenueColumn },
  });
}

function averageOrderValue(input: MetricInput): MetricResolutionResult {
  const revenueColumn = requiredColumn(input.schema, "revenue");
  const orderColumn = findOrderColumn(input.columns);
  if (!orderColumn) {
    return unsupported(input.classification, input.schema, ["reliable order identifier"]);
  }
  const revenue = sum(input.rows, revenueColumn);
  const orderCount = distinctCount(input.rows, orderColumn);
  const aov = orderCount === 0 ? 0 : revenue / orderCount;
  const marketplaceGmv = isMarketplaceGmvMetric(input, revenueColumn);
  return success(input, {
    metricLabel: marketplaceGmv ? "Average Transaction Value" : "Average Order Value",
    answer: `${marketplaceGmv ? "Average Transaction Value" : "Average Order Value"} is ${formatValue(aov, input.schema.currencyCode)}.`,
    insight: `Calculation: ${formatValue(revenue, input.schema.currencyCode)} ${marketplaceGmv ? "GMV" : "revenue"} divided by ${orderCount.toLocaleString("en-US")} distinct orders from "${orderColumn}".`,
    takeaway: marketplaceGmv ? "Average Transaction Value measures average GMV per marketplace transaction." : "AOV measures the average revenue per order, not total revenue.",
    nextQuestion: marketplaceGmv ? "Ask: Which buyers or sellers drive the most GMV?" : "Ask: Which customers have the highest average order value?",
    data: [
      { metric: marketplaceGmv ? "Average Transaction Value" : "Average Order Value", value: round(aov), unit: input.schema.currencyCode ?? "number" },
      { metric: marketplaceGmv ? "GMV" : "Revenue", value: round(revenue), unit: input.schema.currencyCode ?? "number" },
      { metric: "Order count", value: orderCount, unit: "count" },
    ],
    chartType: "kpi",
    result: marketplaceGmv
      ? { averageTransactionValue: round(aov), gmv: round(revenue), orderCount, gmvColumn: revenueColumn, revenueColumn, orderColumn }
      : { averageOrderValue: round(aov), revenue: round(revenue), orderCount, revenueColumn, orderColumn },
  });
}

function averageSellingPrice(input: MetricInput): MetricResolutionResult {
  const revenueColumn = requiredColumn(input.schema, "revenue");
  const quantityColumn = requiredColumn(input.schema, "quantity");
  const revenue = sum(input.rows, revenueColumn);
  const quantity = sum(input.rows, quantityColumn);
  const asp = quantity === 0 ? 0 : revenue / quantity;
  const marketplaceGmv = isMarketplaceGmvMetric(input, revenueColumn);
  return success(input, {
    metricLabel: "Average Selling Price",
    answer: `Average selling price is ${formatValue(asp, input.schema.currencyCode)}.`,
    insight: `Calculation: ${formatValue(revenue, input.schema.currencyCode)} ${marketplaceGmv ? "GMV" : "revenue"} divided by ${formatNumber(quantity)} units.`,
    takeaway: marketplaceGmv ? "ASP measures average GMV per marketplace unit sold." : "ASP measures average revenue per unit sold.",
    nextQuestion: "Ask: Which products have the highest average selling price?",
    data: [
      { metric: "Average selling price", value: round(asp), unit: input.schema.currencyCode ?? "number" },
      { metric: "Units", value: round(quantity), unit: "count" },
    ],
    chartType: "kpi",
    result: marketplaceGmv
      ? { averageSellingPrice: round(asp), gmv: round(revenue), quantity: round(quantity), gmvColumn: revenueColumn, revenueColumn, quantityColumn }
      : { averageSellingPrice: round(asp), revenue: round(revenue), quantity: round(quantity), revenueColumn, quantityColumn },
  });
}

function totalOrders(input: MetricInput): MetricResolutionResult {
  const orderColumn = findOrderColumn(input.columns);
  const orderCount = orderColumn ? distinctCount(input.rows, orderColumn) : input.rows.length;
  return success(input, {
    metricLabel: "Total orders",
    answer: `Total orders: ${orderCount.toLocaleString("en-US")}.`,
    insight: orderColumn ? `Counted distinct values in "${orderColumn}".` : "No order ID column was detected, so each row is treated as one order.",
    takeaway: "This answers order volume, not revenue.",
    nextQuestion: "Ask: What is average order value?",
    data: [{ metric: "Total orders", value: orderCount, unit: "count" }],
    chartType: "kpi",
    result: { orderCount, orderColumn },
  });
}

function totalCustomers(input: MetricInput): MetricResolutionResult {
  const customerColumn = requiredColumn(input.schema, "customer");
  const customerCount = distinctCount(input.rows, customerColumn);
  return success(input, {
    metricLabel: "Total customers",
    answer: `Total customers: ${customerCount.toLocaleString("en-US")}.`,
    insight: `Counted distinct values in "${customerColumn}".`,
    takeaway: "This is the detected customer base in the selected dataset.",
    nextQuestion: "Ask: Who are the top customers?",
    data: [{ metric: "Total customers", value: customerCount, unit: "count" }],
    chartType: "kpi",
    result: { customerCount, customerColumn },
  });
}

function groupedRevenue(input: MetricInput, field: SemanticField | null, label?: string): MetricResolutionResult | null {
  if (!field) return null;
  const revenueColumn = requiredColumn(input.schema, "revenue");
  const groupColumn = requiredColumn(input.schema, field);
  const rows = groupByRevenue(input.rows, groupColumn, revenueColumn).slice(0, 10);
  const top = rows[0];
  const marketplaceGmv = isMarketplaceGmvMetric(input, revenueColumn);
  const valueLabel = marketplaceGmv ? "GMV" : "revenue";
  const title = marketplaceGmv
    ? marketplaceRankingTitle(field, groupColumn)
    : label ?? `Revenue by ${humanize(field)}`;
  return success(input, {
    metricLabel: title,
    answer: top
      ? `${title}: ${top.segment} leads with ${formatValue(top.revenue, input.schema.currencyCode)}.`
      : `${title}: no grouped values were found.`,
    insight: `Grouped by "${groupColumn}" and summed ${valueLabel} from "${revenueColumn}".`,
    takeaway: top ? `${top.segment} represents ${top.sharePct.toFixed(1)}% of detected ${valueLabel}.` : `No grouped ${valueLabel} could be calculated.`,
    nextQuestion: marketplaceGmv ? "Ask: Which sellers or buyers drive the most GMV?" : `Ask: What are the biggest ${humanize(field).toLowerCase()} risks?`,
    data: rows.map((row) => ({
      segment: row.segment,
      [marketplaceGmv ? "gmv" : "revenue"]: round(row.revenue),
      rows: row.rows,
      sharePct: round(row.sharePct, 1),
    })),
    chartType: "table",
    result: marketplaceGmv
      ? {
          groupBy: marketplaceGroupBy(field, groupColumn),
          groupColumn,
          gmvColumn: revenueColumn,
          revenueColumn,
          rows: rows.map((row) => ({ segment: row.segment, gmv: row.revenue, rows: row.rows, sharePct: row.sharePct })),
        }
      : { groupBy: field, groupColumn, revenueColumn, rows },
  });
}

function concentration(input: MetricInput, field: SemanticField | null): MetricResolutionResult | null {
  if (!field) return null;
  const grouped = groupedRevenue(input, field, `${humanize(field)} concentration`);
  if (!grouped || grouped.status !== "success") return grouped;
  const marketplaceGmv = typeof grouped.result.gmvColumn === "string";
  const rows = grouped.result.rows as Array<{ segment: string; sharePct: number; revenue?: number; gmv?: number; rows: number }>;
  const top = rows[0];
  const valueLabel = marketplaceGmv ? "GMV" : "revenue";
  return {
    ...grouped,
    answer: top
      ? `Answer: ${humanize(field)} concentration: ${top.segment} accounts for ${top.sharePct.toFixed(1)}% of detected ${valueLabel}.\n\nInsight: ${top.sharePct >= 50 ? "The dataset shows high concentration risk." : "The dataset does not show a single dominant concentration above 50%."}\n\nTakeaway: ${top.sharePct >= 50 ? "Review dependency on the leading segment." : `${valueLabel} appears more distributed across this dimension.`}\n\nNext question: Ask: What are the biggest ${marketplaceGmv ? "GMV" : "revenue"} risks?`
      : grouped.answer,
    insight: top && top.sharePct >= 50 ? "The dataset shows high concentration risk." : "The dataset does not show a single dominant concentration above 50%.",
    takeaway: top && top.sharePct >= 50 ? "Review dependency on the leading segment." : `${valueLabel} appears more distributed across this dimension.`,
    result: { ...grouped.result, concentrationSegment: top?.segment ?? null, concentrationSharePct: top?.sharePct ?? null },
  };
}

function revenueRisk(input: MetricInput): MetricResolutionResult {
  const revenueColumn = requiredColumn(input.schema, "revenue");
  const marketplaceGmv = isMarketplaceGmvMetric(input, revenueColumn);
  const trendRows = revenueDeclines(input.rows, revenueColumn);
  const concentrationResult = concentration(input, bestAvailableDimension(input.schema, ["customer", "product", "region", "country", "category"]));
  const concentrationRows = concentrationResult?.status === "success"
    ? (concentrationResult.result.rows as Array<{ segment: string; sharePct: number; revenue?: number; gmv?: number }>)
    : [];
  const risks = [
    ...trendRows.map((row) => ({
      risk: marketplaceGmv ? "GMV decline" : "Revenue decline",
      detail: `${row.previousPeriod} to ${row.currentPeriod}`,
      value: row.changePct,
      [marketplaceGmv ? "gmv" : "revenue"]: row.currentRevenue,
    })),
    ...concentrationRows.slice(0, 3).filter((row) => row.sharePct >= 35).map((row) => ({
      risk: marketplaceGmv ? "GMV concentration" : "Revenue concentration",
      detail: row.segment,
      value: row.sharePct,
      [marketplaceGmv ? "gmv" : "revenue"]: (marketplaceGmv ? row.gmv : row.revenue) ?? null,
    })),
  ];
  return success(input, {
    metricLabel: marketplaceGmv ? "GMV risks" : "Revenue risks",
    answer: risks[0]
      ? `Biggest ${marketplaceGmv ? "GMV" : "revenue"} risk: ${risks[0].detail} (${formatSignedPercent(Number(risks[0].value))}).`
      : `No major ${marketplaceGmv ? "GMV" : "revenue"} risk signal was found from the validated fields.`,
    insight: `UseClevr checked ${marketplaceGmv ? "GMV" : "revenue"} movements and concentration from "${revenueColumn}".`,
    takeaway: risks.length > 0 ? "Prioritize the largest decline or concentration signal first." : `Ask for ${marketplaceGmv ? "GMV" : "revenue"} by segment to inspect risk in more detail.`,
    nextQuestion: marketplaceGmv ? "Ask: Which marketplace segments are declining by GMV?" : "Ask: Which segments are declining?",
    data: risks,
    chartType: "table",
    result: marketplaceGmv ? { risks, gmvColumn: revenueColumn, revenueColumn } : { risks, revenueColumn },
  });
}

function monthlyRevenue(input: MetricInput): MetricResolutionResult {
  const revenueColumn = requiredColumn(input.schema, "revenue");
  const dateColumn = requiredColumn(input.schema, "date");
  if (!isCompatibleTrendAxis(input, revenueColumn, dateColumn)) {
    return incompatibleRevenueTrend(input, revenueColumn, dateColumn);
  }
  const marketplaceGmv = isMarketplaceGmvMetric(input, revenueColumn);
  const rows: RevenuePeriodRow[] = marketplaceGmv ? groupByObservedPeriod(input.rows, dateColumn, revenueColumn) : groupByPeriod(input.rows, dateColumn, revenueColumn);
  const latest = rows.at(-1);
  const completeRows = marketplaceGmv ? rows.filter((row) => row.complete) : rows;
  const latestComparable = completeRows.at(-1) ?? latest;
  const previousComparable = completeRows.length >= 2 ? completeRows.at(-2) : rows.at(-2);
  const changePct = latestComparable && previousComparable && previousComparable.revenue !== 0
    ? ((latestComparable.revenue - previousComparable.revenue) / previousComparable.revenue) * 100
    : null;
  const latestPartial = marketplaceGmv && latest ? latest.complete === false : false;
  const partialPeriodText = latestPartial
    ? `${formatMonthLabel(latest?.period ?? "")} is the latest observed period and appears partial. ${latestComparable && latestComparable.period !== latest?.period ? `${formatMonthLabel(latestComparable.period)} is the latest complete comparable period. ` : ""}`
    : "";
  return success(input, {
    metricLabel: marketplaceGmv ? "GMV trend" : "Monthly revenue trend",
    answer: latest
      ? `${partialPeriodText}${marketplaceGmv ? "Latest Monthly GMV" : "Latest monthly revenue"} is ${formatValue(latest.revenue, input.schema.currencyCode)} in ${latest.period}${changePct === null || (latestPartial && latestComparable?.period !== latest.period) ? "" : ` (${formatSignedPercent(changePct)} vs previous period)`}.`
      : marketplaceGmv ? "GMV trend could not be calculated." : "Monthly revenue trend could not be calculated.",
    insight: `Grouped "${revenueColumn}" by "${dateColumn}".`,
    takeaway: marketplaceGmv
      ? latestPartial
        ? "The latest observed period is shown as partial and kept separate from complete-period GMV movement."
        : changePct === null ? "More complete periods improve GMV trend interpretation." : changePct < 0 ? "GMV declined in the latest comparable period." : "GMV increased in the latest comparable period."
      : changePct === null ? "More complete periods improve trend interpretation." : changePct < 0 ? "Revenue declined in the latest comparable period." : "Revenue increased in the latest comparable period.",
    nextQuestion: marketplaceGmv ? "Ask: Which buyers or sellers drive the most GMV?" : "Ask: What are the biggest revenue risks?",
    data: rows.map((row) => ({
      period: row.period,
      [marketplaceGmv ? "gmv" : "revenue"]: round(row.revenue),
      rows: row.rows,
      ...(marketplaceGmv ? { completeness: row.complete === false ? "partial" : "complete" } : {}),
    })),
    chartType: "table",
    result: marketplaceGmv
      ? {
          periods: rows.map((row) => ({ period: row.period, gmv: row.revenue, rows: row.rows, complete: row.complete !== false })),
          latestObservedPeriod: latest?.period ?? null,
          latestObservedGmv: latest?.revenue ?? null,
          latestObservedComplete: latest ? latest.complete !== false : null,
          latestComparablePeriod: latestComparable?.period ?? null,
          latestChangePct: changePct === null ? null : round(changePct, 1),
          gmvColumn: revenueColumn,
          revenueColumn,
          dateColumn,
        }
      : { periods: rows, latestChangePct: changePct === null ? null : round(changePct, 1), revenueColumn, dateColumn },
  });
}

function customerGrowth(input: MetricInput): MetricResolutionResult {
  const customerColumn = requiredColumn(input.schema, "customer");
  const dateColumn = requiredColumn(input.schema, "date");
  const groups = new Map<string, Set<string>>();
  for (const row of input.rows) {
    const period = monthKey(row[dateColumn]);
    const customer = String(row[customerColumn] ?? "").trim();
    if (!period || !customer) continue;
    const current = groups.get(period) ?? new Set<string>();
    current.add(customer);
    groups.set(period, current);
  }
  const rows = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([period, values]) => ({ period, customers: values.size }));
  const latest = rows.at(-1);
  return success(input, {
    metricLabel: "Customer growth",
    answer: latest ? `Latest customer count is ${latest.customers.toLocaleString("en-US")} in ${latest.period}.` : "Customer growth could not be calculated.",
    insight: `Counted distinct "${customerColumn}" values by "${dateColumn}".`,
    takeaway: "This answers customer growth, not revenue.",
    nextQuestion: "Ask: Who are the top customers?",
    data: rows,
    chartType: "table",
    result: { periods: rows, customerColumn, dateColumn },
  });
}

function revenueForecastBaseline(input: MetricInput): MetricResolutionResult {
  const trend = monthlyRevenue(input);
  if (trend.status !== "success") return trend;
  return {
    ...trend,
    answer: `${trend.answer} UseClevr has not generated a modelled forecast from this chat request, so this is a grounded baseline only.`,
    insight: "Forecast intent detected; deterministic trend baseline returned without inventing future values.",
    takeaway: "Use the forecast workflow for modelled future-period projections.",
    result: { ...trend.result, forecastGenerated: false },
  };
}

function marginAnalysis(input: MetricInput): MetricResolutionResult {
  const revenueColumn = requiredColumn(input.schema, "revenue");
  const grossMarginColumn = semanticColumn(input.schema, "gross_margin");
  const grossProfitColumn = semanticColumn(input.schema, "gross_profit");
  const cogsColumn = semanticColumn(input.schema, "cogs");
  if (!grossMarginColumn && !grossProfitColumn && !cogsColumn) {
    return unsupported(input.classification, input.schema, ["Cost, Gross Profit, or Margin"]);
  }
  const groupField = fallbackGrouping(input, ["customer", "product", "category", "region", "country"]);
  const groupColumn = groupField ? semanticColumn(input.schema, groupField) : null;
  const grouped = groupColumn ? groupByMargin(input.rows, groupColumn, revenueColumn, cogsColumn, grossProfitColumn, grossMarginColumn) : [];
  const totalRevenue = sum(input.rows, revenueColumn);
  const totalMargin = calculateMargin(input.rows, revenueColumn, cogsColumn, grossProfitColumn, grossMarginColumn);
  const top = grouped[0];
  return success(input, {
    metricLabel: "Margin analysis",
    answer: top
      ? `Highest margin: ${top.segment} at ${top.marginPct.toFixed(1)}%.`
      : `Overall margin is ${totalMargin === null ? "not available" : `${totalMargin.toFixed(1)}%`}.`,
    insight: groupColumn ? `Grouped margin by "${groupColumn}".` : "Calculated overall margin from validated financial fields.",
    takeaway: "Margin analysis uses revenue plus cost, gross profit, or margin fields. It does not use revenue alone.",
    nextQuestion: "Ask: Which products have the highest margin?",
    data: grouped.length ? grouped.slice(0, 10) : [{ metric: "Overall margin", value: totalMargin, revenue: round(totalRevenue) }],
    chartType: grouped.length ? "table" : "kpi",
    result: { marginPct: totalMargin, rows: grouped, revenueColumn, cogsColumn, grossProfitColumn, grossMarginColumn, groupColumn },
  });
}

type MetricInput = MetricResolverInput & {
  schema: SemanticSchema;
  classification: QuestionIntentClassification;
};

function success(input: MetricInput, output: {
  metricLabel: string;
  answer: string;
  insight: string;
  takeaway: string;
  nextQuestion: string;
  explanation?: string;
  data: Array<Record<string, string | number | null>>;
  chartType: "kpi" | "table";
  result: Record<string, unknown>;
}): MetricResolutionResult {
  return {
    status: "success",
    intent: input.classification.intent,
    classification: input.classification,
    answer: `Answer: ${output.answer}\n\nInsight: ${output.insight}\n\nTakeaway: ${output.takeaway}\n\nNext question: ${output.nextQuestion}`,
    insight: output.insight,
    takeaway: output.takeaway,
    nextQuestion: output.nextQuestion,
    explanation: output.explanation ?? `Intent ${input.classification.intent} resolved to ${output.metricLabel}. Calculations use validated dataset values only.`,
    data: output.data,
    chartType: output.chartType,
    result: {
      intent: input.classification.intent,
      confidence: input.classification.confidence,
      extractedDimensions: input.classification.extractedDimensions,
      extractedMetrics: input.classification.extractedMetrics,
      requestedTimePeriod: input.classification.requestedTimePeriod,
      requestedGrouping: input.classification.requestedGrouping,
      metric: output.metricLabel,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      ...output.result,
    },
  };
}

function validateAnswer(
  result: MetricResolutionResult,
  classification: QuestionIntentClassification,
  schema: SemanticSchema,
): MetricResolutionResult {
  if (result.status !== "success") return result;
  if (result.intent !== classification.intent) return unsupported(classification, schema, ["requested metric"]);
  if (!String(result.result.metric ?? "").trim()) return unsupported(classification, schema, ["calculated metric"]);
  if (!result.answer.toLowerCase().includes("answer:")) return unsupported(classification, schema, ["answer"]);
  return result;
}

function missingRequiredFields(intent: QuestionIntent, schema: SemanticSchema): string[] {
  const requiredByIntent: Partial<Record<QuestionIntent, RequiredMetric[]>> = {
    "metric.total_revenue": ["revenue"],
    "metric.average_order_value": ["revenue"],
    "metric.average_selling_price": ["revenue", "quantity"],
    "metric.total_orders": [],
    "metric.total_customers": ["customer"],
    "analysis.sales_concentration": ["revenue"],
    "analysis.revenue_by_country": ["revenue", "country"],
    "analysis.revenue_by_category": ["revenue", "category"],
    "ranking.top_customers": ["revenue", "customer"],
    "ranking.top_products": ["revenue", "product"],
    "ranking.top_regions": ["revenue", "any_region"],
    "risk.revenue": ["revenue"],
    "risk.customer_concentration": ["revenue", "customer"],
    "trend.monthly_revenue": ["revenue", "date"],
    "trend.customer_growth": ["customer", "date"],
    "forecast.revenue": ["revenue", "date"],
    "comparison.segment": ["revenue"],
    "comparison.region": ["revenue", "any_region"],
    "comparison.period": ["revenue", "date"],
    "analysis.margin": ["revenue", "margin"],
  };
  return (requiredByIntent[intent] ?? []).filter((field) => !hasRequired(field, schema)).map(String);
}

function hasRequired(field: RequiredMetric, schema: SemanticSchema) {
  if (field === "margin") return Boolean(semanticColumn(schema, "cogs") || semanticColumn(schema, "gross_profit") || semanticColumn(schema, "gross_margin"));
  if (field === "any_region") return Boolean(semanticColumn(schema, "region") || semanticColumn(schema, "country"));
  return Boolean(semanticColumn(schema, field));
}

function unsupported(
  classification: QuestionIntentClassification,
  schema: SemanticSchema,
  missingFields: string[],
): MetricResolutionResult {
  const readable = missingFields.join(", ");
  return {
    status: "unsupported",
    intent: classification.intent,
    classification,
    missingFields,
    message: `I understood the question as ${classification.intent}, but cannot calculate it because the dataset is missing: ${readable}.`,
    schema: {
      datasetId: schema.datasetId,
      datasetType: schema.datasetType,
      mappings: schema.mappings,
      ambiguous: schema.ambiguous,
      currencyCode: schema.currencyCode,
      mixedCurrency: schema.mixedCurrency,
    },
  };
}

function requiredColumn(schema: SemanticSchema, field: SemanticField) {
  const column = semanticColumn(schema, field);
  if (!column) throw new Error(`Missing required semantic column ${field}.`);
  return column;
}

function findOrderColumn(columns: string[]) {
  return columns.find((column) => {
    const normalized = column.toLowerCase().trim().replace(/[\s-]+/g, "_");
    return /^(order_id|order_number|transaction_id|transaction_number|sale_id|receipt_id|invoice_id|invoice_number)$/.test(normalized);
  }) ?? null;
}

function sum(rows: Record<string, unknown>[], column: string) {
  return rows.reduce((total, row) => total + (parseBusinessNumber(row[column]) ?? 0), 0);
}

function distinctCount(rows: Record<string, unknown>[], column: string) {
  return new Set(rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean)).size;
}

function groupByRevenue(rows: Record<string, unknown>[], groupColumn: string, revenueColumn: string) {
  const totalRevenue = sum(rows, revenueColumn);
  const groups = new Map<string, { revenue: number; rows: number }>();
  for (const row of rows) {
    const segment = String(row[groupColumn] ?? "Unknown").trim() || "Unknown";
    const current = groups.get(segment) ?? { revenue: 0, rows: 0 };
    current.revenue += parseBusinessNumber(row[revenueColumn]) ?? 0;
    current.rows += 1;
    groups.set(segment, current);
  }
  return Array.from(groups.entries())
    .map(([segment, value]) => ({
      segment,
      revenue: round(value.revenue),
      rows: value.rows,
      sharePct: totalRevenue > 0 ? round((value.revenue / totalRevenue) * 100, 1) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function groupByMargin(
  rows: Record<string, unknown>[],
  groupColumn: string,
  revenueColumn: string,
  cogsColumn: string | null,
  grossProfitColumn: string | null,
  grossMarginColumn: string | null,
) {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const segment = String(row[groupColumn] ?? "Unknown").trim() || "Unknown";
    groups.set(segment, [...(groups.get(segment) ?? []), row]);
  }
  return Array.from(groups.entries())
    .map(([segment, groupRows]) => ({
      segment,
      marginPct: calculateMargin(groupRows, revenueColumn, cogsColumn, grossProfitColumn, grossMarginColumn),
      revenue: round(sum(groupRows, revenueColumn)),
      rows: groupRows.length,
    }))
    .filter((row): row is { segment: string; marginPct: number; revenue: number; rows: number } => row.marginPct !== null)
    .sort((a, b) => b.marginPct - a.marginPct);
}

function calculateMargin(
  rows: Record<string, unknown>[],
  revenueColumn: string,
  cogsColumn: string | null,
  grossProfitColumn: string | null,
  grossMarginColumn: string | null,
) {
  if (grossMarginColumn) {
    const values = rows.map((row) => parseBusinessNumber(row[grossMarginColumn])).filter((value): value is number => value !== null);
    if (values.length === 0) return null;
    const average = values.reduce((total, value) => total + (Math.abs(value) <= 1 ? value * 100 : value), 0) / values.length;
    return round(average, 1);
  }
  const revenue = sum(rows, revenueColumn);
  if (revenue === 0) return null;
  if (grossProfitColumn) return round((sum(rows, grossProfitColumn) / revenue) * 100, 1);
  if (cogsColumn) return round(((revenue - sum(rows, cogsColumn)) / revenue) * 100, 1);
  return null;
}

function groupByPeriod(rows: Record<string, unknown>[], dateColumn: string, revenueColumn: string) {
  const completePeriods = completePeriodKeys(rows, dateColumn);
  const groups = new Map<string, { revenue: number; rows: number }>();
  for (const row of rows) {
    const period = monthKey(row[dateColumn]);
    if (!period) continue;
    if (completePeriods.size > 0 && !completePeriods.has(period)) continue;
    const current = groups.get(period) ?? { revenue: 0, rows: 0 };
    current.revenue += parseBusinessNumber(row[revenueColumn]) ?? 0;
    current.rows += 1;
    groups.set(period, current);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => ({ period, revenue: round(value.revenue), rows: value.rows }));
}

function groupByObservedPeriod(rows: Record<string, unknown>[], dateColumn: string, revenueColumn: string) {
  const groups = new Map<string, { revenue: number; rows: number }>();
  for (const row of rows) {
    const period = monthKey(row[dateColumn]);
    if (!period) continue;
    const current = groups.get(period) ?? { revenue: 0, rows: 0 };
    current.revenue += parseBusinessNumber(row[revenueColumn]) ?? 0;
    current.rows += 1;
    groups.set(period, current);
  }
  const groupedRows = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, revenue: round(value.revenue), rows: value.rows, complete: true }));
  if (groupedRows.length <= 1) return groupedRows;
  const maxRows = Math.max(...groupedRows.map((row) => row.rows));
  return groupedRows.map((row) => ({
    ...row,
    complete: row.rows >= maxRows * 0.8,
  }));
}

function revenueDeclines(rows: Record<string, unknown>[], revenueColumn: string) {
  const dateColumn = Object.keys(rows[0] ?? {}).find((column) => /date|month|period/i.test(column));
  if (!dateColumn) return [];
  const periods = groupByPeriod(rows, dateColumn, revenueColumn);
  return periods.slice(1).map((current, index) => {
    const previous = periods[index];
    const changePct = previous.revenue === 0 ? 0 : ((current.revenue - previous.revenue) / previous.revenue) * 100;
    return { previousPeriod: previous.period, currentPeriod: current.period, previousRevenue: previous.revenue, currentRevenue: current.revenue, changePct: round(changePct, 1) };
  }).filter((row) => row.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 3);
}

function completePeriodKeys(rows: Record<string, unknown>[], dateColumn: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const period = monthKey(row[dateColumn]);
    if (!period) continue;
    counts.set(period, (counts.get(period) ?? 0) + 1);
  }
  const entries = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length <= 2) return new Set(entries.map(([period]) => period));
  const maxCount = Math.max(...entries.map(([, count]) => count));
  const trailingPeriod = entries[entries.length - 1]?.[0];
  return new Set(entries
    .filter(([period, count]) => period !== trailingPeriod || count >= maxCount * 0.5)
    .map(([period]) => period));
}

function bestAvailableDimension(schema: SemanticSchema, fields: SemanticField[]) {
  return fields.find((field) => Boolean(semanticColumn(schema, field))) ?? null;
}

function isMarketplaceGmvMetric(input: MetricInput, column: string) {
  if (!/^(gmv|gross_merchandise_value|gross_merchandise)$/i.test(normalizedColumn(column))) return false;
  const profile = businessSemanticProfile(input);
  return profile.classification.datasetType === "marketplace" && conceptColumn(profile, "gmv") === column;
}

function isInvestorPortfolioAnnualRevenueMetric(input: MetricInput, column: string) {
  if (!/^(annual_revenue|portfolio_company_revenue|company_revenue|portfolio_company_annual_revenue)$/i.test(normalizedColumn(column))) return false;
  const profile = businessSemanticProfile(input);
  return profile.classification.datasetType === "investor" && conceptColumn(profile, "portfolio_company_annual_revenue") === column;
}

function isCompatibleTrendAxis(input: MetricInput, metricColumn: string, timeColumn: string) {
  const profile = businessSemanticProfile(input);
  const metricConcept = conceptForSourceColumn(profile, metricColumn);
  const timeConcept = conceptForSourceColumn(profile, timeColumn);
  if (!metricConcept || !timeConcept) return true;
  if (metricConcept === "portfolio_company_annual_revenue") {
    return isRevenueMeasurementTimeColumn(timeColumn) && timeConcept !== "investment_date";
  }
  if (timeConcept === "investment_date") {
    return ![
      "revenue",
      "gross_sales",
      "net_sales",
      "gross_profit",
      "operating_profit",
      "net_profit",
      "gmv",
      "marketplace_revenue",
      "subscription_revenue",
      "mrr",
      "arr",
      "portfolio_company_annual_revenue",
    ].includes(metricConcept);
  }
  return true;
}

function incompatibleRevenueTrend(input: MetricInput, revenueColumn: string, dateColumn: string): MetricResolutionResult {
  return success(input, {
    metricLabel: "Revenue trend unavailable",
    answer: `Revenue trends over time cannot be calculated from this dataset. The dataset contains annual revenue for portfolio companies, but no validated historical revenue measurement period. "${dateColumn}" represents when the investment was made and is not a revenue reporting period.`,
    insight: `UseClevr rejected grouping "${revenueColumn}" by "${dateColumn}" because the metric and time axis have incompatible semantic roles.`,
    takeaway: "A date field alone is insufficient for trend analysis; revenue trends require a revenue, reporting, fiscal, financial, period-end, year, or fiscal-year time dimension.",
    nextQuestion: "Ask: How has investment activity changed over time?",
    data: [
      { metric: "Portfolio company annual revenue", sourceColumn: revenueColumn, status: "available" },
      { metric: "Revenue trend period", sourceColumn: dateColumn, status: "incompatible" },
    ],
    chartType: "table",
    result: {
      status: "incompatible_evidence",
      revenueColumn,
      rejectedTimeColumn: dateColumn,
      metricConcept: "portfolio_company_annual_revenue",
      rejectedTimeConcept: "investment_date",
      requiredTimeConcepts: ["revenue_period", "reporting_period", "fiscal_period", "financial_period", "period_end", "year", "fiscal_year"],
      lineage: [revenueColumn, dateColumn],
    },
    explanation: "The Business Semantics profile permits portfolio-company annual revenue totals, but blocks revenue trend calculation because investment_date is investment activity timing, not revenue measurement timing.",
  });
}

function businessSemanticProfile(input: MetricInput) {
  return buildBusinessSemanticProfile({
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    columns: input.columns,
    rows: input.rows,
  });
}

function conceptForSourceColumn(profile: ReturnType<typeof buildBusinessSemanticProfile>, column: string) {
  return profile.concepts.find((mapping) => mapping.sourceColumn === column && mapping.status === "confirmed")?.concept ?? null;
}

function isRevenueMeasurementTimeColumn(column: string) {
  return /^(revenue_period|reporting_period|fiscal_period|financial_period|period_end|year|fiscal_year)$/i.test(normalizedColumn(column));
}

function marketplaceRankingTitle(field: SemanticField, groupColumn: string) {
  const group = marketplaceGroupBy(field, groupColumn);
  if (field === "customer" && group === "buyer") return "Top buyers/customers by GMV";
  if (group === "buyer") return "Top buyers by GMV";
  if (group === "seller") return "Top sellers by GMV";
  if (field === "customer") return "Top buyers/customers by GMV";
  return `GMV by ${humanize(field)}`;
}

function marketplaceGroupBy(field: SemanticField, groupColumn: string) {
  if (/buyer|purchaser/i.test(groupColumn)) return "buyer";
  if (/seller|merchant|vendor/i.test(groupColumn)) return "seller";
  return field;
}

function fallbackGrouping(input: MetricInput, fields: SemanticField[]) {
  const requested = input.classification.requestedGrouping;
  if (requested) {
    const field = fields.find((candidate) => requested === candidate && semanticColumn(input.schema, candidate));
    if (field) return field;
  }
  return bestAvailableDimension(input.schema, fields);
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

function formatValue(value: number, currencyCode: string | null) {
  if (!currencyCode) return formatNumber(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatMonthLabel(period: string) {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return period;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizedColumn(column: string) {
  return column.toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
