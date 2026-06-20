"use client"

import { createPortal } from "react-dom"
import { useEffect, useRef, useState } from "react"
import { Building2, Database, LogOut, Search, Sparkles, Upload } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { PayloadCreditBadge } from "./payload-admin-credit-badge"
import { PayloadThemeToggle } from "./payload-theme-toggle"

const quickLinks = [
  { href: "/admin", label: "Dashboard", group: "general" },
  { href: "/admin/collections/cms-users", label: "CMS Users", group: "cms" },
  { href: "/admin/collections/news-posts", label: "News Posts", group: "cms" },
  { href: "/admin/collections/faqs", label: "FAQs", group: "cms" },
  { href: "/admin/collections/media", label: "Media", group: "cms" },
  { href: "/admin/customers", label: "Customers", group: "admin" },
  { href: "/admin/discounts", label: "Discount rules", group: "admin" },
  { href: "/admin/levels", label: "Customer levels", group: "admin" },
  { href: "/admin/progress", label: "Onboarding progress", group: "admin" },
  { href: "/admin/business-profiles", label: "Business profiles", group: "ops" },
  { href: "/admin/accountancy", label: "Accountancy", group: "ops" },
  { href: "/admin/datasets", label: "Datasets", group: "ops" },
  { href: "/admin/dataset-upload", label: "Dataset upload", group: "ops" },
  { href: "/admin/support-issues", label: "Support issues", group: "ops" },
]

const groupIcons: Record<string, React.ReactNode> = {
  general: <Building2 size={14} />,
  cms: <Database size={14} />,
  admin: <Sparkles size={14} />,
  ops: <Upload size={14} />,
}

export function PayloadTopbarControls() {
  const [mounted, setMounted] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [navOpen, setNavOpen] = useState(false)
  const headerRef = useRef<HTMLElement | null>(null)
  const navRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false)
      }
    }
    if (navOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [navOpen])

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
        <div className="payload-topbar-nav" ref={navRef}>
          <button
            type="button"
            className={`payload-topbar-nav-btn${navOpen ? " is-open" : ""}`}
            onClick={() => setNavOpen(!navOpen)}
            aria-label="Navigation"
          >
            <Search size={14} />
            <span>Navigate</span>
            <kbd>⌘K</kbd>
          </button>
          {navOpen && (
            <div className="payload-topbar-nav-dropdown">
              <input
                type="text"
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <div className="payload-topbar-nav-list">
                {filtered.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="payload-topbar-nav-item"
                    onClick={() => setNavOpen(false)}
                  >
                    {groupIcons[link.group]}
                    {link.label}
                  </a>
                ))}
                {filtered.length === 0 && (
                  <p className="payload-topbar-nav-empty">No results found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="payload-topbar-right">
        <PayloadCreditBadge />
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
