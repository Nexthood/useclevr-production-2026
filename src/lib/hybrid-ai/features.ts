export type HybridAiTier = "lite" | "mega"

export type HybridAiModuleId =
  | "privateChat"
  | "csvExcelAnalysis"
  | "dashboardInsights"
  | "basicLocalAi"
  | "aiAgents"
  | "multiDocumentReasoning"
  | "deepResearch"
  | "backgroundTasks"
  | "workflowAutomation"
  | "businessAssistants"
  | "enterpriseModules"

export type HybridAiModule = {
  id: HybridAiModuleId
  tier: HybridAiTier
  name: string
  description: string
}

export const HYBRID_AI_MODULES: HybridAiModule[] = [
  {
    id: "privateChat",
    tier: "lite",
    name: "Private Chat",
    description: "Ask business questions through the local helper.",
  },
  {
    id: "csvExcelAnalysis",
    tier: "lite",
    name: "CSV/Excel Analysis",
    description: "Analyze uploaded spreadsheets privately when Hybrid AI is active.",
  },
  {
    id: "dashboardInsights",
    tier: "lite",
    name: "Dashboard Insights",
    description: "Use local context for dashboard summaries and next-step suggestions.",
  },
  {
    id: "basicLocalAi",
    tier: "lite",
    name: "Basic Local AI",
    description: "Run everyday private analysis on your device.",
  },
  {
    id: "aiAgents",
    tier: "mega",
    name: "AI Agents",
    description: "Coordinate guided analysis tasks from one private workspace.",
  },
  {
    id: "multiDocumentReasoning",
    tier: "mega",
    name: "Multi-document reasoning",
    description: "Connect multiple business documents for deeper local analysis.",
  },
  {
    id: "deepResearch",
    tier: "mega",
    name: "Deep Research",
    description: "Run structured research workflows with private business context.",
  },
  {
    id: "backgroundTasks",
    tier: "mega",
    name: "Background task execution",
    description: "Continue long-running private work while you stay in UseClevr.",
  },
  {
    id: "workflowAutomation",
    tier: "mega",
    name: "Workflow automation",
    description: "Automate recurring analysis steps across business workflows.",
  },
  {
    id: "businessAssistants",
    tier: "mega",
    name: "Business assistants",
    description: "Unlock specialized assistants for business functions.",
  },
  {
    id: "enterpriseModules",
    tier: "mega",
    name: "Future enterprise modules",
    description: "Add advanced modules without installing another helper.",
  },
]

export const HYBRID_AI_LITE_MODULE_IDS = HYBRID_AI_MODULES
  .filter((module) => module.tier === "lite")
  .map((module) => module.id)

export const HYBRID_AI_MEGA_MODULE_IDS = HYBRID_AI_MODULES.map((module) => module.id)

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
  }
}
