import assert from "node:assert/strict";

import { availableAnalyticalSuggestions } from "../../src/lib/data/analytical-intents";
import { buildBusinessSemanticProfile } from "../../src/lib/data/business-semantics";
import { answerDatasetQuestionDeterministically } from "../../src/lib/data/dataset-assistant-deterministic";
import { buildDatasetIntelligence, generateSuggestions } from "../../src/lib/data/dataset-intelligence";
import { generateQuery } from "../../src/lib/data/queryEngine";

const valuePerRow = 126384909.53 / 45;
const rows: Record<string, unknown>[] = Array.from({ length: 45 }, (_, index) => ({
  company_id: `PC-${String(index + 1).padStart(3, "0")}`,
  annual_revenue: valuePerRow,
  investment_date: `2020-01-${String(index + 1).padStart(2, "0")}`,
}));
const columns = ["company_id", "annual_revenue", "investment_date"];
const datasetId = "synthetic_05_investor_portfolio";
const datasetType = "investor";

async function main() {
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

  const businessProfile = buildBusinessSemanticProfile({
    datasetId,
    datasetType,
    columns,
    rows,
  });
  const sql = await generateQuery("What are the revenue trends over time?", columns, businessProfile);
  assert.doesNotMatch(sql, /SUM\(annual_revenue\)/i, "query engine must not group annual_revenue by investment_date");

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
  assert.ok(!suggestions.some((suggestion) => /average order value|AOV/i.test(suggestion)), "Investor suggestions do not include AOV");
  assert.ok(!suggestions.some((suggestion) => /revenue trends over time/i.test(suggestion)), "Investor suggestions do not propose incompatible revenue trends");

  process.stdout.write("ok - Investor deterministic semantics preserve annual_revenue total and reject investment_date revenue trends\n");
}

void main();
