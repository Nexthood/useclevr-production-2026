import { resolveQuestionMetric } from "@/lib/data/metric-resolver";
import {
  buildSemanticSchema,
  detectDatasetSemanticCapabilities,
  findExpenseTypeColumn,
  findMonetaryAmountColumn,
  normalizePercentValue,
  parseBusinessNumber,
  semanticColumn,
} from "@/lib/data/semantic-schema";
import { analyzeTransactionAmountAnomalies } from "@/lib/data/transaction-anomaly-analysis";
import {
  answerRetailInventoryQuestionDeterministically,
  hasRetailInventoryDeterministicCapability,
  isRetailInventoryQuestion,
} from "@/lib/data/retail-inventory-intents";
import {
  buildSaasAssistantSummary,
  type SaasAssistantSummary,
} from "@/lib/data/dataset-intelligence-engine";
import {
  buildBusinessSemanticProfile,
  conceptColumn,
} from "@/lib/data/business-semantics";

export type DatasetAssistantDeterministicResult = {
  status: "success";
  answer: string;
  insight: string;
  explanation: string;
  recommendation?: string;
  data: Array<Record<string, string | number | null>>;
  chartType: "kpi" | "table";
  result: Record<string, unknown>;
};

type DatasetAssistantInput = {
  question: string;
  datasetId: string;
  datasetType: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type SegmentSummary = {
  dimension: string;
  segment: string;
  revenue: number;
  rows: number;
  sharePct: number;
};

type PeriodSummary = {
  period: string;
  revenue: number;
  rows: number;
};

type MarketplaceAssistantSummary = {
  gmvColumn: string;
  marketplaceRevenueColumn: string | null;
  buyerColumn: string | null;
  sellerColumn: string | null;
  dateColumn: string | null;
  currencyCode: string | null;
};

type InvestorAssistantSummary = {
  annualRevenueColumn: string | null;
  investmentDateColumn: string | null;
  portfolioCompanyColumn: string | null;
  investedAmountColumn: string | null;
  entryValuationColumn: string | null;
  latestValuationColumn: string | null;
  growthRateColumn: string | null;
  monthlyBurnColumn: string | null;
  runwayColumn: string | null;
  currencyCode: string | null;
};

const DIMENSION_PATTERNS = [
  /plan/i,
  /startup[_\s-]*stage|stage/i,
  /acquisition[_\s-]*channel|channel/i,
  /region/i,
  /country/i,
  /category|segment/i,
  /product|sku|item/i,
  /customer|client/i,
  /seller|vendor|merchant/i,
  /buyer|purchaser/i,
  /order|transaction|invoice/i,
  /channel/i,
];

export function answerDatasetQuestionDeterministically(
  input: DatasetAssistantInput,
): DatasetAssistantDeterministicResult | null {
  const question = input.question.trim();
  if (!question || input.rows.length === 0) return null;

  const marketplaceResult = answerMarketplaceQuestionDeterministically(input);
  if (marketplaceResult) return marketplaceResult;

  const investorResult = answerInvestorQuestionDeterministically(input);
  if (investorResult) return investorResult;

  const retailInventoryResult = answerRetailInventoryQuestionDeterministically(input);
  if (retailInventoryResult) return retailInventoryResult;

  const saasResult = answerSaasQuestionDeterministically(input);
  if (saasResult) return saasResult;

  const resolvedMetric = resolveQuestionMetric(input);
  if (resolvedMetric.status === "success") {
    return {
      status: "success",
      answer: resolvedMetric.answer,
      insight: resolvedMetric.insight,
      explanation: resolvedMetric.explanation,
      recommendation: resolvedMetric.nextQuestion,
      data: resolvedMetric.data,
      chartType: resolvedMetric.chartType,
      result: resolvedMetric.result,
    };
  }
  if (resolvedMetric.status === "unsupported") {
    return {
      status: "success",
      answer: `Answer: ${resolvedMetric.message}\n\nInsight: Required data is missing for the requested metric.\n\nTakeaway: UseClevr will not substitute another metric or return a generic revenue summary.\n\nNext question: Ask about a metric available in the selected dataset.`,
      insight: "Required data is missing for the requested metric.",
      explanation: "The Question Intent Engine classified the question before calculation and the Metric Resolver rejected the calculation because required fields were unavailable.",
      recommendation: "Ask about a metric available in the selected dataset.",
      data: resolvedMetric.missingFields.map((field) => ({ field, status: "missing" })),
      chartType: "table",
      result: {
        intent: resolvedMetric.intent,
        status: "missing_data",
        missingFields: resolvedMetric.missingFields,
        datasetId: input.datasetId,
        datasetType: input.datasetType,
      },
    };
  }

  const schema = buildSemanticSchema(input);
  if (isExpenseQuestion(question)) {
    return describeExpenseCapability({ ...input, schema });
  }

  if (isAnomalyQuestion(question)) {
    return describeTransactionAnomalies({ ...input, schema });
  }

  if (isLargestTransactionQuestion(question)) {
    return describeLargestTransactions({ ...input, schema });
  }

  const revenueColumn = semanticColumn(schema, "revenue");
  if (!revenueColumn) return null;
  const currencyCode = schema.currencyCode;

  const dimensionColumns = findDimensionColumns(input.columns, revenueColumn);
  if (isExplicitRevenueTrendQuestion(question)) {
    return describeRevenueTrend({ ...input, revenueColumn, currencyCode });
  }

  const target = findRequestedSegment(question, input.rows, dimensionColumns);
  if (target) {
    return describeRequestedSegment({ ...input, revenueColumn, currencyCode, dimension: target.dimension, segment: target.segment });
  }

  if (isRevenueRiskQuestion(question)) {
    return describeRevenueRisks({ ...input, revenueColumn, currencyCode, dimensionColumns });
  }

  if (isBestSegmentQuestion(question)) {
    return describeBestSegments({ ...input, revenueColumn, currencyCode, dimensionColumns });
  }

  if (isGrowthQuestion(question)) {
    return describeRevenueTrend({ ...input, revenueColumn, currencyCode });
  }

  if (isForecastQuestion(question)) {
    const trend = describeRevenueTrend({ ...input, revenueColumn, currencyCode });
    if (!trend) return null;
    return {
      ...trend,
      answer: `${trend.answer}\n\nUseClevr has not generated a forecast from this chat request, so I will not invent future values. Use the observed trend above as the grounded baseline.`,
      recommendation: "Open the dataset forecast workflow for modelled future-period projections.",
    };
  }

  if (isDatasetSummaryQuestion(question)) {
    return describeDatasetSummary({ ...input, revenueColumn, currencyCode, dimensionColumns });
  }

  return null;
}

function answerMarketplaceQuestionDeterministically(input: DatasetAssistantInput): DatasetAssistantDeterministicResult | null {
  const summary = buildMarketplaceAssistantSummary(input);
  if (!summary) return null;

  const question = input.question.toLowerCase();
  if (/total\s+revenue|revenue\s+total|how\s+much\s+revenue|total\s+sales|total\s+gmv|\bgmv\b/.test(question)) {
    return describeMarketplaceTotalGmv(input, summary);
  }
  if (/revenue.*trend|gmv.*trend|sales.*trend|revenue.*over\s+time|gmv.*over\s+time|over\s+time/.test(question)) {
    return describeMarketplaceGmvTrend(input, summary);
  }
  if (/customer|buyer|purchaser/.test(question) && /most|top|generate|highest|largest|best/.test(question)) {
    return describeMarketplaceBuyerRanking(input, summary);
  }
  if (/supplier|seller|merchant|vendor/.test(question) && /revenue|gmv|risk|drive|largest|most|top/.test(question)) {
    return describeMarketplaceSellerRanking(input, summary);
  }
  return null;
}

function answerInvestorQuestionDeterministically(input: DatasetAssistantInput): DatasetAssistantDeterministicResult | null {
  const summary = buildInvestorAssistantSummary(input);
  if (!summary) return null;

  const question = input.question.toLowerCase();
  if (/revenue.*trend|sales.*trend|revenue.*over\s+time|sales.*over\s+time|daily.*revenue|weekly.*revenue|monthly.*revenue/.test(question)) {
    return describeInvestorRevenueTrendUnavailable(input, summary);
  }
  if (/investment.*(activity|changed|change|over\s+time|period)|how\s+many\s+investments.*(over\s+time|by\s+period)|when\s+were\s+most\s+(portfolio\s+)?investments|capital.*deployed.*(over\s+time|period)/.test(question)) {
    return describeInvestorInvestmentActivity(input, summary);
  }
  if (/portfolio\s+companies?.*(annual\s+)?revenue|companies?.*(generate|highest|largest|most).*(annual\s+)?revenue/.test(question)) {
    return describeInvestorCompanyAnnualRevenueRanking(input, summary);
  }
  if (/portfolio\s+companies?.*(highest|largest|top).*valuation|valuation.*portfolio\s+companies?/.test(question)) {
    return describeInvestorCompanyValuationRanking(input, summary);
  }
  if (/portfolio\s+companies?.*(highest|largest|top|most).*growth|companies?.*(highest|largest|top|most).*growth|highest.*growth|growth.*portfolio\s+companies?/.test(question)) {
    return describeInvestorCompanyGrowthRanking(input, summary);
  }
  if (/(shortest|lowest|least).*runway|runway.*(risk|shortest|lowest|least)/.test(question)) {
    return describeInvestorCompanyRunwayRisk(input, summary);
  }
  if (/(highest|largest|top|most).*(monthly\s+)?burn|burn.*(highest|largest|top|most)/.test(question)) {
    return describeInvestorCompanyBurnRanking(input, summary);
  }
  if (/capital.*invested|invested.*capital|how\s+much.*invested|total.*invested/.test(question)) {
    return describeInvestorTotalInvested(input, summary);
  }
  return null;
}

function buildInvestorAssistantSummary(input: DatasetAssistantInput): InvestorAssistantSummary | null {
  const profile = buildBusinessSemanticProfile({
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    columns: input.columns,
    rows: input.rows,
  });
  if (profile.classification.datasetType !== "investor") return null;
  const summary: InvestorAssistantSummary = {
    annualRevenueColumn: conceptColumn(profile, "portfolio_company_annual_revenue"),
    investmentDateColumn: conceptColumn(profile, "investment_date"),
    portfolioCompanyColumn: conceptColumn(profile, "portfolio_company"),
    investedAmountColumn: conceptColumn(profile, "invested_amount"),
    entryValuationColumn: conceptColumn(profile, "entry_valuation"),
    latestValuationColumn: conceptColumn(profile, "latest_valuation"),
    growthRateColumn: conceptColumn(profile, "portfolio_company_growth_rate"),
    monthlyBurnColumn: conceptColumn(profile, "portfolio_company_monthly_burn"),
    runwayColumn: conceptColumn(profile, "portfolio_company_runway"),
    currencyCode: currencyCodeFromRows(input.rows, input.columns),
  };
  if (
    !summary.annualRevenueColumn &&
    !summary.investmentDateColumn &&
    !summary.investedAmountColumn &&
    !summary.entryValuationColumn &&
    !summary.latestValuationColumn &&
    !summary.growthRateColumn &&
    !summary.monthlyBurnColumn &&
    !summary.runwayColumn
  ) return null;
  return summary;
}

function describeInvestorRevenueTrendUnavailable(input: DatasetAssistantInput, summary: InvestorAssistantSummary): DatasetAssistantDeterministicResult {
  if (!summary.annualRevenueColumn) {
    return investorMissingEvidence(input, "Revenue trends over time cannot be calculated because no validated portfolio company annual revenue field was found.", ["annual_revenue"], "investor.revenue_trend");
  }
  const timeColumn = summary.investmentDateColumn;
  return {
    status: "success",
    answer: [
      `Answer: Revenue trends over time cannot be calculated from this dataset. The dataset contains annual revenue for portfolio companies, but no validated historical revenue measurement period.${timeColumn ? ` "${timeColumn}" represents when the investment was made and is not a revenue reporting period.` : ""}`,
      `Evidence: "${summary.annualRevenueColumn}" is portfolio-company annual revenue.${timeColumn ? ` "${timeColumn}" is an investment activity date.` : ""}`,
      "Takeaway: A date field alone is insufficient for trend analysis; revenue trends require a revenue, reporting, fiscal, financial, period-end, year, or fiscal-year time dimension.",
      "Next question: Ask how investment activity changed over time.",
    ].join("\n\n"),
    insight: timeColumn
      ? `UseClevr rejected grouping "${summary.annualRevenueColumn}" by "${timeColumn}" because the metric and time axis have incompatible semantic roles.`
      : "No validated revenue reporting period was found for portfolio-company annual revenue.",
    explanation: "The Business Semantics profile permits portfolio-company annual revenue totals, but blocks revenue trend calculation because investment_date is investment activity timing, not revenue measurement timing.",
    recommendation: "Ask how investment activity changed over time.",
    data: [
      { metric: "Portfolio company annual revenue", sourceColumn: summary.annualRevenueColumn, status: "available" },
      { metric: "Revenue trend period", sourceColumn: timeColumn, status: timeColumn ? "incompatible" : "missing" },
    ],
    chartType: "table",
    result: {
      intent: "investor.revenue_trend",
      status: "incompatible_evidence",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      revenueColumn: summary.annualRevenueColumn,
      rejectedTimeColumn: timeColumn,
      metricConcept: "portfolio_company_annual_revenue",
      rejectedTimeConcept: timeColumn ? "investment_date" : null,
      requiredTimeConcepts: ["revenue_period", "reporting_period", "fiscal_period", "financial_period", "period_end", "year", "fiscal_year"],
      lineage: [summary.annualRevenueColumn, timeColumn].filter((column): column is string => Boolean(column)),
    },
  };
}

function describeInvestorInvestmentActivity(input: DatasetAssistantInput, summary: InvestorAssistantSummary): DatasetAssistantDeterministicResult {
  if (!summary.investmentDateColumn) {
    return investorMissingEvidence(input, "Investment activity over time is unavailable because no validated investment date field was found.", ["investment_date"], "investor.investment_activity");
  }
  const periods = investorInvestmentPeriods(input.rows, summary.investmentDateColumn, summary.investedAmountColumn);
  if (periods.length === 0) {
    return investorMissingEvidence(input, "Investment activity over time is unavailable because investment dates could not be parsed into periods.", [summary.investmentDateColumn], "investor.investment_activity");
  }
  const top = periods.slice().sort((a, b) => b.investments - a.investments || (b.capitalDeployed ?? 0) - (a.capitalDeployed ?? 0))[0];
  return {
    status: "success",
    answer: [
      `Answer: Investment activity is available across ${periods.length.toLocaleString("en-US")} observed period${periods.length === 1 ? "" : "s"}. ${top ? `${top.period} added the most portfolio compan${top.investments === 1 ? "y" : "ies"} (${top.investments.toLocaleString("en-US")}).` : ""}`,
      `Evidence: Grouped "${summary.investmentDateColumn}" as an investment activity time axis${summary.investedAmountColumn ? ` and summed capital deployed from "${summary.investedAmountColumn}"` : ""}.`,
      "Takeaway: Investment date is valid for investment activity, not for portfolio company revenue trends.",
      "Next question: Ask which portfolio companies generate the most annual revenue.",
    ].join("\n\n"),
    insight: top ? `${top.period} has the most investment activity.` : "Investment activity was grouped by validated investment date.",
    explanation: "Direct data analysis grouped validated investment_date values using source data only.",
    recommendation: "Review investment activity alongside valuation, sector, and concentration risk.",
    data: periods,
    chartType: "table",
    result: {
      intent: "investor.investment_activity",
      status: "success",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      investmentDateColumn: summary.investmentDateColumn,
      investedAmountColumn: summary.investedAmountColumn,
      periods,
    },
  };
}

function describeInvestorCompanyAnnualRevenueRanking(input: DatasetAssistantInput, summary: InvestorAssistantSummary): DatasetAssistantDeterministicResult {
  if (!summary.annualRevenueColumn) {
    return investorMissingEvidence(input, "Portfolio company annual revenue ranking is unavailable because no validated annual revenue field was found.", ["annual_revenue"], "investor.portfolio_company_annual_revenue_ranking");
  }
  const rows = investorRankedRows(input.rows, summary.portfolioCompanyColumn, summary.annualRevenueColumn, "annualRevenue");
  const top = rows[0];
  return {
    status: "success",
    answer: [
      top
        ? `Answer: ${top.portfolioCompany} has the highest portfolio company annual revenue at ${formatInvestorValue(top.annualRevenue, summary.currencyCode)}.`
        : "Answer: No portfolio company annual revenue ranking could be calculated.",
      `Evidence: Ranked portfolio companies by "${summary.annualRevenueColumn}".`,
      "Takeaway: This is portfolio-company annual revenue, not investor revenue.",
      "Next question: Ask how investment activity changed over time.",
    ].join("\n\n"),
    insight: top ? `Top portfolio company by annual revenue: ${top.portfolioCompany}.` : "No portfolio company annual revenue values were found.",
    explanation: "Direct data analysis ranked validated annual_revenue values by portfolio company.",
    recommendation: "Review revenue concentration alongside valuation and invested capital.",
    data: rows,
    chartType: "table",
    result: {
      intent: "investor.portfolio_company_annual_revenue_ranking",
      status: "success",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      annualRevenueColumn: summary.annualRevenueColumn,
      portfolioCompanyColumn: summary.portfolioCompanyColumn,
      rows,
    },
  };
}

function describeInvestorCompanyValuationRanking(input: DatasetAssistantInput, summary: InvestorAssistantSummary): DatasetAssistantDeterministicResult {
  if (!summary.latestValuationColumn) {
    return investorMissingEvidence(input, "Portfolio company valuation ranking is unavailable because no validated latest valuation field was found.", ["latest_valuation"], "investor.portfolio_company_valuation_ranking");
  }
  const rows = investorRankedRows(input.rows, summary.portfolioCompanyColumn, summary.latestValuationColumn, "latestValuation");
  const top = rows[0];
  return {
    status: "success",
    answer: [
      top
        ? `Answer: ${top.portfolioCompany} has the highest latest valuation at ${formatInvestorValue(top.latestValuation, summary.currencyCode)}.`
        : "Answer: No portfolio company valuation ranking could be calculated.",
      `Evidence: Ranked portfolio companies by "${summary.latestValuationColumn}".`,
      "Takeaway: This uses source-backed portfolio valuation evidence only.",
      "Next question: Ask which portfolio companies generate the most annual revenue.",
    ].join("\n\n"),
    insight: top ? `Top portfolio company by valuation: ${top.portfolioCompany}.` : "No latest valuation values were found.",
    explanation: "Direct data analysis ranked validated latest_valuation values by portfolio company.",
    recommendation: "Compare valuation concentration with invested capital and annual revenue.",
    data: rows,
    chartType: "table",
    result: {
      intent: "investor.portfolio_company_valuation_ranking",
      status: "success",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      latestValuationColumn: summary.latestValuationColumn,
      portfolioCompanyColumn: summary.portfolioCompanyColumn,
      rows,
    },
  };
}

function describeInvestorCompanyGrowthRanking(input: DatasetAssistantInput, summary: InvestorAssistantSummary): DatasetAssistantDeterministicResult {
  if (!summary.growthRateColumn) {
    return investorMissingEvidence(input, "Portfolio company growth ranking is unavailable because no validated growth_rate field was found.", ["growth_rate"], "investor.portfolio_company_growth_ranking");
  }
  const rows = investorAveragedRows(input.rows, summary.portfolioCompanyColumn, summary.growthRateColumn, "growthRate", "desc");
  const top = rows[0];
  return {
    status: "success",
    answer: [
      top
        ? `Answer: ${top.portfolioCompany} has the highest portfolio company growth rate at ${formatInvestorPercent(top.growthRate)}.`
        : "Answer: No portfolio company growth ranking could be calculated.",
      `Evidence: Ranked portfolio companies by "${summary.growthRateColumn}".`,
      "Takeaway: This uses source-backed portfolio company growth values without grouping annual revenue over time.",
      "Next question: Ask which companies have the shortest runway.",
    ].join("\n\n"),
    insight: top ? `Top portfolio company by growth: ${top.portfolioCompany}.` : "No portfolio company growth values were found.",
    explanation: "Direct data analysis ranked validated growth_rate values by portfolio company.",
    recommendation: "Review growth alongside runway, burn, valuation, and invested capital.",
    data: rows.map((row) => ({ ...row, growthRate: round(row.growthRate, 1) })),
    chartType: "table",
    result: {
      intent: "investor.portfolio_company_growth_ranking",
      status: "success",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      growthRateColumn: summary.growthRateColumn,
      portfolioCompanyColumn: summary.portfolioCompanyColumn,
      rows,
    },
  };
}

function describeInvestorCompanyRunwayRisk(input: DatasetAssistantInput, summary: InvestorAssistantSummary): DatasetAssistantDeterministicResult {
  if (!summary.runwayColumn) {
    return investorMissingEvidence(input, "Portfolio company runway ranking is unavailable because no validated runway_months field was found.", ["runway_months"], "investor.portfolio_company_runway_risk");
  }
  const rows = investorAveragedRows(input.rows, summary.portfolioCompanyColumn, summary.runwayColumn, "runwayMonths", "asc");
  const top = rows[0];
  return {
    status: "success",
    answer: [
      top
        ? `Answer: ${top.portfolioCompany} has the shortest runway at ${top.runwayMonths.toFixed(1)} months.`
        : "Answer: No portfolio company runway ranking could be calculated.",
      `Evidence: Ranked portfolio companies by "${summary.runwayColumn}".`,
      "Takeaway: Runway is a current portfolio company value here, not a historical trend from investment_date.",
      "Next question: Ask which companies have the highest monthly burn.",
    ].join("\n\n"),
    insight: top ? `${top.portfolioCompany} has the shortest runway.` : "No runway values were found.",
    explanation: "Direct data analysis ranked validated runway_months values by portfolio company and did not group them by investment_date.",
    recommendation: "Review shortest runway companies before making follow-on or support decisions.",
    data: rows.map((row) => ({ ...row, runwayMonths: round(row.runwayMonths, 1) })),
    chartType: "table",
    result: {
      intent: "investor.portfolio_company_runway_risk",
      status: "success",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      runwayColumn: summary.runwayColumn,
      portfolioCompanyColumn: summary.portfolioCompanyColumn,
      rows,
    },
  };
}

function describeInvestorCompanyBurnRanking(input: DatasetAssistantInput, summary: InvestorAssistantSummary): DatasetAssistantDeterministicResult {
  if (!summary.monthlyBurnColumn) {
    return investorMissingEvidence(input, "Portfolio company burn ranking is unavailable because no validated burn_rate_monthly field was found.", ["burn_rate_monthly"], "investor.portfolio_company_monthly_burn_ranking");
  }
  const rows = investorRankedRows(input.rows, summary.portfolioCompanyColumn, summary.monthlyBurnColumn, "monthlyBurn");
  const top = rows[0];
  return {
    status: "success",
    answer: [
      top
        ? `Answer: ${top.portfolioCompany} has the highest monthly burn at ${formatInvestorValue(top.monthlyBurn, summary.currencyCode)}.`
        : "Answer: No portfolio company monthly burn ranking could be calculated.",
      `Evidence: Ranked portfolio companies by "${summary.monthlyBurnColumn}".`,
      "Takeaway: Burn is a current portfolio company value here, not a historical trend from investment_date.",
      "Next question: Ask which companies have the shortest runway.",
    ].join("\n\n"),
    insight: top ? `${top.portfolioCompany} has the highest monthly burn.` : "No monthly burn values were found.",
    explanation: "Direct data analysis ranked validated burn_rate_monthly values by portfolio company and did not group them by investment_date.",
    recommendation: "Review highest-burn companies alongside runway and valuation.",
    data: rows,
    chartType: "table",
    result: {
      intent: "investor.portfolio_company_monthly_burn_ranking",
      status: "success",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      monthlyBurnColumn: summary.monthlyBurnColumn,
      portfolioCompanyColumn: summary.portfolioCompanyColumn,
      rows,
    },
  };
}

function describeInvestorTotalInvested(input: DatasetAssistantInput, summary: InvestorAssistantSummary): DatasetAssistantDeterministicResult {
  if (!summary.investedAmountColumn) {
    return investorMissingEvidence(input, "Invested capital is unavailable because no validated invested_amount field was found.", ["invested_amount"], "investor.total_invested_capital");
  }
  const total = input.rows.reduce((sum, row) => sum + (parseBusinessNumber(row[summary.investedAmountColumn!]) ?? 0), 0);
  return {
    status: "success",
    answer: [
      `Answer: Total invested capital is ${formatInvestorValue(total, summary.currencyCode)}.`,
      `Evidence: Summed invested capital from "${summary.investedAmountColumn}".`,
      "Takeaway: This is capital deployed into portfolio companies, not portfolio company revenue or investor profit.",
      "Next question: Ask which portfolio companies have the highest valuation.",
    ].join("\n\n"),
    insight: `UseClevr summed ${input.rows.length.toLocaleString("en-US")} portfolio row${input.rows.length === 1 ? "" : "s"} from "${summary.investedAmountColumn}".`,
    explanation: "Direct data analysis summed validated invested_amount values.",
    recommendation: "Review invested capital by sector, stage, and valuation concentration.",
    data: [{ metric: "Invested capital", value: round(total), sourceColumn: summary.investedAmountColumn }],
    chartType: "kpi",
    result: {
      intent: "investor.total_invested_capital",
      status: "success",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      investedAmountColumn: summary.investedAmountColumn,
      investedCapital: round(total),
      lineage: [summary.investedAmountColumn],
    },
  };
}

function investorMissingEvidence(input: DatasetAssistantInput, message: string, missingFields: string[], intent: string): DatasetAssistantDeterministicResult {
  return {
    status: "success",
    answer: [
      `Answer: ${message}`,
      "Evidence: Missing evidence is unavailable, not zero.",
      "Takeaway: UseClevr will not substitute unrelated investor, sales, customer, order, or inventory metrics.",
      "Next question: Ask about a source-backed Investor portfolio metric.",
    ].join("\n\n"),
    insight: message,
    explanation: "The Investor semantic profile rejected the requested calculation because required source evidence is missing.",
    recommendation: "Ask about a mapped Investor portfolio metric.",
    data: missingFields.map((field) => ({ field, status: "missing" })),
    chartType: "table",
    result: {
      intent,
      status: "missing_evidence",
      missingFields,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
    },
  };
}

function investorInvestmentPeriods(rows: Record<string, unknown>[], investmentDateColumn: string, investedAmountColumn: string | null) {
  const groups = new Map<string, { investments: number; capitalDeployed: number }>();
  for (const row of rows) {
    const period = monthKey(row[investmentDateColumn]);
    if (!period) continue;
    const current = groups.get(period) ?? { investments: 0, capitalDeployed: 0 };
    current.investments += 1;
    current.capitalDeployed += investedAmountColumn ? parseBusinessNumber(row[investedAmountColumn]) ?? 0 : 0;
    groups.set(period, current);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({
      period,
      investments: value.investments,
      capitalDeployed: investedAmountColumn ? round(value.capitalDeployed) : null,
    }));
}

function investorRankedRows<TMetricKey extends "annualRevenue" | "latestValuation" | "monthlyBurn">(
  rows: Record<string, unknown>[],
  portfolioCompanyColumn: string | null,
  metricColumn: string,
  metricKey: TMetricKey,
): Array<{ portfolioCompany: string; rows: number } & Record<TMetricKey, number>> {
  const groups = new Map<string, { value: number; rows: number }>();
  for (const [index, row] of rows.entries()) {
    const company = portfolioCompanyColumn ? String(row[portfolioCompanyColumn] ?? "").trim() : "";
    const portfolioCompany = company || `Portfolio company ${index + 1}`;
    const value = parseBusinessNumber(row[metricColumn]);
    if (value === null) continue;
    const current = groups.get(portfolioCompany) ?? { value: 0, rows: 0 };
    current.value += value;
    current.rows += 1;
    groups.set(portfolioCompany, current);
  }
  return Array.from(groups.entries())
    .map(([portfolioCompany, value]) => ({
      portfolioCompany,
      [metricKey]: round(value.value),
      rows: value.rows,
    }) as { portfolioCompany: string; rows: number } & Record<TMetricKey, number>)
    .sort((a, b) => Number(b[metricKey]) - Number(a[metricKey]) || a.portfolioCompany.localeCompare(b.portfolioCompany))
    .slice(0, 10);
}

function investorAveragedRows<TMetricKey extends "growthRate" | "runwayMonths">(
  rows: Record<string, unknown>[],
  portfolioCompanyColumn: string | null,
  metricColumn: string,
  metricKey: TMetricKey,
  direction: "asc" | "desc",
): Array<{ portfolioCompany: string; rows: number } & Record<TMetricKey, number>> {
  const groups = new Map<string, { total: number; rows: number }>();
  for (const [index, row] of rows.entries()) {
    const company = portfolioCompanyColumn ? String(row[portfolioCompanyColumn] ?? "").trim() : "";
    const portfolioCompany = company || `Portfolio company ${index + 1}`;
    const rawValue = parseBusinessNumber(row[metricColumn]);
    if (rawValue === null) continue;
    const value = metricKey === "growthRate" ? normalizePercentValue(rawValue) : rawValue;
    const current = groups.get(portfolioCompany) ?? { total: 0, rows: 0 };
    current.total += value;
    current.rows += 1;
    groups.set(portfolioCompany, current);
  }
  return Array.from(groups.entries())
    .map(([portfolioCompany, value]) => ({
      portfolioCompany,
      [metricKey]: round(value.total / value.rows, 1),
      rows: value.rows,
    }) as { portfolioCompany: string; rows: number } & Record<TMetricKey, number>)
    .sort((a, b) => {
      const diff = Number(a[metricKey]) - Number(b[metricKey]);
      return (direction === "asc" ? diff : -diff) || a.portfolioCompany.localeCompare(b.portfolioCompany);
    })
    .slice(0, 10);
}

function formatInvestorValue(value: number, currencyCode: string | null) {
  if (!currencyCode) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatInvestorPercent(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function canAnswerDatasetSuggestionDeterministically(input: DatasetAssistantInput) {
  if (hasRetailInventoryDeterministicCapability(input)) return true;
  if (isRetailInventoryQuestion(input.question)) return false;
  return answerDatasetQuestionDeterministically(input) !== null;
}

function answerSaasQuestionDeterministically(input: DatasetAssistantInput): DatasetAssistantDeterministicResult | null {
  const summary = buildSaasAssistantSummary({
    rows: input.rows,
    columns: input.columns,
  });
  if (!hasSaasAssistantEvidence(summary) || !isSaasQuestion(input.question)) return null;

  const question = input.question.toLowerCase();
  const currencyCode = currencyCodeFromRows(input.rows, input.columns);

  if (/changed|change|across|period|trend|growth/.test(question) && /\bmrr\b|recurring|subscription/.test(question)) {
    return describeSaasMrrTrend(input, summary, currencyCode);
  }
  if (/net/.test(question) && /\bmrr\b/.test(question)) {
    return describeSaasNetMrrMovement(input, summary, currencyCode);
  }
  if (/\bnew\s+mrr\b|new recurring/.test(question)) {
    return describeSaasMetric(input, summary, "new_mrr", "New MRR", currencyCode);
  }
  if (/expansion\s+mrr|expansion recurring|upsell/.test(question)) {
    return describeSaasMetric(input, summary, "expansion_mrr", "Expansion MRR", currencyCode);
  }
  if (/contraction\s+mrr|contraction recurring|downsell/.test(question)) {
    return describeSaasMetric(input, summary, "contraction_mrr", "Contraction MRR", currencyCode);
  }
  if (/churned\s+mrr|churn\s+mrr/.test(question)) {
    return describeSaasChurnedMrr(input, summary, currencyCode);
  }
  if (/\barr\b|annual recurring/.test(question)) {
    return describeSaasMetric(input, summary, "arr", "ARR", currencyCode);
  }
  if (/\bmrr\b|monthly recurring|recurring revenue/.test(question) && /current|latest|total|what is|how much/.test(question)) {
    return describeSaasMetric(input, summary, "mrr", "MRR", currencyCode);
  }
  if (/active customers|active accounts|how many.*customers|how many.*accounts|customers.*represented|accounts.*represented/.test(question)) {
    return describeSaasActiveCustomers(input, summary);
  }
  if (/highest-value|highest value|top.*customer|top.*account|customer.*highest|account.*highest/.test(question)) {
    return describeSaasCustomerRanking(input, summary, currencyCode);
  }
  if (/plan/.test(question)) {
    return describeSaasPlanContribution(input, summary, currencyCode);
  }
  if (/churn|cancell/.test(question)) {
    return describeSaasChurnSignal(input, summary, currencyCode);
  }
  if (isExplicitSaasCapabilityQuestion(question)) {
    return describeSaasAvailableFields(input, summary);
  }
  if (/retention|cohort/.test(question)) {
    return saasMissingEvidence(input, "SaaS retention or cohort analysis is unavailable because no validated retention or cohort field was found in this dataset.", ["retention or cohort field"], "retention_analysis");
  }
  if (/\bcac\b|customer acquisition/.test(question)) {
    return describeSaasMetric(input, summary, "cac", "CAC", currencyCode);
  }
  if (/\bltv\b|lifetime value/.test(question)) {
    return describeSaasMetric(input, summary, "ltv", "LTV", currencyCode);
  }
  if (/runway/.test(question)) {
    return describeSaasMetric(input, summary, "runway", "Runway", null);
  }
  if (/burn/.test(question)) {
    return describeSaasMetric(input, summary, "burn", "Burn", currencyCode);
  }

  return null;
}

function hasSaasAssistantEvidence(summary: SaasAssistantSummary) {
  return summary.profile !== "generic_saas" || [
    "mrr",
    "mrr_after",
    "mrr_delta",
    "arr",
    "movement_type",
    "subscription_status",
    "subscription_revenue",
  ].some((concept) => Boolean(summary.mappings[concept as keyof typeof summary.mappings]));
}

function isSaasQuestion(question: string) {
  return /\bsaas\b|\bmrr\b|\barr\b|recurring|subscription|churn|retention|cohort|\bcac\b|\bltv\b|runway|burn|plan|active customers|active accounts|customer.*account|highest-value|highest value|expansion|contraction|upsell|downsell/.test(question.toLowerCase());
}

function isExplicitSaasCapabilityQuestion(question: string) {
  const normalized = question.toLowerCase();
  if (/\bmrr\b|\barr\b|churn|expansion|contraction|new\s+recurring|new\s+mrr|net\s+mrr|active\s+customers?|active\s+accounts?|highest-value|highest\s+value|plan.*contribute|customer.*value|account.*value|growth/.test(normalized)) {
    return false;
  }
  return /available|capabilit|semantic|mapping|mapped|field|source data|support|contain|can be analyzed|can.*analy[sz]e|metrics? can/.test(normalized)
    && /saas|metric|field|mapping|semantic|source data|dataset/.test(normalized);
}

function describeSaasMetric(
  input: DatasetAssistantInput,
  summary: SaasAssistantSummary,
  metricId: string,
  label: string,
  currencyCode: string | null,
): DatasetAssistantDeterministicResult {
  const metric = summary.metrics[metricId];
  if (!metric || metric.status !== "available" || metric.value === null) {
    return saasMissingEvidence(input, missingSaasMetricMessage(metricId, label), missingSaasMetricFields(metricId), `saas.${metricId}`);
  }
  const formatted = metricId === "runway" ? `${formatNumber(metric.value)} months` : formatValue(metric.value, currencyCode);
  const periodText = summary.latestPeriod ? ` for latest period ${summary.latestPeriod}` : "";
  return {
    status: "success",
    answer: [
      `Answer: Current ${label} is ${formatted}${periodText}.`,
      `Evidence: ${metric.reason} Source column${metric.sourceColumns.length === 1 ? "" : "s"}: ${metric.sourceColumns.join(", ")}.`,
      "Takeaway: This answer uses the selected dataset's SaaS semantic profile and no provider-generated values.",
      nextSaasQuestion(label),
    ].join("\n\n"),
    insight: `Current ${label}: ${formatted}.`,
    explanation: metric.reason,
    recommendation: "Ask what changed in MRR across the available periods.",
    data: [{ metric: label, value: round(metric.value), source: metric.sourceColumns.join(", ") }],
    chartType: "kpi",
    result: saasResult(input, summary, `saas.${metricId}`, {
      metric: metricId,
      value: round(metric.value),
      sourceColumns: metric.sourceColumns,
      latestPeriod: summary.latestPeriod,
    }),
  };
}

function describeSaasMrrTrend(input: DatasetAssistantInput, summary: SaasAssistantSummary, currencyCode: string | null): DatasetAssistantDeterministicResult {
  const periods = summary.periodRows.filter((row) => row.mrr !== null);
  if (periods.length < 2) {
    return saasMissingEvidence(input, "MRR movement over time is unavailable because this dataset does not contain at least two periods with validated MRR or MRR-after values.", ["period plus MRR or MRR-after"], "saas.mrr_trend");
  }
  const previous = periods.at(-2);
  const current = periods.at(-1);
  if (!previous || !current || previous.mrr === null || current.mrr === null) {
    return saasMissingEvidence(input, "MRR movement over time is unavailable because current and previous period MRR values could not both be calculated.", ["two valid MRR periods"], "saas.mrr_trend");
  }
  const change = current.mrr - previous.mrr;
  const changePct = previous.mrr === 0 ? null : (change / previous.mrr) * 100;
  return {
    status: "success",
    answer: [
      `Answer: MRR changed from ${formatValue(previous.mrr, currencyCode)} in ${previous.period} to ${formatValue(current.mrr, currencyCode)} in ${current.period}, a ${change >= 0 ? "gain" : "decline"} of ${formatValue(Math.abs(change), currencyCode)}${changePct === null ? "" : ` (${formatSignedPercent(changePct)})`}.`,
      "Evidence: MRR uses the Dataset Intelligence Engine SaaS mapping for source MRR or latest-period active MRR-after values.",
      "Takeaway: This is a direct SaaS calculation and works without any cloud AI provider.",
      "Next question: Ask for New MRR, Expansion MRR, Contraction MRR, or Churned MRR to inspect the movement components.",
    ].join("\n\n"),
    insight: `Latest MRR is ${formatValue(current.mrr, currencyCode)}.`,
    explanation: "Grouped source rows by validated SaaS period and calculated MRR from recurring-revenue semantics.",
    recommendation: "Review movement components to explain the period change.",
    data: periods.map((period) => ({
      period: period.period,
      mrr: period.mrr,
      netMovement: period.netMovement,
      activeCustomers: period.activeCustomers,
      rows: period.rows,
    })),
    chartType: "table",
    result: saasResult(input, summary, "saas.mrr_trend", { periods, latestChange: round(change), latestChangePct: changePct === null ? null : round(changePct, 1) }),
  };
}

function describeSaasNetMrrMovement(input: DatasetAssistantInput, summary: SaasAssistantSummary, currencyCode: string | null): DatasetAssistantDeterministicResult {
  const movement = movementMetricValues(summary);
  if (Object.values(movement).every((value) => value === null)) {
    return saasMissingEvidence(input, "Net MRR movement is unavailable because no validated movement type plus MRR delta fields were found in this dataset.", ["movement_type plus mrr_delta"], "saas.net_mrr_movement");
  }
  const missing = Object.entries(movement)
    .filter(([, value]) => value === null)
    .map(([key]) => ({
      newMrr: "New MRR",
      expansionMrr: "Expansion MRR",
      contractionMrr: "Contraction MRR",
      churnedMrr: "Churned MRR",
    }[key] ?? key));
  if (missing.length > 0) {
    return saasMissingEvidence(input, `Net MRR movement is incomplete because ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} unavailable; missing movement evidence is not treated as zero.`, missing, "saas.net_mrr_movement");
  }
  const net = (movement.newMrr ?? 0) + (movement.expansionMrr ?? 0) - (movement.contractionMrr ?? 0) - (movement.churnedMrr ?? 0);
  return {
    status: "success",
    answer: [
      `Answer: Net MRR movement is ${formatValue(net, currencyCode)}.`,
      `Evidence: New MRR ${formatValue(movement.newMrr ?? 0, currencyCode)} + Expansion MRR ${formatValue(movement.expansionMrr ?? 0, currencyCode)} - Contraction MRR ${formatValue(movement.contractionMrr ?? 0, currencyCode)} - Churned MRR ${formatValue(movement.churnedMrr ?? 0, currencyCode)}.`,
      "Takeaway: This calculation uses movement rows only; no provider-generated values were used.",
      "Next question: Ask which movement component changed most.",
    ].join("\n\n"),
    insight: `Net MRR movement: ${formatValue(net, currencyCode)}.`,
    explanation: "Calculated from validated SaaS movement_type and mrr_delta fields.",
    recommendation: "Inspect contraction and churned MRR first when net movement is under pressure.",
    data: [
      { metric: "New MRR", value: movement.newMrr ?? 0 },
      { metric: "Expansion MRR", value: movement.expansionMrr ?? 0 },
      { metric: "Contraction MRR", value: movement.contractionMrr ?? 0 },
      { metric: "Churned MRR", value: movement.churnedMrr ?? 0 },
      { metric: "Net MRR movement", value: round(net) },
    ],
    chartType: "table",
    result: saasResult(input, summary, "saas.net_mrr_movement", { ...movement, netMrrMovement: round(net) }),
  };
}

function describeSaasActiveCustomers(input: DatasetAssistantInput, summary: SaasAssistantSummary): DatasetAssistantDeterministicResult {
  const customers = summary.metrics.customers;
  if (!customers || customers.status !== "available" || customers.value === null) {
    return saasMissingEvidence(input, "Active customer count is unavailable because no validated customer or account identifier was found in this dataset.", ["customer_id or customer_count"], "saas.active_customers");
  }
  const state = summary.customerState;
  const churnedCustomers = state.churnedCustomers ?? null;
  const totalCustomers = state.totalCustomers ?? customers.value;
  return {
    status: "success",
    answer: [
      `Answer: ${formatNumber(customers.value)} active customers or accounts are represented${summary.latestPeriod ? ` in latest period ${summary.latestPeriod}` : ""}.`,
      `Evidence: Total distinct customers: ${formatNumber(totalCustomers)}. Active customers: ${formatNumber(customers.value)}.${churnedCustomers === null ? "" : ` Churned customers: ${formatNumber(churnedCustomers)}.`} Source column${customers.sourceColumns.length === 1 ? "" : "s"}: ${customers.sourceColumns.join(", ")}.`,
      "Takeaway: This count uses SaaS customer/account semantics, not row count as a proxy, and no provider-generated values were used.",
      "Next question: Ask which customers or accounts are highest value.",
    ].join("\n\n"),
    insight: `${formatNumber(customers.value)} active customers represented.`,
    explanation: customers.reason,
    recommendation: "Ask which customers or accounts are highest value.",
    data: [
      { metric: "Total customers", value: totalCustomers, source: customers.sourceColumns.join(", ") },
      { metric: "Active customers", value: customers.value, source: customers.sourceColumns.join(", ") },
      { metric: "Churned customers", value: churnedCustomers, source: customers.sourceColumns.join(", ") },
    ],
    chartType: "kpi",
    result: saasResult(input, summary, "saas.active_customers", {
      totalCustomers,
      customers: customers.value,
      activeCustomers: customers.value,
      churnedCustomers,
      churnShare: state.churnShare,
      sourceColumns: customers.sourceColumns,
    }),
  };
}

function describeSaasCustomerRanking(input: DatasetAssistantInput, summary: SaasAssistantSummary, currencyCode: string | null): DatasetAssistantDeterministicResult {
  if (!summary.mappings.customer_id) {
    return saasMissingEvidence(input, "Highest-value customer analysis is unavailable because no validated customer or account identifier was found in this dataset.", ["customer_id"], "saas.customer_ranking");
  }
  if (summary.customerRows.length === 0) {
    return saasMissingEvidence(input, "Highest-value customer analysis is unavailable because no validated customer/account value field was found in this dataset.", ["customer_id plus MRR, ARR, revenue, or users"], "saas.customer_ranking");
  }
  const top = summary.customerRows[0];
  return {
    status: "success",
    answer: [
      `Answer: ${top.label} is the highest-value customer or account at ${formatValue(top.value, currencyCode)}.`,
      `Evidence: Ranked latest SaaS customer/account rows using ${top.sourceColumns.join(", ")}.`,
      "Takeaway: The ranking uses source customer/account identifiers and recurring-revenue semantics; no provider-generated values were used.",
      "Next question: Ask which plan contributes the most SaaS revenue or users.",
    ].join("\n\n"),
    insight: `Highest-value account: ${top.label}.`,
    explanation: "Grouped latest SaaS rows by customer/account and ranked by the selected recurring-revenue metric.",
    recommendation: "Review concentration in the top accounts before planning expansion or churn actions.",
    data: summary.customerRows.map((row) => ({ account: row.label, value: row.value, sharePct: row.sharePct ?? null, rows: row.rows ?? null })),
    chartType: "table",
    result: saasResult(input, summary, "saas.customer_ranking", { rows: summary.customerRows }),
  };
}

function describeSaasPlanContribution(input: DatasetAssistantInput, summary: SaasAssistantSummary, currencyCode: string | null): DatasetAssistantDeterministicResult {
  if (!summary.mappings.plan) {
    return saasMissingEvidence(input, "Plan-level recurring revenue is unavailable because no validated plan field was found in this dataset.", ["plan"], "saas.plan_contribution");
  }
  if (summary.planRows.length === 0) {
    return saasMissingEvidence(input, "Plan-level recurring revenue is unavailable because no validated recurring revenue, MRR, ARR, or users field was found with the plan field.", ["plan plus MRR, ARR, recurring revenue, or users"], "saas.plan_contribution");
  }
  const top = summary.planRows[0];
  return {
    status: "success",
    answer: [
      `Answer: ${top.label} contributes the most SaaS revenue or users at ${formatValue(top.value, currencyCode)}${top.sharePct === undefined ? "" : ` (${top.sharePct.toFixed(1)}% of the detected total)`}.`,
      `Evidence: Grouped latest SaaS rows by plan using ${top.sourceColumns.join(", ")}.`,
      "Takeaway: This answer uses the selected dataset's SaaS plan capability and no provider-generated values.",
      "Next question: Ask what changed in MRR across the available periods.",
    ].join("\n\n"),
    insight: `Top SaaS plan: ${top.label}.`,
    explanation: "Grouped latest SaaS rows by validated plan and compatible SaaS metric.",
    recommendation: "Compare the top plan with churn and expansion movement before changing pricing or packaging.",
    data: summary.planRows.map((row) => ({ plan: row.label, value: row.value, sharePct: row.sharePct ?? null, rows: row.rows ?? null })),
    chartType: "table",
    result: saasResult(input, summary, "saas.plan_contribution", { rows: summary.planRows }),
  };
}

function describeSaasChurnedMrr(input: DatasetAssistantInput, summary: SaasAssistantSummary, currencyCode: string | null): DatasetAssistantDeterministicResult {
  const metric = summary.metrics.churned_mrr;
  const state = summary.customerState;
  if (metric?.status === "available" && metric.value !== null) {
    return {
      status: "success",
      answer: [
        `Answer: Churned MRR is ${formatValue(metric.value, currencyCode)}${summary.latestPeriod ? ` for latest period ${summary.latestPeriod}` : ""}.`,
        `Evidence: ${metric.reason} Source column${metric.sourceColumns.length === 1 ? "" : "s"}: ${metric.sourceColumns.join(", ")}.${state.churnedCustomers === null ? "" : ` Churned customers: ${formatNumber(state.churnedCustomers)}.`}`,
        "Takeaway: This answer uses validated churn movement or pre-churn MRR evidence; no provider-generated values were used.",
        "Next question: Ask what churn signal is visible in the source data.",
      ].join("\n\n"),
      insight: `Churned MRR: ${formatValue(metric.value, currencyCode)}.`,
      explanation: metric.reason,
      recommendation: "Ask what churn signal is visible in the source data.",
      data: [
        { metric: "Churned MRR", value: metric.value },
        { metric: "Churned customers", value: state.churnedCustomers },
      ],
      chartType: "table",
      result: saasResult(input, summary, "saas.churned_mrr", {
        metric: "churned_mrr",
        value: round(metric.value),
        churnedMrr: round(metric.value),
        churnedCustomers: state.churnedCustomers,
        sourceColumns: metric.sourceColumns,
        latestPeriod: summary.latestPeriod,
      }),
    };
  }
  if (state.churnedCustomers !== null) {
    if (state.churnedCustomers === 0) {
      return {
        status: "success",
        answer: [
          `Answer: Churned MRR is ${formatValue(0, currencyCode)} because no churned customers are present in the validated current customer state.`,
          `Evidence: Churned customers: 0. Source column${state.sourceColumns.length === 1 ? "" : "s"}: ${state.sourceColumns.join(", ")}.`,
          "Takeaway: This is a confirmed zero from validated churn status evidence, not a missing churn assumption.",
          "Next question: Ask how many active customers are represented.",
        ].join("\n\n"),
        insight: "Churned MRR is confirmed zero because no churned customers were detected.",
        explanation: "Validated churn status evidence contains no churned customers.",
        recommendation: "Ask how many active customers are represented.",
        data: [
          { metric: "Churned MRR", value: 0 },
          { metric: "Churned customers", value: 0 },
        ],
        chartType: "table",
        result: saasResult(input, summary, "saas.churned_mrr", {
          metric: "churned_mrr",
          value: 0,
          churnedMrr: 0,
          churnedCustomers: 0,
          sourceColumns: state.sourceColumns,
          latestPeriod: summary.latestPeriod,
        }),
      };
    }
    return saasMissingEvidence(
      input,
      `${formatNumber(state.churnedCustomers)} churned customer${state.churnedCustomers === 1 ? "" : "s"} ${state.churnedCustomers === 1 ? "was" : "were"} detected, but Churned MRR cannot be calculated reliably because no validated pre-churn or churn-movement MRR amount is available.`,
      ["pre-churn MRR or churn movement MRR amount"],
      "saas.churned_mrr",
    );
  }
  return saasMissingEvidence(input, missingSaasMetricMessage("churned_mrr", "Churned MRR"), missingSaasMetricFields("churned_mrr"), "saas.churned_mrr");
}

function describeSaasChurnSignal(input: DatasetAssistantInput, summary: SaasAssistantSummary, currencyCode: string | null): DatasetAssistantDeterministicResult {
  const churnedMrr = summary.metrics.churned_mrr;
  const churnRate = summary.metrics.churn_rate;
  const churnEvidence = summarizeSaasChurnEvidence(input.rows, summary);
  const state = summary.customerState;
  if ((churnedMrr?.status !== "available" || churnedMrr.value === null) && (churnRate?.status !== "available" || churnRate.value === null) && churnEvidence.events === 0 && state.churnedCustomers === null) {
    return saasMissingEvidence(input, "Churn signal is unavailable because no validated churn, cancellation, movement type, or churn-rate field was found in this dataset.", ["churn, movement_type, churned_customers, or churn_rate"], "saas.churn_signal");
  }
  const churnedMrrValue = churnedMrr?.status === "available" && churnedMrr.value !== null ? churnedMrr.value : churnEvidence.events > 0 ? churnEvidence.mrr : null;
  const churnedCustomers = state.churnedCustomers ?? churnEvidence.customers;
  const activeCustomers = state.activeCustomers ?? null;
  const totalCustomers = state.totalCustomers ?? (churnedCustomers !== null && activeCustomers !== null ? churnedCustomers + activeCustomers : null);
  const churnShare = state.churnShare ?? churnRate?.value ?? (totalCustomers && totalCustomers > 0 && churnedCustomers !== null ? round((churnedCustomers / totalCustomers) * 100) : null);
  const customersText = churnEvidence.events > 0 && churnEvidence.customers === null
    ? `${formatNumber(churnEvidence.events)} churn event${churnEvidence.events === 1 ? "" : "s"}`
    : churnEvidence.events > 0 && churnEvidence.customers !== null
      ? `${formatNumber(churnEvidence.events)} churn event${churnEvidence.events === 1 ? "" : "s"} across ${formatNumber(churnEvidence.customers)} affected customer${churnEvidence.customers === 1 ? "" : "s"}`
      : churnedCustomers !== null
        ? `${formatNumber(churnedCustomers)} churned customer${churnedCustomers === 1 ? "" : "s"}`
        : null;
  const currentMrr = metricValue(summary, "mrr");
  const materiality = churnedMrrValue !== null && currentMrr && currentMrr > 0
    ? `Churned MRR equals ${formatSignedPercent((churnedMrrValue / currentMrr) * 100).replace(/^\+/, "")} of current MRR.`
    : "UseClevr found customer churn evidence, but Churned MRR is unavailable without pre-churn or churn-movement MRR evidence.";
  const parts = [
    churnedMrrValue !== null ? `Churned MRR is ${formatValue(churnedMrrValue, currencyCode)}` : null,
    customersText,
    churnShare !== null ? `customer churn share is ${formatSignedPercent(churnShare).replace(/^\+/, "")}` : null,
  ].filter(Boolean);
  const sourceColumns = churnEvidence.events > 0 && churnEvidence.sourceColumns.length > 0
    ? churnEvidence.sourceColumns
    : [...state.sourceColumns, ...(churnedMrr?.sourceColumns ?? []), ...(churnRate?.sourceColumns ?? [])].filter((value, index, list) => list.indexOf(value) === index);
  return {
    status: "success",
    answer: [
      `Answer: ${parts.join(", ")}.`,
      [
        `Evidence: Customers represented: ${totalCustomers === null ? "not available" : formatNumber(totalCustomers)}`,
        `Churned customers: ${churnedCustomers === null ? "not available" : formatNumber(churnedCustomers)}`,
        `Active customers: ${activeCustomers === null ? "not available" : formatNumber(activeCustomers)}`,
        `Churn share: ${churnShare === null ? "not available" : formatSignedPercent(churnShare).replace(/^\+/, "")}`,
        `Churned MRR: ${churnedMrrValue === null ? "not available" : formatValue(churnedMrrValue, currencyCode)}`,
        `Churn events: ${formatNumber(churnEvidence.events)}`,
        `Period with highest churn: ${churnEvidence.highestPeriod ? `${churnEvidence.highestPeriod.period} (${formatValue(churnEvidence.highestPeriod.mrr, currencyCode)})` : "not available"}`,
        `Source fields: ${sourceColumns.join(", ") || "validated SaaS churn metric"}`,
      ].join("\n"),
      `Takeaway: ${materiality} This is a direct source-data signal with no provider interpretation, and contraction is kept separate from full churn.`,
      "Next question: Ask for contraction MRR or highest-value accounts to identify where churn risk matters most.",
    ].join("\n\n"),
    insight: parts.join("; "),
    explanation: "Calculated from validated SaaS churn semantics.",
    recommendation: "Review churned MRR alongside contraction MRR and top-account concentration.",
    data: [
      { metric: "Customers represented", value: totalCustomers },
      { metric: "Churned customers", value: churnedCustomers },
      { metric: "Active customers", value: activeCustomers },
      { metric: "Churn share", value: churnShare },
      { metric: "Churned MRR", value: churnedMrrValue },
      { metric: "Churn events", value: churnEvidence.events },
    ],
    chartType: "table",
    result: saasResult(input, summary, "saas.churn_signal", {
      churnedMrr: churnedMrrValue === null ? null : round(churnedMrrValue),
      churnEvents: churnEvidence.events,
      affectedCustomers: churnedCustomers,
      totalCustomers,
      activeCustomers,
      churnedCustomers,
      churnShare,
      highestChurnPeriod: churnEvidence.highestPeriod,
      churnRate: churnShare,
      sourceColumns,
      currentMrr,
    }),
  };
}

function summarizeSaasChurnEvidence(rows: Record<string, unknown>[], summary: SaasAssistantSummary) {
  const mappings = summary.mappings;
  const periodColumn = mappings.period;
  const movementColumn = mappings.movement_type;
  const deltaColumn = mappings.mrr_delta;
  const beforeColumn = mappings.mrr_before;
  const afterColumn = mappings.mrr_after || mappings.mrr;
  const statusColumn = mappings.subscription_status;
  const customerColumn = mappings.customer_id;
  const eventDateColumn = mappings.movement_event_date;
  const latestRows = periodColumn && summary.latestPeriod
    ? rows.filter((row) => normalizePeriodForSaasAssistant(row[periodColumn]) === summary.latestPeriod)
    : rows;
  const sourceColumns = [movementColumn, deltaColumn, beforeColumn, afterColumn, customerColumn, eventDateColumn, statusColumn].filter((column): column is string => Boolean(column));
  const churnRows = latestRows.flatMap((row) => {
    const movement = movementColumn ? normalizeSaasState(row[movementColumn]) : "";
    const status = statusColumn ? normalizeSaasState(row[statusColumn]) : "";
    const before = beforeColumn ? parseBusinessNumber(row[beforeColumn]) : null;
    const after = afterColumn ? parseBusinessNumber(row[afterColumn]) : null;
    const delta = deltaColumn ? parseBusinessNumber(row[deltaColumn]) : null;
    const hasExplicitChurnMovement = ["churn", "churned", "cancelled", "canceled", "cancellation"].includes(movement);
    const hasFullLossTransition = before !== null && before > 0 && after !== null && after <= 0;
    const hasChurnStatus = ["churn", "churned", "cancelled", "canceled", "inactive", "expired"].includes(status);
    if (!hasExplicitChurnMovement && !(hasFullLossTransition && (hasChurnStatus || !movementColumn))) return [];
    const amount = delta !== null
      ? Math.abs(delta)
      : before !== null && after !== null
        ? Math.max(0, before - after)
        : 0;
    return [{
      row,
      amount,
      customer: customerColumn ? String(row[customerColumn] ?? "").trim() : "",
      period: periodColumn ? normalizePeriodForSaasAssistant(row[periodColumn]) : null,
    }];
  });
  const customers = customerColumn
    ? new Set(churnRows.map((item) => item.customer).filter(Boolean)).size
    : null;
  const periodTotals = new Map<string, number>();
  for (const item of rows) {
    if (!periodColumn) continue;
    const period = normalizePeriodForSaasAssistant(item[periodColumn]);
    if (!period) continue;
    const evidence = summarizeSaasChurnEvidenceForRow(item, summary);
    if (!evidence.isChurn) continue;
    periodTotals.set(period, (periodTotals.get(period) ?? 0) + evidence.amount);
  }
  const highestPeriod = Array.from(periodTotals.entries())
    .map(([period, mrr]) => ({ period, mrr: round(mrr) }))
    .sort((a, b) => b.mrr - a.mrr)[0] ?? null;
  return {
    mrr: round(churnRows.reduce((total, item) => total + item.amount, 0)),
    events: churnRows.length,
    customers,
    highestPeriod,
    sourceColumns,
  };
}

function summarizeSaasChurnEvidenceForRow(row: Record<string, unknown>, summary: SaasAssistantSummary) {
  const movementColumn = summary.mappings.movement_type;
  const deltaColumn = summary.mappings.mrr_delta;
  const beforeColumn = summary.mappings.mrr_before;
  const afterColumn = summary.mappings.mrr_after || summary.mappings.mrr;
  const statusColumn = summary.mappings.subscription_status;
  const movement = movementColumn ? normalizeSaasState(row[movementColumn]) : "";
  const status = statusColumn ? normalizeSaasState(row[statusColumn]) : "";
  const before = beforeColumn ? parseBusinessNumber(row[beforeColumn]) : null;
  const after = afterColumn ? parseBusinessNumber(row[afterColumn]) : null;
  const delta = deltaColumn ? parseBusinessNumber(row[deltaColumn]) : null;
  const isChurnMovement = ["churn", "churned", "cancelled", "canceled", "cancellation"].includes(movement);
  const isFullLossTransition = before !== null && before > 0 && after !== null && after <= 0;
  const isChurnStatus = ["churn", "churned", "cancelled", "canceled", "inactive", "expired"].includes(status);
  const isChurn = isChurnMovement || (isFullLossTransition && (isChurnStatus || !movementColumn));
  return {
    isChurn,
    amount: isChurn
      ? delta !== null
        ? Math.abs(delta)
        : before !== null && after !== null
          ? Math.max(0, before - after)
          : 0
      : 0,
  };
}

function normalizeSaasState(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizePeriodForSaasAssistant(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime()) && /^\d{4}-\d{1,2}-\d{1,2}/.test(text)) return parsed.toISOString().slice(0, 10);
  return text;
}

function describeSaasAvailableFields(input: DatasetAssistantInput, summary: SaasAssistantSummary): DatasetAssistantDeterministicResult {
  const mappings = Object.entries(summary.mappings).map(([concept, column]) => ({ concept, column: column ?? "" })).filter((row) => row.column);
  return {
    status: "success",
    answer: [
      `Answer: UseClevr found ${mappings.length.toLocaleString("en-US")} SaaS semantic field${mappings.length === 1 ? "" : "s"} in this dataset.`,
      `Evidence: ${mappings.slice(0, 8).map((row) => `${row.concept} = ${row.column}`).join("; ")}${mappings.length > 8 ? "; ..." : ""}`,
      `Takeaway: Available capabilities include ${summary.suggestedQuestions.length > 0 ? summary.suggestedQuestions.join("; ") : "basic SaaS field review"}. No provider-generated values were used.`,
      `Next question: ${summary.suggestedQuestions[0] ?? "Ask what SaaS metric needs additional source data."}`,
    ].join("\n\n"),
    insight: `${mappings.length.toLocaleString("en-US")} SaaS fields are mapped.`,
    explanation: "The Dataset Intelligence Engine resolved SaaS semantic mappings before answering.",
    recommendation: summary.suggestedQuestions[0] ?? "Ask about a mapped SaaS metric.",
    data: mappings,
    chartType: "table",
    result: saasResult(input, summary, "saas.available_fields", { mappings, dataGaps: summary.dataGaps }),
  };
}

function saasMissingEvidence(input: DatasetAssistantInput, message: string, missingFields: string[], intent: string): DatasetAssistantDeterministicResult {
  return {
    status: "success",
    answer: [
      `Answer: ${message}`,
      `Evidence: Missing required source evidence: ${missingFields.join(", ")}.`,
      "Takeaway: UseClevr will not route recognized SaaS metric gaps to a provider or fabricate values.",
      "Next question: Ask about a SaaS metric backed by mapped source fields in this dataset.",
    ].join("\n\n"),
    insight: "Required SaaS source evidence is missing.",
    explanation: "Direct data analysis recognized the SaaS question and refused the calculation because the required semantic fields are unavailable.",
    recommendation: "Ask about a SaaS metric backed by mapped source fields in this dataset.",
    data: missingFields.map((field) => ({ field, status: "missing" })),
    chartType: "table",
    result: {
      intent,
      status: "missing_evidence",
      missingFields,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
    },
  };
}

function saasResult(input: DatasetAssistantInput, summary: SaasAssistantSummary, intent: string, extra: Record<string, unknown>) {
  return {
    intent,
    status: "success",
    confidence: summary.confidence,
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    profile: summary.profile,
    mappings: summary.mappings,
    ...extra,
  };
}

function movementMetricValues(summary: SaasAssistantSummary) {
  return {
    newMrr: metricValue(summary, "new_mrr"),
    expansionMrr: metricValue(summary, "expansion_mrr"),
    contractionMrr: metricValue(summary, "contraction_mrr"),
    churnedMrr: metricValue(summary, "churned_mrr"),
  };
}

function metricValue(summary: SaasAssistantSummary, metricId: string) {
  const metric = summary.metrics[metricId];
  return metric?.status === "available" && metric.value !== null ? metric.value : null;
}

function missingSaasMetricMessage(metricId: string, label: string) {
  const messages: Record<string, string> = {
    mrr: "Current MRR is unavailable because no validated MRR or MRR-after field was found in this dataset.",
    arr: "Current ARR is unavailable because no validated ARR field or annualizable MRR field was found in this dataset.",
    new_mrr: "New MRR is unavailable because no validated movement type plus MRR delta fields were found in this dataset.",
    expansion_mrr: "Expansion MRR is unavailable because no validated expansion MRR field or movement type plus MRR delta fields were found in this dataset.",
    contraction_mrr: "Contraction MRR is unavailable because no validated contraction MRR field or movement type plus MRR delta fields were found in this dataset.",
    churned_mrr: "Churned MRR is unavailable because no validated churn movement type plus MRR delta fields were found in this dataset.",
    cac: "CAC is unavailable because no validated customer acquisition cost field was found in this dataset.",
    ltv: "LTV is unavailable because no validated lifetime value field was found in this dataset.",
    runway: "Runway is unavailable because no validated runway field was found in this dataset.",
    burn: "Burn is unavailable because no validated burn field was found in this dataset.",
  };
  return messages[metricId] ?? `${label} is unavailable because the required validated SaaS source fields were not found in this dataset.`;
}

function missingSaasMetricFields(metricId: string) {
  const fields: Record<string, string[]> = {
    mrr: ["mrr or mrr_after"],
    arr: ["arr or mrr"],
    new_mrr: ["movement_type plus mrr_delta"],
    expansion_mrr: ["expansion_mrr or movement_type plus mrr_delta"],
    contraction_mrr: ["contraction_mrr or movement_type plus mrr_delta"],
    churned_mrr: ["churn movement_type plus mrr_delta"],
    cac: ["cac"],
    ltv: ["ltv"],
    runway: ["runway"],
    burn: ["burn"],
  };
  return fields[metricId] ?? ["validated SaaS metric fields"];
}

function nextSaasQuestion(label: string) {
  if (label === "MRR") return "Next question: Ask what changed in MRR across the available periods.";
  if (label === "ARR") return "Next question: Ask how much New MRR, Expansion MRR, Contraction MRR, or Churned MRR is in the data.";
  return "Next question: Ask for the net MRR movement.";
}

function buildMarketplaceAssistantSummary(input: DatasetAssistantInput): MarketplaceAssistantSummary | null {
  const datasetType = input.datasetType.toLowerCase();
  const gmvColumn = findMarketplaceColumn(input.columns, [/^gmv$/, /^gross_merchandise_value$/, /^gross_merchandise$/], input.rows);
  const marketplaceRevenueColumn = findMarketplaceColumn(input.columns, [/^platform_fee$/, /^marketplace_revenue$/, /^take_rate_amount$/, /^commission$/], input.rows);
  const buyerColumn = findMarketplaceColumn(input.columns, [/^buyer_id$/, /^buyer$/, /^purchaser_id$/, /^purchaser$/], input.rows, false);
  const sellerColumn = findMarketplaceColumn(input.columns, [/^seller_id$/, /^seller$/, /^merchant_id$/, /^merchant$/, /^vendor_id$/], input.rows, false);
  const dateColumn = findMarketplaceColumn(input.columns, [/^date$/, /^transaction_date$/, /^order_date$/, /^period$/, /^month$/], input.rows, false);
  const hasMarketplaceShape = Boolean(gmvColumn && (buyerColumn || sellerColumn || marketplaceRevenueColumn || /marketplace/.test(datasetType)));
  if (!hasMarketplaceShape) return null;
  return {
    gmvColumn: gmvColumn!,
    marketplaceRevenueColumn,
    buyerColumn,
    sellerColumn,
    dateColumn,
    currencyCode: currencyCodeFromRows(input.rows, input.columns),
  };
}

function describeMarketplaceTotalGmv(input: DatasetAssistantInput, summary: MarketplaceAssistantSummary): DatasetAssistantDeterministicResult {
  const gmv = round(sumMarketplaceColumn(input.rows, summary.gmvColumn));
  return marketplaceSuccess(input, "marketplace.total_gmv", {
    answer: `Total GMV is ${formatMarketplaceValue(gmv, summary.currencyCode)}.`,
    insight: `UseClevr summed ${input.rows.length.toLocaleString("en-US")} validated row${input.rows.length === 1 ? "" : "s"} from "${summary.gmvColumn}".`,
    takeaway: "GMV is gross merchandise value; it is not labelled as generic company revenue or marketplace platform revenue.",
    recommendation: "Ask which buyers or sellers drive GMV concentration.",
    data: [
      { metric: "Total GMV", value: gmv, source: summary.gmvColumn },
      { metric: "Marketplace Revenue", value: summary.marketplaceRevenueColumn ? round(sumMarketplaceColumn(input.rows, summary.marketplaceRevenueColumn)) : null, source: summary.marketplaceRevenueColumn },
    ],
    result: {
      metric: "Total GMV",
      gmv,
      gmvColumn: summary.gmvColumn,
      marketplaceRevenueColumn: summary.marketplaceRevenueColumn,
    },
  });
}

function describeMarketplaceGmvTrend(input: DatasetAssistantInput, summary: MarketplaceAssistantSummary): DatasetAssistantDeterministicResult | null {
  if (!summary.dateColumn) return null;
  const periods = marketplacePeriods(input.rows, summary.dateColumn, summary.gmvColumn);
  const latestObserved = periods.at(-1);
  const completePeriods = periods.filter((period) => period.complete);
  const latestComparable = completePeriods.at(-1) ?? latestObserved;
  const previousComparable = completePeriods.length >= 2 ? completePeriods.at(-2) : periods.at(-2);
  const changePct = latestComparable && previousComparable && previousComparable.gmv !== 0 ? ((latestComparable.gmv - previousComparable.gmv) / previousComparable.gmv) * 100 : null;
  const latestScope = latestObserved?.complete ? "complete" : "partial/incomplete";
  const comparableText = latestComparable && previousComparable
    ? `Latest comparable movement: ${previousComparable.period} ${formatMarketplaceValue(previousComparable.gmv, summary.currencyCode)} to ${latestComparable.period} ${formatMarketplaceValue(latestComparable.gmv, summary.currencyCode)}${changePct === null ? "" : ` (${formatSignedPercent(changePct)})`}.`
    : "Comparable period movement is unavailable because fewer than two periods have comparable GMV evidence.";

  return marketplaceSuccess(input, "marketplace.gmv_trend", {
    answer: latestObserved
      ? `Latest observed GMV is ${formatMarketplaceValue(latestObserved.gmv, summary.currencyCode)} in ${latestObserved.period} (${latestScope}, ${latestObserved.rows.toLocaleString("en-US")} row${latestObserved.rows === 1 ? "" : "s"}). ${comparableText}`
      : "No valid GMV periods were found.",
    insight: `Grouped "${summary.gmvColumn}" by "${summary.dateColumn}" and kept the latest observed period even when it is partial.`,
    takeaway: latestObserved?.complete ? "The latest observed period has complete-period row coverage for this dataset." : "The latest observed period is shown as partial and kept separate from comparable complete-period movement.",
    recommendation: "Compare buyer and seller concentration against the latest observed GMV period.",
    data: periods.map((period) => ({
      period: period.period,
      gmv: period.gmv,
      rows: period.rows,
      complete: period.complete ? "complete" : "partial",
    })),
    result: {
      metric: "GMV trend",
      periods,
      latestObservedPeriod: latestObserved?.period ?? null,
      latestObservedGmv: latestObserved?.gmv ?? null,
      latestObservedComplete: latestObserved?.complete ?? null,
      latestComparablePeriod: latestComparable?.period ?? null,
      latestChangePct: changePct === null ? null : round(changePct, 1),
      gmvColumn: summary.gmvColumn,
      dateColumn: summary.dateColumn,
    },
  });
}

function describeMarketplaceBuyerRanking(input: DatasetAssistantInput, summary: MarketplaceAssistantSummary): DatasetAssistantDeterministicResult | null {
  if (!summary.buyerColumn) return null;
  const rows = marketplaceEntityRows(input.rows, summary.buyerColumn, summary.gmvColumn);
  const top = rows[0];
  return marketplaceSuccess(input, "marketplace.top_buyers", {
    answer: top
      ? `Top buyers/customers by GMV: ${top.segment} leads with ${formatMarketplaceValue(top.gmv, summary.currencyCode)}.`
      : "No buyer groups were available after Marketplace semantic validation.",
    insight: `Grouped by buyer field "${summary.buyerColumn}" and summed GMV from "${summary.gmvColumn}".`,
    takeaway: top ? `${top.segment} represents ${top.sharePct.toFixed(1)}% of detected GMV.` : "No buyer GMV concentration could be calculated.",
    recommendation: "Ask which sellers or merchants drive the most GMV.",
    data: rows,
    result: {
      metric: "Top buyers by GMV",
      groupBy: "buyer",
      groupColumn: summary.buyerColumn,
      gmvColumn: summary.gmvColumn,
      rows,
    },
  });
}

function describeMarketplaceSellerRanking(input: DatasetAssistantInput, summary: MarketplaceAssistantSummary): DatasetAssistantDeterministicResult | null {
  if (!summary.sellerColumn) return null;
  const rows = marketplaceEntityRows(input.rows, summary.sellerColumn, summary.gmvColumn)
    .map((row) => ({ ...row, inventoryExposure: null, stock: null }));
  const top = rows[0];
  return marketplaceSuccess(input, "marketplace.top_sellers", {
    answer: top
      ? `Top sellers/merchants by GMV: ${top.segment} leads with ${formatMarketplaceValue(top.gmv, summary.currencyCode)}. Inventory exposure is unavailable because no validated inventory or stock fields are present.`
      : "No seller or merchant groups were available after Marketplace semantic validation.",
    insight: `Grouped by seller/merchant field "${summary.sellerColumn}" and summed GMV from "${summary.gmvColumn}".`,
    takeaway: "Marketplace seller analysis reports seller/merchant concentration and keeps missing inventory evidence unavailable instead of treating it as zero.",
    recommendation: "Review seller concentration alongside marketplace revenue, refunds, and take rate.",
    data: rows,
    result: {
      metric: "Top sellers by GMV",
      groupBy: "seller",
      groupColumn: summary.sellerColumn,
      gmvColumn: summary.gmvColumn,
      rows,
      inventoryExposure: null,
      stock: null,
    },
  });
}

function marketplaceSuccess(input: DatasetAssistantInput, intent: string, output: {
  answer: string;
  insight: string;
  takeaway: string;
  recommendation: string;
  data: Array<Record<string, string | number | null>>;
  result: Record<string, unknown>;
}): DatasetAssistantDeterministicResult {
  return {
    status: "success",
    answer: [
      `Answer: ${output.answer}`,
      `Insight: ${output.insight}`,
      `Takeaway: ${output.takeaway}`,
      `Next question: ${output.recommendation}`,
    ].join("\n\n"),
    insight: output.insight,
    explanation: "Marketplace Assistant calculations use validated GMV, buyer, seller, platform-fee, and period source fields without cloud provider values.",
    recommendation: output.recommendation,
    data: output.data,
    chartType: output.data.length > 1 ? "table" : "kpi",
    result: {
      intent,
      status: "success",
      confidence: 0.92,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      ...output.result,
    },
  };
}

function findMarketplaceColumn(columns: string[], patterns: RegExp[], rows: Record<string, unknown>[], requireNumeric = true) {
  const candidates = columns.filter((column) => {
    const normalized = column.toLowerCase().trim().replace(/[\s-]+/g, "_");
    return patterns.some((pattern) => pattern.test(normalized));
  });
  if (!requireNumeric) return candidates[0] ?? null;
  return candidates.find((column) => rows.some((row) => parseBusinessNumber(row[column]) !== null)) ?? null;
}

function sumMarketplaceColumn(rows: Record<string, unknown>[], column: string) {
  return rows.reduce((total, row) => total + (parseBusinessNumber(row[column]) ?? 0), 0);
}

function marketplaceEntityRows(rows: Record<string, unknown>[], entityColumn: string, gmvColumn: string) {
  const totalGmv = sumMarketplaceColumn(rows, gmvColumn);
  const groups = new Map<string, { gmv: number; rows: number }>();
  for (const row of rows) {
    const segment = String(row[entityColumn] ?? "").trim() || "Unknown";
    const current = groups.get(segment) ?? { gmv: 0, rows: 0 };
    current.gmv += parseBusinessNumber(row[gmvColumn]) ?? 0;
    current.rows += 1;
    groups.set(segment, current);
  }
  return Array.from(groups.entries())
    .map(([segment, value]) => ({
      segment,
      gmv: round(value.gmv),
      rows: value.rows,
      sharePct: totalGmv > 0 ? round((value.gmv / totalGmv) * 100, 1) : 0,
    }))
    .sort((a, b) => b.gmv - a.gmv || a.segment.localeCompare(b.segment))
    .slice(0, 10);
}

function marketplacePeriods(rows: Record<string, unknown>[], dateColumn: string, gmvColumn: string) {
  const groups = new Map<string, { gmv: number; rows: number }>();
  for (const row of rows) {
    const period = monthKey(row[dateColumn]);
    if (!period) continue;
    const current = groups.get(period) ?? { gmv: 0, rows: 0 };
    current.gmv += parseBusinessNumber(row[gmvColumn]) ?? 0;
    current.rows += 1;
    groups.set(period, current);
  }
  const periods = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, gmv: round(value.gmv), rows: value.rows, complete: true }));
  if (periods.length <= 1) return periods;
  const maxRows = Math.max(...periods.map((period) => period.rows));
  return periods.map((period) => ({
    ...period,
    complete: period.rows >= maxRows * 0.8,
  }));
}

