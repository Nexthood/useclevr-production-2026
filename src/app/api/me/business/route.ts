import { auth } from "@/lib/auth"
import { isBuiltinUserId } from "@/lib/auth/builtin-users"
import { getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { debugError } from "@/lib/utils/debug"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const parseBoolean = z
  .union([z.literal("true"), z.literal("false"), z.literal("")])
  .optional()

const querySchema = z.object({
  includeNulls: parseBoolean,
})

export async function GET(request: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId || isBuiltinUserId(userId)) {
    return NextResponse.json({
      details: {
        businessName: "",
        businessEmail: "",
        industry: "",
        location: "",
        website: "",
        businessDescription: "",
      },
    })
  }

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))

  const includeNulls = parsed.success ? parsed.data.includeNulls === "true" : false

  try {
    const details = await getPrimaryBusinessDetails(userId)

    return NextResponse.json({ details: includeNulls ? details : details })
  } catch (error) {
    debugError("[api/me/business] load failed:", error)
    return NextResponse.json(
      { error: "Failed to load business details." },
      { status: 500 }
    )
  }
}
