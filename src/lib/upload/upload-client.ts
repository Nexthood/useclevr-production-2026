"use client"

export type UploadMode = "standard" | "retail" | "profitability" | "accountancy" | "prebookkeeping"

export type UploadDatasetResponse = {
  ok?: boolean
  success?: boolean
  stage?: string
  step?: string
  error?: string
  message?: string
  retryable?: boolean
  missingFields?: string[]
  receivedFields?: string[]
  datasetId?: string
  datasetName?: string
  datasetType?: UploadMode | string
  dataset_type?: UploadMode | string
  rowsProcessed?: number
  columnsDetected?: number
  analysisStatus?: string
  redirectTo?: string
  fileName?: string
  profitabilityResult?: Record<string, unknown>
  usage?: {
    limitReached?: boolean
    analysisCount?: number
    total?: number
    subscriptionTier?: string
  }
  datasetLimit?: {
    limitReached: boolean
    currentCount: number
    limit: number
    planName: string
  }
}

export function createUploadFormData(input: {
  file: File
  uploadMode: UploadMode
  source?: string
  extraFields?: Record<string, string>
}) {
  const formData = new FormData()
  formData.append("file", input.file)
  formData.append("uploadMode", input.uploadMode)
  formData.append("dataset_type", input.uploadMode)
  if (input.source) formData.append("fileType", input.source)

  for (const [key, value] of Object.entries(input.extraFields || {})) {
    formData.append(key, value)
  }

  return formData
}

export async function uploadDatasetFile(input: {
  file: File
  uploadMode: UploadMode
  source?: string
  extraFields?: Record<string, string>
}): Promise<UploadDatasetResponse> {
  const response = await fetch("/api/upload", {
    method: "POST",
    body: createUploadFormData(input),
  })

  const result = (await response.json().catch(() => ({
    ok: false,
    success: false,
    stage: "response_sent",
    message: "Upload response could not be read.",
  }))) as UploadDatasetResponse

  return {
    ...result,
    ok: response.ok && (result.ok ?? result.success ?? false),
    success: response.ok && (result.success ?? result.ok ?? false),
  }
}
