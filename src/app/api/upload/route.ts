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
      const unauthorized = result.error?.startsWith("Unauthorized|")
      return NextResponse.json({
        error: unauthorized ? result.error?.split("|", 2)[1] : result.error || "Upload failed",
        usage: result.usage,
      }, { status: unauthorized ? 401 : 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({
      error: "Upload failed",
      message: error.message,
    }, { status: 500 })
  }
}
