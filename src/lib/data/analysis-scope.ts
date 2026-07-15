export const analysisScopes = ["single_dataset", "dataset_group", "portfolio"] as const

export type AnalysisScope = (typeof analysisScopes)[number]

export type AnalysisScopeSelection = {
  scope: AnalysisScope
  datasetId?: string
  groupId?: string
}

export function resolveDashboardAnalysisScope(input: {
  datasetId?: string | null
  groupId?: string | null
  portfolioId?: string | null
}): AnalysisScopeSelection | null {
  if (input.datasetId) return { scope: "single_dataset", datasetId: input.datasetId }
  if (input.groupId) return { scope: "dataset_group", groupId: input.groupId }
  if (input.portfolioId) return { scope: "portfolio", groupId: input.portfolioId }
  return null
}
