"use server"

import { debugError, debugLog } from "@/lib/utils/debug"
import { mkdir, readFile, rename, writeFile } from "fs/promises"
import path from "path"
import { getDb } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

const STORE_DIR = process.env.WAITLIST_STORE_DIR || "/tmp/useclevr-waitlist"
const STORE_PATH = path.join(STORE_DIR, "waitlist.json")

type WaitlistStore = {
  emails: Record<string, { email: string; source: string; createdAt: string }>
}

async function readFallbackStore(): Promise<WaitlistStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<WaitlistStore>
    return { emails: parsed.emails || {} }
  } catch {
    return { emails: {} }
  }
}

async function writeFallbackStore(store: WaitlistStore) {
  await mkdir(STORE_DIR, { recursive: true })
  const tmpPath = `${STORE_PATH}.${process.pid}.tmp`
  await writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8")
  await rename(tmpPath, STORE_PATH)
}

async function joinFallbackWaitlist(email: string, source: string) {
  const store = await readFallbackStore()
  if (!store.emails[email]) {
    store.emails[email] = {
      email,
      source,
      createdAt: new Date().toISOString(),
    }
    await writeFallbackStore(store)
  }
}

export async function joinWaitlist(email: string, source: string = "landing_page"): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Validate email
    if (!email || !email.includes("@")) {
      return { success: false, error: "Please enter a valid email address" }
    }

    const normalizedEmail = email.toLowerCase().trim()
    const db = getDb()
    if (!db) {
      await joinFallbackWaitlist(normalizedEmail, source)
      return { success: true }
    }

    // Check if already on waitlist
    const existing = await db.query.waitlist.findFirst({
      where: eq(waitlist.email, normalizedEmail),
    })

    if (existing) {
      // Already on waitlist - still return success
      return { success: true }
    }

    // Add to waitlist
    const id = uuidv4()
    await db.insert(waitlist).values({
      id,
      email: normalizedEmail,
      source,
      status: "new",
    })

    debugLog("[WAITLIST] New signup:", normalizedEmail, "from:", source)

    return { success: true }
  } catch (error) {
    debugError("[WAITLIST] Error:", error)
    try {
      await joinFallbackWaitlist(email.toLowerCase().trim(), source)
      return { success: true }
    } catch (fallbackError) {
      debugError("[WAITLIST] Fallback error:", fallbackError)
      return { success: false, error: "Failed to join waitlist. Please try again." }
    }
  }
}
