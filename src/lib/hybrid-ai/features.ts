import { isSuperadmin } from "@/lib/auth/builtin-users"

export type HybridAiTier = "lite" | "mega"

export type HybridAiFeatureId =
  | "hybridAiModal"
  | "privateChat"
  | "csvExcelAnalysis"
  | "dashboardInsights"
  | "aiProviderManagement"
  | "providerHealthChecks"
  | "autoMode"
  | "localMode"
  | "cloudMode"
  | "aiAssistantIntegration"
  | "datasetAwareChat"
  | "multipleAiProviders"
  | "providerFallback"
  | "multiDocumentAnalysis"
  | "aiReports"
  | "auditLogs"
  | "workflowAutomationRoadmap"
  | "helperRoadmap"
  | "aiAgents"
  | "deepResearch"
  | "backgroundTasks"
  | "businessAssistants"
  | "teamAi"
  | "localKnowledgeBase"

export type HybridAiModuleId = HybridAiFeatureId

export type HybridAiModule = {
  id: HybridAiFeatureId
  tier: HybridAiTier
  name: string
  description: string
  upgradeReason: string
  status: "active" | "coming-soon"
}

export const HYBRID_AI_MODULES: HybridAiModule[] = [
  {
    id: "hybridAiModal",
    tier: "lite",
    name: "Hybrid AI Modal",
    description: "Open the Hybrid AI setup and plan access experience.",
    upgradeReason: "Hybrid AI setup is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "privateChat",
    tier: "lite",
    name: "Private Chat",
    description: "Ask business questions through the local helper.",
    upgradeReason: "Private Chat is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "csvExcelAnalysis",
    tier: "lite",
    name: "CSV/Excel Analysis",
    description: "Analyze uploaded spreadsheets privately when Hybrid AI is active.",
    upgradeReason: "Private CSV and Excel analysis is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "dashboardInsights",
    tier: "lite",
    name: "Dashboard Insights",
    description: "Use local context for dashboard summaries and next-step suggestions.",
    upgradeReason: "Dashboard Insights are included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "aiProviderManagement",
    tier: "lite",
    name: "AI Provider Management",
    description: "Connect one local or cloud AI provider for private routing.",
    upgradeReason: "AI Provider Management is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "providerHealthChecks",
    tier: "lite",
    name: "Provider Health Checks",
    description: "Test provider reachability, latency, and model availability.",
    upgradeReason: "Provider Health Checks are included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "autoMode",
    tier: "lite",
    name: "Auto Mode",
    description: "Try configured providers first and use allowed fallback routing.",
    upgradeReason: "Auto Mode is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "localMode",
    tier: "lite",
    name: "Local Mode",
    description: "Keep Hybrid AI requests on configured local providers only.",
    upgradeReason: "Local Mode is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "cloudMode",
    tier: "lite",
    name: "Cloud Mode",
    description: "Route Hybrid AI requests through configured cloud providers or default cloud AI.",
    upgradeReason: "Cloud Mode is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "aiAssistantIntegration",
    tier: "lite",
    name: "AI Assistant integration",
    description: "Use Hybrid AI routing inside the existing UseClevr AI Assistant.",
    upgradeReason: "AI Assistant integration is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "datasetAwareChat",
    tier: "lite",
    name: "Dataset-aware chat",
    description: "Ask questions with summarized dataset context and privacy routing.",
    upgradeReason: "Dataset-aware chat is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "multipleAiProviders",
    tier: "mega",
    name: "Multiple AI Providers",
    description: "Connect multiple providers and configure fallback routing.",
    upgradeReason: "Multiple AI Providers require Hybrid AI MEGA because Lite includes one provider.",
    status: "active",
  },
  {
    id: "providerFallback",
    tier: "mega",
    name: "Provider Fallback",
    description: "Route to a configured fallback provider when the default provider is unavailable.",
    upgradeReason: "Provider Fallback requires Hybrid AI MEGA because Lite includes one provider.",
    status: "active",
  },
  {
    id: "multiDocumentAnalysis",
    tier: "mega",
    name: "Multi-document Analysis",
    description: "Analyze multiple datasets or documents together.",
    upgradeReason: "Multi-document Analysis requires Hybrid AI MEGA because it combines multiple private sources.",
    status: "active",
  },
  {
    id: "aiReports",
    tier: "mega",
    name: "AI Reports",
    description: "Use advanced Hybrid AI report enhancement.",
    upgradeReason: "AI Reports require Hybrid AI MEGA because they use deeper provider-powered report generation.",
    status: "active",
  },
  {
    id: "auditLogs",
    tier: "mega",
    name: "Audit Logs",
    description: "Review AI provider usage and privacy-routing metadata.",
    upgradeReason: "Audit Logs require Hybrid AI MEGA because they support governance and audit review.",
    status: "active",
  },
  {
    id: "workflowAutomationRoadmap",
    tier: "mega",
    name: "Workflow Automation roadmap",
    description: "Track future workflow automation capabilities.",
    upgradeReason: "Workflow Automation roadmap access requires Hybrid AI MEGA.",
    status: "active",
  },
  {
    id: "helperRoadmap",
    tier: "mega",
    name: "UseClevr Helper roadmap",
    description: "Access advanced helper roadmap actions when they are available.",
    upgradeReason: "UseClevr Helper roadmap actions require Hybrid AI MEGA.",
    status: "active",
  },
  {
    id: "aiAgents",
    tier: "mega",
    name: "AI Agents",
    description: "Coordinate guided analysis tasks from one private workspace.",
    upgradeReason: "AI Agents require Hybrid AI MEGA because they coordinate advanced multi-step work.",
    status: "coming-soon",
  },
  {
    id: "deepResearch",
    tier: "mega",
    name: "Deep Research",
    description: "Run structured research workflows with private business context.",
    upgradeReason: "Deep Research requires Hybrid AI MEGA because it runs advanced research workflows.",
    status: "coming-soon",
  },
  {
    id: "backgroundTasks",
    tier: "mega",
    name: "Background task execution",
    description: "Continue long-running private work while you stay in UseClevr.",
    upgradeReason: "Background tasks require Hybrid AI MEGA because they run long-lived automated work.",
    status: "coming-soon",
  },
  {
    id: "businessAssistants",
    tier: "mega",
    name: "Business assistants",
    description: "Unlock specialized assistants for business functions.",
    upgradeReason: "Business assistants require Hybrid AI MEGA because they unlock specialized role-based modules.",
    status: "coming-soon",
  },
  {
    id: "teamAi",
    tier: "mega",
    name: "Team AI",
    description: "Coordinate Hybrid AI work across team workspaces.",
    upgradeReason: "Team AI requires Hybrid AI MEGA because it is built for shared business workspaces.",
    status: "coming-soon",
  },
  {
    id: "localKnowledgeBase",
    tier: "mega",
    name: "Local Knowledge Base",
    description: "Use private business knowledge as reusable local context.",
    upgradeReason: "Local Knowledge Base requires Hybrid AI MEGA because it maintains reusable private context.",
    status: "coming-soon",
  },
]

