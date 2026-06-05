"use client"

import { ChevronDown } from "lucide-react"
import * as React from "react"

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIdx === i
        return (
          <div key={i} className="overflow-hidden rounded-lg border border-border bg-background">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
            >
              <span className="text-sm font-medium text-foreground">{item.q}</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div className="border-t border-border/40 px-6 pb-5 pt-4 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