function formatMarketplaceValue(value: number, currencyCode: string | null) {
  if (!currencyCode) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function currencyCodeFromRows(rows: Record<string, unknown>[], columns: string[]) {
  const currencyColumn = columns.find((column) => /^currency$/i.test(column) || /currency_code/i.test(column));
  if (!currencyColumn) return null;
  const value = rows.map((row) => String(row[currencyColumn] ?? "").trim().toUpperCase()).find((item) => /^[A-Z]{3}$/.test(item));
  return value ?? null;
}

function describeTransactionAnomalies(input: DatasetAssistantInput & {
  schema: ReturnType<typeof buildSemanticSchema>;
}): DatasetAssistantDeterministicResult {
  const analysis = analyzeTransactionAmountAnomalies({
    rows: input.rows,
    columns: input.columns,
  });
  const currencyCode = input.schema.currencyCode;

  if (analysis.status === "missing_amount") {
    return {
      status: "success",
      answer: [
        "Answer: I can't detect unusual transactions because no validated transaction amount field was found.",
        "Evidence: Quantity, item count, ID, SKU, tax rate, and similar numeric identifier fields are not valid transaction amount fields.",
        "Takeaway: UseClevr will not run anomaly detection on arbitrary numeric columns.",
        "Next question: Upload or map an amount, transaction amount, payment amount, invoice amount, or transaction total field.",
      ].join("\n\n"),
      insight: "No validated transaction amount field is available for anomaly detection.",
      explanation: "Direct data analysis refused transaction anomaly detection because amount semantics were missing.",
      recommendation: "Upload or map a transaction amount field before asking for outliers.",
      data: [{ capability: "transaction_amount", status: "unavailable" }],
      chartType: "table",
      result: anomalyResult(input, analysis),
    };
  }

  if (analysis.status === "insufficient_data") {
    return {
      status: "success",
      answer: [
        "Answer: There are not enough valid transaction amounts in this period to reliably detect statistical outliers.",
        `Evidence: ${analysis.validCount.toLocaleString("en-US")} valid amount value(s) were found in "${analysis.amountColumn}". At least 8 valid values are required for this IQR check.${analysis.invalidCount > 0 ? ` ${analysis.invalidCount.toLocaleString("en-US")} invalid or blank value(s) were excluded.` : ""}`,
        `Takeaway: I can show the largest transactions, but I can't reliably classify them as unusual.${analysis.largest ? ` The largest transaction is ${analysis.largest.label} at ${formatValue(analysis.largest.amount, currencyCode)}.` : ""}`,
        "Next question: Add more transaction rows or ask for the largest transactions instead.",
      ].join("\n\n"),
      insight: "Insufficient valid transaction amounts for reliable anomaly detection.",
      explanation: "Direct data analysis requires a minimum sample before applying IQR outlier detection.",
      recommendation: "Add more valid transaction rows or ask for largest transactions.",
      data: analysis.largest ? [{ label: analysis.largest.label, amount: analysis.largest.amount, status: "largest_only" }] : [],
      chartType: "table",
      result: anomalyResult(input, analysis),
    };
  }

  if (analysis.candidates.length === 0) {
    return {
      status: "success",
      answer: [
        "Answer: I didn't detect any strong transaction-amount outliers for this period.",
        `Evidence: Median transaction: ${formatValue(analysis.median || 0, currencyCode)}. Q1: ${formatValue(analysis.q1 || 0, currencyCode)}. Q3: ${formatValue(analysis.q3 || 0, currencyCode)}. IQR: ${formatValue(analysis.iqr || 0, currencyCode)}. Upper outlier threshold: ${formatValue(analysis.upperThreshold || 0, currencyCode)}.${analysis.invalidCount > 0 ? ` ${analysis.invalidCount.toLocaleString("en-US")} invalid or blank value(s) were excluded.` : ""}`,
        `Takeaway: No strong transaction-amount anomalies were detected.${analysis.largest ? ` The largest transaction was ${analysis.largest.label} at ${formatValue(analysis.largest.amount, currencyCode)}, but it does not exceed the anomaly threshold.` : ""}`,
        "Next question: No anomaly review is required based on transaction amount alone.",
      ].join("\n\n"),
      insight: "No strong transaction-amount outliers were detected.",
      explanation: `Applied IQR outlier detection to "${analysis.amountColumn}" after excluding invalid values.`,
      recommendation: "No anomaly review is required based on transaction amount alone.",
      data: [
        { metric: "Median transaction", value: analysis.median },
        { metric: "Upper outlier threshold", value: analysis.upperThreshold },
      ],
      chartType: "table",
      result: anomalyResult(input, analysis),
    };
  }

  return {
    status: "success",
    answer: [
      `Answer: Yes. I found ${analysis.candidates.length.toLocaleString("en-US")} ${analysis.candidates.length === 1 ? "transaction that is" : "transactions that are"} statistically unusual compared with the typical transaction size this period.`,
      [
        `Evidence: Median transaction: ${formatValue(analysis.median || 0, currencyCode)}`,
        `Q1: ${formatValue(analysis.q1 || 0, currencyCode)}`,
        `Q3: ${formatValue(analysis.q3 || 0, currencyCode)}`,
        `IQR: ${formatValue(analysis.iqr || 0, currencyCode)}`,
        `Upper outlier threshold: ${formatValue(analysis.upperThreshold || 0, currencyCode)}`,
        ...(analysis.invalidCount > 0 ? [`${analysis.invalidCount.toLocaleString("en-US")} invalid or blank value(s) were excluded.`] : []),
        ...analysis.candidates.slice(0, 5).map((candidate) => `${candidate.label}: ${formatValue(candidate.amount, currencyCode)} - ${candidate.thresholdMultiple ?? "above"}x threshold, ${candidate.medianMultiple ?? "above"}x median${candidate.context ? ` (${candidate.context})` : ""}`),
      ].join("\n"),
      "Takeaway: These transactions are statistical outlier candidates, not proof of an error or misconduct.",
      "Next question: Review the flagged outlier transactions and confirm that the amounts and categories are expected.",
    ].join("\n\n"),
    insight: `${analysis.candidates.length.toLocaleString("en-US")} transaction-amount outlier candidate${analysis.candidates.length === 1 ? "" : "s"} detected.`,
    explanation: `Applied IQR outlier detection to "${analysis.amountColumn}" using ${analysis.validCount.toLocaleString("en-US")} valid amount values.`,
    recommendation: "Review the flagged outlier transactions and confirm that the amounts and categories are expected.",
    data: analysis.candidates.map((candidate) => ({
      label: candidate.label,
      amount: candidate.amount,
      medianMultiple: candidate.medianMultiple,
      thresholdMultiple: candidate.thresholdMultiple,
      context: candidate.context,
      status: "outlier_candidate",
    })),
    chartType: "table",
    result: anomalyResult(input, analysis),
  };
}

function describeLargestTransactions(input: DatasetAssistantInput & {
  schema: ReturnType<typeof buildSemanticSchema>;
}): DatasetAssistantDeterministicResult {
  const analysis = analyzeTransactionAmountAnomalies({
    rows: input.rows,
    columns: input.columns,
    minimumValidCount: 1,
  });
  if (!analysis.amountColumn || !analysis.largest) {
    return {
      status: "success",
      answer: [
        "Answer: I can't rank largest transactions because no validated transaction amount field was found.",
        "Evidence: Quantity, IDs, SKUs, rates, and counts are not valid transaction amount fields.",
        "Takeaway: UseClevr will not rank arbitrary numeric columns as transaction values.",
        "Next question: Upload or map an amount, transaction amount, payment amount, invoice amount, or transaction total field.",
      ].join("\n\n"),
      insight: "No validated transaction amount field is available for largest-transaction ranking.",
      explanation: "Direct data analysis refused largest-transaction ranking because amount semantics were missing.",
      recommendation: "Upload or map a transaction amount field.",
      data: [{ capability: "transaction_amount", status: "unavailable" }],
      chartType: "table",
      result: {
        intent: "largest_transactions",
        status: "missing_amount",
        confidence: 0.4,
        datasetId: input.datasetId,
        datasetType: input.datasetType,
      },
    };
  }
  const amountColumn = analysis.amountColumn;
  const rows = input.rows
    .map((row, rowIndex) => ({ row, rowIndex, amount: parseBusinessNumber(row[amountColumn]) }))
    .filter((row): row is { row: Record<string, unknown>; rowIndex: number; amount: number } => row.amount !== null)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 10)
    .map((row) => ({
      label: labelForTransactionRow(row.row, row.rowIndex),
      amount: round(row.amount),
      context: contextForTransactionRow(row.row, amountColumn),
    }));

  return {
    status: "success",
    answer: [
      `Answer: The largest transaction is ${rows[0].label} at ${formatValue(rows[0].amount, input.schema.currencyCode)}.`,
      `Evidence: Ranked ${analysis.validCount.toLocaleString("en-US")} valid transaction amount value(s) from "${amountColumn}" by absolute amount.`,
      "Takeaway: This ranking shows the largest transaction amounts only; it does not classify them as unusual.",
      "Next question: Ask about unusual transactions to run statistical outlier detection.",
    ].join("\n\n"),
    insight: `Largest transaction: ${rows[0].label}.`,
    explanation: `Ranked validated transaction values from "${amountColumn}".`,
    recommendation: "Ask about unusual transactions to run statistical outlier detection.",
    data: rows,
    chartType: "table",
    result: {
      intent: "largest_transactions",
      status: "success",
      confidence: 0.9,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      amountColumn,
      rows,
    },
  };
}

