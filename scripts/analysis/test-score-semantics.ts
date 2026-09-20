import * as assert from "node:assert/strict"

import { calculateBusinessBalancedScorecard } from "../../src/lib/business/balanced-scorecard"
import { buildDeterministicBrief, calculateMetrics, healthSignalProviders } from "../../src/lib/executive/daily-health"
import {
  BBSC_SCORE_METHODOLOGY,
  DAILY_ANALYSIS_CONFIDENCE_EXPLANATION,
  DAILY_ANALYSIS_CONFIDENCE_LABEL,
  DAILY_BUSINESS_HEALTH_SCORE_EXPLANATION,
  DAILY_BUSINESS_HEALTH_SCORE_LABEL,
  WORKSPACE_ANALYSIS_CONFIDENCE_LABEL,
  WORKSPACE_HEALTH_SCORE_LABEL,
} from "../../src/lib/executive/daily-health-semantics"

const investorRows: Record<string, unknown>[] = Array.from({ length: 12 }, (_, index) => ({
  company_id: `PC-${index + 1}`,
  sector: ["Fintech", "Health", "SaaS", "Climate"][index % 4],
  stage: ["Seed", "Series A", "Series B", "Growth"][index % 4],
  invested_amount: 470000,
  latest_valuation: 9700000 + index * 1000,
  ownership_percent: 13.7,
  annual_revenue: 2800000,
  growth_rate: 0.08 + (index % 9) * 0.02,
  investment_date: `2020-${String((index % 12) + 1).padStart(2, "0")}-15`,
}))

const healthSource = {
  userId: "score_semantics_user",
  workspaceId: null,
  workspaceKey: "user:score_semantics_user",
  date: "2026-09-20",
  profileComplete: true,
  hasBusinessProfile: true,
  datasets: [
    {
      id: "ds_score_semantics",
      name: "sales.csv",
      datasetType: "standard",
      rowCount: 3,
      columnCount: 3,
      createdAt: new Date("2026-09-19T00:00:00Z"),
      columns: ["date", "revenue", "cost"],
      rows: [
        { date: "2026-09-17", revenue: 1000, cost: 400 },
        { date: "2026-09-18", revenue: 1200, cost: 450 },
        { date: "2026-09-19", revenue: 1100, cost: 420 },
      ],
      analysisStatus: "ready",
      analysis: { insights: ["a"], recommendations: ["b"] },
      aiInsights: null,
      precomputedMetrics: null,
    },
  ],
}

