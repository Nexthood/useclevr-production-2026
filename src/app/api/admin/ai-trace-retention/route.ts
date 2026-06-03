import { requireSuperAdmin } from "@/lib/auth/require-session"
import { getDb } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

const SETTINGS_KEY = "ai_trace_retention"

interface RetentionConfig {
  retentionDays: number
  autoCleanupEnabled: boolean
}

const defaultConfig: RetentionConfig = {
  retentionDays: 90,
  autoCleanupEnabled: true,
}

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  try {
    const db = getDb()
    if (!db) return NextResponse.json(defaultConfig)

    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, SETTINGS_KEY))
      .limit(1)

    if (row) {
      return NextResponse.json(row.value as RetentionConfig)
    }
    return NextResponse.json(defaultConfig)
  } catch {
    return NextResponse.json(defaultConfig)
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  try {
    const body = await request.json()
    const config: RetentionConfig = {
      retentionDays: Math.max(1, Math.min(365, body.retentionDays || 90)),
      autoCleanupEnabled: body.autoCleanupEnabled !== false,
    }

    const db = getDb()
    if (!db) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 })
    }

    await db
      .insert(appSettings)
      .values({ key: SETTINGS_KEY, value: config, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: config, updatedAt: new Date() },
      })

    return NextResponse.json({ success: true, config })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
