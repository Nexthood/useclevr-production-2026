export type HybridAiTier = "lite" | "mega"

export type HybridAiFeatureId =
  | "privateChat"
  | "csvExcelAnalysis"
  | "dashboardInsights"
  | "basicLocalAi"
  | "singleAiProvider"
  | "aiModeRouting"
  | "standardReports"
  | "aiAgents"
  | "deepResearch"
  | "multiDocumentReasoning"
  | "workflowAutomation"
  | "backgroundTasks"
  | "businessAssistants"
  | "teamAi"
  | "enterpriseAudit"
  | "localKnowledgeBase"
  | "futureHelperIntegration"

export type HybridAiModuleId = HybridAiFeatureId

export type HybridAiModule = {
  id: HybridAiFeatureId
  tier: HybridAiTier
  name: string
  description: string
  upgradeReason: string
}

export const HYBRID_AI_MODULES: HybridAiModule[] = [
  {
    id: "privateChat",
    tier: "lite",
    name: "Private Chat",
    description: "Ask business questions through the local helper.",
    upgradeReason: "Private Chat is included with Hybrid AI Lite and MEGA.",
  },
  {
    id: "csvExcelAnalysis",
    tier: "lite",
    name: "CSV/Excel Analysis",
    description: "Analyze uploaded spreadsheets privately when Hybrid AI is active.",
    upgradeReason: "Private CSV and Excel analysis is included with Hybrid AI Lite and MEGA.",
  },
  {
    id: "dashboardInsights",
    tier: "lite",
    name: "Dashboard Insights",
    description: "Use local context for dashboard summaries and next-step suggestions.",
    upgradeReason: "Dashboard Insights are included with Hybrid AI Lite and MEGA.",
  },
  {
    id: "basicLocalAi",
    tier: "lite",
    name: "Basic Local AI",
    description: "Run everyday private analysis on your device.",
    upgradeReason: "Basic Local AI is included with Hybrid AI Lite and MEGA.",
  },
  {
    id: "singleAiProvider",
    tier: "lite",
    name: "Single AI Provider",
    description: "Connect one local or cloud AI provider for private routing.",
    upgradeReason: "Single AI Provider setup is included with Hybrid AI Lite and MEGA.",
  },
  {
    id: "aiModeRouting",
    tier: "lite",
    name: "Auto/Local/Cloud mode",
    description: "Choose automatic, offline local-only, or cloud-only routing.",
    upgradeReason: "Hybrid AI mode switching is included with Hybrid AI Lite and MEGA.",
  },
  {
    id: "standardReports",
    tier: "lite",
    name: "Standard Reports",
    description: "Use Hybrid AI routing for standard report explanations.",
    upgradeReason: "Standard Reports are included with Hybrid AI Lite and MEGA.",
  },
  {
    id: "aiAgents",
    tier: "mega",
    name: "AI Agents",
    description: "Coordinate guided analysis tasks from one private workspace.",
    upgradeReason: "AI Agents require Hybrid AI MEGA because they coordinate advanced multi-step work.",
  },
  {
    id: "deepResearch",
    tier: "mega",
    name: "Deep Research",
    description: "Run structured research workflows with private business context.",
    upgradeReason: "Deep Research requires Hybrid AI MEGA because it runs advanced research workflows.",
  },
  {
    id: "multiDocumentReasoning",
    tier: "mega",
    name: "Multi-document reasoning",
    description: "Connect multiple business documents for deeper local analysis.",
    upgradeReason: "Multi-document reasoning requires Hybrid AI MEGA because it combines multiple private sources.",
  },
  {
    id: "workflowAutomation",
    tier: "mega",
    name: "Workflow automation",
    description: "Automate recurring analysis steps across business workflows.",
    upgradeReason: "Workflow automation requires Hybrid AI MEGA because it can run cross-workflow actions.",
  },
  {
    id: "backgroundTasks",
    tier: "mega",
    name: "Background task execution",
    description: "Continue long-running private work while you stay in UseClevr.",
    upgradeReason: "Background tasks require Hybrid AI MEGA because they run long-lived automated work.",
  },
  {
    id: "businessAssistants",
    tier: "mega",
    name: "Business assistants",
    description: "Unlock specialized assistants for business functions.",
    upgradeReason: "Business assistants require Hybrid AI MEGA because they unlock specialized role-based modules.",
  },
  {
    id: "teamAi",
    tier: "mega",
    name: "Team AI",
    description: "Coordinate Hybrid AI work across team workspaces.",
    upgradeReason: "Team AI requires Hybrid AI MEGA because it is built for shared business workspaces.",
  },
  {
    id: "enterpriseAudit",
    tier: "mega",
    name: "Enterprise Audit",
    description: "Review detailed provider usage and governance metadata.",
    upgradeReason: "Enterprise Audit requires Hybrid AI MEGA because it supports governance and compliance review.",
  },
  {
    id: "localKnowledgeBase",
    tier: "mega",
    name: "Local Knowledge Base",
    description: "Use private business knowledge as reusable local context.",
    upgradeReason: "Local Knowledge Base requires Hybrid AI MEGA because it maintains reusable private context.",
  },
  {
    id: "futureHelperIntegration",
    tier: "mega",
    name: "Future Helper integration",
    description: "Add advanced helper modules without changing the core app.",
    upgradeReason: "Future Helper integration requires Hybrid AI MEGA because it unlocks advanced local automation.",
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
