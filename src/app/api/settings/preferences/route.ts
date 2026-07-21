import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import {
  normalizeRegionalPreferences,
  resolveDisplayCurrency,
  type RegionalPreferences,
} from "@/lib/utils/regional-preferences"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

type PreferencePayload = Partial<RegionalPreferences> & {
  browserLocale?: string | null
}

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database connection is unavailable." }, { status: 503 })
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: {
      preferredCurrency: true,
      numberFormat: true,
      regionalPreferences: true,
    },
  })

  const preferences = normalizeRegionalPreferences(profile?.regionalPreferences, {
    preferredCurrency: profile?.preferredCurrency,
    numberFormat: profile?.numberFormat,
  })

  return NextResponse.json({
    preferences,
    resolvedDisplayCurrency: resolveDisplayCurrency(preferences),
    legacyCurrencyPreserved: Boolean(profile && !profile.regionalPreferences),
  })
}

export async function PATCH(request: Request) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database connection is unavailable." }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as PreferencePayload | null
  const preferences = normalizeRegionalPreferences(body)
  const browserLocale = typeof body?.browserLocale === "string" ? body.browserLocale : null
  const compatibleDisplayCurrency = resolveDisplayCurrency(preferences, browserLocale)
  const compatibleNumberFormat = preferences.numberFormat === "auto" ? "auto" : "manual"

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { userId: true },
  })

  if (existingProfile) {
    await db.update(profiles)
      .set({
        preferredCurrency: compatibleDisplayCurrency,
        numberFormat: compatibleNumberFormat,
        regionalPreferences: preferences,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
  } else {
    await db.insert(profiles).values({
      id: `profile_${uuidv4()}`,
      userId,
      email: session.user.email,
      fullName: session.user.name,
      preferredCurrency: compatibleDisplayCurrency,
      numberFormat: compatibleNumberFormat,
      regionalPreferences: preferences,
    })
  }

  return NextResponse.json({
    success: true,
    preferences,
    resolvedDisplayCurrency: compatibleDisplayCurrency,
  })
}
