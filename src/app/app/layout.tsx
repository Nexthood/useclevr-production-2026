import Topbar from "@/components/ui/topbar"
import type React from "react"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Topbar />
      {children}
    </>
  )
}
