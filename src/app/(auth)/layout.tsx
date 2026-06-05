import { auth } from "@/lib/auth/auth"
import { redirect } from "next/navigation"
import type React from "react"

export default async function AuthRouteGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return <>{children}</>
}
