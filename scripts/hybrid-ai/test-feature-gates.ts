import assert from "node:assert/strict"

import {
  canUseHybridAiFeature,
  formatAiProviderLimit,
  getHybridAiEntitlement,
  HYBRID_AI_COMING_SOON_MODULE_IDS,
  HYBRID_AI_FEATURES,
  HYBRID_AI_LITE_MODULE_IDS,
  HYBRID_AI_MEGA_MODULE_IDS,
  type HybridAiFeatureId,
} from "../../src/lib/hybrid-ai/features"

const liteFeatures: HybridAiFeatureId[] = [
  "hybridAiModal",
  "privateChat",
  "csvExcelAnalysis",
  "dashboardInsights",
  "aiProviderManagement",
  "providerHealthChecks",
  "autoMode",
  "localMode",
  "cloudMode",
  "aiAssistantIntegration",
  "datasetAwareChat",
]

const megaFeatures: HybridAiFeatureId[] = [
  "multipleAiProviders",
  "providerFallback",
  "multiDocumentAnalysis",
  "aiReports",
  "auditLogs",
  "workflowAutomationRoadmap",
  "helperRoadmap",
]

const comingSoonFeatures: HybridAiFeatureId[] = [
  "aiAgents",
  "deepResearch",
  "backgroundTasks",
  "businessAssistants",
  "teamAi",
  "localKnowledgeBase",
]

function assertIncludesAll(actual: readonly HybridAiFeatureId[], expected: readonly HybridAiFeatureId[], label: string) {
  for (const featureId of expected) {
    assert.ok(actual.includes(featureId), `${label} includes ${featureId}`)
  }
}

function assertExcludesAll(actual: readonly HybridAiFeatureId[], expected: readonly HybridAiFeatureId[], label: string) {
  for (const featureId of expected) {
    assert.equal(actual.includes(featureId), false, `${label} excludes ${featureId}`)
  }
}

function assertEntitlementCase(input: {
  label: string
  subscriptionTier: string | null
  role?: string | null
  email?: string | null
  accessTier: "lite" | "mega" | null
  providerLimit: number | null
  enabled: HybridAiFeatureId[]
  disabled: HybridAiFeatureId[]
  comingSoon: HybridAiFeatureId[]
}) {
  const entitlement = getHybridAiEntitlement(input.subscriptionTier, input.role, input.email)
  assert.equal(entitlement.accessTier, input.accessTier, `${input.label} access tier`)
  assert.equal(entitlement.providerLimit, input.providerLimit, `${input.label} provider limit`)
  assertIncludesAll(entitlement.enabledModuleIds, input.enabled, `${input.label} enabled modules`)
  assertExcludesAll(entitlement.enabledModuleIds, input.disabled, `${input.label} enabled modules`)
  assertIncludesAll(entitlement.comingSoonModuleIds, input.comingSoon, `${input.label} coming soon modules`)

  for (const featureId of input.enabled) {
    assert.equal(
      canUseHybridAiFeature(featureId, input.subscriptionTier, input.role, input.email),
      true,
      `${input.label} can use ${featureId}`,
    )
  }
  for (const featureId of [...input.disabled, ...input.comingSoon]) {
    assert.equal(
      canUseHybridAiFeature(featureId, input.subscriptionTier, input.role, input.email),
      false,
      `${input.label} cannot execute ${featureId}`,
    )
  }
}

const registeredIds = HYBRID_AI_FEATURES.map((feature) => feature.id)
assert.equal(new Set(registeredIds).size, registeredIds.length, "feature registry has unique IDs")
assertIncludesAll(registeredIds, liteFeatures, "feature registry")
assertIncludesAll(registeredIds, megaFeatures, "feature registry")
assertIncludesAll(registeredIds, comingSoonFeatures, "feature registry")

