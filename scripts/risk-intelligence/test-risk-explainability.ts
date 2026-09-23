import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  calculateRiskIntelligence,
  type RiskDataRow,
  type RiskDatasetInput,
  type RiskIntelligenceResult,
} from "../../src/lib/risk-intelligence/risk-engine"
import {
  getSeverityForScore,
  RISK_METRIC_LABELS,
  RISK_RULES,
  RISK_SEVERITY_LABELS,
  RISK_SEVERITY_RANK,
  thresholdMatches,
} from "../../src/lib/risk-intelligence/risk-rules"

function buildDataset(overrides: Partial<RiskDatasetInput> = {}): RiskDatasetInput {
  return {
    id: "ds_explain_test",
    name: "Explainability test dataset",
    fileName: "explain.csv",
    datasetType: "standard",
    businessModel: "generic",
    rowCount: 0,
    columns: null,
    ...overrides,
  }
}

function runFixture(rows: RiskDataRow[], overrides: Partial<RiskDatasetInput> = {}) {
  return calculateRiskIntelligence(
    buildDataset({
      ...overrides,
      rowCount: overrides.rowCount ?? rows.length,
      columns: overrides.columns ?? Object.keys(rows[0] ?? {}),
    }),
    rows,
  )
}

function findingFor(result: RiskIntelligenceResult, ruleId: string) {
  return result.findings.find((finding) => finding.ruleId === ruleId) ?? null
}

function assertValidExplanation(result: RiskIntelligenceResult, label: string) {
  for (const finding of result.findings) {
    const rule = RISK_RULES.find((candidate) => candidate.ruleId === finding.ruleId)
    assert.ok(rule, `${label}: finding maps to a known rule (${finding.ruleId})`)
    const explanation = finding.explanation
    assert.ok(explanation, `${label}: finding carries an explanation`)
    assert.equal(explanation.metricLabel, RISK_METRIC_LABELS[finding.metric], `${label}: metric label is canonical`)
    assert.ok(explanation.evidence.whatHappened.length > 0, `${label}: evidence states what happened`)
    assert.ok(explanation.evidence.values.length > 0, `${label}: evidence lists measured values`)
    for (const value of explanation.evidence.values) {
      assert.ok(value.display.length > 0, `${label}: evidence value has a display form`)
      assert.ok(!value.display.includes("NaN") && !value.display.includes("undefined"), `${label}: evidence display is never NaN/undefined`)
      if (typeof value.raw === "number") {
        assert.ok(Number.isFinite(value.raw), `${label}: evidence raw numbers are finite`)
      }
    }
    const matchedBands = explanation.threshold.bands.filter((band) => band.matched)
    assert.equal(matchedBands.length, 1, `${label}: exactly one severity band is marked matched`)
    assert.equal(matchedBands[0].severity, finding.severity, `${label}: displayed severity matches the matched band`)
    assert.equal(matchedBands[0].score, finding.score, `${label}: displayed score matches the matched band score`)
    assert.ok(
      thresholdMatches(finding.metricValue, { severity: matchedBands[0].severity, operator: explanation.threshold.operator, value: explanation.threshold.value, score: matchedBands[0].score }),
      `${label}: the displayed threshold is truly crossed by the displayed metric`,
    )
    const deeperBands = rule.thresholds.filter(
      (band) => RISK_SEVERITY_RANK[band.severity] > RISK_SEVERITY_RANK[finding.severity],
    )
    for (const band of deeperBands) {
      assert.equal(
        thresholdMatches(finding.metricValue, band),
        false,
        `${label}: no deeper band is also crossed (severity would be understated)`,
      )
    }
    assert.ok(explanation.threshold.severityReason.includes(RISK_SEVERITY_LABELS[finding.severity]), `${label}: severity reason names the severity`)
    assert.equal(finding.estimatedImpact, Math.round(finding.score * finding.weight), `${label}: impact stays score x weight`)
    assert.equal(explanation.score.weightedPoints, finding.estimatedImpact, `${label}: explanation reproduces the weighted contribution`)
    assert.ok(explanation.score.contributionDisplay.includes(String(finding.estimatedImpact)), `${label}: contribution display shows the weighted points`)
    assert.ok(explanation.score.contributionNote.length > 0, `${label}: contribution note explains semantics`)
    assert.ok(explanation.investigation.length > 0, `${label}: investigation guidance present`)
    assert.ok(explanation.evidence.sourceMetric.length > 0, `${label}: source metric named`)
  }
  const serialized = JSON.stringify(result)
  assert.ok(!serialized.includes("NaN") && !serialized.includes("Infinity"), `${label}: result never serializes NaN/Infinity`)
}

