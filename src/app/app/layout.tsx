import { AppSidebar } from "@/components/layout/app-sidebar"
import { DashboardGlobalFooter } from "@/components/layout/dashboard-global-footer"
import { HelpChatbox } from "@/components/ui/help-chatbox"
import { PageVisitTracker } from "@/components/ui/page-visit-tracker"
import Topbar from "@/components/ui/topbar"
import { auth } from "@/lib/auth/auth"
import { FormattingProvider } from "@/lib/utils/formatting-context"
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

  return (
    <FormattingProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar user={session.user} />
        <div className="transition-[margin] duration-200 md:ml-[var(--app-sidebar-width)]">
          <Topbar />
          <main className="flex min-h-[calc(100vh-4rem)] flex-col">
            {children}
          </main>
          <DashboardGlobalFooter />
          <HelpChatbox />
          <PageVisitTracker />
        </div>
      </div>
    </FormattingProvider>
  )
}
