import { auth } from "@/lib/auth/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { AssistantPageClient } from "./assistant-page-client"

export default async function AssistantPage() {
  const session = await auth()
  const usage = await getAnalystCreditUsage(session?.user?.id ?? null, session?.user?.role)

  return (
    <AssistantPageClient
      subscriptionTier={usage.subscriptionTier}
      userRole={session?.user?.role ?? null}
    />
  )
}