// ============================================================================
// 1. Exact Financial Risk 94 case: -32.7% revenue decline
// ============================================================================

const financialDeclineRows: RiskDataRow[] = [
  { order_date: "2026-01-10", product: "A", category: "Core", customer_id: "C1", order_total: 1200, cost: 400 },
  { order_date: "2026-01-24", product: "B", category: "Core", customer_id: "C2", order_total: 1200, cost: 400 },
  { order_date: "2026-02-05", product: "A", category: "Core", customer_id: "C1", order_total: 808, cost: 400 },
  { order_date: "2026-02-18", product: "B", category: "Core", customer_id: "C2", order_total: 808, cost: 400 },
]
const financialDecline = runFixture(financialDeclineRows, { name: "financial_decline_fixture" })
assert.ok(financialDecline, "financial decline fixture produces a result")
const declineFinding = findingFor(financialDecline, "financial.revenue_decline.v1")
assert.ok(declineFinding, "revenue decline finding exists")
// metric: (1616 - 2400) / 2400 * 100 = -32.666... -> displayed -32.7
assert.equal(declineFinding.metricValue, -32.7, "displayed metric reproduces the -32.7 percent decline")
assert.equal(declineFinding.severity, "critical", "decline crosses the critical <= -20 band")
assert.equal(declineFinding.score, 94, "critical band score for revenue decline is 94")
assert.equal(declineFinding.estimatedImpact, Math.round(94 * 1.15), "impact 108 is the weighted contribution of score 94")

const declineEvidence = declineFinding.explanation.evidence
assert.equal(declineEvidence.periodsCompared, "2026-01 → 2026-02", "evidence names the compared periods")
assert.equal(declineEvidence.absoluteChange?.raw, -784, "evidence reproduces the absolute change")
assert.equal(declineEvidence.absoluteChange?.display, "-784", "absolute change display is deterministic")
const previousValue = declineEvidence.values.find((value) => value.label.includes("previous period"))
const latestValue = declineEvidence.values.find((value) => value.label.includes("latest period"))
assert.ok(previousValue && latestValue, "evidence separates baseline and current values")
assert.equal(previousValue.raw, 2400, "baseline value comes from the previous period rows")
assert.equal(latestValue.raw, 1616, "current value comes from the latest period rows")
assert.ok(declineEvidence.percentChange, "percent change evidence exists")
assert.equal(
  Math.round((declineEvidence.percentChange.raw as number) * 10) / 10,
  -32.7,
  "evidence percent change reproduces the displayed metric",
)
assert.deepEqual(declineEvidence.unavailable, [], "decline evidence is complete for this dataset")
assert.equal(
  declineFinding.explanation.threshold.display,
  "≤ -20%",
  "displayed threshold equals the scoring threshold of the critical band",
)
assert.equal(declineFinding.explanation.threshold.score, 94, "displayed threshold score equals the rule score")
assert.equal(
  declineFinding.explanation.threshold.severityReason,
  "Critical applies because -32.7% is within the Critical band (≤ -20%).",
  "severity reason is deterministic and names the crossed band",
)
assert.equal(
  declineFinding.explanation.score.contributionDisplay,
  "94 × 1.15 = 108 weighted points",
  "contribution display reproduces score x weight",
)
assert.equal(
  declineFinding.explanation.score.categoryFormula,
  "Financial Risk = round((94×1.15) ÷ 1.15) = 94",
  "category formula reproduces the Financial Risk score",
)

const financialSummary = financialDecline.categorySummaries.find((summary) => summary.category === "financial")
assert.ok(financialSummary, "financial category summary exists")
assert.equal(financialSummary.score, 94, "category score equals the single triggered rule score")
assert.equal(financialSummary.scoreFormula, "Financial Risk = round((94×1.15) ÷ 1.15) = 94", "category score formula is exposed")
assert.deepEqual(
  financialSummary.topTriggeredRules,
  [{ ruleId: "financial.revenue_decline.v1", title: "Latest-period revenue decline", metricDisplay: "-32.7%" }],
  "category card exposes triggered rules with metric display",
)

