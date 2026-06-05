"use client"

import { AppPageHeader } from "@/components/layout/app-page-header"
import { Settings } from "lucide-react"
import { usePathname } from "next/navigation"

const subPageLabels: Record<string, string> = {
  profile: "Profile",
  preferences: "Preferences",
  subscription: "Subscription",
  activity: "Activity",
  billing: "Billing",
  payment: "Payment",
  credits: "Credits",
  "total-activity": "Activity Log",
}

export function SettingsHeader() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const settingsIndex = segments.findIndex((s) => s === "settings")
  const subSegment = settingsIndex !== -1 && settingsIndex + 1 < segments.length
    ? segments[settingsIndex + 1]
    : undefined
  const subLabel = subSegment ? subPageLabels[subSegment] : undefined

  return (
    <AppPageHeader
      title="Account"
      description="Manage profile, preferences, subscription, billing, and activity."
      breadcrumbs={[
        { label: "Dashboard", href: "/app" },
        { label: "Settings", href: "/app/settings" },
        ...(subLabel ? [{ label: subLabel }] : []),
      ]}
      icon={Settings}
    />
  )
}
