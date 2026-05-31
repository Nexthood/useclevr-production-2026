import { AccountancyNav } from "@/components/accountancy/accountancy-nav"
import { AppPageHeader } from "@/components/layout/app-page-header"
import type React from "react"

export default function AccountancyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <AppPageHeader
        title="Accountancy"
        description="Financial records, tax calculations, and compliance tools."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Accountancy" },
        ]}
      />
      <AccountancyNav />
      <main className="px-5 py-5">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  )
}