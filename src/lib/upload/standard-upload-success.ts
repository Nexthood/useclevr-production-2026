import type { UploadDatasetResponse } from "@/lib/upload/upload-client"

export function getStandardUploadSuccessView(result: UploadDatasetResponse) {
  const datasetId = result.datasetId || ""
  const rowsProcessed = typeof result.rowsProcessed === "number" ? result.rowsProcessed : null
  const columnsDetected = typeof result.columnsDetected === "number" ? result.columnsDetected : null

  return {
    title: "Upload completed successfully",
    description: "Your standard dataset was uploaded and is ready for analysis.",
    dashboardHref: result.redirectTo || (datasetId ? `/app/dashboard?datasetId=${encodeURIComponent(datasetId)}` : "/app/dashboard"),
    datasetHref: datasetId ? `/app/datasets/${encodeURIComponent(datasetId)}` : "/app/datasets",
    hasDatasetNavigation: Boolean(datasetId),
    metrics: [
      { label: "Dataset type", value: "Standard" },
      { label: "Rows processed", value: rowsProcessed === null ? "Not reported" : rowsProcessed.toLocaleString() },
      { label: "Columns detected", value: columnsDetected === null ? "Not reported" : columnsDetected.toLocaleString() },
      { label: "Analysis status", value: getStandardAnalysisStatusLabel(result.analysisStatus) },
    ],
  }
}

export function getStandardAnalysisStatusLabel(status: string | undefined) {
  if (!status) return "Processing"
  const normalized = status.trim().toLowerCase().replaceAll("_", " ")
  if (normalized === "ready" || normalized === "completed" || normalized === "complete" || normalized === "success") return "Ready"
  if (normalized === "failed" || normalized === "failure" || normalized === "error") return "Failed"
  return "Processing"
}
