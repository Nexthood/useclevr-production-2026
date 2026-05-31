"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, BarChart3, Database, FileQuestion, HelpCircle, SearchIcon, Send, Settings, Ticket, X } from "lucide-react"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"

export function Search() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<{ id: string; type: string; title: string; description?: string; href: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const quickLinks = [
    { href: "/app/datasets", label: "Datasets", description: "Open uploaded files and tables.", icon: Database },
    { href: "/app/upload", label: "Upload", description: "Add a CSV dataset.", icon: BarChart3 },
    { href: "/app/assistant", label: "AI Assistant", description: "Ask questions about a dataset.", icon: SearchIcon },
    { href: "/app/tickets", label: "Tickets", description: "Create or review support requests.", icon: Ticket },
    { href: "/app/faq", label: "FAQ", description: "Search dashboard help.", icon: HelpCircle },
    { href: "/app/settings/profile", label: "Settings", description: "Manage account and profile.", icon: Settings },
  ]

  // Handle opening the search
  useEffect(() => {
    if (open) {
      // Focus the input when search opens
      searchInputRef.current?.focus()
      // Prevent background scrolling
      document.body.style.overflow = 'hidden'
    } else {
      // Return focus to the search button when closed
      searchButtonRef.current?.focus()
      // Re-enable background scrolling
      document.body.style.overflow = ''
    }
  }, [open])

  // Handle ESC key to close search
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (open && event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  // Focus trapping when search is open
  useEffect(() => {
    if (!open) return

    const overlay = document.querySelector('.fixed inset-0 z-[220] bg-background') as HTMLElement | null
    if (!overlay) return

    // Get all focusable elements within the overlay
    const focusableElements = overlay.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    function handleTabKey(e: KeyboardEvent) {
      if (e.key === 'Tab') {
        if (e.shiftKey) { // Shift + Tab
          if (document.activeElement === firstFocusable) {
            e.preventDefault()
            lastFocusable.focus()
          }
        } else { // Tab
          if (document.activeElement === lastFocusable) {
            e.preventDefault()
            firstFocusable.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => {
      document.removeEventListener('keydown', handleTabKey)
    }
  }, [open])

  async function handleSearch() {
    if (!query.trim() || isSearching) return
    setIsSearching(true)
    setHasSearched(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setResults(Array.isArray(data.results) ? data.results : [])
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <>
      <Button
        ref={searchButtonRef}
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="h-full min-w-12 rounded-none px-0"
      >
        <SearchIcon className="h-4 w-4" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[220] bg-background"
          role="dialog"
          aria-modal="true"
          aria-labelledby="search-header"
        >
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex h-12 items-center justify-between gap-3 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground" id="search-header">
                <SearchIcon className="h-4 w-4 text-primary" />
                Search UseClevr
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close search">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form
              className="flex gap-2 border-b border-border py-4"
              onSubmit={(event) => {
                event.preventDefault()
                void handleSearch()
              }}
            >
              <Input
                ref={searchInputRef}
                placeholder="Search dashboard pages, datasets, reports, and FAQ..."
                className="h-11 flex-1 text-base"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button type="submit" className="h-11 gap-2" disabled={!query.trim() || isSearching}>
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{isSearching ? "Searching" : "Search"}</span>
              </Button>
            </form>

            <div className="min-h-0 flex-1 overflow-y-auto py-4">
              {results.length > 0 ? (
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {results.map((result) => (
                    <Link
                      key={result.id}
                      href={result.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-4 p-4 text-left transition hover:bg-accent"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="rounded-md border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
                            {result.type}
                          </span>
                          <span className="truncate font-medium text-foreground">{result.title}</span>
                        </span>
                        {result.description && (
                          <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                            {result.description}
                          </span>
                        )}
                      </span>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              ) : hasSearched ? (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
                  <FileQuestion className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium text-foreground">No results found for "{query}".</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try a dashboard page, dataset name, report topic, or FAQ question.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                    Search dashboard pages, datasets, reports, support tickets, and FAQ answers. Operator-only results only appear for super-admin accounts.
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {quickLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted"
                      >
                        <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>
                          <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
