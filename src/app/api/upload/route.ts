import { uploadCSV } from "@/app/actions/upload"
import { allowedUploadDatasetCategories, getDatasetCategoryFromUpload, getUploadCategoryCandidate } from "@/lib/data/dataset-category"
import { NextResponse } from "next/server"

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
    const file = formData.get("file")
    const uploadCategoryCandidate = getUploadCategoryCandidate(formData)
    const uploadCategory = getDatasetCategoryFromUpload(uploadCategoryCandidate)

    if (!(file instanceof File)) {
      missingFields.push("file")
    }
    if (!uploadCategoryCandidate) {
      missingFields.push("dataset_type")
    }
    if (!allowedUploadDatasetCategories.includes(uploadCategory as (typeof allowedUploadDatasetCategories)[number])) {
      missingFields.push("dataset_type")
    }

    if (missingFields.length > 0) {
      return NextResponse.json({
        ok: false,
        success: false,
        stage: "validation",
        step: "validation",
        error: "Upload validation failed.",
        missingFields: [...new Set(missingFields)],
        receivedFields,
        allowedDatasetTypes: allowedUploadDatasetCategories,
      }, { status: 400 })
    }

    const result = await uploadCSV(formData)

    if (!result.success) {
      const rawError = result.error || ""
      const hasStructuredError = rawError.includes("|")
      const [errorCode = "", ...messageParts] = hasStructuredError ? rawError.split("|") : []
      const structuredMessage = messageParts.filter(Boolean).join(" ")
      const unauthorized = errorCode === "Unauthorized"
      const databaseUnavailable = errorCode === "DB_UNAVAILABLE"
      const limitReached = errorCode === "DATASET_LIMIT_REACHED"
      const rowLimitExceeded = errorCode === "ROW_LIMIT_EXCEEDED"
      const usageLimitReached = errorCode === "USAGE_LIMIT_REACHED"
      const fileProcessingError = errorCode === "FILE_PROCESSING_ERROR"
      const databaseWriteError = errorCode === "DATABASE_INSERT_ERROR" || errorCode === "DATASET_CREATE_ERROR"
      const analystLimitReached = Boolean(result.usage?.limitReached)

      let userMessage = structuredMessage || result.error || "Upload failed"
      if (unauthorized) {
        userMessage = structuredMessage || "Please sign in to upload files."
      } else if (databaseUnavailable) {
        userMessage = structuredMessage || "Database is temporarily unavailable. Please try again."
      } else if (rowLimitExceeded) {
        userMessage = structuredMessage || "Your file exceeds the row limit for your plan."
      } else if (limitReached) {
        userMessage = structuredMessage || "You have reached the dataset limit for your plan."
      } else if (analystLimitReached) {
        userMessage = "You have used all included AI credits for your plan. Upgrade to continue."
      }

      const stage = result.step || "upload"
      const stageLabels: Record<string, string> = {
        authentication: "checking your session",
        database_configuration: "checking database configuration",
        database_connection: "connecting to the database",
        demo_limit_check: "checking demo limits",
        dataset_limit_check: "checking dataset limits",
        usage_limit_check: "checking plan limits",
        file_validation: "validating the file",
        file_parse: "parsing the file",
        row_limit_check: "checking row limits",
        database_insert: "saving the dataset",
        dataset_create: "creating the dataset",
        analysis_queue: "queueing analysis",
        upload: "uploading the file",
      }
      const stageMessage = `Upload failed while ${stageLabels[stage] || stage.replaceAll("_", " ")}: ${userMessage}`
      const status = unauthorized
        ? 401
        : databaseUnavailable
          ? 503
          : analystLimitReached || rowLimitExceeded || usageLimitReached
            ? 402
            : limitReached
              ? 403
              : fileProcessingError
                ? 422
                : databaseWriteError
                  ? 500
                  : 400

      return NextResponse.json({
        ok: false,
        error: stageMessage,
        code: errorCode || undefined,
        stage,
        step: stage,
        missingFields: [],
        receivedFields,
        usage: result.usage,
        datasetLimit: limitReached ? result.limitInfo : undefined,
      }, { status })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    console.error("[UPLOAD] Unexpected error:", error)
    return NextResponse.json({
      ok: false,
      stage: "upload",
      error: "Upload failed. Please try again.",
    }, { status: 500 })
  }
}
