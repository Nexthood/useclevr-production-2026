import { uploadCSV } from "@/app/actions/upload"
import { buildUploadCreditLimitInlineMessage } from "@/lib/billing/upload-credit-messaging"
import { allowedUploadDatasetCategories, getDatasetCategoryFromUpload, getUploadCategoryCandidate, normalizeDatasetCategory } from "@/lib/data/dataset-category"
import { NextResponse } from "next/server"

const supportedUploadModes = allowedUploadDatasetCategories

type SupportedUploadMode = (typeof supportedUploadModes)[number]

const retryableCodes = new Set(["DB_UNAVAILABLE", "DATABASE_INSERT_ERROR", "DATASET_CREATE_ERROR", "AUTH_CHECK_FAILED"])

const stageLabels: Record<string, string> = {
  request_received: "receiving the request",
  auth_checked: "checking your session",
  formdata_validated: "validating the upload request",
  file_validated: "validating the file",
  file_parsed: "parsing the file",
  dataset_created: "creating the dataset",
  rows_processed: "processing dataset rows",
  analysis_created_or_queued: "queueing analysis",
  credits_deducted: "deducting credits",
  usage_limit_check: "checking upload limits",
  response_sent: "sending the response",
}

const legacyStageMap: Record<string, string> = {
  authentication: "auth_checked",
  database_configuration: "dataset_created",
  database_connection: "dataset_created",
  demo_limit_check: "credits_deducted",
  dataset_limit_check: "formdata_validated",
  usage_limit_check: "credits_deducted",
  file_validation: "file_validated",
  file_parse: "file_parsed",
  row_limit_check: "rows_processed",
  database_insert: "dataset_created",
  dataset_create: "dataset_created",
  analysis_queue: "analysis_created_or_queued",
  upload: "request_received",
  validation: "formdata_validated",
}

function normalizeStage(stage?: string) {
  if (!stage) return "request_received"
  if (stage in stageLabels) return stage
  return legacyStageMap[stage] || stage
}

