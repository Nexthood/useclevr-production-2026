export async function getHybridAiFeatureAccess() {
  return {
    enabledFeatureIds: ["aiProviderManagement", "privateChat", "csvExcelAnalysis", "aiReports", "dashboardInsights", "autoMode", "cloudMode", "localMode"],
    providerLimit: null,
    role: "user",
    subscriptionTier: "business",
  }
}

export function logBlockedHybridAiFeatureAttempt() {}

export async function requireHybridAiFeature() {
  return { success: true, session: { user: { id: "user-byok-test" } } }
}