function nearlyEqual(actual: number, expected: number, message: string, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`)
}

function main() {
  // 1. The general health score and the BBSC are separate metrics with separate identities.
  const bbsc = calculateBusinessBalancedScorecard({ rows: investorRows, columns: Object.keys(investorRows[0] ?? {}), businessModel: "investor" })
  assert.equal(bbsc.title, "Business Balanced Scorecard")
  assert.notEqual(DAILY_BUSINESS_HEALTH_SCORE_LABEL, bbsc.title, "general health score label must differ from the BBSC title")
  assert.notEqual(DAILY_BUSINESS_HEALTH_SCORE_LABEL, "Today's Score", "the vague daily label must not be used")
  assert.equal(DAILY_BUSINESS_HEALTH_SCORE_LABEL, "Business Health Score")
  assert.equal(WORKSPACE_HEALTH_SCORE_LABEL, "Workspace Health Score")
  assert.notEqual(DAILY_BUSINESS_HEALTH_SCORE_LABEL, WORKSPACE_HEALTH_SCORE_LABEL, "the daily brief score and the workspace composite score must keep distinct labels")
  assert.match(DAILY_BUSINESS_HEALTH_SCORE_EXPLANATION, /not the Business Balanced Scorecard/, "the dashboard must not imply the health score and the BBSC should match")

  // 2. General health score formula stays unchanged: mean of signal scores minus the missing-data penalty.
  const metrics = calculateMetrics(healthSource)
  const signals = healthSignalProviders.map((provider) => provider.collect(healthSource, metrics))
  const deterministic = buildDeterministicBrief(healthSource, metrics, signals)
  const expectedScore = Math.max(0, Math.min(100, Math.round(signals.reduce((total, signal) => total + signal.score, 0) / signals.length) - metrics.missingDataCount * 3))
  assert.equal(deterministic.score, expectedScore, "health score must remain the deterministic signal average minus missing-data gaps")

  // 3. Analysis confidence formula stays unchanged: mean signal confidence plus the insight bonus, not AI model certainty.
  const expectedConfidence = Math.max(0, Math.min(100, Math.round(signals.reduce((total, signal) => total + signal.confidence, 0) / signals.length) + Math.min(10, metrics.aiInsightCount)))
  assert.equal(deterministic.aiConfidence, expectedConfidence, "analysis confidence must remain the deterministic signal-confidence formula")
  assert.equal(DAILY_ANALYSIS_CONFIDENCE_LABEL, "Analysis confidence")
  assert.equal(WORKSPACE_ANALYSIS_CONFIDENCE_LABEL, "Analysis Confidence")
  assert.ok(!/ai confidence/i.test(DAILY_ANALYSIS_CONFIDENCE_LABEL), "the deterministic confidence value must not be labeled AI confidence")
  assert.match(DAILY_ANALYSIS_CONFIDENCE_EXPLANATION, /not a business performance score and not AI model certainty/)

  // 4. BBSC overall score stays the equally weighted average of available perspectives; insufficient ones are excluded, not estimated.
  const available = Object.values(bbsc.perspectives).filter((perspective) => perspective.status === "available" && perspective.score !== null)
  assert.ok(available.length > 0 && available.length < 4, "investor fixture must keep at least one BBSC perspective excluded")
  const expectedOverall = Math.round(available.reduce((total, perspective) => total + (perspective.score || 0) * (1 / available.length), 0))
  assert.equal(bbsc.availablePerspectiveCount, available.length)
  assert.equal(bbsc.overallScore, expectedOverall, "BBSC overall score must remain the equal-weight average of available perspectives")
  assert.deepEqual(
    bbsc.scoringInputs.excludedPerspectives,
    Object.values(bbsc.perspectives).filter((perspective) => perspective.status === "insufficient_data").map((perspective) => perspective.title),
    "excluded perspectives must be reported, not estimated",
  )
  assert.match(bbsc.scoreExplanation, /equally weighted average of \d+ available BBSC perspective scores?; insufficient perspectives are excluded instead of estimated\./)
  assert.match(bbsc.scoreExplanation, new RegExp(`Overall score ${expectedOverall}/100`))

  // 5. BBSC methodology copy is accurate on the dashboard.
  assert.equal(
    BBSC_SCORE_METHODOLOGY,
    "Average of available Balanced Scorecard perspectives. Perspectives with insufficient source data are excluded rather than estimated.",
  )

  // 6. The two scores never claim to be the same calculation: labels stay distinct and the BBSC name is reserved.
  assert.equal(bbsc.alsoKnownAs, "Balanced Scorecard (BSC)")
  assert.ok(!DAILY_BUSINESS_HEALTH_SCORE_EXPLANATION.includes("same"), "health score copy must not equate the two scores")
  assert.ok(DAILY_BUSINESS_HEALTH_SCORE_EXPLANATION.includes("workspace health score"))

  console.log(JSON.stringify({
    verdict: "pass",
    healthScoreFormula: "round(mean(signal scores)) - 3 * missingDataCount, clamped 0-100",
    analysisConfidenceFormula: "round(mean(signal confidences)) + min(10, insightCount), clamped 0-100",
    bbscOverall: bbsc.overallScore,
    bbscAvailablePerspectives: bbsc.availablePerspectiveCount,
  }, null, 2))
}

main()
