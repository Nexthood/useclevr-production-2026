import type React from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { FormattingProvider } from "@/lib/formatting-context"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

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
        <main className="ml-[220px] min-h-screen">
          {children}
        </main>
      </div>
    </FormattingProvider>
  )
}