for (const feature of HYBRID_AI_FEATURES) {
  assert.ok(feature.name.trim(), `${feature.id} has a name`)
  assert.ok(feature.description.trim(), `${feature.id} has a description`)
  assert.ok(feature.upgradeReason.trim(), `${feature.id} has an upgrade reason`)
}

assert.deepEqual([...HYBRID_AI_LITE_MODULE_IDS].sort(), [...liteFeatures].sort(), "Lite registry matches MVP features")
assertIncludesAll(HYBRID_AI_MEGA_MODULE_IDS, liteFeatures, "MEGA enabled modules")
assertIncludesAll(HYBRID_AI_MEGA_MODULE_IDS, megaFeatures, "MEGA enabled modules")
assertExcludesAll(HYBRID_AI_MEGA_MODULE_IDS, comingSoonFeatures, "MEGA enabled modules")
assert.deepEqual(
  [...HYBRID_AI_COMING_SOON_MODULE_IDS].sort(),
  [...comingSoonFeatures].sort(),
  "Coming soon registry matches future MEGA modules",
)

assertEntitlementCase({
  label: "Lite user",
  subscriptionTier: "pro",
  accessTier: "lite",
  providerLimit: 1,
  enabled: liteFeatures,
  disabled: megaFeatures,
  comingSoon: [],
})

assertEntitlementCase({
  label: "MEGA user",
  subscriptionTier: "business",
  accessTier: "mega",
  providerLimit: null,
  enabled: [...liteFeatures, ...megaFeatures],
  disabled: [],
  comingSoon: comingSoonFeatures,
})

assertEntitlementCase({
  label: "Expired subscription",
  subscriptionTier: "expired",
  accessTier: null,
  providerLimit: 0,
  enabled: [],
  disabled: [...liteFeatures, ...megaFeatures],
  comingSoon: [],
})

assertEntitlementCase({
  label: "Trial account",
  subscriptionTier: "trial",
  accessTier: null,
  providerLimit: 0,
  enabled: [],
  disabled: [...liteFeatures, ...megaFeatures],
  comingSoon: [],
})

assertEntitlementCase({
  label: "Superadmin",
  subscriptionTier: "free",
  role: "superadmin",
  accessTier: "mega",
  providerLimit: null,
  enabled: [...liteFeatures, ...megaFeatures],
  disabled: [],
  comingSoon: comingSoonFeatures,
})

assertEntitlementCase({
  label: "Official superadmin email",
  subscriptionTier: "free",
  role: "user",
  email: "superadmin@useclevr.com",
  accessTier: "mega",
  providerLimit: null,
  enabled: [...liteFeatures, ...megaFeatures],
  disabled: [],
  comingSoon: comingSoonFeatures,
})

assertEntitlementCase({
  label: "Normalized official superadmin email",
  subscriptionTier: "free",
  role: "user",
  email: "  SUPERADMIN@USECLEVR.COM  ",
  accessTier: "mega",
  providerLimit: null,
  enabled: [...liteFeatures, ...megaFeatures],
  disabled: [],
  comingSoon: comingSoonFeatures,
})

assertEntitlementCase({
  label: "Normal free user",
  subscriptionTier: "free",
  role: "user",
  email: "free-user@example.com",
  accessTier: null,
  providerLimit: 0,
  enabled: [],
  disabled: [...liteFeatures, ...megaFeatures],
  comingSoon: [],
})

assert.equal(
  canUseHybridAiFeature("aiProviderManagement", "free", "user", "free-user@example.com"),
  false,
  "direct API feature checks block normal free users from AI provider management",
)
assert.equal(
  canUseHybridAiFeature("providerHealthChecks", "free", "user", "free-user@example.com"),
  false,
  "direct API feature checks block normal free users from provider health checks",
)
assert.equal(
  formatAiProviderLimit(getHybridAiEntitlement("free", "user", "superadmin@useclevr.com").providerLimit),
  "Unlimited",
  "official superadmin provider limit displays Unlimited",
)

console.log("Hybrid AI feature gate tests passed.")
