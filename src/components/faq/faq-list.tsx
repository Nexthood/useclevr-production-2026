"use client"

import { Button } from "@/components/ui/button"
import type { FaqCategory } from "@/lib/content/faq"
import { useMemo, useState } from "react"

export function FaqList({
  categories,
  showFilter = false,
  initialCategory = "All",
}: {
  categories: FaqCategory[]
  showFilter?: boolean
  initialCategory?: string
}) {
  const categoryLabels = useMemo(() => ["All", ...categories.map((category) => category.category)], [categories])
  const [selectedCategory, setSelectedCategory] = useState(
    categoryLabels.includes(initialCategory) ? initialCategory : "All",
  )
  const visibleCategories =
    selectedCategory === "All"
      ? categories
      : categories.filter((category) => category.category === selectedCategory)

  return (
    <div className="space-y-6">
      {showFilter && (
        <div className="flex flex-wrap gap-2">
          {categoryLabels.map((category) => (
            <Button
              key={category}
              type="button"
              size="sm"
              variant={selectedCategory === category ? "default" : "outline"}
              className={selectedCategory === category ? "" : "bg-transparent"}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      )}

      {visibleCategories.map((category) => (
        <section key={category.category} className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {category.category}
          </h2>
          <div className="grid gap-3">
            {category.items.map((item) => (
              <details
                key={item.q}
                className="rounded-lg border border-border bg-card px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