function describeExpenseCapability(input: DatasetAssistantInput & {
  schema: ReturnType<typeof buildSemanticSchema>;
}): DatasetAssistantDeterministicResult {
  const capabilities = detectDatasetSemanticCapabilities({ schema: input.schema, rows: input.rows });
  if (!capabilities.hasExpenseData) {
    const alternatives = availableExpenseAlternatives(capabilities);
    return {
      status: "success",
      answer: [
        "Answer: No expense or cost data was detected in this dataset, so I can't reliably determine your largest expenses.",
        `Insight: ${capabilities.hasRevenueData ? "The available data appears to contain sales or revenue records." : "Generic monetary fields such as amount, total, value, transaction, or price are semantically ambiguous."}`,
        "Evidence: No validated expense category, cost field, debit classification, or trusted expense mapping was found.",
        "Takeaway: UseClevr will not classify generic numeric values as expenses.",
        `Next question: ${alternatives}`,
      ].join("\n\n"),
      insight: "No validated expense or cost semantics were detected.",
      explanation: "Direct data analysis checked semantic field mappings and classifier values before refusing the expense calculation.",
      recommendation: alternatives,
      data: [
        { capability: "expense_data", status: "unavailable", evidence: "No reliable expense/cost semantics found." },
        { capability: "revenue_data", status: capabilities.hasRevenueData ? "available" : "unavailable", evidence: capabilities.revenueEvidence.join(" ") || null },
      ],
      chartType: "table",
      result: {
        intent: "ranking.top_expenses",
        status: "unsupported_semantics",
        confidence: 0.94,
        datasetId: input.datasetId,
        datasetType: input.datasetType,
        hasExpenseData: false,
        hasRevenueData: capabilities.hasRevenueData,
        evidence: capabilities.expenseEvidence,
      },
    };
  }

  const expenseColumn = semanticColumn(input.schema, "expenses") || semanticColumn(input.schema, "cogs");
  const typeColumn = findExpenseTypeColumn(input.rows, input.columns);
  const amountColumn = typeColumn ? findMonetaryAmountColumn(input.rows, input.columns) : null;
  const valueColumn = expenseColumn || amountColumn;
  if (!valueColumn) {
    return {
      status: "success",
      answer: [
        "Answer: Expense analysis unavailable: expense semantics were detected, but no numeric expense amount field was validated.",
        `Evidence: ${capabilities.expenseEvidence.join(" ")}`,
        "Takeaway: UseClevr needs both expense classification and numeric amount values before calculating largest expenses.",
        "Next question: Upload or map an expense amount, debit, cost, COGS, or unit cost field.",
      ].join("\n\n"),
      insight: "Expense labels exist, but no numeric expense amount is available.",
      explanation: "Direct data analysis refused the calculation because amount semantics were incomplete.",
      recommendation: "Upload or map an expense amount, debit, cost, COGS, or unit cost field.",
      data: capabilities.expenseEvidence.map((evidence) => ({ evidence })),
      chartType: "table",
      result: {
        intent: "ranking.top_expenses",
        status: "missing_amount",
        confidence: 0.9,
        datasetId: input.datasetId,
        datasetType: input.datasetType,
        evidence: capabilities.expenseEvidence,
      },
    };
  }

  const groupColumn = expenseGroupColumn(input.columns, valueColumn, typeColumn);
  const rows = expenseRows(input.rows, valueColumn, groupColumn, typeColumn).slice(0, 10);
  const top = rows[0];
  const evidence = capabilities.expenseEvidence.join(" ");
  return {
    status: "success",
    answer: [
      `Answer: ${top ? `${top.segment} is the largest detected expense/cost at ${formatValue(top.amount, input.schema.currencyCode)}.` : "No expense rows with numeric values were found."}`,
      `Evidence: ${evidence}`,
      `Takeaway: ${top ? "This calculation uses only validated expense/cost semantics." : "Expense semantics exist, but matching rows have no usable numeric values."}`,
      "Next question: Ask for expense trends, supplier concentration, or margin if revenue is also available.",
    ].join("\n\n"),
    insight: top ? `Largest detected expense/cost: ${top.segment}.` : "No numeric expense rows were available.",
    explanation: `Calculated from ${typeColumn ? `classifier "${typeColumn}" and amount column "${valueColumn}"` : `validated cost column "${valueColumn}"`}.`,
    recommendation: "Ask for expense trends, supplier concentration, or margin if revenue is also available.",
    data: rows,
    chartType: "table",
    result: {
      intent: "ranking.top_expenses",
      status: "success",
      confidence: 0.9,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      expenseColumn: valueColumn,
      expenseTypeColumn: typeColumn,
      groupColumn,
      evidence: capabilities.expenseEvidence,
      rows,
    },
  };
}

