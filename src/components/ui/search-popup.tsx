"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SearchIcon, Send } from "lucide-react"
import { useState } from "react"

export function Search() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<{ id: string; type: string; title: string }>>([])
  const [isSearching, setIsSearching] = useState(false)

  async function handleSearch() {
    if (!query.trim() || isSearching) return
    setIsSearching(true)
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
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="h-9 w-9 px-0"
      >
        <SearchIcon className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[80vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4 flex gap-2">
            <Input
              placeholder="Search datasets, reports, business data..."
              className="h-10 flex-1"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleSearch()
                }
              }}
            />
            <Button type="button" size="icon" onClick={handleSearch} disabled={!query.trim() || isSearching} aria-label="Submit search">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {results.length > 0 ? (
              <div className="space-y-2">
                {results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      // Navigate to result
                      window.location.href = `/app/${result.type}s/${result.id}`
                    }}
                    className="w-full rounded-md border border-border p-3 text-left text-sm transition hover:bg-accent"
                  >
                    <p className="font-medium">{result.title}</p>
                    <p className="text-xs text-muted-foreground">{result.type}</p>
                  </button>
                ))}
              </div>
            ) : query ? (
              <p className="text-sm text-muted-foreground">No results found for "{query}".</p>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a search query to find datasets, reports, or business data.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}