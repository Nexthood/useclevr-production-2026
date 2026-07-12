export type DatasetCategory = "standard" | "retail" | "accountancy" | "profitability" | "prebookkeeping"

export const allowedUploadDatasetCategories = ["standard", "retail", "profitability", "accountancy", "prebookkeeping"] as const
const datasetCategorySet = new Set<string>(allowedUploadDatasetCategories)

const datasetCategoryLabels: Record<DatasetCategory, string> = {
  standard: "Standard Dataset",
  retail: "Retail Analysis",
  profitability: "Profitability Analysis",
  accountancy: "Accountancy",
  prebookkeeping: "Pre-bookkeeping",
}

const datasetCategoryDestinations: Record<DatasetCategory, string> = {
  standard: "Generic dataset analysis",
  retail: "Retail",
  profitability: "Profitability",
  accountancy: "Accountancy",
  prebookkeeping: "Pre-bookkeeping",
}

export function normalizeDatasetCategory(value?: string | null): DatasetCategory | null {
  const normalized = (value || "").trim().toLowerCase()
  if (!normalized) return null

  if (datasetCategorySet.has(normalized)) return normalized as DatasetCategory

  const compact = normalized.replace(/[\s_-]+/g, "")
  if (compact === "generic" || compact === "genericanalysis" || compact === "standarddataset") return "standard"
  if (compact === "retailanalysis" || compact === "retailupload") return "retail"
  if (compact === "profitabilityanalysis" || compact === "profitabilityupload") return "profitability"
  if (compact === "accounting" || compact === "accountancyupload") return "accountancy"
  if (
    compact === "prebookkeeping" ||
    compact === "prebookkeepingupload" ||
    compact === "invoiceupload" ||
    compact === "receiptupload"
  ) {
    return "prebookkeeping"
  }

  return null
}

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
  const explicit = normalizeDatasetCategory(fileType)
  if (explicit) return explicit

  const normalized = (fileType || "").toLowerCase()

  if (normalized.includes("profitability")) return "profitability"
  if (normalized.includes("retail")) return "retail"
  if (
    normalized.includes("prebookkeeping") ||
    normalized.includes("pre-bookkeeping") ||
    normalized.includes("invoice") ||
    normalized.includes("receipt") ||
    normalized.includes("bank")
  ) {
    return "prebookkeeping"
  }
  if (normalized.includes("accountancy") || normalized.includes("accounting")) return "accountancy"

  return "standard"
}

export function inferDatasetCategoryFromAnalysis(analysis: unknown): DatasetCategory {
  if (!analysis || typeof analysis !== "object") return "standard"

  const record = analysis as Record<string, unknown>
  const candidate = record.dataset_type || record.datasetCategory || record.datasetType
  if (typeof candidate === "string") {
    const normalized = normalizeDatasetCategory(candidate)
    if (normalized) return normalized
  }

  if (record.profitability && typeof record.profitability === "object") {
    return "profitability"
  }

  if (typeof record.uploadSource === "string") {
    const sourceCategory = getDatasetCategoryFromUpload(record.uploadSource)
    if (sourceCategory !== "standard") return sourceCategory
  }

  return "standard"
}

export function resolveDatasetType(datasetType: string | null | undefined, analysis: unknown): DatasetCategory {
  const normalized = normalizeDatasetCategory(datasetType)
  if (normalized && normalized !== "standard") return normalized
  return inferDatasetCategoryFromAnalysis(analysis)
}

export function getDatasetCategoryLabel(category: DatasetCategory | string | null | undefined) {
  const normalized = normalizeDatasetCategory(category) || "standard"
  return datasetCategoryLabels[normalized]
}

export function getDatasetCategoryDestinationLabel(category: DatasetCategory | string | null | undefined) {
  const normalized = normalizeDatasetCategory(category) || "standard"
  return datasetCategoryDestinations[normalized]
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