function describeRequestedSegment(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
  dimension: string;
  segment: string;
}): DatasetAssistantDeterministicResult {
  const summaries = summarizeDimension(input.rows, input.dimension, input.revenueColumn);
  const segment = summaries.find((row) => row.segment.toLowerCase() === input.segment.toLowerCase()) ??
    summarizeSegment(input.rows, input.dimension, input.segment, input.revenueColumn);
  const totalRevenue = sumRevenue(input.rows, input.revenueColumn);
  const periods = summarizePeriodsForSegment(input.rows, input.dimension, input.segment, input.revenueColumn);
  const trendText = trendSentence(periods);
  const formattedRevenue = formatValue(segment.revenue, input.currencyCode);

  return {
    status: "success",
    answer: `${segment.segment} in ${humanizeColumn(input.dimension)} generated ${formattedRevenue} across ${segment.rows} row${segment.rows === 1 ? "" : "s"}${totalRevenue > 0 ? `, representing ${segment.sharePct.toFixed(1)}% of detected revenue` : ""}.${trendText ? ` ${trendText}` : ""}`,
    insight: `${segment.segment} is a ${humanizeColumn(input.dimension)} segment with ${formattedRevenue} in detected revenue.`,
    explanation: `Calculated from column "${input.dimension}" matched to "${segment.segment}" and revenue column "${input.revenueColumn}".`,
    recommendation: periods.length >= 2 && periods[periods.length - 1].revenue < periods[periods.length - 2].revenue
      ? `Review what changed for ${segment.segment} between ${periods[periods.length - 2].period} and ${periods[periods.length - 1].period}.`
      : `Compare ${segment.segment} against the top ${humanizeColumn(input.dimension)} segments for growth, risk, and next actions.`,
    data: [
      {
        dimension: humanizeColumn(input.dimension),
        segment: segment.segment,
        revenue: round(segment.revenue),
        rows: segment.rows,
        sharePct: round(segment.sharePct, 1),
      },
      ...periods.slice(-4).map((period) => ({
        dimension: "Period",
        segment: period.period,
        revenue: round(period.revenue),
        rows: period.rows,
        sharePct: null,
      })),
    ],
    chartType: "table",
    result: {
      intent: "segment_lookup",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      dimension: input.dimension,
      segment: segment.segment,
      revenueColumn: input.revenueColumn,
      revenue: round(segment.revenue),
      sharePct: round(segment.sharePct, 1),
      periods,
    },
  };
}

