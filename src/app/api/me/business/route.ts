import { auth } from "@/lib/auth/auth"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import { getBusinessDetailsById, getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { debugError } from "@/lib/utils/debug"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const parseBoolean = z
  .union([z.literal("true"), z.literal("false"), z.literal("")])
  .optional()

const querySchema = z.object({
  businessId: z.string().optional(),
  includeNulls: parseBoolean,
})

export async function GET(request: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
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

  try {
    await requireBuiltinUserRecord(userId)
  } catch (error) {
    debugError("[api/me/business] built-in identity sync failed:", error)
    return NextResponse.json({ error: "Database connection is unavailable." }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))

  const includeNulls = parsed.success ? parsed.data.includeNulls === "true" : false

  try {
    const details = parsed.success && parsed.data.businessId
      ? await getBusinessDetailsById(userId, parsed.data.businessId)
      : await getPrimaryBusinessDetails(userId)

    return NextResponse.json({ details: includeNulls ? details : details })
  } catch (error) {
    debugError("[api/me/business] load failed:", error)
    return NextResponse.json(
      { error: "Failed to load business details." },
      { status: 500 }
    )
  }
}
