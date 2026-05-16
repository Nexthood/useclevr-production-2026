import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"

export type ReferralEventType = "click" | "signup" | "paid"

export interface ReferralStats {
  code: string
  clicks: number
  signups: number
  paidReferrals: number
  creditsEarned: number
  createdAt: string
  updatedAt: string
}

interface ReferralStoreFile {
  referrals: Record<string, ReferralStats>
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
    return { referrals: parsed.referrals || {} }
  } catch {
    return { referrals: {} }
  }
}

async function writeStore(store: ReferralStoreFile) {
  await mkdir(STORE_DIR, { recursive: true })
  const tmpPath = `${STORE_PATH}.${process.pid}.tmp`
  await writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8")
  await rename(tmpPath, STORE_PATH)
}

export async function getReferralStats(code: string) {
  const normalizedCode = normalizeReferralCode(code)
  if (!normalizedCode) throw new Error("A referral code is required.")

  const store = await readStore()
  const stats = store.referrals[normalizedCode] || emptyReferralStats(normalizedCode)
  store.referrals[normalizedCode] = stats
  await writeStore(store)
  return stats
}

export async function recordReferralEvent(code: string, type: ReferralEventType) {
  const normalizedCode = normalizeReferralCode(code)
  if (!normalizedCode) throw new Error("A referral code is required.")

  const store = await readStore()
  const stats = store.referrals[normalizedCode] || emptyReferralStats(normalizedCode)

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
  await writeStore(store)
  return stats
}
