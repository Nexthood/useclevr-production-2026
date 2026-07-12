import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { deleteDatasetsForUser } from "@/lib/data/delete-datasets"
import { db } from "@/lib/db"
import { datasetRows, datasets, retrievalDocuments, users } from "@/lib/db/schema"
import { eq, inArray, sql } from "drizzle-orm"

async function main() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
  const userA = `delete_test_user_a_${suffix}`
  const userB = `delete_test_user_b_${suffix}`
  const datasetA1 = `delete_test_dataset_a1_${suffix}`
  const datasetA2 = `delete_test_dataset_a2_${suffix}`
  const datasetB1 = `delete_test_dataset_b1_${suffix}`
  const now = new Date()
  const retrievalTableExists = await tableExists("RetrievalDocument")

  try {
    await db.insert(users).values([
      { id: userA, email: `${userA}@example.test`, name: "Delete Test A", createdAt: now },
      { id: userB, email: `${userB}@example.test`, name: "Delete Test B", createdAt: now },
    ])

    await db.insert(datasets).values([
      buildDataset(datasetA1, userA, "Delete Test Retail A1", now),
      buildDataset(datasetA2, userA, "Delete Test Profitability A2", now),
      buildDataset(datasetB1, userB, "Delete Test Retail B1", now),
    ])

    await db.insert(datasetRows).values([
      buildDatasetRow(datasetA1, 0, { sku: "SKU-A1-001", description: "English retail product", revenue: 1200 }),
      buildDatasetRow(datasetA2, 0, { sku: "SKU-A2-001", description: "German product margin", profit: 340 }),
      buildDatasetRow(datasetB1, 0, { sku: "SKU-B1-001", description: "Other tenant product", revenue: 999 }),
    ])

    if (retrievalTableExists) {
      await db.insert(retrievalDocuments).values([
        buildRetrievalDocument(userA, datasetA1, "SKU-A1-001 English retail product delete fixture", now),
        buildRetrievalDocument(userA, datasetA2, "SKU-A2-001 German profitability fixture", now),
        buildRetrievalDocument(userB, datasetB1, "SKU-B1-001 isolated tenant fixture", now),
      ])
    }

    const single = await deleteDatasetsForUser({
      datasetIds: [datasetA1],
      userId: userA,
      userEmail: `${userA}@example.test`,
      role: "user",
    })

    assert.equal(single.ok, true, "single delete succeeds")
    assert.deepEqual(single.deletedIds, [datasetA1], "single delete returns deleted dataset")
    await assertDatasetAbsent(datasetA1)
    await assertDatasetRowsAbsent(datasetA1)
    if (retrievalTableExists) await assertRetrievalAbsent(datasetA1)

    const repeated = await deleteDatasetsForUser({
      datasetIds: [datasetA1],
      userId: userA,
      userEmail: `${userA}@example.test`,
      role: "user",
    })
    assert.equal(repeated.deletedIds.length, 0, "repeated delete is idempotent")
    assert.equal(repeated.failed[0]?.datasetId, datasetA1, "repeated delete reports the missing dataset")

    const mixed = await deleteDatasetsForUser({
      datasetIds: [datasetA2, datasetB1],
      userId: userA,
      userEmail: `${userA}@example.test`,
      role: "user",
    })

    assert.equal(mixed.ok, false, "mixed authorized/unauthorized delete reports partial failure")
    assert.deepEqual(mixed.deletedIds, [datasetA2], "mixed delete removes only authorized dataset")
    assert.equal(mixed.failed[0]?.datasetId, datasetB1, "mixed delete reports unauthorized dataset")
    await assertDatasetAbsent(datasetA2)
    await assertDatasetPresent(datasetB1)
    await assertDatasetRowsAbsent(datasetA2)
    if (retrievalTableExists) {
      await assertRetrievalAbsent(datasetA2)
      await assertRetrievalPresent(datasetB1)
    }

    const lastTenantDataset = await deleteDatasetsForUser({
      datasetIds: [datasetB1],
      userId: userB,
      userEmail: `${userB}@example.test`,
      role: "user",
    })

    assert.equal(lastTenantDataset.ok, true, "last dataset delete succeeds")
    await assertDatasetAbsent(datasetB1)
    await assertDatasetRowsAbsent(datasetB1)
    if (retrievalTableExists) await assertRetrievalAbsent(datasetB1)

    console.log(`Dataset deletion verification passed. retrievalTableExists=${retrievalTableExists}`)
  } finally {
    await cleanup([datasetA1, datasetA2, datasetB1], [userA, userB], retrievalTableExists)
  }
}

