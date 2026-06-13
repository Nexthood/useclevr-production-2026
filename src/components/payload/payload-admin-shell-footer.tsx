"use client"

import { LogOut, Search } from "lucide-react"
import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { PayloadThemeToggle } from "./payload-theme-toggle"

const quickLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/collections/cms-users", label: "CMS Users" },
  { href: "/admin/collections/news-posts", label: "News Posts" },
  { href: "/admin/collections/faqs", label: "FAQs" },
  { href: "/admin/collections/media", label: "Media" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/discounts", label: "Discount rules" },
  { href: "/admin/levels", label: "Customer levels" },
  { href: "/admin/progress", label: "Onboarding progress" },
  { href: "/admin/business-profiles", label: "Business profiles" },
  { href: "/admin/support-issues", label: "Support issues" },
  { href: "/admin/dataset-upload", label: "Dataset upload" },
]

export function PayloadNavFooter() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = searchQuery
    ? quickLinks.filter((l) => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : quickLinks

  return (
    <div style={{ marginTop: "auto", borderTop: "1px solid var(--theme-elevation-150)", padding: "0.75rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.45rem 0.6rem", borderRadius: "0.35rem",
            border: "1px solid var(--theme-elevation-150)",
            background: "var(--theme-elevation-50)",
            color: "var(--theme-elevation-600)",
            fontSize: "0.75rem", cursor: "pointer",
            transition: "border-color 0.15s, background-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#078fa1"; e.currentTarget.style.background = "color-mix(in srgb, #078fa1 6%, var(--theme-elevation-0))" }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--theme-elevation-150)"; e.currentTarget.style.background = "var(--theme-elevation-50)" }}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search admin...</span>
          <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "var(--theme-elevation-500)", background: "var(--theme-elevation-100)", padding: "0 0.35rem", borderRadius: "0.2rem" }}>⌘K</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <div style={{ flex: 1 }}>
            <PayloadThemeToggle />
          </div>
          <a
            href="/admin/logout"
            title="Sign out"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "2rem", height: "2rem", borderRadius: "0.3rem",
              color: "var(--theme-elevation-500)", textDecoration: "none",
              transition: "background-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--theme-elevation-100)"; e.currentTarget.style.color = "var(--theme-error-500)" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--theme-elevation-500)" }}
          >
            <LogOut className="h-4 w-4" />
          </a>
        </div>
      </div>

      <Modal open={searchOpen} onOpenChange={setSearchOpen} title="Search admin" description="Find pages, collections, and tools.">
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <input
            type="text"
            placeholder="Type to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: "100%", minHeight: "2.75rem", padding: "0.5rem 0.75rem",
              borderRadius: "0.35rem", border: "1px solid var(--theme-elevation-250)",
              background: "var(--theme-input-bg)", color: "var(--theme-text)",
              fontSize: "0.9rem",
            }}
          />
          <div style={{ display: "grid", gap: "0.25rem" }}>
            {filtered.map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.5rem 0.65rem", borderRadius: "0.3rem",
                  color: "var(--theme-text)", textDecoration: "none",
                  fontSize: "0.8rem", transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--theme-elevation-100)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
              >
                {link.label}
              </a>
            ))}
            {filtered.length === 0 && (
              <p style={{ color: "var(--theme-elevation-500)", fontSize: "0.8rem", padding: "0.5rem" }}>
                No results found.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
