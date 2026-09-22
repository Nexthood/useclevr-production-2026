import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { inArray } from "drizzle-orm"

import { loadDashboardDatasetAggregation } from "@/lib/data/dashboard-dataset-aggregation"
import { deleteDatasetsForUser } from "@/lib/data/delete-datasets"
import { buildDeterministicBrief, type HealthSignal } from "@/lib/executive/daily-health"
import { db } from "@/lib/db"
import { datasets, users } from "@/lib/db/schema"

const DAY_MS = 86_400_000

async function main() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
  const userC = `dashboard_scope_user_c_${suffix}`
  const userD = `dashboard_scope_user_d_${suffix}`
  const datasetC1 = `dashboard_scope_dataset_c1_${suffix}`
  const datasetC2 = `dashboard_scope_dataset_c2_${suffix}`
  const datasetC3 = `dashboard_scope_dataset_c3_prebook_${suffix}`
  const datasetD1 = `dashboard_scope_dataset_d1_${suffix}`
  const base = Date.now()

  try {
    await db.insert(users).values([
      { id: userC, email: `${userC}@example.test`, name: "Dashboard Scope C", createdAt: new Date(base) },
      { id: userD, email: `${userD}@example.test`, name: "Dashboard Scope D", createdAt: new Date(base) },
    ])
    await db.insert(datasets).values([
      buildDataset(datasetC1, userC, "Retail Workspace C", new Date(base - 2 * DAY_MS)),
      buildDataset(datasetC2, userC, "Standard Workspace C", new Date(base - DAY_MS)),
      buildDataset(datasetC3, userC, "Prebook Workspace C", new Date(base - DAY_MS)),
      buildDataset(datasetD1, userD, "Standard Workspace D", new Date(base - 3 * DAY_MS)),
    ])

    // Workspace scope: the dashboard aggregation counts only the caller's own
    // non-prebookkeeping datasets. Another user's dataset must never inflate
    // the workspace dataset count or processed rows.
    const userCScope = await loadDashboardDatasetAggregation(userC)
    assert.equal(userCScope.datasetCount, 2, "dashboard aggregation counts only the caller's datasets")
    assert.equal(userCScope.activeDatasetCount, 2, "dashboard active count matches the caller's datasets")
    assert.equal(userCScope.totalRows, 90, "dashboard processed rows aggregate only the caller's datasets")
    const userCIds = new Set(userCScope.datasets.map((dataset) => dataset.id))
    assert.ok(userCIds.has(datasetC1) && userCIds.has(datasetC2), "dashboard aggregation includes the caller's standard and retail datasets")
    assert.ok(!userCIds.has(datasetC3), "dashboard aggregation excludes pre-bookkeeping datasets")
    assert.ok(!userCIds.has(datasetD1), "dashboard aggregation excludes another user's datasets")

    const userDScope = await loadDashboardDatasetAggregation(userD)
    assert.equal(userDScope.datasetCount, 1, "a workspace with one dataset reports one dataset")

    const selectedScope = await loadDashboardDatasetAggregation(userC, {
      datasetId: datasetC1,
      includeCompatibleDatasets: true,
    })
    const selectedIds = new Set(selectedScope.datasets.map((dataset) => dataset.id))
    assert.ok(selectedIds.has(datasetC1), "selected-dataset scope keeps the selected dataset")
    assert.ok(!selectedIds.has(datasetD1), "selected-dataset scope never includes another user's dataset")

    // Deletion semantics: after deleting the workspace datasets, the current
    // dashboard state reports zero datasets and zero processed rows.
    const deletion = await deleteDatasetsForUser({
      datasetIds: [datasetC1, datasetC2],
      userId: userC,
      role: "user",
      userEmail: `${userC}@example.test`,
    })
    assert.equal(deletion.deletedCount, 2, "workspace delete confirms both datasets deleted")

    const userCScopeAfterDelete = await loadDashboardDatasetAggregation(userC)
    assert.equal(userCScopeAfterDelete.datasetCount, 0, "deleted datasets leave the current dataset count")
    assert.equal(userCScopeAfterDelete.activeDatasetCount, 0, "deleted datasets leave the active dataset count")
    assert.equal(userCScopeAfterDelete.totalRows, 0, "processed rows drop to zero after workspace deletion")
    assert.equal(userCScopeAfterDelete.latestUpload, null, "latest upload falls back safely after deletion")

    const userDScopeAfterDelete = await loadDashboardDatasetAggregation(userD)
    assert.equal(userDScopeAfterDelete.datasetCount, 1, "deleting another user's datasets leaves unrelated workspaces unchanged")

    // Daily health wording follows the workspace dataset count.
    const oneDatasetSummary = buildDailyHealthSummary(userC, [buildHealthDataset("one", 45)])
    assert.equal(oneDatasetSummary, "Business health score is 68/100 across 1 dataset and 45 processed rows.", "daily health names one dataset for one workspace dataset")
    const twoDatasetSummary = buildDailyHealthSummary(userC, [buildHealthDataset("one", 45), buildHealthDataset("two", 45)])
    assert.equal(twoDatasetSummary, "Business health score is 68/100 across 2 datasets and 90 processed rows.", "daily health names both datasets for two workspace datasets")

    console.log("Dashboard workspace scope verification passed.")
  } finally {
    await db.delete(datasets).where(inArray(datasets.id, [datasetC1, datasetC2, datasetC3, datasetD1])).catch(() => {})
    await db.delete(users).where(inArray(users.id, [userC, userD])).catch(() => {})
  }
}

function buildDataset(id: string, userId: string, name: string, createdAt: Date) {
  return {
    id,
    userId,
    name,
    fileName: `${id}.csv`,
    rowCount: 45,
    columnCount: 3,
    columns: ["order_id", "revenue", "date"],
    data: [],
    datasetType: name.includes("Prebook") ? "prebookkeeping" : name.includes("Retail") ? "retail" : "standard",
    status: "ready",
    analysisStatus: "completed",
    analysis: {},
    createdAt,
    updatedAt: createdAt,
  }
}

function buildHealthDataset(id: string, rowCount: number) {
  return {
    id,
    name: id,
    datasetType: "standard",
    rowCount,
    columnCount: 3,
    createdAt: new Date(),
    columns: ["revenue", "date"],
    rows: [] as Record<string, unknown>[],
    analysisStatus: "completed",
    analysis: {},
    aiInsights: {},
    precomputedMetrics: {},
  }
}

function buildDailyHealthSummary(userId: string, healthDatasets: ReturnType<typeof buildHealthDataset>[]) {
  const source = {
    userId,
    workspaceId: null,
    workspaceKey: `user:${userId}`,
    date: "2026-09-22",
    profileComplete: true,
    hasBusinessProfile: true,
    datasets: healthDatasets,
  }
  const metrics = {
    rowCount: healthDatasets.reduce((total, dataset) => total + dataset.rowCount, 0),
    latestUploadAgeDays: null,
    totalRevenue: null,
    previousRevenue: null,
    revenueChangePct: null,
    totalProfit: null,
    profitMargin: null,
    lowStockCount: null,
    deadStockCount: null,
    inventoryHealth: null,
    forecastReliability: 32,
    missingDataCount: 0,
    aiInsightCount: 0,
    columns: {},
    isProfitabilityAnalysis: false,
    profitabilityExpenseShareLabel: null,
  }
  const signals: HealthSignal[] = [
    { id: "a", label: "A", score: 68, confidence: 70, summary: "A" },
    { id: "b", label: "B", score: 68, confidence: 70, summary: "B" },
  ]
  const brief = buildDeterministicBrief(source, metrics, signals)
  return brief.executiveSummary
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