function describeRevenueRisks(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
  dimensionColumns: string[];
}): DatasetAssistantDeterministicResult | null {
  const periodRisks = revenuePeriodRisks(input.rows, input.revenueColumn);
  const weakSegments = input.dimensionColumns
    .flatMap((dimension) => summarizeDimension(input.rows, dimension, input.revenueColumn)
      .slice(-3)
      .map((segment) => ({ ...segment, dimension })))
    .sort((a, b) => a.sharePct - b.sharePct)
    .slice(0, 5);
  const concentration = input.dimensionColumns
    .flatMap((dimension) => summarizeDimension(input.rows, dimension, input.revenueColumn)
      .slice(0, 1)
      .map((segment) => ({ ...segment, dimension })))
    .sort((a, b) => b.sharePct - a.sharePct)[0];

  const rows = [
    ...periodRisks.map((risk) => ({
      risk: "Revenue trend",
      detail: `${risk.previousPeriod} to ${risk.currentPeriod}`,
      value: round(risk.changePct, 1),
      revenue: round(risk.currentRevenue),
    })),
    ...weakSegments.map((segment) => ({
      risk: `Weak ${humanizeColumn(segment.dimension)}`,
      detail: segment.segment,
      value: round(segment.sharePct, 1),
      revenue: round(segment.revenue),
    })),
    ...(concentration && concentration.sharePct >= 50
      ? [{
        risk: "Revenue concentration",
        detail: `${concentration.segment} in ${humanizeColumn(concentration.dimension)}`,
        value: round(concentration.sharePct, 1),
        revenue: round(concentration.revenue),
      }]
      : []),
  ];

  if (rows.length === 0) return null;

  const leadingRisk = rows[0];
  return {
    status: "success",
    answer: `The biggest grounded revenue risk is ${String(leadingRisk.detail)}. ${riskExplanation(rows)}`,
    insight: `UseClevr found ${rows.length} revenue risk signal${rows.length === 1 ? "" : "s"} from the selected dataset.`,
    explanation: `Calculated from revenue column "${input.revenueColumn}" and available segment/date columns. No provider-generated values were used.`,
    recommendation: "Prioritize the largest negative period movement first, then review low-revenue segments and any high concentration risk.",
    data: rows,
    chartType: "table",
    result: {
      intent: "revenue_risks",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      revenueColumn: input.revenueColumn,
      risks: rows,
    },
  };
}

