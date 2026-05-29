"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "lucide-react"
import { useState } from "react"

export function Search() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

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
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search datasets, reports, business data..."
            className="h-10"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex-1 overflow-y-auto mt-4">
            <p className="text-sm text-muted-foreground">
              Search functionality coming soon. Query: "{query}"
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}