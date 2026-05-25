"use client"

import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { Button } from "@/components/ui/button"
import { allFaqCategories } from "@/lib/content/faq"
import { ChevronDown, HelpCircle } from "lucide-react"
import * as React from "react"

const highlightSplitPattern = /(€[\d,]+(?:\/month| per month| annually)?|\d+-\d+ \w+)/g
const highlightExactPattern = /^(€[\d,]+(?:\/month| per month| annually)?|\d+-\d+ \w+)$/

function renderHighlightedAnswer(answer: string) {
  const parts = answer.split(highlightSplitPattern)

  return parts.map((part, index) => {
    if (!part) return null

    if (highlightExactPattern.test(part)) {
      return <strong key={`${part}-${index}`}>{part}</strong>
    }

    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
  })
}

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIdx === i

        return (
          <div key={i} className="rounded-lg border border-border bg-background overflow-hidden">
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
              <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
                {renderHighlightedAnswer(item.a)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">
        <PublicPageHeader
          eyebrow={
            <>
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
            </>
          }
          title="Frequently asked questions"
          description="Everything you need to know about UseClevr, from setup to billing and beyond."
        />
        <section className="py-12">
          <div className="container mx-auto max-w-3xl px-4">
            {allFaqCategories.map((section) => (
              <div key={section.category} className="mb-12">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {section.category}
                </h2>
                <FaqAccordion items={section.items} />
              </div>
            ))}

            <div className="mt-12 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                Can&apos;t find the answer you&apos;re looking for?
              </p>
              <a href="mailto:support@useclevr.com">
                <Button variant="outline" className="gap-2 bg-transparent">
                  Contact support
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