function describeBestSegments(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
  dimensionColumns: string[];
}): DatasetAssistantDeterministicResult | null {
  const rows = input.dimensionColumns
    .flatMap((dimension) => summarizeDimension(input.rows, dimension, input.revenueColumn)
      .slice(0, 3)
      .map((segment) => ({
        dimension: humanizeColumn(dimension),
        segment: segment.segment,
        revenue: round(segment.revenue),
        rows: segment.rows,
        sharePct: round(segment.sharePct, 1),
      })))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 8);

  if (rows.length === 0) return null;
  const best = rows[0];
  return {
    status: "success",
    answer: `${best.segment} is the strongest detected segment, with ${formatValue(Number(best.revenue), input.currencyCode)} in revenue.`,
    insight: `Best segment: ${best.segment} (${best.dimension}).`,
    explanation: `Ranked available segment columns by summed revenue from "${input.revenueColumn}".`,
    recommendation: "Use the top segments as benchmarks, then compare trend and margin where those fields are available.",
    data: rows,
    chartType: "table",
    result: {
      intent: "best_segments",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      revenueColumn: input.revenueColumn,
      segments: rows,
    },
  };
}

function describeRevenueTrend(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
}): DatasetAssistantDeterministicResult | null {
  const periods = summarizePeriods(input.rows, input.revenueColumn);
  if (periods.length < 2) return null;
  const previous = periods[periods.length - 2];
  const current = periods[periods.length - 1];
  const change = current.revenue - previous.revenue;
  const changePct = previous.revenue === 0 ? null : (change / previous.revenue) * 100;
  const direction = change >= 0 ? "increased" : "declined";

  return {
    status: "success",
    answer: `Revenue ${direction} from ${formatValue(previous.revenue, input.currencyCode)} in ${previous.period} to ${formatValue(current.revenue, input.currencyCode)} in ${current.period}${changePct === null ? "" : ` (${formatSignedPercent(changePct)})`}.`,
    insight: `Latest period revenue: ${formatValue(current.revenue, input.currencyCode)}.`,
    explanation: `Grouped rows by detected date/period column and summed "${input.revenueColumn}".`,
    recommendation: change < 0 ? "Review the segments contributing most to the latest-period decline." : "Review which segments drove the latest-period increase and whether it is repeatable.",
    data: periods.slice(-6).map((period) => ({
      period: period.period,
      revenue: round(period.revenue),
      rows: period.rows,
    })),
    chartType: "table",
    result: {
      intent: "revenue_trend_summary",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      revenueColumn: input.revenueColumn,
      periods,
      latestChangePct: changePct === null ? null : round(changePct, 1),
    },
  };
}

