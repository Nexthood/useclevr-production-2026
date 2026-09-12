import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { BUILTIN_SUPER_ADMIN_USER, isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { FREE_PLAN_LIMITS } from "@/lib/billing/plans"
import { isUnlimitedCreditRole } from "@/lib/billing/credit-engine"
import {
  getDatasetLimitInfo,
  getDatasetLimitError,
  getPrebookkeepingLimitInfo,
  getPrebookkeepingLimitError,
  type DatasetLimitInfo,
} from "@/lib/usage/dataset-limits"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

type TestCase = {
  name: string
  run: () => Promise<void> | void
}

const tests: TestCase[] = [
  {
    name: "Free plan maxDatasets equals 2 (pre-bookkeeping limit ceiling)",
    run() {
      assert.equal(FREE_PLAN_LIMITS.maxDatasets, 2, "Free plan maxDatasets is 2, matching the 2 pre-bookkeeping uploads allowance")
    },
  },
  {
    name: "superadmin user bypasses the pre-bookkeeping dataset limit",
    async run() {
      const info = await getDatasetLimitInfo(BUILTIN_SUPER_ADMIN_USER.id, "superadmin", BUILTIN_SUPER_ADMIN_USER.email, "prebookkeeping")
      assert.equal(info.canCreate, true, "superadmin can always create pre-bookkeeping uploads")
      assert.equal(info.limit, Infinity, "superadmin has unlimited pre-bookkeeping uploads")
    },
  },
  {
    name: "superadmin role bypass applies regardless of datasetType filter",
    async run() {
      const unfiltered = await getDatasetLimitInfo(BUILTIN_SUPER_ADMIN_USER.id, "superadmin", null, undefined)
      const filtered = await getDatasetLimitInfo(BUILTIN_SUPER_ADMIN_USER.id, "superadmin", null, "prebookkeeping")
      assert.equal(unfiltered.canCreate, true, "unfiltered superadmin bypass is unlimited")
      assert.equal(filtered.canCreate, true, "filtered superadmin bypass is unlimited")
      assert.equal(filtered.limit, Infinity, "filtered superadmin limit stays Infinity")
    },
  },
  {
    name: "admin role bypasses the pre-bookkeeping dataset limit",
    async run() {
      assert.equal(isUnlimitedCreditRole("admin"), true, "admin role is recognized as unlimited")
      const info = await getDatasetLimitInfo("any-user-id", "admin", null, "prebookkeeping")
      assert.equal(info.canCreate, true, "admin-role users can always create pre-bookkeeping uploads")
    },
  },
  {
    name: "Free user with no DB returns canCreate true (0 pre-bookkeeping datasets)",
    async run() {
      const info = await getDatasetLimitInfo("non-superadmin-user", "user", null, "prebookkeeping")
      assert.equal(info.tier, "free", "non-superadmin user without profile falls back to free tier")
      assert.equal(info.limit, FREE_PLAN_LIMITS.maxDatasets, "Free tier uses plan maxDatasets as the pre-bookkeeping limit")
      assert.equal(info.currentCount, 0, "without DB, currentCount defaults to 0")
      assert.equal(info.canCreate, true, "0 pre-bookkeeping datasets is below the Free limit of 2")
    },
  },
  {
    name: "getDatasetLimitError blocks when count reaches the Free limit of 2",
    run() {
      const blocked: DatasetLimitInfo = {
        limit: 2,
        currentCount: 2,
        canCreate: false,
        planName: "Free",
        tier: "free",
      }
      const err = getDatasetLimitError(blocked, "pre-bookkeeping uploads")
      assert.ok(err !== null, "limit error is returned when count reaches limit")
      assert.ok(err!.startsWith("DATASET_LIMIT_REACHED|"), "error code is DATASET_LIMIT_REACHED")
      assert.ok(err!.includes("allows up to 2 pre-bookkeeping uploads"), "error message references pre-bookkeeping uploads and the limit of 2")
      assert.ok(err!.includes("currently have 2 pre-bookkeeping uploads"), "error message includes current count")
    },
  },
  {
    name: "getDatasetLimitError allows uploads 1 and 2 for Free (count below limit)",
    run() {
      const first: DatasetLimitInfo = { limit: 2, currentCount: 0, canCreate: true, planName: "Free", tier: "free" }
      const second: DatasetLimitInfo = { limit: 2, currentCount: 1, canCreate: true, planName: "Free", tier: "free" }
      assert.equal(getDatasetLimitError(first), null, "upload #1 (count 0) is allowed")
      assert.equal(getDatasetLimitError(second), null, "upload #2 (count 1) is allowed")

      const third: DatasetLimitInfo = { limit: 2, currentCount: 2, canCreate: false, planName: "Free", tier: "free" }
      assert.ok(getDatasetLimitError(third) !== null, "upload #3 (count 2) is blocked")
    },
  },
  {
    name: "getDatasetLimitError returns null for Pro (limit well above 2)",
    run() {
      const proInfo: DatasetLimitInfo = {
        limit: 25,
        currentCount: 2,
        canCreate: true,
        planName: "Pro",
        tier: "pro",
      }
      assert.equal(getDatasetLimitError(proInfo, "pre-bookkeeping uploads"), null, "Pro with 2 pre-bookkeeping uploads is allowed")
    },
  },
  {
    name: "getDatasetLimitError returns null when limit is Infinity (superadmin)",
    run() {
      const superadminInfo: DatasetLimitInfo = {
        limit: Infinity,
        currentCount: 0,
        canCreate: true,
        planName: "Superadmin",
        tier: "superadmin",
      }
      assert.equal(getDatasetLimitError(superadminInfo, "pre-bookkeeping uploads"), null, "Infinity limit never blocks")
    },
  },
  {
    name: "default itemLabel remains 'datasets' for backward compatibility",
    run() {
      const blocked: DatasetLimitInfo = {
        limit: 2,
        currentCount: 2,
        canCreate: false,
        planName: "Free",
        tier: "free",
      }
      const err = getDatasetLimitError(blocked)
      assert.ok(err!.includes("allows up to 2 datasets"), "default error message uses 'datasets' label")
    },
  },
  {
    name: "getPrebookkeepingLimitInfo delegates to getDatasetLimitInfo with prebookkeeping filter",
    async run() {
      const routeSource = readProjectFile("src/lib/usage/dataset-limits.ts")
      assert.ok(routeSource.includes('getDatasetLimitInfo(userId, role, email, "prebookkeeping")'), "getPrebookkeepingLimitInfo calls getDatasetLimitInfo with the prebookkeeping datasetType filter")
      assert.ok(routeSource.includes('export async function getPrebookkeepingLimitInfo'), "getPrebookkeepingLimitInfo is exported")
    },
  },
  {
    name: "getPrebookkeepingLimitError delegates to getDatasetLimitError with pre-bookkeeping label",
    run() {
      const blocked: DatasetLimitInfo = {
        limit: 2,
        currentCount: 2,
        canCreate: false,
        planName: "Free",
        tier: "free",
      }
      const err = getPrebookkeepingLimitError(blocked)
      assert.ok(err !== null, "pre-bookkeeping limit error is returned")
      assert.ok(err!.includes("pre-bookkeeping uploads"), "pre-bookkeeping error uses the pre-bookkeeping label")

      const allowed: DatasetLimitInfo = {
        limit: 2,
        currentCount: 1,
        canCreate: true,
        planName: "Free",
        tier: "free",
      }
      assert.equal(getPrebookkeepingLimitError(allowed), null, "allowed pre-bookkeeping upload returns no error")
    },
  },
  {
    name: "accountancy upload route checks pre-bookkeeping limit before processing",
    run() {
      const routeSource = readProjectFile("src/app/api/accountancy/upload/route.ts")
      assert.ok(routeSource.includes('getPrebookkeepingLimitInfo'), "route imports and calls the pre-bookkeeping limit info function")
      assert.ok(routeSource.includes('getPrebookkeepingLimitError'), "route imports and calls the pre-bookkeeping limit error helper")
      assert.ok(routeSource.includes('DATASET_LIMIT_REACHED'), "route returns DATASET_LIMIT_REACHED when limit is exceeded")
      assert.ok(routeSource.includes('datasetType === "prebookkeeping"'), "limit check is scoped to pre-bookkeeping uploads only")

      const checkStart = routeSource.indexOf('if (datasetType === "prebookkeeping")')
      const processCallStart = routeSource.indexOf("await processAccountancyUpload")
      assert.ok(checkStart > -1, "pre-bookkeeping limit check exists in route")
      assert.ok(checkStart < processCallStart, "limit check runs before processAccountancyUpload")
    },
  },
  {
    name: "accountancy upload route returns 403 and datasetLimit payload on limit exceeded",
    run() {
      const routeSource = readProjectFile("src/app/api/accountancy/upload/route.ts")
      assert.ok(routeSource.includes("403"), "route returns HTTP 403 for dataset limit reached")
      assert.ok(routeSource.includes("limitReached: true"), "route includes limitReached flag in the response")
      assert.ok(routeSource.includes("currentCount"), "route includes currentCount in the response")
      assert.ok(routeSource.includes("planName"), "route includes planName in the response")
      assert.ok(routeSource.includes("structuredError(") && routeSource.includes("DATASET_LIMIT_REACHED"), "route uses structuredError with DATASET_LIMIT_REACHED")
    },
  },
  {
    name: "normal Dataset upload limit check is unchanged (no datasetType filter)",
    run() {
      const datasetsRouteSource = readProjectFile("src/app/api/datasets/route.ts")
      assert.ok(
        datasetsRouteSource.includes("getDatasetLimitInfo(session.user.id, session.user.role, session.user.email)"),
        "normal dataset route calls getDatasetLimitInfo without a datasetType filter",
      )
      assert.ok(datasetsRouteSource.includes("getDatasetLimitError(limitInfo)"), "normal dataset route still uses getDatasetLimitError")
      assert.ok(!datasetsRouteSource.includes("getPrebookkeepingLimitInfo"), "normal dataset route does not use pre-bookkeeping limit functions")
      assert.ok(!datasetsRouteSource.includes("getPrebookkeepingLimitError"), "normal dataset route does not use pre-bookkeeping error helper")
    },
  },
  {
    name: "Dataset Library page excludes prebookkeeping datasets from the query",
    run() {
      const pageSource = readProjectFile("src/app/(auth)/app/datasets/page.tsx")
      assert.ok(pageSource.includes('ne(datasets.datasetType, "prebookkeeping")'), "Dataset Library page filters out prebookkeeping datasetType")
      assert.ok(pageSource.includes('import { and, desc, eq, ne }'), "Dataset Library page imports ne and and from drizzle-orm")
    },
  },
  {
    name: "pre-bookkeeping datasets are preserved (not deleted) by the Dataset Library filter",
    run() {
      const pageSource = readProjectFile("src/app/(auth)/app/datasets/page.tsx")
      assert.ok(!pageSource.includes("delete"), "Dataset Library page does not delete filtered datasets")
      assert.ok(!pageSource.includes("remove"), "Dataset Library page does not remove filtered datasets")
    },
  },
  {
    name: "pre-bookkeeping route does not consume normal upload credits (remains credit-exempt)",
    run() {
      const processorSource = readProjectFile("src/lib/accountancy/upload-processing.ts")
      const entitlementSource = readProjectFile("src/lib/accountancy/upload-entitlements.ts")
      assert.ok(!processorSource.includes('feature: "dataset_upload"'), "pre-bookkeeping processor still does not consume dataset_upload credits")
      assert.ok(!processorSource.includes("reserveCredits"), "pre-bookkeeping processor still does not reserve credits")
      assert.ok(!processorSource.includes("finalizeCredits"), "pre-bookkeeping processor still does not finalize credits")
      assert.ok(processorSource.includes("resolveAccountancyUploadEntitlement"), "pre-bookkeeping processor still resolves its dedicated entitlement")
      assert.ok(entitlementSource.includes("normalUploadCreditsRequired: false"), "pre-bookkeeping remains credit-exempt in the entitlement resolver")
    },
  },
  {
    name: "normal dataset upload credit flow is untouched",
    run() {
      const uploadActionSource = readProjectFile("src/app/actions/upload.ts")
      assert.ok(uploadActionSource.includes("reserveCredits"), "normal dataset upload still reserves credits")
      assert.ok(uploadActionSource.includes("finalizeCredits"), "normal dataset upload still finalizes credits")
      assert.ok(uploadActionSource.includes("releaseCredits"), "normal dataset upload still releases credits on failure")
    },
  },
]

async function main() {
  for (const test of tests) {
    await test.run()
    console.log(`ok - ${test.name}`)
  }
  console.log(`Pre-bookkeeping upload limit and Dataset Library isolation tests passed (${tests.length} checks).`)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
