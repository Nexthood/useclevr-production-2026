import { AppPageHeader } from "@/components/layout/app-page-header"
import { auth } from "@/lib/auth"
import type React from "react"
import { SettingsNav } from "./settings-nav"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "superadmin"

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Account"
        description="Manage profile, preferences, subscription, billing, and activity."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Settings" },
        ]}
      />

      <SettingsNav showAdmin={isSuperAdmin} />

      <main className="px-5 py-5">
        <section className="min-w-0">{children}</section>
      </main>
    </div>
  )
}
