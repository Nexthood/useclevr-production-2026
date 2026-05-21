import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { getDb } from "@/lib/db"
import { referralEvents, referralStats } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import path from "node:path"

export type ReferralEventType = "click" | "signup" | "paid"

export interface ReferralStats {
  code: string
  ownerUserId?: string | null
  ownerEmail?: string | null
  clicks: number
  signups: number
  paidReferrals: number
  creditsEarned: number
  createdAt: string
  updatedAt: string
}

interface ReferralStoreFile {
  referrals: Record<string, ReferralStats>
  events: Record<string, true>
}

const STORE_DIR = process.env.REFERRAL_STORE_DIR || "/tmp/useclevr-referrals"
const STORE_PATH = path.join(STORE_DIR, "referrals.json")
const COOKIE_NAME = "useclevr_referral_code"

export { COOKIE_NAME as referralCookieName }

export function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string") return ""
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32)
}

export function createReferralCode() {
  return `uc-${randomUUID().replace(/-/g, "").slice(0, 10)}`
}

export function buildReferralLink(origin: string, code: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || origin
  const url = new URL("/signup", baseUrl)
  url.searchParams.set("ref", code)
  return url.toString()
}

export function emptyReferralStats(code: string): ReferralStats {
  const now = new Date().toISOString()
  return {
    code,
    ownerUserId: null,
    ownerEmail: null,
    clicks: 0,
    signups: 0,
    paidReferrals: 0,
    creditsEarned: 0,
    createdAt: now,
    updatedAt: now,
  }
}

