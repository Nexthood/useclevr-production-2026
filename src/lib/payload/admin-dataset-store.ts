import { parseCSVString } from "@/lib/data/csvLoader"
import { getDb } from "@/lib/db"
import { datasets, datasetRows, users } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

export type AdminDatasetView = {
  id: string
  userId: string
  ownerEmail: string
  ownerName: string | null
  name: string
  fileName: string
  fileSize: number | null
  rowCount: number
  columnCount: number
  columns: string[]
  analysisStatus: string
  status: string
  createdAt: string
  updatedAt: string
}

function cleanText(value: unknown, fallback = "", maxLength = 1000): string {
  if (typeof value !== "string") return fallback
  return value.trim().slice(0, maxLength)
}

export async function listDatasets(): Promise<{
  datasets: AdminDatasetView[]
  users: Array<{ id: string; email: string | null; name: string | null }>
}> {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [datasetRows, userRows] = await Promise.all([
    db
      .select({
        id: datasets.id,
        userId: datasets.userId,
        name: datasets.name,
        fileName: datasets.fileName,
        fileSize: datasets.fileSize,
        rowCount: datasets.rowCount,
        columnCount: datasets.columnCount,
        columns: datasets.columns,
        analysisStatus: datasets.analysisStatus,
        status: datasets.status,
        createdAt: datasets.createdAt,
        updatedAt: datasets.updatedAt,
      })
      .from(datasets)
      .orderBy(desc(datasets.updatedAt)),
    db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .orderBy(users.email),
  ])

  const usersById = new Map(userRows.map((u) => [u.id, u]))

  return {
    datasets: datasetRows.map((d) => ({
      id: d.id,
      userId: d.userId,
      ownerEmail: usersById.get(d.userId)?.email || "Unknown",
      ownerName: usersById.get(d.userId)?.name || null,
      name: d.name,
      fileName: d.fileName,
      fileSize: d.fileSize,
      rowCount: d.rowCount,
      columnCount: d.columnCount,
      columns: (d.columns as string[]) || [],
      analysisStatus: d.analysisStatus || "unknown",
      status: d.status,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    users: userRows.filter((u) => Boolean(u.email)),
  }
}

export async function getDatasetById(id: string): Promise<AdminDatasetView | null> {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [row] = await db
    .select({
      id: datasets.id,
      userId: datasets.userId,
      name: datasets.name,
      fileName: datasets.fileName,
      fileSize: datasets.fileSize,
      rowCount: datasets.rowCount,
      columnCount: datasets.columnCount,
      columns: datasets.columns,
      analysisStatus: datasets.analysisStatus,
      status: datasets.status,
      createdAt: datasets.createdAt,
      updatedAt: datasets.updatedAt,
    })
    .from(datasets)
    .where(eq(datasets.id, id))
    .limit(1)

  if (!row) return null

  const [owner] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1)

  return {
    ...row,
    analysisStatus: row.analysisStatus || "unknown",
    ownerEmail: owner?.email || "Unknown",
    ownerName: owner?.name || null,
    columns: (row.columns as string[]) || [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function uploadDataset(
  file: File,
  userId: string,
): Promise<{ id: string; name: string; rowCount: number; columnCount: number }> {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  if (!file.name.toLowerCase().endsWith(".csv") && !file.type.includes("csv")) {
    throw new Error("File must be a CSV file.")
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("File size must be less than 50MB.")
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!owner) throw new Error("The selected dashboard user does not exist.")

  const parsed = parseCSVString(await file.text())
  if (parsed.rowCount === 0) throw new Error("CSV file is empty.")

  const id = `ds_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
  const rows = parsed.rows as Record<string, string | number | boolean | null>[]
  const now = new Date()

  await db.insert(datasets).values({
    id,
    userId,
    name: file.name.replace(/\.csv$/i, ""),
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "text/csv",
    rowCount: parsed.rowCount,
    columnCount: parsed.columns.length,
    columns: parsed.columns,
    data: rows,
    columnTypes: {},
    status: "ready",
    analysisStatus: "ready",
    analysisProgress: 100,
    analysis: {},
    createdAt: now,
    updatedAt: now,
  })

  const batchSize = 100
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    await db.insert(datasetRows).values(
      rows.slice(offset, offset + batchSize).map((row, index) => ({
        id: `${id}-row-${offset + index}`,
        datasetId: id,
        rowIndex: offset + index,
        data: row,
      })),
    )
  }

  return {
    id,
    name: file.name.replace(/\.csv$/i, ""),
    rowCount: parsed.rowCount,
    columnCount: parsed.columns.length,
  }
}

export async function deleteDataset(id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [existing] = await db
    .select({ id: datasets.id })
    .from(datasets)
    .where(eq(datasets.id, id))
    .limit(1)

  if (!existing) throw new Error("Dataset was not found.")

  await db.delete(datasetRows).where(eq(datasetRows.datasetId, id))
  await db.delete(datasets).where(eq(datasets.id, id))
}

export async function getDatasetPreview(id: string, limit = 20, offset = 0) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const rows = await db
    .select({ rowIndex: datasetRows.rowIndex, data: datasetRows.data })
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, id))
    .orderBy(datasetRows.rowIndex)
    .limit(limit)
    .offset(offset)

  return rows.map((r) => ({
    rowIndex: r.rowIndex,
    data: r.data as Record<string, unknown>,
  }))
}
