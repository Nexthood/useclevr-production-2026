import { revalidatePath } from "next/cache"

const BUSINESS_PROFILE_DEPENDENT_PATHS = [
  "/app",
  "/app/business",
  "/app/business/setup",
  "/app/business/profile",
  "/app/business/review",
  "/app/accountancy",
  "/app/accountancy/tax",
  "/app/accountancy/compliance",
  "/app/accountancy/reporting",
  "/app/prebookkeeping",
  "/app/profitability",
] as const

export function revalidateBusinessProfileDependents() {
  for (const path of BUSINESS_PROFILE_DEPENDENT_PATHS) {
    revalidatePath(path)
  }
}
