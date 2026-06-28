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
      const [errorCode, structuredMessage] = result.error?.split("|", 2) ?? []
      const unauthorized = errorCode === "Unauthorized"
      const databaseUnavailable = errorCode === "DB_UNAVAILABLE"
      const limitReached = errorCode === "DATASET_LIMIT_REACHED"
      const rowLimitExceeded = errorCode === "ROW_LIMIT_EXCEEDED"
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
        userMessage = "You have used all analyst credits. Upgrade to continue."
      }

      return NextResponse.json({
        error: userMessage,
        usage: result.usage,
        datasetLimit: limitReached ? result.limitInfo : undefined,
      }, { status: unauthorized ? 401 : databaseUnavailable ? 503 : analystLimitReached || rowLimitExceeded ? 402 : limitReached ? 403 : 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[UPLOAD] Unexpected error:", error)
    return NextResponse.json({
      error: "Upload failed. Please try again.",
    }, { status: 500 })
  }
}