function describeDatasetSummary(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
  dimensionColumns: string[];
}): DatasetAssistantDeterministicResult {
  const totalRevenue = sumRevenue(input.rows, input.revenueColumn);
  const topSegments = input.dimensionColumns
    .flatMap((dimension) => summarizeDimension(input.rows, dimension, input.revenueColumn)
      .slice(0, 2)
      .map((segment) => ({
        dimension: humanizeColumn(dimension),
        segment: segment.segment,
        revenue: round(segment.revenue),
        rows: segment.rows,
        sharePct: round(segment.sharePct, 1),
      })))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 5);
  const trend = describeRevenueTrend(input);
  const topText = topSegments.length
    ? ` Top segment: ${topSegments[0].segment} (${topSegments[0].dimension}) with ${formatValue(Number(topSegments[0].revenue), input.currencyCode)}.`
    : "";

  return {
    status: "success",
    answer: `The selected dataset contains ${input.rows.length.toLocaleString("en-US")} usable rows and ${input.columns.length.toLocaleString("en-US")} columns. Detected revenue totals ${formatValue(totalRevenue, input.currencyCode)}.${topText}${trend ? ` ${trend.answer}` : ""}`,
    insight: `Detected revenue total: ${formatValue(totalRevenue, input.currencyCode)}.`,
    explanation: `Calculated from revenue column "${input.revenueColumn}" and available dataset rows. No provider-generated values were used.`,
    recommendation: topSegments.length
      ? "Ask about a specific segment, plan, channel, region, or revenue risk for a narrower answer."
      : "Ask about revenue trend, totals, data quality, or a specific column for a narrower answer.",
    data: topSegments.length ? topSegments : [{ metric: "Detected revenue", value: round(totalRevenue), rows: input.rows.length }],
    chartType: "table",
    result: {
      intent: "dataset_grounded_summary",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      revenueColumn: input.revenueColumn,
      revenue: round(totalRevenue),
      topSegments,
      latestTrend: trend?.result ?? null,
    },
  };
}

