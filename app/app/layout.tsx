import type React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { FormattingProvider } from "@/lib/formatting-context"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
