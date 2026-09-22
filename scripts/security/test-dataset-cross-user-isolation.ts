import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { inArray } from "drizzle-orm"

import { findAccessibleDataset } from "@/lib/data/dataset-access"
import { loadDashboardDatasetAggregation } from "@/lib/data/dashboard-dataset-aggregation"
import { deleteDatasetsForUser } from "@/lib/data/delete-datasets"
import {
  calculateRiskIntelligenceForDataset,
  listRiskIntelligenceDatasets,
} from "@/lib/risk-intelligence/risk-service"
import { db } from "@/lib/db"
import { datasetRows, datasets, users } from "@/lib/db/schema"

const SUPERADMIN_USER_ID = "super-admin-user-id"

async function main() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
  const userA = `iso_user_a_${suffix}`
  const userB = `iso_user_b_${suffix}`
  const datasetA1 = `iso_ds_a1_${suffix}`
  const datasetA2 = `iso_ds_a2_${suffix}`
  const datasetB1 = `iso_ds_b1_${suffix}`
  const now = new Date()

  try {
    await db.insert(users).values([
      { id: userA, email: `${userA}@example.test`, name: "Isolation A", createdAt: now },
      { id: userB, email: `${userB}@example.test`, name: "Isolation B", createdAt: now },
    ])
    await db.insert(datasets).values([
      buildDataset(datasetA1, userA, "Isolation Retail A1", now, 30),
      buildDataset(datasetA2, userA, "Isolation Standard A2", now, 45),
      buildDataset(datasetB1, userB, "Isolation Retail B1", now, 60),
    ])
    await db.insert(datasetRows).values([
      buildRow(datasetA1, 0, { order_id: "A1-1", revenue: 100 }),
      buildRow(datasetA2, 0, { order_id: "A2-1", revenue: 200 }),
      buildRow(datasetB1, 0, { order_id: "B1-1", revenue: 300 }),
    ])

    // ─── Direct dataset access ────────────────────────────────────────
    const ownView = await findAccessibleDataset(datasetA1, userA, "user")
    assert.equal(ownView.dataset?.id, datasetA1, "User A can access Dataset A")

    const foreignViewA = await findAccessibleDataset(datasetB1, userA, "user")
    assert.equal(foreignViewA.dataset, null, "User A cannot access Dataset B through the shared access helper")

    const foreignViewB = await findAccessibleDataset(datasetA1, userB, "user")
    assert.equal(foreignViewB.dataset, null, "User B cannot access Dataset A through the shared access helper")

    // ─── Risk Intelligence isolation ─────────────────────────────────
    const riskListA = await listRiskIntelligenceDatasets({ id: userA, role: "user", email: `${userA}@example.test` }, {})
    const riskListIdsA = new Set(riskListA.map((dataset) => dataset.id))
    assert.ok(riskListIdsA.has(datasetA1), "Risk Intelligence lists User A's own datasets")
    assert.ok(!riskListIdsA.has(datasetB1), "Risk Intelligence never exposes User B's datasets to User A")

    const foreignRisk = await calculateRiskIntelligenceForDataset(datasetB1, { id: userA, role: "user", email: `${userA}@example.test` })
    assert.equal(foreignRisk.success, false, "risk calculation denies a foreign dataset ID")
    if (!foreignRisk.success) {
      assert.equal(foreignRisk.status, 404, "foreign risk calculation returns 404 dataset_not_found")
    }

    // ─── Dashboard aggregation isolation ─────────────────────────────
    const dashboardA = await loadDashboardDatasetAggregation(userA)
    const dashboardIdsA = new Set(dashboardA.datasets.map((dataset) => dataset.id))
    assert.ok(dashboardIdsA.has(datasetA1) && dashboardIdsA.has(datasetA2), "dashboard aggregation contains User A's datasets")
    assert.ok(!dashboardIdsA.has(datasetB1), "dashboard aggregation never contains User B's dataset")
    assert.equal(dashboardA.datasetCount, 2, "dashboard dataset count covers only the caller's datasets")
    assert.equal(dashboardA.totalRows, 75, "dashboard processed rows aggregate only the caller's datasets")

    const dashboardB = await loadDashboardDatasetAggregation(userB)
    const dashboardIdsB = new Set(dashboardB.datasets.map((dataset) => dataset.id))
    assert.ok(dashboardIdsB.has(datasetB1), "dashboard aggregation contains User B's own dataset")
    assert.ok(!dashboardIdsB.has(datasetA1) && !dashboardIdsB.has(datasetA2), "dashboard aggregation never contains User A's datasets for User B")

    const foreignSelected = await loadDashboardDatasetAggregation(userA, {
      datasetId: datasetB1,
      includeCompatibleDatasets: true,
    })
    assert.equal(foreignSelected.datasetCount, 0, "submitting a foreign dataset ID yields an empty selected-dataset scope")

    const foreignWorkspaceScope = await loadDashboardDatasetAggregation(userA, { datasetId: datasetB1 })
    assert.equal(foreignWorkspaceScope.datasetCount, 0, "direct dataset-scoped aggregation denies a foreign dataset ID")

    // ─── Mutation isolation: delete ──────────────────────────────────
    const foreignSingleDelete = await deleteDatasetsForUser({
      datasetIds: [datasetB1],
      userId: userA,
      role: "user",
      userEmail: `${userA}@example.test`,
    })
    assert.equal(foreignSingleDelete.deletedCount, 0, "User A cannot delete Dataset B")
    assert.deepEqual(foreignSingleDelete.failedIds, [datasetB1], "foreign delete reports the denied dataset")
    await assertDatasetPresent(datasetB1)

    const mixedBulkDelete = await deleteDatasetsForUser({
      datasetIds: [datasetA1, datasetB1],
      userId: userA,
      role: "user",
      userEmail: `${userA}@example.test`,
    })
    assert.deepEqual(mixedBulkDelete.deletedIds, [datasetA1], "bulk delete removes only the caller's dataset")
    assert.deepEqual(mixedBulkDelete.failedIds, [datasetB1], "bulk delete denies the foreign dataset inside a mixed selection")
    await assertDatasetPresent(datasetB1)
    await assertDatasetAbsent(datasetA1)

    // ─── Superadmin intentional access (separately asserted) ─────────
    // Asserted while the fixtures still exist. Superadmin resolves datasets
    // from both workspaces through the same shared helper, intentionally.
    const superadminViewA2 = await findAccessibleDataset(datasetA2, SUPERADMIN_USER_ID, "superadmin")
    assert.equal(superadminViewA2.dataset?.id, datasetA2, "superadmin intentionally resolves User A's dataset through the shared helper")
    const superadminViewB = await findAccessibleDataset(datasetB1, SUPERADMIN_USER_ID, "superadmin")
    assert.equal(superadminViewB.dataset?.id, datasetB1, "superadmin intentionally resolves User B's dataset through the shared helper")

    // Deleting User A's datasets never affects Dataset B.
    const remainingForeignDelete = await deleteDatasetsForUser({
      datasetIds: [datasetA2],
      userId: userA,
      role: "user",
      userEmail: `${userA}@example.test`,
    })
    assert.equal(remainingForeignDelete.deletedCount, 1, "User A deletes their remaining dataset")
    await assertDatasetPresent(datasetB1)
    const dashboardBAfterADeletion = await loadDashboardDatasetAggregation(userB)
    assert.equal(dashboardBAfterADeletion.datasetCount, 1, "User B's dashboard still reports their one dataset after User A deleted everything")

    const foreignDeleteFromB = await deleteDatasetsForUser({
      datasetIds: [datasetB1],
      userId: userB,
      role: "user",
      userEmail: `${userB}@example.test`,
    })
    assert.equal(foreignDeleteFromB.deletedCount, 1, "User B can delete their own dataset through the same shared path")
    await assertDatasetAbsent(datasetB1)

    console.log("Cross-user dataset isolation verification passed.")
  } finally {
    await db.delete(datasetRows).where(inArray(datasetRows.datasetId, [datasetA1, datasetA2, datasetB1])).catch(() => {})
    await db.delete(datasets).where(inArray(datasets.id, [datasetA1, datasetA2, datasetB1])).catch(() => {})
    await db.delete(users).where(inArray(users.id, [userA, userB])).catch(() => {})
  }
}

function buildDataset(id: string, userId: string, name: string, now: Date, rowCount: number) {
  return {
    id,
    userId,
    name,
    fileName: `${id}.csv`,
    rowCount,
    columnCount: 2,
    columns: ["order_id", "revenue"],
    data: [],
    datasetType: name.includes("Retail") ? "retail" : "standard",
    status: "ready",
    analysisStatus: "completed",
    analysis: {},
    createdAt: now,
    updatedAt: now,
  }
}

function buildRow(datasetId: string, rowIndex: number, data: Record<string, unknown>) {
  return {
    id: `${datasetId}-row-${rowIndex}`,
    datasetId,
    rowIndex,
    data,
  }
}

async function assertDatasetPresent(datasetId: string) {
  const rows = await db.select({ id: datasets.id }).from(datasets).where(inArray(datasets.id, [datasetId]))
  assert.equal(rows.length, 1, `${datasetId} must remain present`)
}

async function assertDatasetAbsent(datasetId: string) {
  const rows = await db.select({ id: datasets.id }).from(datasets).where(inArray(datasets.id, [datasetId]))
  assert.equal(rows.length, 0, `${datasetId} must be absent`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
