import Topbar from "@/components/ui/topbar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { FormattingProvider } from "@/lib/formatting-context"
import { auth } from "@/lib/auth"
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
        <div className="ml-[220px] min-h-screen">
          <Topbar />
          <main className="min-h-screen pt-10">
            {children}
          </main>
        </div>
      </div>
    </FormattingProvider>
  )
}
