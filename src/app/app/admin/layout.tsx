import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type React from "react"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (session?.user?.role !== "superadmin") {
    redirect("/app")
  }

  return children
}
