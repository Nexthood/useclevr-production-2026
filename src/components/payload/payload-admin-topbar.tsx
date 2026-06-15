"use client"

import { createPortal } from "react-dom"
import { useEffect, useRef, useState } from "react"
import { LogOut, Search } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { PayloadCreditBadge } from "./payload-admin-credit-badge"
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

export function PayloadTopbarControls() {
  const [mounted, setMounted] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const headerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    headerRef.current = document.querySelector(".app-header") as HTMLElement | null
    setMounted(true)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const filtered = searchQuery
    ? quickLinks.filter((l) => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : quickLinks

  if (!mounted || !headerRef.current) return null

  return createPortal(
    <>
      <div className="payload-topbar-left">
        <a href="/admin" className="payload-topbar-logo" aria-label="Admin dashboard">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span>Admin</span>
        </a>
      </div>

      <div className="payload-topbar-right">
        <PayloadCreditBadge />
        <button
          type="button"
          className="payload-topbar-search-btn"
          onClick={() => setSearchOpen(true)}
          aria-label="Search admin"
          title="Search admin (⌘K)"
        >
          <Search className="h-4 w-4" />
        </button>
        <div className="payload-topbar-theme">
          <PayloadThemeToggle />
        </div>
        <a
          href="/admin/logout"
          className="payload-topbar-logout"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </a>
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
    </>,
    headerRef.current,
  )
}
