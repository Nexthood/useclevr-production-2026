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
      const analystLimitReached = Boolean(result.usage?.limitReached)
      return NextResponse.json({
        error:
          unauthorized || databaseUnavailable
            ? structuredMessage
            : result.error || "Upload failed",
        usage: result.usage,
        datasetLimit: limitReached ? result.limitInfo : undefined,
      }, { status: unauthorized ? 401 : databaseUnavailable ? 503 : analystLimitReached ? 402 : limitReached ? 403 : 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({
      error: "Upload failed",
      message: error.message,
    }, { status: 500 })
  }
}
