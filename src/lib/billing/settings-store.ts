import { billingPlans, type BillingPlan } from "@/lib/billing/plans"
import { getDb } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

export interface HybridAiCreditCosts {
  lite: number
  standard: number
  mega: number
}

export interface ReferralConfig {
  referralsPerCredit: number
  enabled: boolean
}

export interface BillingSettings {
  hybridAiCreditCosts: HybridAiCreditCosts
  referralConfig: ReferralConfig
  plans: BillingPlan[]
  levels?: CustomerLevel[]
  discountRules?: DiscountRule[]
}

type CustomerLevel = {
  id: string
  name: string
  minInteractions: number
  minPageVisits: number
  minUploads: number
  minCreditsUsed: number
  minLogins: number
  creditReward: number
}

type DiscountRule = {
  id: string
  type: "free" | "percentage" | "referral" | "stacking"
  name: string
  code: string
  percent?: number
  description: string
  enabled: boolean
}

const STORE_DIR = process.env.BILLING_SETTINGS_STORE_DIR || "/tmp/useclevr-billing"
const STORE_PATH = path.join(STORE_DIR, "billing-settings.json")
const SETTINGS_KEY = "billing"

export const defaultBillingSettings: BillingSettings = {
  hybridAiCreditCosts: {
    lite: 5,
    standard: 12,
    mega: 35,
  },
  referralConfig: {
    referralsPerCredit: 5,
    enabled: true,
  },
  plans: billingPlans,
  levels: [
    { id: "1", name: "Explorer", minInteractions: 1,  minPageVisits: 1,  minUploads: 0, minCreditsUsed: 0, minLogins: 1, creditReward: 1 },
    { id: "2", name: "Analyst",   minInteractions: 5,  minPageVisits: 3,  minUploads: 1, minCreditsUsed: 2, minLogins: 3, creditReward: 2 },
    { id: "3", name: "Strategist",minInteractions: 15, minPageVisits: 8,  minUploads: 3, minCreditsUsed: 5, minLogins: 7, creditReward: 5 },
    { id: "4", name: "Expert",    minInteractions: 40, minPageVisits: 20, minUploads: 8, minCreditsUsed: 15, minLogins: 15, creditReward: 10 },
    { id: "5", name: "Champion",  minInteractions: 100,minPageVisits: 50, minUploads: 20,minCreditsUsed: 40,minLogins: 30, creditReward: 20 },
  ],
  discountRules: [
    { id: "1", type: "percentage", name: "Pro Annual Discount", code: "ANNUAL20", percent: 17, description: "17 % off annual billing for Pro.", enabled: true },
    { id: "2", type: "referral",   name: "Referral Reward",   code: "REFERRAL",  percent: 100, description: "Free month per successful referral.", enabled: true },
  ],
}

function sanitizePlan(plan: BillingPlan): BillingPlan {
  return {
    ...plan,
    name: String(plan.name || "Plan").slice(0, 80),
    description: String(plan.description || "").slice(0, 240),
    features: Array.isArray(plan.features)
      ? plan.features.map((feature) => String(feature).trim()).filter(Boolean).slice(0, 12)
      : [],
    price: Math.max(0, Number(plan.price) || 0),
  }
}

function mergeSettings(input: Partial<BillingSettings>): BillingSettings {
  const defaultById = new Map(defaultBillingSettings.plans.map((plan) => [plan.id, plan]))
  const incomingPlans = Array.isArray(input.plans) ? input.plans : []
  const plans = defaultBillingSettings.plans.map((defaultPlan) => {
    const incoming = incomingPlans.find((plan) => plan.id === defaultPlan.id)
    return sanitizePlan({ ...defaultById.get(defaultPlan.id)!, ...incoming, id: defaultPlan.id })
  })

  return {
    hybridAiCreditCosts: {
      lite: Math.max(0, Number(input.hybridAiCreditCosts?.lite) || defaultBillingSettings.hybridAiCreditCosts.lite),
      standard: Math.max(0, Number(input.hybridAiCreditCosts?.standard) || defaultBillingSettings.hybridAiCreditCosts.standard),
      mega: Math.max(0, Number(input.hybridAiCreditCosts?.mega) || defaultBillingSettings.hybridAiCreditCosts.mega),
    },
    referralConfig: {
      referralsPerCredit: Math.max(1, Math.floor(Number(input.referralConfig?.referralsPerCredit) || defaultBillingSettings.referralConfig.referralsPerCredit)),
      enabled: input.referralConfig?.enabled !== undefined ? Boolean(input.referralConfig.enabled) : defaultBillingSettings.referralConfig.enabled,
    },
    plans,
    levels: Array.isArray(input.levels) ? input.levels : defaultBillingSettings.levels,
    discountRules: Array.isArray(input.discountRules) ? input.discountRules : defaultBillingSettings.discountRules,
  }
}

export async function getBillingSettings(): Promise<BillingSettings> {
  try {
    const db = getDb()
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY)).limit(1)
    if (row) {
      return mergeSettings(row.value as Partial<BillingSettings>)
    }
  } catch {
    // Fall back to local file storage for local/offline development.
  }

  try {
    const raw = await readFile(STORE_PATH, "utf8")
    return mergeSettings(JSON.parse(raw) as Partial<BillingSettings>)
  } catch {
    return defaultBillingSettings
  }
}

export async function saveBillingSettings(settings: BillingSettings): Promise<BillingSettings> {
  const nextSettings = mergeSettings(settings)
  try {
    const db = getDb()
    await db.insert(appSettings).values({
      key: SETTINGS_KEY,
      value: nextSettings,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: nextSettings,
        updatedAt: new Date(),
      },
    })
    return nextSettings
  } catch {
    // Fall back to local file storage for local/offline development.
  }

  await mkdir(STORE_DIR, { recursive: true })
  const tmpPath = `${STORE_PATH}.${process.pid}.tmp`
  await writeFile(tmpPath, JSON.stringify(nextSettings, null, 2), "utf8")
  await rename(tmpPath, STORE_PATH)
  return nextSettings
}

export async function getConfiguredBillingPlan(planId: string | null | undefined) {
  const settings = await getBillingSettings()
  return settings.plans.find((plan) => plan.id === planId) || settings.plans[1]
}
