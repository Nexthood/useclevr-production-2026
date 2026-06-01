import { auth } from "@/lib/auth/auth"
import type React from "react"
import { SettingsHeader } from "./settings-header"
import { SettingsNav } from "./settings-nav"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "superadmin"

  return (
    <div className="flex flex-1 flex-col bg-background">
      <SettingsHeader />

      <SettingsNav showAdmin={isSuperAdmin} />

      <main className="flex-1 px-5 py-5">
        <section className="min-w-0">{children}</section>
      </main>
    </div>
  )
}