export const HYBRID_AI_FEATURES = HYBRID_AI_MODULES

export const HYBRID_AI_LITE_MODULE_IDS = HYBRID_AI_MODULES
  .filter((module) => module.tier === "lite" && module.status === "active")
  .map((module) => module.id)

export const HYBRID_AI_MEGA_MODULE_IDS = HYBRID_AI_MODULES
  .filter((module) => module.status === "active")
  .map((module) => module.id)

export const HYBRID_AI_COMING_SOON_MODULE_IDS = HYBRID_AI_MODULES
  .filter((module) => module.status === "coming-soon")
  .map((module) => module.id)

export function getHybridAiFeature(featureId: HybridAiFeatureId) {
  return HYBRID_AI_FEATURES.find((feature) => feature.id === featureId)
}

export function getHybridAiFeatureTier(featureId: HybridAiFeatureId): HybridAiTier {
  return getHybridAiFeature(featureId)?.tier || "mega"
}

export function getHybridAiEntitlement(
  subscriptionTier?: string | null,
  role?: string | null,
  email?: string | null,
) {
  const normalizedTier = (subscriptionTier || "free").toLowerCase()
  const normalizedRole = (role || "").toLowerCase()
  const hasSuperadminAccess = isSuperadmin({ role: normalizedRole, email })
  const isAdmin =
    normalizedRole === "admin" ||
    normalizedTier === "admin" ||
    normalizedTier === "superadmin" ||
    hasSuperadminAccess
  const accessTier: HybridAiTier | null =
    isAdmin || normalizedTier === "business"
      ? "mega"
      : normalizedTier === "pro"
        ? "lite"
        : null
  const enabledModuleIds =
    accessTier === "mega" ? HYBRID_AI_MEGA_MODULE_IDS : accessTier === "lite" ? HYBRID_AI_LITE_MODULE_IDS : []
  const providerLimit = accessTier === "mega" ? null : accessTier === "lite" ? 1 : 0
  const canUseLite = accessTier === "lite" || accessTier === "mega"
  const canUseMega = accessTier === "mega"
  const canChangeAIMode =
    enabledModuleIds.includes("autoMode") &&
    enabledModuleIds.includes("localMode") &&
    enabledModuleIds.includes("cloudMode")

  return {
    isSuperadmin: hasSuperadminAccess || normalizedTier === "superadmin",
    accessTier,
    canUseHybridAI: canUseLite,
    canDownload: Boolean(accessTier),
    canDownloadLocalAI: Boolean(accessTier),
    canUseLite,
    canUseMega,
    canManageProviders: enabledModuleIds.includes("aiProviderManagement"),
    canChangeAIMode,
    enabledModuleIds,
    comingSoonModuleIds: accessTier === "mega" ? HYBRID_AI_COMING_SOON_MODULE_IDS : [],
    providerLimit,
    providerLimitLabel: formatAiProviderLimit(providerLimit),
    upgradeRequired: !canUseLite,
  }
}

export function getHybridAIEntitlements(
  user: { role?: string | null; email?: string | null } | null | undefined,
  subscriptionTier?: string | null,
) {
  return getHybridAiEntitlement(subscriptionTier, user?.role, user?.email)
}

export function canUseHybridAiFeature(
  featureId: HybridAiFeatureId,
  subscriptionTier?: string | null,
  role?: string | null,
  email?: string | null,
) {
  const entitlement = getHybridAiEntitlement(subscriptionTier, role, email)
  return entitlement.enabledModuleIds.includes(featureId)
}

export function formatAiProviderLimit(providerLimit: number | null) {
  return providerLimit === null ? "Unlimited" : String(providerLimit)
}
