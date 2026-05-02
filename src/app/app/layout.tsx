import type React from "react"
import { AppSidebar } from "@/components/app-sidebar"
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
    redirect("/login?callbackUrl=/app")
  }

  return (
    <FormattingProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <main className="ml-[240px] min-h-screen">
          {children}
        </main>
      </div>
    </FormattingProvider>
  )
}
