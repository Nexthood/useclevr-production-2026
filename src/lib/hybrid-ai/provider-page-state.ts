import { formatAiProviderLimit } from "@/lib/hybrid-ai/features"
import type { HybridAiFeatureAccess } from "@/lib/hybrid-ai/feature-gate"

export type AiProvidersPageState = {
  canUseAiProviders: boolean
  canUseModeRouting: boolean
  providerLimit: number | null
  providerLimitLabel: string
  canAddProvider: boolean
  addProviderLabel: "Add provider" | "Upgrade for more"
  showSubscriptionWarning: boolean
  showUpgradeDialog: boolean
  modeSaveLabel: "Save AI mode" | "Upgrade for modes"
}

export function getAiProvidersPageState(
  featureAccess: Pick<
    HybridAiFeatureAccess,
    | "canManageProviders"
    | "canChangeAIMode"
    | "enabledFeatureIds"
    | "providerLimit"
    | "providerLimitLabel"
    | "upgradeRequired"
  > | null,
  providerCount: number,
): AiProvidersPageState {
  const canUseAiProviders = Boolean(
    featureAccess?.canManageProviders || featureAccess?.enabledFeatureIds.includes("aiProviderManagement"),
  )
  const canUseModeRouting = Boolean(
    featureAccess?.canChangeAIMode ||
      (
        featureAccess?.enabledFeatureIds.includes("autoMode") &&
        featureAccess.enabledFeatureIds.includes("localMode") &&
        featureAccess.enabledFeatureIds.includes("cloudMode")
      ),
  )
  const providerLimit = featureAccess ? featureAccess.providerLimit : 0
  const canAddProvider = canUseAiProviders && (providerLimit === null || providerCount < providerLimit)

  return {
    canUseAiProviders,
    canUseModeRouting,
    providerLimit,
    providerLimitLabel: featureAccess?.providerLimitLabel || formatAiProviderLimit(providerLimit),
    canAddProvider,
    addProviderLabel: canAddProvider ? "Add provider" : "Upgrade for more",
    showSubscriptionWarning: !canUseAiProviders && Boolean(featureAccess?.upgradeRequired ?? true),
    showUpgradeDialog: !canUseAiProviders || !canAddProvider,
    modeSaveLabel: canUseModeRouting ? "Save AI mode" : "Upgrade for modes",
  }
}