// Overall aggregation formula reproduces the overall score deterministically.
const overallNotApplicable = new Set(financialDecline.notApplicableRules.map((rule) => rule.ruleId))
const overallApplicableRules = RISK_RULES.filter((rule) => !overallNotApplicable.has(rule.ruleId))
const overallWeightTotal = overallApplicableRules.reduce((sum, rule) => sum + rule.weight, 0)
const overallWeighted = financialDecline.findings.reduce((sum, finding) => {
  const rule = RISK_RULES.find((candidate) => candidate.ruleId === finding.ruleId)
  assert.ok(rule, "finding maps to a rule for weighting")
  return sum + finding.score * rule.weight
}, 0)
const expectedOverall = Math.max(0, Math.min(100, Math.round(overallWeighted / overallWeightTotal)))
assert.equal(financialDecline.overallScore, expectedOverall, "overall score is the weighted average over applicable rules")
assert.ok(
  financialDecline.scoringModel.overallFormula.endsWith(`= ${financialDecline.overallScore}`),
  "overall scoring formula ends with the displayed overall score",
)

// ============================================================================
// 2. Representative fixtures: severity/score/threshold consistency everywhere
// ============================================================================

const retailRows: RiskDataRow[] = [
  { order_date: "2026-01-05", store: "North", product: "Ski jacket", category: "Outerwear", customer_id: "C1", units_sold: 0, stock: 40, revenue: 0, cost: 300, currency: "EUR" },
  { order_date: "2026-01-18", store: "North", product: "Snow boots", category: "Footwear", customer_id: "C2", units_sold: 6, stock: 5, revenue: 1200, cost: 500, currency: "EUR" },
  { order_date: "2026-02-03", store: "North", product: "Snow pants", category: "Outerwear", customer_id: "C1", units_sold: 4, stock: 0, revenue: 700, cost: 260, currency: "EUR" },
  { order_date: "2026-02-20", store: "South", product: "Ski poles", category: "Equipment", customer_id: "C2", units_sold: 0, stock: 12, revenue: 0, cost: 90, currency: "EUR" },
]

const saasRows: RiskDataRow[] = [
  { month: "2026-01", mrr: 50000, churned_mrr: 2000, active_customers: 420, cash_balance: 150000, burn: 25000 },
  { month: "2026-02", mrr: 48000, churned_mrr: 3500, active_customers: 415, cash_balance: 125000, burn: 25000 },
  { month: "2026-03", mrr: 51000, churned_mrr: 1800, active_customers: 421, cash_balance: 100000, burn: 25000 },
]

const profitabilityRows: RiskDataRow[] = [
  { period: "2026-01", revenue: 20000, cogs: 9000, operating_expense: 8000 },
  { period: "2026-02", revenue: 21000, cogs: 9500, operating_expense: 8500 },
  { period: "2026-03", revenue: 8000, cogs: 9800, operating_expense: 9000 },
]

const ledgerRows: RiskDataRow[] = [
  { journal_date: "2026-01-05", account: "4010 Sales", description: "Invoice 1", debit: 0, credit: 1200 },
  { journal_date: "2026-01-06", account: "2010 Rent", description: "Rent January", debit: 800, credit: 0 },
  { journal_date: "2026-02-05", account: "4010 Sales", description: "Invoice 2", debit: 0, credit: 1500 },
  { journal_date: "2026-02-06", account: "2010 Rent", description: "Rent February", debit: 800, credit: 0 },
]

const investorRows: RiskDataRow[] = [
  { company_id: "PC-001", company_name: "Portfolio Co 1", annual_revenue: 700000, runway_months: 3 },
  { company_id: "PC-002", company_name: "Portfolio Co 2", annual_revenue: 200000, runway_months: 4 },
  { company_id: "PC-003", company_name: "Portfolio Co 3", annual_revenue: 100000, runway_months: 24 },
]

const genericRows: RiskDataRow[] = [
  { date: "2026-01-04", revenue: 3000, cost: 1200 },
  { date: "2026-02-04", revenue: 3200, cost: 1400 },
  { date: "2026-03-04", revenue: 3100, cost: 1450 },
]

