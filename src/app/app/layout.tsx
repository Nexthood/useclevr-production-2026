import { AppSidebar } from "@/components/layout/app-sidebar"
import { DashboardNoticeBar } from "@/components/ui/dashboard-notice-bar"
import { HelpChatbox } from "@/components/ui/help-chatbox"
import Topbar from "@/components/ui/topbar"
import { auth } from "@/lib/auth"
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
        <div className="min-h-screen md:ml-[220px]">
          <Topbar />
          <DashboardNoticeBar />
          <main className="min-h-screen pt-16">
            {children}
          </main>
          <HelpChatbox />
        </div>
      </div>
    </FormattingProvider>
  )
}
