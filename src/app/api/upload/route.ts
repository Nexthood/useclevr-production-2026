import { uploadCSV } from "@/app/actions/upload"
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
        database_check: "checking database availability",
        database_connection: "connecting to the database",
        demo_limit_check: "checking demo limits",
        dataset_limit_check: "checking dataset limits",
        usage_limit_check: "checking plan limits",
        file_validation: "validating the file",
        file_parsing: "parsing the file",
        row_limit_check: "checking row limits",
        save_dataset: "saving the dataset",
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
                : 400

      return NextResponse.json({
        error: stageMessage,
        code: errorCode || undefined,
        step: stage,
        usage: result.usage,
        datasetLimit: limitReached ? result.limitInfo : undefined,
      }, { status })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[UPLOAD] Unexpected error:", error)
    return NextResponse.json({
      error: "Upload failed. Please try again.",
    }, { status: 500 })
  }
}