async function readStore(): Promise<ReferralStoreFile> {
  try {
    const raw = await readFile(STORE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<ReferralStoreFile>
    return { referrals: parsed.referrals || {}, events: (parsed as Partial<ReferralStoreFile>).events || {} }
  } catch {
    return { referrals: {}, events: {} }
  }
}

async function writeStore(store: ReferralStoreFile) {
  await mkdir(STORE_DIR, { recursive: true })
  const tmpPath = `${STORE_PATH}.${process.pid}.tmp`
  await writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8")
  await rename(tmpPath, STORE_PATH)
}

function toStats(row: typeof referralStats.$inferSelect): ReferralStats {
  return {
    code: row.code,
    ownerUserId: row.ownerUserId,
    ownerEmail: row.ownerEmail,
    clicks: row.clicks,
    signups: row.signups,
    paidReferrals: row.paidReferrals,
    creditsEarned: row.creditsEarned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function getDbClient() {
  try {
    return getDb()
  } catch {
    return null
  }
}

function eventKeyFor(code: string, type: ReferralEventType, key?: string | null) {
  const normalizedKey = normalizeReferralCode(key || "")
  return normalizedKey ? `${code}:${type}:${normalizedKey}` : `${code}:${type}:${randomUUID()}`
}

export async function getReferralStats(
  code: string,
  owner?: { userId?: string | null; email?: string | null },
) {
  const normalizedCode = normalizeReferralCode(code)
  if (!normalizedCode) throw new Error("A referral code is required.")

  const db = getDbClient()
  if (db) {
    try {
      const now = new Date()
      await db.insert(referralStats).values({
        code: normalizedCode,
        ownerUserId: owner?.userId || null,
        ownerEmail: owner?.email || null,
        clicks: 0,
        signups: 0,
        paidReferrals: 0,
        creditsEarned: 0,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing({ target: referralStats.code })

      if (owner?.userId || owner?.email) {
        await db.update(referralStats).set({
          ownerUserId: owner.userId || null,
          ownerEmail: owner.email || null,
          updatedAt: now,
        }).where(eq(referralStats.code, normalizedCode))
      }

      const [row] = await db.select().from(referralStats).where(eq(referralStats.code, normalizedCode)).limit(1)
      if (row) return toStats(row)
    } catch {
      // Fall back to local file storage for local/offline development.
    }
  }

  const store = await readStore()
  const stats = store.referrals[normalizedCode] || emptyReferralStats(normalizedCode)
  if (owner?.userId || owner?.email) {
    stats.ownerUserId = owner.userId || null
    stats.ownerEmail = owner.email || null
  }
  store.referrals[normalizedCode] = stats
  await writeStore(store)
  return stats
}

export async function recordReferralEvent(
  code: string,
  type: ReferralEventType,
  options: {
    eventKey?: string | null
    referredUserId?: string | null
    referredEmail?: string | null
  } = {},
) {
  const normalizedCode = normalizeReferralCode(code)
  if (!normalizedCode) throw new Error("A referral code is required.")

  const db = getDbClient()
  if (db) {
    try {
      const [existing] = await db.select().from(referralStats).where(eq(referralStats.code, normalizedCode)).limit(1)
      const ownerEmail = existing?.ownerEmail?.toLowerCase() || ""
      const referredEmail = options.referredEmail?.toLowerCase() || ""
      if (
        (existing?.ownerUserId && options.referredUserId && existing.ownerUserId === options.referredUserId) ||
        (ownerEmail && referredEmail && ownerEmail === referredEmail)
      ) {
        throw new Error("Self-referrals are not eligible for rewards.")
      }

      const key = eventKeyFor(normalizedCode, type, options.eventKey)
      const [event] = await db.insert(referralEvents).values({
        id: `refevt-${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        code: normalizedCode,
        type,
        eventKey: key,
        referredUserId: options.referredUserId || null,
        referredEmail: options.referredEmail || null,
        createdAt: new Date(),
      }).onConflictDoNothing({ target: referralEvents.eventKey }).returning()

      if (!event) {
        const [row] = await db.select().from(referralStats).where(eq(referralStats.code, normalizedCode)).limit(1)
        return row ? toStats(row) : emptyReferralStats(normalizedCode)
      }

      const current = existing ? toStats(existing) : await getReferralStats(normalizedCode)
      if (type === "click") current.clicks += 1
      if (type === "signup") {
        current.signups += 1
        current.creditsEarned += 5
      }
      if (type === "paid") {
        current.paidReferrals += 1
        current.creditsEarned += 25
      }
      current.updatedAt = new Date().toISOString()

      const [row] = await db.insert(referralStats).values({
        code: normalizedCode,
        ownerUserId: current.ownerUserId || null,
        ownerEmail: current.ownerEmail || null,
        clicks: current.clicks,
        signups: current.signups,
        paidReferrals: current.paidReferrals,
        creditsEarned: current.creditsEarned,
        createdAt: new Date(current.createdAt),
        updatedAt: new Date(current.updatedAt),
      }).onConflictDoUpdate({
        target: referralStats.code,
        set: {
          clicks: current.clicks,
          signups: current.signups,
          paidReferrals: current.paidReferrals,
          creditsEarned: current.creditsEarned,
          updatedAt: new Date(current.updatedAt),
        },
      }).returning()

      return toStats(row)
    } catch (error) {
      if (error instanceof Error && error.message.includes("Self-referrals")) {
        throw error
      }
      // Fall back to local file storage for local/offline development.
    }
  }

  const store = await readStore()
  const stats = store.referrals[normalizedCode] || emptyReferralStats(normalizedCode)

  if (stats.ownerUserId && options.referredUserId && stats.ownerUserId === options.referredUserId) {
    throw new Error("Self-referrals are not eligible for rewards.")
  }
  if (stats.ownerEmail && options.referredEmail && stats.ownerEmail.toLowerCase() === options.referredEmail.toLowerCase()) {
    throw new Error("Self-referrals are not eligible for rewards.")
  }

  const fileEventKey = options.eventKey ? eventKeyFor(normalizedCode, type, options.eventKey) : ""
  if (fileEventKey && store.events[fileEventKey]) {
    return stats
  }

  if (type === "click") stats.clicks += 1
  if (type === "signup") {
    stats.signups += 1
    stats.creditsEarned += 5
  }
  if (type === "paid") {
    stats.paidReferrals += 1
    stats.creditsEarned += 25
  }

  stats.updatedAt = new Date().toISOString()
  store.referrals[normalizedCode] = stats
  if (fileEventKey) {
    store.events[fileEventKey] = true
  }
  await writeStore(store)
  return stats
}