const representativeFixtures: Array<[string, RiskIntelligenceResult | null, boolean]> = [
  ["Ecommerce/Financial decline", financialDecline, true],
  ["Retail", runFixture(retailRows, { name: "retail_explain_fixture" }), true],
  ["SaaS", runFixture(saasRows, { name: "saas_explain_fixture" }), true],
  ["Profitability", runFixture(profitabilityRows, { name: "profitability_explain_fixture" }), true],
  ["Accountancy", runFixture(ledgerRows, { name: "accountancy_explain_fixture" }), false],
  ["Investor Portfolio", runFixture(investorRows, { name: "investor_explain_fixture" }), true],
  ["Generic business", runFixture(genericRows, { name: "generic_explain_fixture" }), false],
]

for (const [label, result, expectFindings] of representativeFixtures) {
  assert.ok(result, `${label}: fixture produces a risk result`)
  if (expectFindings) {
    assert.ok(result.findings.length > 0, `${label}: representative fixture triggers at least one rule`)
  }
  assertValidExplanation(result, label)
  for (const summary of result.categorySummaries) {
    assert.ok(summary.scoreFormula.length > 0, `${label}: category ${summary.category} exposes its score formula`)
    for (const rule of summary.topTriggeredRules) {
      assert.ok(rule.metricDisplay.length > 0, `${label}: triggered rule metric display is present`)
      assert.ok(rule.title.length > 0, `${label}: triggered rule title present`)
    }
  }
}

// SaaS runway evidence reproduces the displayed months from cash and burn.
const saasResult = representativeFixtures[2][1] as RiskIntelligenceResult
const runwayFinding = findingFor(saasResult, "cash_flow.low_runway.v1")
assert.ok(runwayFinding, "SaaS fixture triggers the runway rule")
assert.equal(runwayFinding.metricValue, 4, "runway metric uses the latest cash and burn point")
const runwayValues = runwayFinding.explanation.evidence.values
assert.equal(runwayValues.find((value) => value.label.includes("cash balance"))?.raw, 100000, "runway evidence carries the latest cash balance")
assert.equal(runwayValues.find((value) => value.label.includes("burn"))?.raw, 25000, "runway evidence carries the latest burn")
assert.ok(
  runwayFinding.explanation.threshold.display.startsWith("≤"),
  "runway threshold display uses the <= operator semantics",
)
assert.ok(
  runwayFinding.explanation.threshold.bands.some((band) => band.matched && band.severity === "high" && band.score === 70),
  "runway severity maps to the high band at 4 months",
)

// Investor portfolio concentration evidence reproduces the share from raw values.
const investorResult = representativeFixtures[5][1] as RiskIntelligenceResult
const concentrationFinding = findingFor(investorResult, "investor.portfolio_company_concentration.v1")
assert.ok(concentrationFinding, "investor fixture triggers portfolio concentration")
assert.equal(concentrationFinding.metricValue, 70, "portfolio concentration is 70 percent at the boundary")
const concentrationEvidence = concentrationFinding.explanation.evidence
const concentrationTop = concentrationEvidence.values.find((value) => value.label.startsWith("Value for the largest portfolio company"))
const concentrationTotal = concentrationEvidence.values.find((value) => value.label.startsWith("Total mapped value"))
assert.ok(concentrationTop && concentrationTotal, "concentration evidence carries top and total values")
assert.equal(concentrationTop.raw, 700000, "concentration evidence carries the top company revenue")
assert.equal(
  Math.round(((concentrationTop.raw as number) / (concentrationTotal.raw as number)) * 1000) / 10,
  70,
  "evidence values reproduce the displayed concentration share",
)

// Profitability net margin evidence reproduces the displayed margin.
const profitabilityResult = representativeFixtures[3][1] as RiskIntelligenceResult
const netMarginFinding = findingFor(profitabilityResult, "profitability.negative_net_margin.v1")
assert.ok(netMarginFinding, "profitability fixture triggers negative net margin")
const netMarginValues = netMarginFinding.explanation.evidence.values
const marginRevenue = netMarginValues.find((value) => value.label.includes("revenue"))
const marginCosts = netMarginValues.find((value) => value.label.includes("costs"))
assert.ok(marginRevenue && marginCosts, "net margin evidence carries revenue and cost totals")
assert.equal(marginRevenue.raw, 49000, "net margin evidence total revenue reproduces row sums")
assert.equal(marginCosts.raw, 53800, "net margin evidence total costs reproduce row sums")
assert.equal(
  Math.round((((marginRevenue.raw as number) - (marginCosts.raw as number)) / (marginRevenue.raw as number)) * 1000) / 10,
  netMarginFinding.metricValue,
  "net margin evidence reproduces the displayed margin",
)