function buildDataset(id: string, userId: string, name: string, now: Date) {
  return {
    id,
    userId,
    name,
    fileName: `${id}.csv`,
    rowCount: 1,
    columnCount: 3,
    columns: ["sku", "description", "revenue"],
    data: [],
    datasetType: name.includes("Profitability") ? "profitability" : "retail",
    status: "ready",
    analysisStatus: "completed",
    analysis: {},
    createdAt: now,
    updatedAt: now,
  }
}

function buildDatasetRow(datasetId: string, rowIndex: number, data: Record<string, unknown>) {
  return {
    id: `${datasetId}-row-${rowIndex}`,
    datasetId,
    rowIndex,
    data,
  }
}

function buildRetrievalDocument(userId: string, datasetId: string, content: string, now: Date) {
  return {
    userId,
    datasetId,
    datasetType: content.includes("profitability") ? "profitability" as const : "retail" as const,
    sourceType: "product_identity" as const,
    sourceRecordId: `${datasetId}-retrieval`,
    content,
    metadata: { synthetic: true },
    embedding: [0.1, 0.2, 0.3],
    embeddingModel: "synthetic",
    embeddingDimensions: 3,
    contentHash: randomUUID().replaceAll("-", ""),
    language: "en",
    ingestionStatus: "ready",
    createdAt: now,
    updatedAt: now,
  }
}

async function assertDatasetAbsent(datasetId: string) {
  const rows = await db.select({ id: datasets.id }).from(datasets).where(eq(datasets.id, datasetId))
  assert.equal(rows.length, 0, `${datasetId} remains in Dataset`)
}

async function assertDatasetPresent(datasetId: string) {
  const rows = await db.select({ id: datasets.id }).from(datasets).where(eq(datasets.id, datasetId))
  assert.equal(rows.length, 1, `${datasetId} is missing unexpectedly`)
}

async function assertDatasetRowsAbsent(datasetId: string) {
  const rows = await db.select({ id: datasetRows.id }).from(datasetRows).where(eq(datasetRows.datasetId, datasetId))
  assert.equal(rows.length, 0, `${datasetId} rows remain`)
}

async function assertRetrievalAbsent(datasetId: string) {
  const rows = await db.select({ id: retrievalDocuments.id }).from(retrievalDocuments).where(eq(retrievalDocuments.datasetId, datasetId))
  assert.equal(rows.length, 0, `${datasetId} retrieval documents remain`)
}

async function assertRetrievalPresent(datasetId: string) {
  const rows = await db.select({ id: retrievalDocuments.id }).from(retrievalDocuments).where(eq(retrievalDocuments.datasetId, datasetId))
  assert.equal(rows.length, 1, `${datasetId} retrieval document is missing unexpectedly`)
}

async function tableExists(tableName: string) {
  const result = await db.execute(sql`SELECT to_regclass(${`"${tableName}"`}) IS NOT NULL AS "exists"`)
  return extractRows(result).some((row) => row.exists === true || row.exists === "t")
}

async function cleanup(datasetIds: string[], userIds: string[], retrievalTableExists: boolean) {
  if (retrievalTableExists) {
    await db.delete(retrievalDocuments).where(inArray(retrievalDocuments.datasetId, datasetIds)).catch(() => {})
  }
  await db.delete(datasetRows).where(inArray(datasetRows.datasetId, datasetIds)).catch(() => {})
  await db.delete(datasets).where(inArray(datasets.id, datasetIds)).catch(() => {})
  await db.delete(users).where(inArray(users.id, userIds)).catch(() => {})
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: Array<Record<string, unknown>> }).rows
  }
  return []
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
