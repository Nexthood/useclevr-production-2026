"use client"

import { LogOut } from "lucide-react"
import { PayloadCreditBadge } from "./payload-admin-credit-badge"
import { PayloadThemeToggle } from "./payload-theme-toggle"

export function PayloadNavFooter() {
  return (
    <div style={{ marginTop: "auto", borderTop: "1px solid var(--theme-elevation-150)", padding: "0.5rem 0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.35rem" }}>
        <PayloadThemeToggle />
        <PayloadCreditBadge />
        <a
          href="/admin/logout"
          title="Sign out"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "1.75rem", height: "1.75rem", borderRadius: "0.3rem",
            color: "var(--theme-elevation-500)", textDecoration: "none",
            transition: "background-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--theme-elevation-100)"; e.currentTarget.style.color = "var(--theme-error-500)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--theme-elevation-500)" }}
        >
          <LogOut className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
