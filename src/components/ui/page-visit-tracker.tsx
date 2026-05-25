"use client"

import { usePathname } from "next/navigation"
import * as React from "react"

export function PageVisitTracker() {
  const pathname = usePathname()

  React.useEffect(() => {
    if (!pathname || !pathname.startsWith("/app")) return

    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "page_visited", path: pathname }),
    }).catch(() => undefined)
  }, [pathname])

  return null
}
