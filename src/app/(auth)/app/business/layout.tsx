import { BusinessNav } from "@/components/business/business-nav"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { Building2 } from "lucide-react"
import type React from "react"

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <AppPageHeader
        title="Business"
        description="Manage business profiles, operating details, and review readiness."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Business" },
        ]}
        icon={Building2}
      />
      <BusinessNav />
      {children}
    </div>
  )
}
