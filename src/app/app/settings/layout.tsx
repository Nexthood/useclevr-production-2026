import type React from "react"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { auth } from "@/lib/auth"
import { SettingsNav } from "./settings-nav"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "superadmin"

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Settings"
        description="Manage profile, preferences, and subscription details."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Settings" },
        ]}
      />

      <main className="px-5 py-5">
        <div className="flex w-full flex-col gap-5 md:flex-row">
          <SettingsNav showAdmin={isSuperAdmin} />
          <section className="min-w-0 flex-1">{children}</section>
        </div>
      </main>
    </div>
  )
}
