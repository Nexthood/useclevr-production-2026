import assert from "node:assert/strict"

import { mapPlanIdToTier } from "@/lib/billing/plans"

// Test the mapPlanIdToTier function
const tests = [
  {
    name: "mapPlanIdToTier: free plan",
    run() {
      assert.equal(mapPlanIdToTier("free"), "free")
      assert.equal(mapPlanIdToTier("demo"), "free")
      assert.equal(mapPlanIdToTier(null), "free")
      assert.equal(mapPlanIdToTier(undefined), "free")
      assert.equal(mapPlanIdToTier(""), "free")
    }
  },
  {
    name: "mapPlanIdToTier: pro plans",
    run() {
      assert.equal(mapPlanIdToTier("pro_monthly"), "pro")
      assert.equal(mapPlanIdToTier("pro_annual"), "pro")
      assert.equal(mapPlanIdToTier("pro"), "pro")
    }
  },
  {
    name: "mapPlanIdToTier: business plans",
    run() {
      assert.equal(mapPlanIdToTier("business_monthly"), "business")
      assert.equal(mapPlanIdToTier("business_annual"), "business")
      assert.equal(mapPlanIdToTier("business"), "business")
    }
  }
]

async function main() {
  for (const test of tests) {
    await test.run()
    console.log(`ok - ${test.name}`)
  }
  
  console.log(`Tier resolution tests passed (${tests.length} checks).`)
}

void main()