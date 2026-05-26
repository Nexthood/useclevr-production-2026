import { AppPageHeader } from "@/components/layout/app-page-header"
import type React from "react"

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Business"
        description="Configure company details for analysis context."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Settings", href: "/app/settings" },
          { label: "Business" },
        ]}
      />

      <main className="px-5 py-5">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}