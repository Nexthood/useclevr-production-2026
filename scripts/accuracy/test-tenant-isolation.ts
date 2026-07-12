import { randomUUID } from "node:crypto"

import { embedAccuracyText } from "@/lib/accuracy/embeddings"
import { searchDatasetContext } from "@/lib/accuracy/search"
import { db } from "@/lib/db"
import { datasets, retrievalDocuments, users } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"

async function main() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
  const userA = `acc_test_user_a_${suffix}`
  const userB = `acc_test_user_b_${suffix}`
  const datasetA = `acc_test_dataset_a_${suffix}`
  const datasetB = `acc_test_dataset_b_${suffix}`
  const now = new Date()

  try {
    await db.insert(users).values([
      { id: userA, email: `${userA}@example.test`, name: "Accuracy Test A", createdAt: now },
      { id: userB, email: `${userB}@example.test`, name: "Accuracy Test B", createdAt: now },
    ])

    await db.insert(datasets).values([
      {
        id: datasetA,
        userId: userA,
        name: "Tenant A Risk Dataset",
        fileName: "tenant-a.csv",
        rowCount: 1,
        columnCount: 2,
        columns: ["product", "risk"],
        data: [],
        datasetType: "standard",
        status: "ready",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: datasetB,
        userId: userB,
        name: "Tenant B Opportunity Dataset",
        fileName: "tenant-b.csv",
        rowCount: 1,
        columnCount: 2,
        columns: ["product", "opportunity"],
        data: [],
        datasetType: "standard",
        status: "ready",
        createdAt: now,
        updatedAt: now,
      },
    ])

    const [embeddingA, embeddingB] = await Promise.all([
      embedAccuracyText("tenant alpha product risk"),
      embedAccuracyText("tenant beta product opportunity"),
    ])

    await db.insert(retrievalDocuments).values([
      {
        userId: userA,
        datasetId: datasetA,
        datasetType: "standard",
        sourceType: "controlled_summary",
        sourceRecordId: "test-a",
        content: "tenant alpha product risk",
        metadata: { test: true },
        embedding: embeddingA.vector,
        embeddingModel: embeddingA.model,
        embeddingDimensions: embeddingA.dimensions,
        contentHash: "tenant-a-test-hash",
        language: "en",
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: userB,
        datasetId: datasetB,
        datasetType: "standard",
        sourceType: "controlled_summary",
        sourceRecordId: "test-b",
        content: "tenant beta product opportunity",
        metadata: { test: true },
        embedding: embeddingB.vector,
        embeddingModel: embeddingB.model,
        embeddingDimensions: embeddingB.dimensions,
        contentHash: "tenant-b-test-hash",
        language: "en",
        createdAt: now,
        updatedAt: now,
      },
    ])

    const ownResult = await searchDatasetContext({
      userId: userA,
      datasetId: datasetA,
      datasetType: "standard",
      query: "alpha risk",
      limit: 5,
    })

    if (ownResult.results.length === 0) {
      throw new Error("Tenant A search returned no results for its own dataset.")
    }

    const crossTenantLeak = ownResult.results.some((result) => result.datasetId !== datasetA)
    if (crossTenantLeak) {
      throw new Error("Tenant A search returned another tenant's retrieval document.")
    }

    let blocked = false
    try {
      await searchDatasetContext({
        userId: userB,
        datasetId: datasetA,
        datasetType: "standard",
        query: "alpha risk",
        limit: 5,
      })
    } catch (error) {
      blocked = error instanceof Error && error.message.includes("access denied")
    }

    if (!blocked) {
      throw new Error("Tenant B was able to search Tenant A's dataset.")
    }

    console.log("Accuracy tenant isolation test passed.")
  } finally {
    await db.delete(retrievalDocuments).where(inArray(retrievalDocuments.datasetId, [datasetA, datasetB])).catch(() => {})
    await db.delete(datasets).where(inArray(datasets.id, [datasetA, datasetB])).catch(() => {})
    await db.delete(users).where(inArray(users.id, [userA, userB])).catch(() => {})
    await db.delete(users).where(eq(users.email, `${userA}@example.test`)).catch(() => {})
    await db.delete(users).where(eq(users.email, `${userB}@example.test`)).catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
