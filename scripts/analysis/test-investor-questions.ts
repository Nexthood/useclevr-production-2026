import assert from "node:assert/strict";

import { availableAnalyticalSuggestions } from "../../src/lib/data/analytical-intents";
import { detectBusinessModelFromColumns, resolveBusinessModel } from "../../src/lib/data/business-model";
import { buildBusinessSemanticProfile } from "../../src/lib/data/business-semantics";
import { answerDatasetQuestionDeterministically } from "../../src/lib/data/dataset-assistant-deterministic";
import { buildDatasetIntelligence, detectDatasetTypeFromColumns, generateSuggestions } from "../../src/lib/data/dataset-intelligence";
import { generateQuery } from "../../src/lib/data/queryEngine";
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile";
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder";

const rows: Record<string, unknown>[] = Array.from({ length: 45 }, (_, index) => {
  const companyNumber = index + 1;
  const isLast = index === 44;
  return {
    company_id: `PC-${String(companyNumber).padStart(3, "0")}`,
    company_name: `Portfolio Co ${String(companyNumber).padStart(3, "0")}`,
    sector: ["Fintech", "Health", "SaaS", "Climate", "Consumer"][index % 5],
    stage: ["Seed", "Series A", "Series B", "Growth"][index % 4],
    country: ["United States", "Netherlands", "Germany", "United Kingdom"][index % 4],
    investment_date: `2020-${String((index % 12) + 1).padStart(2, "0")}-15`,
    invested_amount: isLast ? 568450.45 : 470000,
    ownership_percent: isLast ? 15.545 : 13.7,
    entry_valuation: isLast ? 12720000 : 4000000 + index * 10000,
    latest_valuation: isLast ? 14010475.74 : 9700000 + index * 1000,
    annual_revenue: isLast ? 3184909.53 : 2800000,
    growth_rate: isLast ? 0.42 : 0.08 + (index % 9) * 0.02,
    burn_rate_monthly: isLast ? 420000 : 95000 + index * 1000,
    runway_months: isLast ? 7 : 12 + (index % 18),
    employees: 20 + index,
    status: index < 38 ? "Active" : index < 43 ? "Exited" : "Watchlist",
  };
});
const columns = Object.keys(rows[0] ?? {});
const datasetId = "synthetic_05_investor_portfolio";
const datasetType = "standard";

type TestDataset = Parameters<typeof buildDatasetReportInput>[0];

