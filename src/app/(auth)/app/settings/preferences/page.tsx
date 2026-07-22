import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { normalizeRegionalPreferences } from "@/lib/utils/regional-preferences"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { PreferencesPanel } from "./preferences-panel"

export const metadata: Metadata = { title: "Regional Preferences" }

export default async function PreferencesSettingsPage() {
  const session = await auth()
  const userId = session?.user?.id
  const db = getDb()
  let initialPreferences = normalizeRegionalPreferences(null)
  let loadError: string | null = null

  if (userId && db) {
    try {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
        columns: {
          preferredCurrency: true,
          numberFormat: true,
          regionalPreferences: true,
        },
      })
      initialPreferences = normalizeRegionalPreferences(profile?.regionalPreferences, {
        preferredCurrency: profile?.preferredCurrency,
        numberFormat: profile?.numberFormat,
      })
    } catch {
      loadError = "Regional preferences could not be loaded. Auto defaults are shown until settings can be saved."
    }
  }

  return <PreferencesPanel initialPreferences={initialPreferences} loadError={loadError} />
}
