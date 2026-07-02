export type HybridAiTier = "lite" | "mega"

export type HybridAiFeatureId =
  | "privateChat"
  | "csvExcelAnalysis"
  | "dashboardInsights"
  | "singleAiProvider"
  | "aiModeRouting"
  | "multipleAiProviders"
  | "multiDocumentAnalysis"
  | "advancedReports"
  | "aiAuditLogs"
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
    id: "singleAiProvider",
    tier: "lite",
    name: "Single AI Provider",
    description: "Connect one local or cloud AI provider for private routing.",
    upgradeReason: "Single AI Provider setup is included with Hybrid AI Lite and MEGA.",
    status: "active",
  },
  {
    id: "aiModeRouting",
    tier: "lite",
    name: "Auto/Local/Cloud mode",
    description: "Choose automatic, offline local-only, or cloud-only routing.",
    upgradeReason: "Hybrid AI mode switching is included with Hybrid AI Lite and MEGA.",
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
    id: "multiDocumentAnalysis",
    tier: "mega",
    name: "Multi-document Analysis",
    description: "Analyze multiple datasets or documents together.",
    upgradeReason: "Multi-document Analysis requires Hybrid AI MEGA because it combines multiple private sources.",
    status: "active",
  },
  {
    id: "advancedReports",
    tier: "mega",
    name: "Advanced Reports",
    description: "Use advanced Hybrid AI report enhancement.",
    upgradeReason: "Advanced Reports require Hybrid AI MEGA because they use deeper provider-powered report generation.",
    status: "active",
  },
  {
    id: "aiAuditLogs",
    tier: "mega",
    name: "AI Audit Logs",
    description: "Review AI provider usage and privacy-routing metadata.",
    upgradeReason: "AI Audit Logs require Hybrid AI MEGA because they support governance and audit review.",
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
  .filter((module) => module.tier === "lite")
  .map((module) => module.id)

export const HYBRID_AI_MEGA_MODULE_IDS = HYBRID_AI_MODULES.map((module) => module.id)

export function getHybridAiFeature(featureId: HybridAiFeatureId) {
  return HYBRID_AI_FEATURES.find((feature) => feature.id === featureId)
}

export function getHybridAiFeatureTier(featureId: HybridAiFeatureId): HybridAiTier {
  return getHybridAiFeature(featureId)?.tier || "mega"
}

export function getHybridAiEntitlement(subscriptionTier?: string | null, role?: string | null) {
  const normalizedTier = (subscriptionTier || "free").toLowerCase()
  const normalizedRole = (role || "").toLowerCase()
  const isAdmin =
    normalizedRole === "admin" ||
    normalizedRole === "superadmin" ||
    normalizedTier === "admin" ||
    normalizedTier === "superadmin"
  const accessTier: HybridAiTier | null =
    isAdmin || normalizedTier === "business"
      ? "mega"
      : normalizedTier === "pro"
        ? "lite"
        : null

  return {
    accessTier,
    canDownload: Boolean(accessTier),
    canUseLite: accessTier === "lite" || accessTier === "mega",
    canUseMega: accessTier === "mega",
    enabledModuleIds:
      accessTier === "mega" ? HYBRID_AI_MEGA_MODULE_IDS : accessTier === "lite" ? HYBRID_AI_LITE_MODULE_IDS : [],
    providerLimit: accessTier === "mega" ? null : accessTier === "lite" ? 1 : 0,
  }
}

export function canUseHybridAiFeature(
  featureId: HybridAiFeatureId,
  subscriptionTier?: string | null,
  role?: string | null,
) {
  const entitlement = getHybridAiEntitlement(subscriptionTier, role)
  return entitlement.enabledModuleIds.includes(featureId)
}