// ============================================================================
// 3. Unavailable evidence is not fabricated
// ============================================================================

const noHistoryRows: RiskDataRow[] = [
  { product: "A", category: "Core", customer_id: "C1", revenue: 100, cost: 40, stock: 0, units_sold: 2, currency: "EUR" },
  { product: "B", category: "Core", customer_id: "C2", revenue: 120, cost: 60, stock: 0, units_sold: 1, currency: "EUR" },
]
const noHistory = runFixture(noHistoryRows, { name: "no_history_fixture" })
assert.ok(noHistory, "no-history fixture produces a result")
assert.equal(noHistory.metrics.revenueGrowthPct.available, false, "trend metric is unavailable without dates")
assert.equal(noHistory.metrics.revenueGrowthPct.details, undefined, "unavailable metric does not fabricate evidence")
assert.equal(findingFor(noHistory, "financial.revenue_decline.v1"), null, "no decline finding without comparable periods")
assert.ok(
  noHistory.notApplicableRules.some((rule) => rule.ruleId === "financial.revenue_decline.v1"),
  "revenue decline reports as not applicable without period evidence",
)

const revenueOnly = runFixture(
  [
    { date: "2026-01-01", revenue: 100 },
    { date: "2026-02-01", revenue: 110 },
  ],
  { name: "revenue_only_fixture" },
)
assert.ok(revenueOnly, "revenue-only fixture produces a result")
assert.equal(revenueOnly.metrics.netMarginPct.available, false, "net margin unavailable without cost columns")
assert.equal(revenueOnly.metrics.netMarginPct.details, undefined, "net margin evidence is not fabricated without costs")
assert.equal(findingFor(revenueOnly, "cash_flow.expenses_exceed_revenue.v1"), null, "no cash-flow finding without cost evidence")
assert.ok(
  revenueOnly.metrics.grossMarginTrendPct.details === undefined,
  "gross margin evidence is absent when the metric is unavailable",
)

// historyPeriodCount is available at 1 period and honestly reports the limitation.
const onePeriod = runFixture(
  [
    { date: "2026-01-01", revenue: 100 },
    { date: "2026-01-15", revenue: 120 },
  ],
  { name: "one_period_fixture" },
)
assert.ok(onePeriod, "one-period fixture produces a result")
assert.equal(onePeriod.metrics.historyPeriodCount.value, 1, "one comparable period is counted truthfully")
assert.deepEqual(
  onePeriod.metrics.historyPeriodCount.details?.unavailable,
  ["Fewer than two periods exist, so no period-over-period comparison is possible."],
  "one-period history declares the missing comparison instead of fabricating it",
)

// ============================================================================
// 4. Genuine zero remains zero
// ============================================================================

const zeroRiskRows: RiskDataRow[] = [
  { date: "2026-01-05", product: "A", category: "Core", customer_id: "C1", revenue: 1000, cost: 300, stock: 0, units_sold: 5, currency: "EUR" },
  { date: "2026-02-05", product: "B", category: "Core", customer_id: "C2", revenue: 1000, cost: 300, stock: 0, units_sold: 4, currency: "EUR" },
]
const zeroRisk = runFixture(zeroRiskRows, { name: "zero_risk_fixture" })
assert.ok(zeroRisk, "zero-risk fixture produces a result")
assert.equal(zeroRisk.metrics.invalidDateRatio.value, 0, "genuine zero stays zero for invalid dates")
assert.equal(zeroRisk.metrics.duplicateRowRatio.value, 0, "genuine zero stays zero for duplicates")
assert.equal(zeroRisk.metrics.revenueGrowthPct.value, 0, "flat revenue reports a genuine zero percent change")
assert.equal(zeroRisk.metrics.revenueGrowthPct.details?.percentChange?.display, "0%", "zero percent change is displayed as zero, not fabricated")
assert.equal(findingFor(zeroRisk, "financial.revenue_decline.v1"), null, "a genuine zero decline does not trigger the decline rule")
assert.equal(findingFor(zeroRisk, "data_quality.invalid_dates.v1"), null, "zero invalid dates do not trigger the invalid-date rule")
assert.equal(findingFor(zeroRisk, "data_quality.duplicate_rows.v1"), null, "zero duplicates do not trigger the duplicate rule")
assert.equal(zeroRisk.metrics.invalidDateRatio.details?.values.find((value) => value.label.includes("Unparseable"))?.raw, 0, "zero invalid dates are evidenced as zero")

