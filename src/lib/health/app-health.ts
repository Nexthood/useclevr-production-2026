import { getDb } from "@/lib/db"
import { sql } from "drizzle-orm"

export type AppHealth = {
  ok: boolean
  app: "healthy"
  helper: "healthy" | "unavailable"
  database: "healthy" | "degraded" | "unavailable"
  status: "ok" | "ready" | "not-ready"
  mode: "cloud"
  timestamp: string
}

async function getDatabaseHealth(): Promise<AppHealth["database"]> {
  const db = getDb()
  if (!db) return "unavailable"

  try {
    await db.execute(sql`SELECT 1`)
    return "healthy"
  } catch {
    return "degraded"
  }
}

async function getHelperHealth(): Promise<AppHealth["helper"]> {
  if (process.env.NODE_ENV === "production") return "unavailable"

  try {
    const response = await fetch("http://localhost:14567/health", {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(500),
    })
    return response.ok ? "healthy" : "unavailable"
  } catch {
    return "unavailable"
  }
}

export async function getAppHealth(): Promise<AppHealth> {
  const [database, helper] = await Promise.all([
    getDatabaseHealth(),
    getHelperHealth(),
  ])

  return {
    ok: true,
    app: "healthy",
    helper,
    database,
    status: database === "healthy" ? "ready" : "ok",
    mode: "cloud",
    timestamp: new Date().toISOString(),
  }
}

