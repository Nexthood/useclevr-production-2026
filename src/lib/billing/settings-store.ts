import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { billingPlans, type BillingPlan } from "@/lib/billing/plans"

export interface HybridAiCreditCosts {
  lite: number
  standard: number
  mega: number
}

export interface BillingSettings {
  hybridAiCreditCosts: HybridAiCreditCosts
  plans: BillingPlan[]
}

const STORE_DIR = process.env.BILLING_SETTINGS_STORE_DIR || "/tmp/useclevr-billing"
const STORE_PATH = path.join(STORE_DIR, "billing-settings.json")

export const defaultBillingSettings: BillingSettings = {
  hybridAiCreditCosts: {
    lite: 5,
    standard: 12,
    mega: 35,
  },
  plans: billingPlans,
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
    plans,
  }
}

export async function getBillingSettings(): Promise<BillingSettings> {
  try {
    const raw = await readFile(STORE_PATH, "utf8")
    return mergeSettings(JSON.parse(raw) as Partial<BillingSettings>)
  } catch {
    return defaultBillingSettings
  }
}

export async function saveBillingSettings(settings: BillingSettings): Promise<BillingSettings> {
  const nextSettings = mergeSettings(settings)
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