function dataset(businessModel: string | null): TestDataset {
  return {
    id: datasetId,
    userId: "synthetic_user",
    name: "05_investor_portfolio",
    fileName: "05_investor_portfolio.xlsx",
    fileSize: 1000,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    storageKey: null,
    checksum: null,
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    data: rows,
    columnTypes: null,
    previewRowCount: null,
    previewGenerated: null,
    fullAnalysisCompleted: null,
    analysisStatus: "ready",
    analysisProgress: null,
    analysisMessage: null,
    analysisError: null,
    invalidRowCount: null,
    missingValueCounts: null,
    precomputedMetrics: null,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: { businessModel: "saas", uploadSource: "standard" },
    datasetType,
    businessModel,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TestDataset;
}

async function main() {
  assert.equal(detectDatasetTypeFromColumns(columns, "05_investor_portfolio"), "Investor", "Dataset Intelligence classifies the full portfolio schema as Investor");
  assert.equal(detectBusinessModelFromColumns(columns, "05_investor_portfolio"), "investor", "Business model classifier routes the full portfolio schema as Investor");
  assert.equal(
    resolveBusinessModel({ explicit: "saas", datasetType, columns, datasetName: "05_investor_portfolio", analysis: { businessModel: "saas" } }),
    "investor",
    "strong Investor schema overrides stale SaaS business-model metadata",
  );
  const reportInput = await buildDatasetReportInput(dataset("saas"));
  assert.equal(reportInput.reportType, "investor", "Report routing uses the Investor model");
  assert.equal(reportInput.reportProfile?.id, "investor_portfolio", "Report profile is investor_portfolio");
  assert.equal(reportInput.saasAnalysis, undefined, "SaaS report analysis must not be present");
  assert.ok(reportInput.investorAnalysis, "Investor report analysis must be present");
  assert.equal(reportInput.financials.reportingPeriod, null, "Investment date must not become the report reporting period");
  assert.deepEqual(reportInput.financials.periodTrends, [], "Investment date must not generate generic financial period trends");
  assert.ok(!reportInput.kpis.some((kpi) => /^Revenue$|^Total Revenue$|MRR|ARR|Churn/i.test(kpi.title)), "Investor report KPIs do not expose SaaS or generic revenue labels");
  assert.ok(reportInput.kpis.some((kpi) => kpi.title === "Portfolio Company Annual Revenue"), "Investor report labels annual_revenue as portfolio company annual revenue");
  assert.ok(reportInput.bbsc, "Investor report includes a Balanced Scorecard payload");
  assert.equal(reportInput.bbsc?.perspectives.growth.trend, "unknown", "Investment date must not create a BBSC growth trend");
  assert.ok(reportInput.bbsc?.perspectives.growth.kpis.some((kpi) => kpi.label === "Portfolio growth rate" && kpi.sourceFields.includes("growth_rate")), "BBSC growth uses growth_rate as cross-sectional portfolio evidence");
  assert.ok(!reportInput.bbsc?.perspectives.growth.kpis.some((kpi) => kpi.label === "Growth trend" || kpi.sourceFields.includes("investment_date")), "BBSC growth must not derive a trend from investment_date");
  assert.ok(!reportInput.bbsc?.perspectives.growth.findings.some((finding) => /Growth trend is calculated from dated values/i.test(finding)), "BBSC growth reason must not claim dated growth trend evidence");
  assert.ok(reportInput.bbsc?.perspectives.financial.kpis.some((kpi) => kpi.label === "Portfolio company annual revenue" && kpi.sourceFields.includes("annual_revenue")), "BBSC financial perspective keeps annual_revenue as portfolio-company annual revenue");
  assert.ok(!reportInput.bbsc?.perspectives.financial.kpis.some((kpi) => kpi.label === "Revenue" || kpi.sourceFields.includes("investment_date")), "BBSC financial perspective must not label invested_amount or investment_date as generic revenue evidence");

  const dashboard = await buildDashboardSemanticAnalysis(dataset("saas") as Parameters<typeof buildDashboardSemanticAnalysis>[0]);
  assert.equal(dashboard.businessProfile, "investor", "Dashboard profile agrees with Investor report routing");
  assert.equal(dashboard.reportProfileId, "investor_portfolio", "Dashboard report profile is Investor");
  assert.ok(dashboard.trends.every((trend) => !/revenue|mrr|arr|runway/i.test(`${trend.title} ${trend.metricLabel}`)), "Dashboard does not expose incompatible Investor revenue, MRR, ARR, or runway trends");

  const totalRevenueAnswer = answerDatasetQuestionDeterministically({
    question: "What is the total revenue?",
    datasetId,
    datasetType,
    columns,
    rows,
  });
  assert.ok(totalRevenueAnswer, "total revenue receives a deterministic answer");
  assert.match(totalRevenueAnswer.answer, /Combined annual revenue of the portfolio companies is 126,384,909\.53/i);
  assert.doesNotMatch(totalRevenueAnswer.answer, /Total revenue is/i);
  assert.doesNotMatch(totalRevenueAnswer.answer, /Total investor revenue is|Investor revenue is/i);
  assert.equal(totalRevenueAnswer.result.portfolioCompanyAnnualRevenue, 126384909.53);
  assert.equal(totalRevenueAnswer.result.annualRevenueColumn, "annual_revenue");
  assert.deepEqual(totalRevenueAnswer.result.lineage, ["annual_revenue"]);
  assert.match(totalRevenueAnswer.answer, /Which portfolio companies generate the most annual revenue/i);
  assert.doesNotMatch(totalRevenueAnswer.answer, /average order value|AOV/i);

  const revenueTrendAnswer = answerDatasetQuestionDeterministically({
    question: "What are the revenue trends over time?",
    datasetId,
    datasetType,
    columns,
    rows,
  });
  assert.ok(revenueTrendAnswer, "revenue trend receives a deterministic semantic limitation answer");
  assert.equal(revenueTrendAnswer.result.status, "incompatible_evidence");
  assert.equal(revenueTrendAnswer.result.revenueColumn, "annual_revenue");
  assert.equal(revenueTrendAnswer.result.rejectedTimeColumn, "investment_date");
  assert.match(revenueTrendAnswer.answer, /cannot be calculated/i);
  assert.match(revenueTrendAnswer.answer, /investment_date/i);
  assert.match(revenueTrendAnswer.answer, /not a revenue reporting period/i);
  assert.doesNotMatch(revenueTrendAnswer.answer, /Latest monthly revenue|monthly revenue is|vs previous period|growth|decline/i);

  const investmentActivityAnswer = answerDatasetQuestionDeterministically({
    question: "How has investment activity changed over time?",
    datasetId,
    datasetType,
    columns,
    rows,
  });
  assert.ok(investmentActivityAnswer, "investment activity remains answerable");
  assert.equal(investmentActivityAnswer.result.intent, "investor.investment_activity");
  assert.equal(investmentActivityAnswer.result.investmentDateColumn, "investment_date");
  assert.match(investmentActivityAnswer.answer, /Investment activity is available/i);
  assert.match(investmentActivityAnswer.answer, /not for portfolio company revenue trends/i);
  assert.doesNotMatch(investmentActivityAnswer.answer, /annual_revenue|Latest monthly revenue/i);

  const topRevenueAnswer = answerDatasetQuestionDeterministically({
    question: "Which portfolio companies generate the most annual revenue?",
    datasetId,
    datasetType,
    columns,
    rows,
  });
  assert.ok(topRevenueAnswer, "portfolio company annual revenue ranking receives a deterministic answer");
  assert.equal(topRevenueAnswer.result.intent, "investor.portfolio_company_annual_revenue_ranking");
  assert.match(topRevenueAnswer.answer, /highest portfolio company annual revenue/i);
  assert.doesNotMatch(topRevenueAnswer.answer, /customer revenue|provider/i);

  const valuationAnswer = answerDatasetQuestionDeterministically({
    question: "Which portfolio companies have the highest valuation?",
    datasetId,
    datasetType,
    columns,
    rows,
  });
  assert.ok(valuationAnswer, "portfolio company valuation ranking receives a deterministic answer");
  assert.equal(valuationAnswer.result.intent, "investor.portfolio_company_valuation_ranking");
  assert.match(valuationAnswer.answer, /highest latest valuation/i);
  assert.doesNotMatch(valuationAnswer.answer, /holding value|investor profit|provider/i);

  const growthAnswer = answerDatasetQuestionDeterministically({
    question: "Which portfolio companies have the highest growth?",
    datasetId,
    datasetType,
    columns,
    rows,
  });
  assert.ok(growthAnswer, "portfolio company growth ranking receives a deterministic answer");
  assert.equal(growthAnswer.result.intent, "investor.portfolio_company_growth_ranking");
  assert.match(growthAnswer.answer, /highest portfolio company growth rate/i);
  assert.match(growthAnswer.answer, /42%/i);
  assert.doesNotMatch(growthAnswer.answer, /revenue trend|Latest monthly revenue|provider/i);

  const runwayAnswer = answerDatasetQuestionDeterministically({
    question: "Which companies have the shortest runway?",
    datasetId,
    datasetType,
    columns,
    rows,
  });
  assert.ok(runwayAnswer, "portfolio company runway ranking receives a deterministic answer");
  assert.equal(runwayAnswer.result.intent, "investor.portfolio_company_runway_risk");
  assert.match(runwayAnswer.answer, /not a historical trend from investment_date/i);

  const businessProfile = buildBusinessSemanticProfile({
    datasetId,
    datasetType,
    columns,
    rows,
  });
  assert.equal(businessProfile.datasetType, "investor", "Business Semantics classifies the full portfolio schema as Investor");
  assert.equal(businessProfile.concepts.find((concept) => concept.sourceColumn === "growth_rate")?.concept, "portfolio_company_growth_rate");
  assert.equal(businessProfile.concepts.find((concept) => concept.sourceColumn === "burn_rate_monthly")?.concept, "portfolio_company_monthly_burn");
  assert.equal(businessProfile.concepts.find((concept) => concept.sourceColumn === "runway_months")?.concept, "portfolio_company_runway");
  const sql = await generateQuery("What are the revenue trends over time?", columns, businessProfile);
  assert.doesNotMatch(sql, /SUM\(annual_revenue\)/i, "query engine must not group annual_revenue by investment_date");
  assert.doesNotMatch(sql, /investment_date/i, "query engine must not use investment_date for revenue trend SQL");

  const analyticalSuggestions = availableAnalyticalSuggestions({
    datasetId,
    datasetType,
    columns,
    rows,
  });
  const intelligenceSuggestions = generateSuggestions(buildDatasetIntelligence(rows as Array<Record<string, string | number | boolean | null>>), "05_investor_portfolio");
  const suggestions = [...new Set([...analyticalSuggestions, ...intelligenceSuggestions])];
  assert.ok(suggestions.includes("What is the total portfolio company revenue?"), "Investor suggestions include portfolio company annual revenue");
  assert.ok(suggestions.includes("How has investment activity changed over time?"), "Investor suggestions include investment activity");
  assert.ok(suggestions.includes("Which portfolio companies have the highest valuation?"), "Investor suggestions include valuation ranking");
  assert.ok(suggestions.includes("Which portfolio companies have the highest growth?"), "Investor suggestions include growth ranking");
  assert.ok(suggestions.includes("Which companies have the shortest runway?"), "Investor suggestions include runway ranking without trend wording");
  assert.ok(suggestions.includes("Which companies have the highest monthly burn?"), "Investor suggestions include monthly burn ranking without trend wording");
  assert.ok(!suggestions.some((suggestion) => /average order value|AOV/i.test(suggestion)), "Investor suggestions do not include AOV");
  assert.ok(!suggestions.some((suggestion) => /revenue trends over time|mrr|arr|inventory|supplier|strongest return|moic|irr/i.test(suggestion)), "Investor suggestions do not propose incompatible or unsupported questions");

  process.stdout.write("ok - Investor portfolio golden flow routes report, dashboard, suggestions, and deterministic Assistant through Investor semantics\n");
}

void main();
