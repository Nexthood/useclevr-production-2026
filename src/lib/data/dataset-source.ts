/**
 * Normalized dataset source model — the single authoritative vocabulary for
 * how a dataset entered UseClevr. Persisted on every new dataset in
 * `Dataset.source` and backfilled from immutable stored metadata only.
 *
 * Values reuse the existing product vocabulary (file kinds, ClevrSync
 * connector types, and the dashboard source categories) — no duplicate enums.
 */
export const DATASET_SOURCES = [
  "csv",
  "excel",
  "google_sheets",
  "onedrive",
  "sharepoint",
  "snowflake",
  "api",
  "clevrsync",
  "accountancy_document",
  "unknown",
] as const

export type DatasetSource = (typeof DATASET_SOURCES)[number]

export const DEFAULT_DATASET_SOURCE: DatasetSource = "unknown"

const datasetSourceSet = new Set<string>(DATASET_SOURCES)

export function normalizeDatasetSource(value?: string | null): DatasetSource | null {
  const normalized = (value || "").trim().toLowerCase()
  if (!normalized) return null
  if (datasetSourceSet.has(normalized)) return normalized as DatasetSource
  return null
}

/** Display order and labels for upload-history source counts. */
export const DATASET_SOURCE_LABELS: Record<DatasetSource, string> = {
  csv: "CSV",
  excel: "Excel",
  google_sheets: "Google Sheets",
  onedrive: "OneDrive",
  sharepoint: "SharePoint",
  snowflake: "Snowflake",
  api: "API",
  clevrsync: "ClevrSync",
  accountancy_document: "Document",
  unknown: "Other / Unknown",
}

export function getDatasetSourceLabel(source?: string | null): string {
  return DATASET_SOURCE_LABELS[normalizeDatasetSource(source) || DEFAULT_DATASET_SOURCE]
}

function fileExtension(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec((fileName || "").trim())
  return match ? match[1].toLowerCase() : ""
}

/**
 * Derive the dataset source from immutable stored metadata only. Never
 * fabricates a connector origin: unknown stays unknown.
 */
export function deriveDatasetSource(input: {
  source?: string | null
  uploadSource?: string | null
  datasetType?: string | null
  fileName?: string | null
  mimeType?: string | null
}): DatasetSource {
  const stored = normalizeDatasetSource(input.source)
  if (stored) return stored

  const uploadSource = (input.uploadSource || "").trim().toLowerCase()
  if (uploadSource === "clevrsync") return "clevrsync"

  const datasetType = (input.datasetType || "").trim().toLowerCase()
  if (datasetType === "snowflake") return "snowflake"
  if (datasetType === "api") return "api"

  const extension = fileExtension(input.fileName || "")
  if (extension === "csv") return "csv"
  if (extension === "xlsx" || extension === "xls") return "excel"

  const mimeType = (input.mimeType || "").trim().toLowerCase()
  if (mimeType === "text/csv" || mimeType === "application/csv") return "csv"
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return "excel"
  }

  return DEFAULT_DATASET_SOURCE
}

/** Accountancy upload types map onto the shared source vocabulary. */
export function resolveAccountancyDatasetSource(input: {
  uploadType: string
  fileName: string
  mimeType?: string | null
}): DatasetSource {
  if (input.uploadType === "pdf" || input.uploadType === "receipt") return "accountancy_document"
  const derived = deriveDatasetSource({ fileName: input.fileName, mimeType: input.mimeType ?? null })
  if (derived !== "unknown") return derived
  // Bank exports in OFX/QIF are structured ledger files; classify them as CSV
  // tabular sources rather than losing them under unknown.
  return "csv"
}
