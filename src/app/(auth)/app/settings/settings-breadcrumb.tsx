"use client"

import { usePathname } from "next/navigation"

export function SettingsBreadcrumb({ map }: { map: Record<string, string> }) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const settingsIndex = segments.findIndex((s) => s === "settings")
  const subSegment = settingsIndex !== -1 && settingsIndex + 1 < segments.length
    ? segments[settingsIndex + 1]
    : undefined
  const subLabel = subSegment ? map[subSegment] : undefined

  if (!subLabel) return null

  return (
    <script
      type="application/json"
      id="settings-breadcrumb-data"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ label: subLabel }),
      }}
    />
  )

  // The sub-page label is used by the layout to augment breadcrumbs.
}
