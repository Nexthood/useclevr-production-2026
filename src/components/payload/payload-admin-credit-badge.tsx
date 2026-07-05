"use client"

import { Coins } from "lucide-react"
import { useEffect, useState } from "react"

export function PayloadCreditBadge() {
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("useclevr_credits")
      setCredits(stored ? Number.parseInt(stored) : 0)
    } catch {
      setCredits(0)
    }
  }, [])

  if (credits === null) return null

  return (
    <a
      href="/app/settings/subscription?tab=billing"
      target="_parent"
      title={`${credits} credits remaining — Click to manage billing`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.2rem 0.45rem",
        borderRadius: "0.3rem",
        color: "var(--theme-elevation-500)",
        fontSize: "0.72rem",
        fontWeight: 600,
        textDecoration: "none",
        transition: "background 0.12s, color 0.12s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--theme-elevation-100)"; e.currentTarget.style.color = "#047d8d" }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--theme-elevation-500)" }}
    >
      <Coins className="h-3.5 w-3.5" />
      <span>{credits}</span>
    </a>
  )
}