function findRequestedSegment(question: string, rows: Record<string, unknown>[], dimensions: string[]) {
  const normalizedQuestion = normalizeToken(question);
  for (const dimension of dimensions) {
    const values = uniqueValues(rows, dimension);
    for (const value of values) {
      if (normalizeToken(value) && normalizedQuestion.includes(normalizeToken(value))) {
        return { dimension, segment: value };
      }
    }
  }
  return null;
}

function findDimensionColumns(columns: string[], revenueColumn: string) {
  return columns
    .filter((column) => column !== revenueColumn)
    .filter((column) => DIMENSION_PATTERNS.some((pattern) => pattern.test(column)))
    .slice(0, 8);
}

function summarizeDimension(rows: Record<string, unknown>[], dimension: string, revenueColumn: string): SegmentSummary[] {
  const totalRevenue = sumRevenue(rows, revenueColumn);
  const groups = new Map<string, { revenue: number; rows: number }>();
  for (const row of rows) {
    const segment = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const current = groups.get(segment) ?? { revenue: 0, rows: 0 };
    current.revenue += parseBusinessNumber(row[revenueColumn]) ?? 0;
    current.rows += 1;
    groups.set(segment, current);
  }
  return Array.from(groups.entries())
    .map(([segment, value]) => ({
      dimension,
      segment,
      revenue: round(value.revenue),
      rows: value.rows,
      sharePct: totalRevenue > 0 ? round((value.revenue / totalRevenue) * 100, 1) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function summarizeSegment(rows: Record<string, unknown>[], dimension: string, segment: string, revenueColumn: string): SegmentSummary {
  const matchedRows = rows.filter((row) => String(row[dimension] ?? "").trim().toLowerCase() === segment.toLowerCase());
  const revenue = sumRevenue(matchedRows, revenueColumn);
  const totalRevenue = sumRevenue(rows, revenueColumn);
  return {
    dimension,
    segment,
    revenue: round(revenue),
    rows: matchedRows.length,
    sharePct: totalRevenue > 0 ? round((revenue / totalRevenue) * 100, 1) : 0,
  };
}

function summarizePeriodsForSegment(
  rows: Record<string, unknown>[],
  dimension: string,
  segment: string,
  revenueColumn: string,
) {
  const allowedPeriods = completePeriodKeys(rows);
  return summarizePeriods(
    rows.filter((row) => String(row[dimension] ?? "").trim().toLowerCase() === segment.toLowerCase()),
    revenueColumn,
    allowedPeriods,
  );
}

function summarizePeriods(rows: Record<string, unknown>[], revenueColumn: string, allowedPeriods?: Set<string>): PeriodSummary[] {
  const dateColumn = findDateColumn(rows);
  if (!dateColumn) return [];
  const groups = new Map<string, { revenue: number; rows: number }>();
  for (const row of rows) {
    const period = monthKey(row[dateColumn]);
    if (!period) continue;
    if (allowedPeriods && !allowedPeriods.has(period)) continue;
    const current = groups.get(period) ?? { revenue: 0, rows: 0 };
    current.revenue += parseBusinessNumber(row[revenueColumn]) ?? 0;
    current.rows += 1;
    groups.set(period, current);
  }
  const periods = Array.from(groups.entries())
    .map(([period, value]) => ({ period, revenue: round(value.revenue), rows: value.rows }))
    .sort((a, b) => a.period.localeCompare(b.period));
  if (allowedPeriods) return periods;
  const complete = completePeriodKeys(rows);
  return complete.size > 0 ? periods.filter((period) => complete.has(period.period)) : periods;
}

function completePeriodKeys(rows: Record<string, unknown>[]) {
  const dateColumn = findDateColumn(rows);
  if (!dateColumn) return new Set<string>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    const period = monthKey(row[dateColumn]);
    if (!period) continue;
    counts.set(period, (counts.get(period) ?? 0) + 1);
  }
  const entries = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length <= 2) return new Set(entries.map(([period]) => period));
  const maxCount = Math.max(...entries.map(([, count]) => count));
  const trailingPeriod = entries[entries.length - 1][0];
  return new Set(entries
    .filter(([period, count]) => period !== trailingPeriod || count >= maxCount * 0.5)
    .map(([period]) => period));
}

function revenuePeriodRisks(rows: Record<string, unknown>[], revenueColumn: string) {
  const periods = summarizePeriods(rows, revenueColumn);
  const risks: Array<{
    previousPeriod: string;
    currentPeriod: string;
    previousRevenue: number;
    currentRevenue: number;
    changePct: number;
  }> = [];
  for (let index = 1; index < periods.length; index += 1) {
    const previous = periods[index - 1];
    const current = periods[index];
    if (previous.revenue <= 0 || current.revenue >= previous.revenue) continue;
    risks.push({
      previousPeriod: previous.period,
      currentPeriod: current.period,
      previousRevenue: previous.revenue,
      currentRevenue: current.revenue,
      changePct: round(((current.revenue - previous.revenue) / previous.revenue) * 100, 1),
    });
  }
  return risks.sort((a, b) => a.changePct - b.changePct).slice(0, 3);
}

function uniqueValues(rows: Record<string, unknown>[], column: string) {
  return Array.from(new Set(rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean))).slice(0, 200);
}

function sumRevenue(rows: Record<string, unknown>[], revenueColumn: string) {
  return rows.reduce((total, row) => total + (parseBusinessNumber(row[revenueColumn]) ?? 0), 0);
}

function findDateColumn(rows: Record<string, unknown>[]) {
  const sample = rows[0] ?? {};
  return Object.keys(sample).find((column) => /date|month|period/i.test(column));
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

function trendSentence(periods: PeriodSummary[]) {
  if (periods.length < 2) return "";
  const previous = periods[periods.length - 2];
  const current = periods[periods.length - 1];
  if (previous.revenue === 0) return "";
  const changePct = ((current.revenue - previous.revenue) / previous.revenue) * 100;
  return `Latest comparable movement: ${previous.period} ${formatNumber(previous.revenue)} to ${current.period} ${formatNumber(current.revenue)} (${formatSignedPercent(changePct)}).`;
}

function riskExplanation(rows: Array<Record<string, string | number | null>>) {
  const trend = rows.find((row) => row.risk === "Revenue trend");
  if (trend) return `Detected revenue declined ${formatSignedPercent(Number(trend.value))} for ${trend.detail}.`;
  const weak = rows.find((row) => String(row.risk).startsWith("Weak"));
  if (weak) return `${weak.detail} contributes only ${Number(weak.value).toFixed(1)}% of detected revenue.`;
  return "The dataset shows revenue concentration that should be reviewed.";
}

function isRevenueRiskQuestion(question: string) {
  return /risk|weak|problem|concern|declin|drop|down|loss/i.test(question) && /revenue|sales|segment|plan|growth/i.test(question);
}

function isBestSegmentQuestion(question: string) {
  return /best|top|strong|largest|highest|perform/i.test(question) && /segment|plan|channel|region|country|product|customer|category/i.test(question);
}

function isExpenseQuestion(question: string) {
  return /expense|expenses|spend|spending|cost|costs|opex|operating\s+expense|money\s+going/i.test(question) &&
    /largest|biggest|top|most|where|show|what|which|total|category/i.test(question);
}

function isAnomalyQuestion(question: string) {
  return /unusual|anomal|outlier|abnormal|stand(s)?\s+out|suspicious/i.test(question) &&
    /transaction|payment|amount|anything|any|value/i.test(question);
}

function isLargestTransactionQuestion(question: string) {
  return /largest|biggest|highest[-\s]*value|top/i.test(question) && /transaction|payment|amount|value/i.test(question);
}

function availableExpenseAlternatives(capabilities: ReturnType<typeof detectDatasetSemanticCapabilities>) {
  const alternatives: string[] = [];
  if (capabilities.hasRevenueData) {
    alternatives.push("largest revenue categories", "top-selling products", "biggest revenue transactions", "sales trends");
  }
  if (alternatives.length === 0) return "Ask about data quality, row counts, or upload a dataset with expense/cost columns.";
  return `I can analyze ${alternatives.join(", ")} instead.`;
}

function expenseGroupColumn(columns: string[], valueColumn: string, typeColumn: string | null) {
  const candidates = columns.filter((column) => column !== valueColumn && column !== typeColumn);
  return candidates.find((column) => /category|account/i.test(column)) ??
    candidates.find((column) => /supplier|vendor|merchant/i.test(column)) ??
    candidates.find((column) => /product/i.test(column)) ??
    candidates.find((column) => /description/i.test(column)) ??
    null;
}

function expenseRows(rows: Record<string, unknown>[], valueColumn: string, groupColumn: string | null, typeColumn: string | null) {
  const groups = new Map<string, { amount: number; rows: number }>();
  const quantityColumn = Object.keys(rows[0] ?? {}).find((column) => /^(quantity|qty|units)$/i.test(column));
  for (const row of rows) {
    if (typeColumn && !/\b(expense|expenses|cost|costs|cogs|opex|debit|supplier|vendor|procurement|operating expense|fixed costs|payroll|bank fees)\b/i.test(String(row[typeColumn] ?? ""))) continue;
    const baseValue = parseBusinessNumber(row[valueColumn]);
    if (baseValue === null) continue;
    const quantity = /unit[_\s-]*cost/i.test(valueColumn) && quantityColumn ? parseBusinessNumber(row[quantityColumn]) : null;
    const amount = Math.abs(baseValue * (quantity ?? 1));
    const segment = groupColumn ? String(row[groupColumn] ?? "Uncategorized").trim() || "Uncategorized" : valueColumn;
    const current = groups.get(segment) ?? { amount: 0, rows: 0 };
    current.amount += amount;
    current.rows += 1;
    groups.set(segment, current);
  }
  const total = Array.from(groups.values()).reduce((sum, row) => sum + row.amount, 0);
  return Array.from(groups.entries())
    .map(([segment, value]) => ({
      segment,
      amount: round(value.amount),
      rows: value.rows,
      sharePct: total > 0 ? round((value.amount / total) * 100, 1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function anomalyResult(
  input: DatasetAssistantInput,
  analysis: ReturnType<typeof analyzeTransactionAmountAnomalies>,
) {
  return {
    intent: "unusual_transactions",
    status: analysis.status,
    confidence: analysis.confidence,
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    amountColumn: analysis.amountColumn,
    validCount: analysis.validCount,
    invalidCount: analysis.invalidCount,
    median: analysis.median,
    q1: analysis.q1,
    q3: analysis.q3,
    iqr: analysis.iqr,
    lowerThreshold: analysis.lowerThreshold,
    upperThreshold: analysis.upperThreshold,
    outlierCount: analysis.candidates.length,
    candidates: analysis.candidates,
    largest: analysis.largest,
  };
}

function labelForTransactionRow(row: Record<string, unknown>, rowIndex: number) {
  const column = Object.keys(row).find((key) => /description|merchant|supplier|vendor|product|item|category|name/i.test(key));
  const value = column ? String(row[column] ?? "").trim() : "";
  return value || `Row ${rowIndex + 1}`;
}

function contextForTransactionRow(row: Record<string, unknown>, amountColumn: string) {
  const parts = Object.keys(row)
    .filter((column) => column !== amountColumn && /category|type|merchant|supplier|vendor|product|description/i.test(column))
    .map((column) => {
      const value = String(row[column] ?? "").trim();
      return value ? `${humanizeColumn(column)}: ${value}` : "";
    })
    .filter(Boolean)
    .slice(0, 3);
  return parts.length > 0 ? parts.join("; ") : null;
}

function isGrowthQuestion(question: string) {
  return /growth|trend|over\s+time|increase|decrease/i.test(question) && /revenue|sales|growth|trend/i.test(question);
}

function isExplicitRevenueTrendQuestion(question: string) {
  return /revenue|sales|trend|over\s+time/i.test(question) && /growth|trend|increase|decrease|over\s+time/i.test(question);
}

function isForecastQuestion(question: string) {
  return /forecast|predict|projection|next\s+(month|period|quarter)/i.test(question);
}

function isDatasetSummaryQuestion(question: string) {
  return /summary|overview|summarize|analyse|analyze|what\s+do\s+you\s+see|tell\s+me\s+about|dataset|total\s+revenue|revenue\s+summary/i.test(question);
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function humanizeColumn(column: string) {
  return column.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
