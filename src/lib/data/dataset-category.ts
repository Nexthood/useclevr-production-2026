export type DatasetCategory = "standard" | "retail" | "accountancy" | "profitability"

export function getDatasetCategoryFromUpload(fileType?: string | null): DatasetCategory {
  const normalized = (fileType || "").toLowerCase()

  if (normalized.includes("profitability")) return "profitability"
  if (normalized.includes("accountancy") || normalized.includes("accounting") || normalized.includes("invoice") || normalized.includes("receipt")) {
    return "accountancy"
  }
  if (normalized.includes("retail")) return "retail"

  return "standard"
}

export function getDatasetCategoryRedirect(category: DatasetCategory, datasetId: string) {
  if (category === "retail") return `/app/retail?datasetId=${datasetId}`
  if (category === "accountancy" || category === "profitability") return `/app/accountancy?datasetId=${datasetId}`

  return `/app/datasets/${datasetId}/analyze`
}
