import { AppSidebar } from "@/components/layout/app-sidebar"
import { HelpChatbox } from "@/components/ui/help-chatbox"
import Topbar from "@/components/ui/topbar"
import { auth } from "@/lib/auth/auth"
import { getSetupStatus } from "@/lib/business/company-setup-store"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { FormattingProvider } from "@/lib/utils/formatting-context"
import { count, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import type React from "react"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const setupStatus = await getSetupStatus(session.user.id)
  const businessCompletion = Math.min(100, Math.max(0, setupStatus.setupAccuracy ?? 0))
  const businessComplete = businessCompletion >= 100
  let uploadedDatasetCount = 0
  const db = getDb()
  if (db) {
    try {
      const [datasetCount] = await db
        .select({ count: count() })
        .from(datasets)
        .where(eq(datasets.userId, session.user.id))
      uploadedDatasetCount = Number(datasetCount?.count ?? 0)
    } catch {
      uploadedDatasetCount = 0
    }
  }
  const accountancyCompletion = businessComplete && uploadedDatasetCount > 0
    ? 100
    : businessComplete || uploadedDatasetCount > 0
      ? 50
      : 0

  return (
    <FormattingProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar
          user={session.user}
          businessStatus={{
            completion: businessCompletion,
            requiredLabel: businessCompletion === 0 ? "Required" : `${businessCompletion}%`,
            complete: businessComplete,
            hrefWhenIncomplete: "/app/business/setup",
          }}
          accountancyStatus={{
            completion: accountancyCompletion,
            requiredLabel: accountancyCompletion === 0 ? "Required" : `${accountancyCompletion}%`,
            complete: accountancyCompletion >= 100,
            hrefWhenIncomplete: "/app/accountancy",
          }}
        />
        <div className="transition-[margin] duration-200 md:ml-[var(--app-sidebar-width)]">
          <Topbar />
          <main className="flex min-h-[calc(100vh-4rem)] flex-col pt-[var(--app-topbar-offset,40px)]">
            {children}
          </main>
          <HelpChatbox audience={session.user.role === "superadmin" ? "superadmin" : "dashboard"} userRole={session.user.role} />
        </div>
      </div>
    </FormattingProvider>
  )
}