// ============================================================================
// 5. Cross-dataset applicability remains correct
// ============================================================================

assert.ok(
  investorResult.notApplicableRules.some((rule) => rule.ruleId === "financial.revenue_decline.v1"),
  "investor portfolio keeps revenue decline not applicable",
)
assert.ok(
  investorResult.notApplicableRules.some((rule) => rule.ruleId === "inventory.dead_stock_ratio.v1"),
  "investor portfolio keeps inventory rules not applicable",
)
for (const finding of investorResult.findings) {
  assert.ok(
    finding.ruleId.startsWith("investor.") || finding.ruleId.startsWith("data_quality."),
    "investor findings stay limited to portfolio and data-quality rules",
  )
}

const ledgerResult = representativeFixtures[4][1] as RiskIntelligenceResult
assert.ok(
  ledgerResult.notApplicableRules.some((rule) => rule.ruleId === "financial.revenue_decline.v1"),
  "ledger keeps revenue decline not applicable",
)
for (const finding of ledgerResult.findings) {
  assert.ok(finding.ruleId.startsWith("data_quality."), "ledger findings stay limited to data-quality rules")
}

// Dead-stock severity must still follow the deterministic thresholds.
assert.ok(
  findingFor(representativeFixtures[1][1] as RiskIntelligenceResult, "inventory.dead_stock_ratio.v1"),
  "retail fixture triggers dead stock",
)

// ============================================================================
// 6. Impact semantics: weighted contribution, never a naked business impact
// ============================================================================

const riskPageSource = readFileSync("src/app/(auth)/app/risk-intelligence/page.tsx", "utf8")
assert.ok(!riskPageSource.includes('label="Impact"'), "risk page never renders the naked Impact label")
assert.ok(riskPageSource.includes("Contribution to category"), "risk page labels the weighted contribution")
assert.ok(
  riskPageSource.includes("explanation.score.contributionNote"),
  "risk page renders the contribution semantics note",
)
assert.ok(
  !riskPageSource.includes("Sorted by severity, score, and estimated impact."),
  "risk page no longer claims sorting by estimated impact",
)

for (const result of representativeFixtures.map(([, value]) => value as RiskIntelligenceResult)) {
  assertValidExplanation(result, "impact-semantics")
  for (const finding of result.findings) {
    const severityFromScore = getSeverityForScore(finding.score)
    const severityMatchesRule = RISK_RULES.find((rule) => rule.ruleId === finding.ruleId)?.thresholds.some(
      (band) => band.score === finding.score && band.severity === finding.severity,
    )
    assert.ok(severityMatchesRule, "finding score and severity come from the crossed rule band")
    assert.ok(
      RISK_SEVERITY_RANK[finding.severity] === RISK_SEVERITY_RANK[severityFromScore] || severityMatchesRule,
      "displayed severity corresponds to the scoring result",
    )
    if (finding.metricUnit === "percent") {
      assert.equal(
        finding.explanation.metricDisplay,
        `${finding.metricValue}%`,
        "percent metrics display with one decimal",
      )
    } else {
      assert.equal(
        finding.explanation.metricDisplay,
        `${finding.metricValue}`,
        "count and score metrics display without a percent sign",
      )
    }
  }
}

// ============================================================================
// 7. Determinism: two runs produce identical explanations
// ============================================================================

const first = runFixture(financialDeclineRows, { name: "determinism_fixture" })
const second = runFixture(financialDeclineRows, { name: "determinism_fixture" })
assert.ok(first && second, "determinism fixtures produce results")
const strip = (result: RiskIntelligenceResult) => {
  const { calculatedAt: _calculatedAt, ...rest } = result
  return JSON.stringify(rest)
}
assert.equal(strip(first), strip(second), "risk explanations are deterministic across runs")

console.log("Risk Intelligence explainability tests passed.")