function getStringField(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

/**
 * Upload API Route
 *
 * Delegated directly to the canonical uploadCSV server action
 * to eliminate code duplication and maintain robust consistency.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const receivedFields = Array.from(formData.keys())
    const missingFields: string[] = []
    const invalidFields: string[] = []
    const file = formData.get("file")
    const uploadMode = getStringField(formData, "uploadMode")
    const datasetType = getStringField(formData, "dataset_type")
    const uploadCategoryCandidate = getUploadCategoryCandidate(formData)
    const uploadCategory = getDatasetCategoryFromUpload(uploadCategoryCandidate)
    const isSupportedMode = (value: string): value is SupportedUploadMode =>
      normalizeDatasetCategory(value) !== null
    const normalizedUploadMode = normalizeDatasetCategory(uploadMode)
    const normalizedDatasetType = normalizeDatasetCategory(datasetType)
    const hasExplicitSharedUploadContract = Boolean(uploadMode || datasetType)
    const legacyCategoryAllowed = !hasExplicitSharedUploadContract && ["accountancy", "prebookkeeping"].includes(uploadCategory)

    if (!(file instanceof File)) {
      missingFields.push("file")
    }
    if (!legacyCategoryAllowed) {
      if (!uploadMode) {
        missingFields.push("uploadMode")
      } else if (!isSupportedMode(uploadMode)) {
        invalidFields.push("uploadMode")
      }

      if (!datasetType) {
        missingFields.push("dataset_type")
      } else if (!isSupportedMode(datasetType)) {
        invalidFields.push("dataset_type")
      }

      if (normalizedUploadMode && normalizedDatasetType && normalizedUploadMode !== normalizedDatasetType) {
        invalidFields.push("uploadMode", "dataset_type")
      }
    }
    if (!allowedUploadDatasetCategories.includes(uploadCategory as (typeof allowedUploadDatasetCategories)[number])) {
      missingFields.push("dataset_type")
    }

    if (missingFields.length > 0 || invalidFields.length > 0) {
      const uniqueMissingFields = [...new Set(missingFields)]
      const uniqueInvalidFields = [...new Set(invalidFields)]
      return NextResponse.json({
        ok: false,
        success: false,
        stage: "formdata_validated",
        step: "formdata_validated",
        error: "Upload validation failed.",
        message: uniqueMissingFields.length > 0
          ? `Upload request is missing required field${uniqueMissingFields.length === 1 ? "" : "s"}: ${uniqueMissingFields.join(", ")}.`
          : `Upload request has invalid field${uniqueInvalidFields.length === 1 ? "" : "s"}: ${uniqueInvalidFields.join(", ")}.`,
        retryable: false,
        missingFields: uniqueMissingFields,
        invalidFields: uniqueInvalidFields,
        receivedFields,
        allowedDatasetTypes: [...supportedUploadModes],
      }, { status: 400 })
    }

    const result = await uploadCSV(formData)

    if (!result.success) {
      const rawError = result.error || ""
      const hasStructuredError = rawError.includes("|")
      const [errorCode = "", ...messageParts] = hasStructuredError ? rawError.split("|") : []
      const structuredMessage = messageParts.filter(Boolean).join(" ")
      const unauthorized = errorCode === "Unauthorized"
      const authCheckFailed = errorCode === "AUTH_CHECK_FAILED"
      const databaseUnavailable = errorCode === "DB_UNAVAILABLE"
      const limitReached = errorCode === "DATASET_LIMIT_REACHED"
      const rowLimitExceeded = errorCode === "ROW_LIMIT_EXCEEDED"
      const uploadFileTooLarge = errorCode === "UPLOAD_FILE_TOO_LARGE"
      const invalidUploadFile =
        errorCode === "UPLOAD_FILE_TYPE_INVALID" ||
        errorCode === "UPLOAD_CSV_STRUCTURE_INVALID" ||
        errorCode === "UPLOAD_SPREADSHEET_STRUCTURE_INVALID" ||
        errorCode === "UPLOAD_ROW_LIMIT_EXCEEDED" ||
        errorCode === "UPLOAD_COLUMN_LIMIT_EXCEEDED" ||
        errorCode === "UPLOAD_TEMPORARY_FILE_REJECTED"
      const insufficientCredits = errorCode === "INSUFFICIENT_CREDITS" || errorCode === "UPLOAD_CREDITS_EXHAUSTED"
      const usageLimitReached = errorCode === "USAGE_LIMIT_REACHED"
      const fileProcessingError = errorCode === "FILE_PROCESSING_ERROR"
      const databaseWriteError = errorCode === "DATABASE_INSERT_ERROR" || errorCode === "DATASET_CREATE_ERROR"
      const unexpectedUploadError = errorCode === "UNEXPECTED_UPLOAD_ERROR"
      const analystLimitReached = Boolean(result.usage?.limitReached)

      let userMessage = structuredMessage || result.error || "Upload failed"
      if (unauthorized) {
        userMessage = structuredMessage || "Please sign in to upload files."
      } else if (authCheckFailed) {
        userMessage = "Unable to check your session. Please refresh and sign in again."
      } else if (databaseUnavailable) {
        userMessage = structuredMessage || "Database is temporarily unavailable. Please try again."
      } else if (rowLimitExceeded) {
        userMessage = structuredMessage || "Your file exceeds the row limit for your plan."
      } else if (limitReached) {
        userMessage = structuredMessage || "You have reached the dataset limit for your plan."
      } else if (insufficientCredits || analystLimitReached) {
        userMessage = buildUploadCreditLimitInlineMessage()
      }

      const stage = normalizeStage(result.step)
      const stageMessage = insufficientCredits
        ? userMessage
        : `Upload failed while ${stageLabels[stage] || stage.replaceAll("_", " ")}: ${userMessage}`
      const status = unauthorized
        ? 401
        : uploadFileTooLarge
          ? 413
        : authCheckFailed || unexpectedUploadError
          ? 500
          : databaseUnavailable
          ? 503
          : insufficientCredits || analystLimitReached || rowLimitExceeded || usageLimitReached
            ? 402
            : limitReached
              ? 403
              : fileProcessingError || invalidUploadFile
                ? 422
                : databaseWriteError
                  ? 500
                  : 400

      return NextResponse.json({
        ok: false,
        success: false,
        error: stageMessage,
        message: stageMessage,
        code: errorCode || undefined,
        title: insufficientCredits ? "Free upload limit reached" : undefined,
        upgradeRequired: insufficientCredits || undefined,
        stage,
        step: stage,
        retryable: errorCode ? retryableCodes.has(errorCode) : false,
        missingFields: [],
        receivedFields,
        usage: result.usage,
      }, { status })
    }

    return NextResponse.json({ ok: true, stage: "response_sent", ...result })
  } catch (error) {
    console.error("[UPLOAD] Unexpected error:", error)
    const details = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined
    return NextResponse.json({
      ok: false,
      success: false,
      stage: "request_received",
      step: "request_received",
      error: `Upload failed while ${stageLabels.request_received}: Unexpected upload failure.`,
      message: `Upload failed while ${stageLabels.request_received}: Unexpected upload failure.`,
      details,
      retryable: false,
    }, { status: 500 })
  }
}
