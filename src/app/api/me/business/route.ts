import { auth } from "@/lib/auth"
import { isBuiltinUserId } from "@/lib/auth/builtin-users"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
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

  const db = getDb()
  if (!db) {
    return NextResponse.json(
      { error: "Database connection is unavailable." },
      { status: 500 }
    )
  }

  try {
    const allColumns: (keyof typeof profiles)[] = [
      "businessName",
      "businessEmail",
      "industry",
      "location",
      "website",
      "businessDescription",
    ]

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: includeNulls ? undefined : (allColumns.reduce((a, b) => ({ ...a, [b]: true }), {}) as Record<string, boolean>),
    })

    const rawDetails = profile as Record<string, unknown> | undefined

    const details = {
      businessName:        (rawDetails?.businessName ?? "") as string,
      businessEmail:       (rawDetails?.businessEmail ?? "") as string,
      industry:            (rawDetails?.industry ?? "") as string,
      location:            (rawDetails?.location ?? "") as string,
      website:             (rawDetails?.website ?? "") as string,
      businessDescription: (rawDetails?.businessDescription ?? "") as string,
    }

    return NextResponse.json({ details })
  } catch (error) {
    console.error("[api/me/business] load failed:", error)
    return NextResponse.json(
      { error: "Failed to load business details." },
      { status: 500 }
    )
  }
}
