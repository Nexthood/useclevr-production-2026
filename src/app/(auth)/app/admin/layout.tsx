import { auth } from "@/lib/auth/auth"
import { redirect } from "next/navigation"
import type React from "react"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (session?.user?.role !== "superadmin") {
    redirect("/app")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background pt-[var(--app-topbar-offset,40px)]">
      {children}
    </div>
  )
}
