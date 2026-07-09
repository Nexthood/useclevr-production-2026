export type DatasetCategory = "standard" | "retail" | "accountancy" | "profitability" | "prebookkeeping"

export const allowedUploadDatasetCategories = ["standard", "retail", "profitability", "accountancy", "prebookkeeping"] as const

export function getUploadCategoryCandidate(formData: FormData): string {
  const candidate =
    formData.get("dataset_type") ||
    formData.get("datasetType") ||
    formData.get("uploadMode") ||
    formData.get("analysisType") ||
    formData.get("fileType")

  return typeof candidate === "string" ? candidate : ""
}

export function getDatasetCategoryFromUpload(fileType?: string | null): DatasetCategory {
  const normalized = (fileType || "").toLowerCase()

  if (normalized.includes("profitability")) return "profitability"
  if (normalized.includes("retail")) return "retail"
  if (normalized.includes("invoice") || normalized.includes("receipt") || normalized.includes("bank")) return "prebookkeeping"
  if (normalized.includes("accountancy") || normalized.includes("accounting")) return "accountancy"

  return "standard"
}

export function inferDatasetCategoryFromAnalysis(analysis: unknown): DatasetCategory {
  if (!analysis || typeof analysis !== "object") return "standard"

  const record = analysis as Record<string, unknown>
  const candidate = record.datasetCategory || record.datasetType
  if (typeof candidate === "string") {
    const normalized = candidate.toLowerCase()
    if (["retail", "accountancy", "profitability", "prebookkeeping", "standard"].includes(normalized)) {
      return normalized as DatasetCategory
    }
  }

  return "standard"
}

export function resolveDatasetType(datasetType: string | null | undefined, analysis: unknown): DatasetCategory {
  if (datasetType && datasetType !== "standard") return datasetType as DatasetCategory
  return inferDatasetCategoryFromAnalysis(analysis)
}

export function getDatasetCategoryRedirect(category: DatasetCategory, datasetId: string) {
  switch (category) {
    case "retail":
      return `/app/retail?datasetId=${datasetId}`
    case "profitability":
      return `/app/profitability?datasetId=${datasetId}`
    case "accountancy":
      return `/app/accountancy?datasetId=${datasetId}`
    case "prebookkeeping":
      return `/app/prebookkeeping?datasetId=${datasetId}`
    default:
      return `/app/datasets/${datasetId}/analyze`
  }
}
