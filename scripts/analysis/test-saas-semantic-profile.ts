import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"

import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import { resolveBusinessModel } from "../../src/lib/data/business-model"
import {
  buildDatasetIntelligenceEngine,
  resolveSaasSemanticProfile,
  type SaasCapabilityId,
} from "../../src/lib/data/dataset-intelligence-engine"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"
import { generatePdfReport } from "../../src/lib/reports/pdf-report-generator"
import type { SaasReportAnalysis } from "../../src/lib/reports/report-generator"

type Row = Record<string, unknown>

function hasCapability(profile: ReturnType<typeof resolveSaasSemanticProfile>, capability: SaasCapabilityId) {
  return profile.capabilityDetails[capability].available
}

function makeDataset(name: string, rows: Row[], columns: string[]) {
  return {
    id: `ds_${name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
    userId: "user_test",
    name,
    fileName: `${name}.csv`,
    fileSize: 1000,
    mimeType: "text/csv",
    storageKey: null,
    checksum: null,
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    data: rows,
    columnTypes: {},
    previewRowCount: null,
    previewGenerated: null,
    fullAnalysisCompleted: null,
    analysisStatus: "ready",
    analysisProgress: 100,
    analysisMessage: "Analysis is ready.",
    analysisError: null,
    invalidRowCount: null,
    missingValueCounts: null,
    precomputedMetrics: null,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: { datasetType: "standard", businessModel: "saas", uploadSource: "standard" },
    datasetType: "standard",
    businessModel: "saas",
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
  } as Parameters<typeof buildDatasetReportInput>[0]
}

function reportSaasAnalysis(reportInput: Awaited<ReturnType<typeof buildDatasetReportInput>>) {
  return (reportInput as { saasAnalysis?: SaasReportAnalysis }).saasAnalysis
}

async function pdfText(reportInput: Awaited<ReturnType<typeof buildDatasetReportInput>>, id: string) {
  const pdfPath = await generatePdfReport({
    ...reportInput,
    id,
    datasetId: `ds_${id}`,
    datasetName: id,
    createdAt: new Date("2026-08-28T00:00:00.000Z").toISOString(),
    timezone: "UTC",
    timezoneOffset: 0,
    localTime: "08/28/2026, 12:00:00 AM",
    visibility: "private",
    kpis: reportInput.kpis.map((item) => ({ title: item.title, value: String(item.value) })),
    columnCount: reportInput.columns.length,
  })
  try {
    return execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" })
  } finally {
    fs.unlinkSync(pdfPath)
  }
}

async function parseFixture(filePath: string) {
  const buffer = fs.readFileSync(filePath)
  const file = new File([buffer], path.basename(filePath), { type: "text/csv" })
  return parseCSVStreaming(file, 1000)
}

function assertPriorityActionsPagination(text: string, label: string, expectedActions: string[]) {
  const headingMatches = text.match(/\bPRIORITY ACTIONS\b/g) || []
  assert.equal(headingMatches.length, 1, `${label}: Priority Actions heading must render exactly once`)

  const pages = text.split("\f").map((pageText) => pageText.trim()).filter(Boolean)
  assert.ok(pages.length >= 10, `${label}: regression PDF must cross enough pages to exercise pagination`)
  const pageWithHeading = pages.find((pageText) => pageText.includes("PRIORITY ACTIONS")) || ""
  assert.ok(pageWithHeading, `${label}: Priority Actions heading must be on a PDF page`)

  const expectedSnippets = expectedActions.slice(0, 4).map(actionSnippet).filter(Boolean)
  assert.ok(expectedSnippets.length > 0, `${label}: expected actions must be available for Priority Actions regression`)

  const normalizedText = normalizePdfText(text)
  const followingHeading = normalizePdfText(pageWithHeading.slice(pageWithHeading.indexOf("PRIORITY ACTIONS")))
  assert.ok(
    expectedSnippets.some((snippet) => followingHeading.includes(snippet)),
    `${label}: Priority Actions heading must stay with the first action on the same page`,
  )

  for (const snippet of expectedSnippets) {
    assert.ok(normalizedText.includes(snippet), `${label}: Priority Actions must include expected action snippet "${snippet}"`)
  }
}

function actionSnippet(action: string) {
  return normalizePdfText(action).split(" ").slice(0, 8).join(" ")
}

function normalizePdfText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

async function main() {
  const subscriptionRows = [
    { billing_month: "2026-06", customer_id: "cus_1", subscription_id: "sub_1", plan: "Pro", subscription_status: "active", mrr: 100, arr: 1200 },
    { billing_month: "2026-06", customer_id: "cus_2", subscription_id: "sub_2", plan: "Team", subscription_status: "churned", mrr: 150, arr: 1800 },
  ]
  const subscription = resolveSaasSemanticProfile({ rows: subscriptionRows, columns: Object.keys(subscriptionRows[0]), fileName: "saas-subscriptions.csv" })
  assert.equal(subscription.profile, "subscription_snapshot")
  assert.equal(hasCapability(subscription, "mrr_analysis"), true)
  assert.equal(hasCapability(subscription, "subscription_metrics"), true)

  const transactionalRows = [
    { date: "2026-06-01", company: "Acme", plan: "Pro", users: 10, price_per_user: 50, revenue: 500, cost: 200, profit: 300, channel: "Organic", country: "US", startup_stage: "Seed" },
    { date: "2026-06-02", company: "Beta", plan: "Team", users: 20, price_per_user: 40, revenue: 800, cost: 300, profit: 500, channel: "Paid", country: "NL", startup_stage: "Series A" },
  ]
  const transactional = resolveSaasSemanticProfile({ rows: transactionalRows, columns: Object.keys(transactionalRows[0]), fileName: "startup-saas-sales.csv" })
  assert.equal(transactional.profile, "transactional_saas")
  assert.equal(hasCapability(transactional, "revenue_analysis"), true)
  assert.equal(hasCapability(transactional, "unit_economics"), true)
  assert.equal(hasCapability(transactional, "mrr_analysis"), false)
  assert.equal(transactional.metrics.mrr.status, "unavailable")
  assert.equal(transactional.metrics.average_revenue_per_user.value, 43.33)

  const cohortRows = [
    { signup_date: "2026-01-01", customer_id: "cus_1", plan: "Pro", mrr: 100, churn: "no", retention: "retained", expansion: 10, contraction: 0, country: "US" },
    { signup_date: "2026-01-15", customer_id: "cus_2", plan: "Team", mrr: 150, churn: "yes", retention: "lost", expansion: 0, contraction: 15, country: "DE" },
  ]
  const cohort = resolveSaasSemanticProfile({ rows: cohortRows, columns: Object.keys(cohortRows[0]), fileName: "saas-cohort.csv" })
  assert.equal(cohort.profile, "customer_cohort")
  assert.equal(hasCapability(cohort, "cohort_analysis"), true)
  assert.equal(cohort.mappings.expansion_mrr, "expansion")

  const financialRows = [
    { month: "2026-01", revenue: 20000, expenses: 14000, profit: 6000, burn: 3000, cash_balance: 120000, runway: 40 },
    { month: "2026-02", revenue: 24000, expenses: 15000, profit: 9000, burn: 2500, cash_balance: 118000, runway: 47.2 },
  ]
  const financial = resolveSaasSemanticProfile({ rows: financialRows, columns: Object.keys(financialRows[0]), fileName: "saas-financial.csv" })
  assert.equal(financial.profile, "saas_financial")
  assert.equal(hasCapability(financial, "cash_analysis"), true)
  assert.equal(hasCapability(financial, "runway_analysis"), true)

  const hybridRows = [
    { month: "2026-01", customer_id: "cus_1", subscription_id: "sub_1", plan: "Pro", status: "active", mrr: 500, revenue: 500, users: 10, burn: 1000, cash_balance: 30000, runway: 30 },
    { month: "2026-02", customer_id: "cus_2", subscription_id: "sub_2", plan: "Team", status: "active", mrr: 900, revenue: 900, users: 30, burn: 1200, cash_balance: 28800, runway: 24 },
  ]
  const hybrid = resolveSaasSemanticProfile({ rows: hybridRows, columns: Object.keys(hybridRows[0]), fileName: "saas-hybrid.csv" })
  assert.equal(hybrid.profile, "hybrid_saas")
  assert.ok(hybrid.availableCapabilities.includes("mrr_analysis"))
  assert.ok(hybrid.availableCapabilities.includes("cash_analysis"))

  const genericSaasRows = [{ plan: "Pro" }, { plan: "Team" }]
  const genericSaas = resolveSaasSemanticProfile({ rows: genericSaasRows, columns: ["plan"], fileName: "saas-minimal.csv" })
  assert.equal(genericSaas.profile, "generic_saas")
  assert.equal(hasCapability(genericSaas, "customer_analysis"), false)

  const orderOnlyRows = [
    { order_id: "ord_1", revenue: 100 },
    { order_id: "ord_2", revenue: 200 },
  ]
  const orderOnly = resolveSaasSemanticProfile({ rows: orderOnlyRows, columns: Object.keys(orderOnlyRows[0]), fileName: "saas-orders.csv" })
  assert.equal(orderOnly.mappings.customer_id, undefined)
  assert.equal(orderOnly.metrics.customers.status, "unavailable")
  assert.match(orderOnly.metrics.customers.reason, /rows, orders, and plans are not customer proxies/i)

  const mrrlessReport = await buildDatasetReportInput(makeDataset("transactional-saas-report", transactionalRows, Object.keys(transactionalRows[0])))
  assert.equal(reportSaasAnalysis(mrrlessReport)?.mrr, null)
  assert.equal(reportSaasAnalysis(mrrlessReport)?.arr, null)
  assert.equal(reportSaasAnalysis(mrrlessReport)?.availableCapabilities?.includes("mrr_analysis"), false)
  assert.equal(mrrlessReport.kpis.some((kpi) => kpi.title === "MRR"), false)

  const mrrOnlyReport = await buildDatasetReportInput(makeDataset("mrr-only-saas-report", subscriptionRows.map(({ arr, ...row }) => row), ["billing_month", "customer_id", "subscription_id", "plan", "subscription_status", "mrr"]))
  assert.equal(reportSaasAnalysis(mrrOnlyReport)?.mrr, 250)
  assert.equal(reportSaasAnalysis(mrrOnlyReport)?.arr, 3000)
  assert.equal(reportSaasAnalysis(mrrOnlyReport)?.arrField, "mrr")
  const subscriptionPdf = await pdfText(mrrOnlyReport, "saas_subscription_pdf")
  assert.match(subscriptionPdf, /RECURRING REVENUE & GROWTH/i)
  assert.match(subscriptionPdf, /ARR[\s\S]*\$3\.0K/i)

  const saasFixture = await parseFixture(path.join(process.cwd(), "test-fixtures", "business-models", "03_saas_startup.csv"))
  const saasFixtureReport = await buildDatasetReportInput(makeDataset("03_saas_startup", saasFixture.previewRows, saasFixture.columns))
  const saasFixturePdf = await pdfText(saasFixtureReport, "03_saas_startup")
  assertPriorityActionsPagination(saasFixturePdf, "03_saas_startup", saasFixtureReport.recommendations.map((item) => item.recommendedAction))

  const partialPeriodRows = [
    ...Array.from({ length: 10 }, (_, index) => ({ month: "2026-01", revenue: 100 + index, users: 10, plan: "Pro" })),
    { month: "2026-02", revenue: 150, users: 10, plan: "Pro" },
  ]
  const partialPeriod = resolveSaasSemanticProfile({ rows: partialPeriodRows, columns: ["month", "revenue", "users", "plan"], fileName: "saas-partial-period.csv" })
  assert.equal(partialPeriod.periodComparability.latestPeriodComparable, false)
  assert.match(partialPeriod.periodComparability.reason || "", /withheld/i)

  assert.equal(resolveBusinessModel({
    uploadSource: "standard",
    datasetType: "standard",
    columns: ["order_id", "order_date", "customer_id", "revenue", "shipping_cost", "return_status"],
    datasetName: "shopify-orders",
  }), "ecommerce")
  assert.equal(resolveBusinessModel({
    uploadSource: "standard",
    datasetType: "retail",
    columns: ["store_id", "sku", "stock_on_hand", "reorder_point", "unit_cost"],
    datasetName: "retail-inventory",
  }), "local_retail")
  assert.equal(resolveBusinessModel({
    uploadSource: "profitability",
    datasetType: "profitability",
    columns: ["revenue", "expenses", "profit"],
    datasetName: "profitability-analysis",
  }), "generic")

  const engine = buildDatasetIntelligenceEngine({ rows: transactionalRows, columns: Object.keys(transactionalRows[0]), fileName: "startup-saas-sales.csv" })
  assert.equal(engine.aiContext.saas?.profile, "transactional_saas")
  assert.ok(engine.aiContext.saas?.suggestedQuestions.some((question) => /revenue per user/i.test(question)))

  const transactionalPdf = await pdfText(mrrlessReport, "saas_transactional_pdf")
  assert.doesNotMatch(transactionalPdf, /RECURRING REVENUE & GROWTH/i)
  assert.match(transactionalPdf, /CUSTOMER & UNIT ECONOMICS/i)
  assert.match(transactionalPdf, /Total Revenue[\s\S]*\$1\.3K/i)

  const financialReport = await buildDatasetReportInput(makeDataset("saas-financial-report", financialRows, Object.keys(financialRows[0])))
  const financialPdf = await pdfText(financialReport, "saas_financial_pdf")
  assert.match(financialPdf, /CASH \/ STARTUP HEALTH/i)
  assert.doesNotMatch(financialPdf, /CUSTOMER & UNIT ECONOMICS/i)

  process.stdout.write("SaaS semantic profile tests passed.\n")
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
