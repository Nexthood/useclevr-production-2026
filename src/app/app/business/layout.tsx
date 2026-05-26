import { BusinessNav } from "@/components/business/business-nav"
import { AppPageHeader } from "@/components/layout/app-page-header"
import type React from "react"

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Business"
        description="Manage business profiles, operating details, and review readiness."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Business" },
        ]}
      />
      <BusinessNav />

      <main className="px-5 py-5">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
