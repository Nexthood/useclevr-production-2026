import { AccountCenter } from "@/components/settings/account-center"
import { getPublicAiProviderConfig } from "@/lib/ai/byoai-provider"
import { auth } from "@/lib/auth/auth"
import { getCompanySetup } from "@/lib/business/company-setup-store"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { getBillingSettings } from "@/lib/billing/settings-store"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export default async function SettingsPage() {
  const session = await auth()
  const setupStatus = session?.user?.id ? await getCompanySetup(session.user.id) : null
  const usage = await getAnalystCreditUsage(session?.user?.id, session?.user?.role)
  const billingSettings = await getBillingSettings()
  const aiProvider = session?.user?.id ? await getPublicAiProviderConfig(session.user.id) : null

  let profile: { fullName: string | null; email: string | null } | null = null
  const db = getDb()
  if (session?.user?.id && db) {
    profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
      columns: { fullName: true, email: true },
    }) ?? null
  }

  return (
    <AccountCenter
      profile={profile}
      setupStatus={setupStatus?.setupStatus ?? null}
      usage={usage}
      billingSettings={billingSettings}
      session={session}
      aiProvider={aiProvider}
    />
  )
}
