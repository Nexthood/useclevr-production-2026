"use client"

import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Button } from "@/components/ui/button"
import { allFaqCategories } from "@/lib/content/faq"
import { ChevronDown, HelpCircle } from "lucide-react"
import * as React from "react"

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIdx === i
        let answer: React.ReactNode = item.a
        if (typeof answer === "string") {
          answer = (
            <span dangerouslySetInnerHTML={{
              __html: answer
                .replace(/(€[\d,]+(?:\/month| per month| annually)?)/g, '<strong>$1</strong>')
                .replace(/(\d+-\d+ \w+)/g, '<strong>$1</strong>')
            }} />
          )
        }
        return (
          <div key={i} className="rounded-lg border border-border bg-background overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
            >
              <span className="text-sm font-medium text-foreground">{item.q}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
                {answer}
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
      <main className="flex-1 py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/50 bg-primary/10 text-sm text-primary mb-4">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently asked questions</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Everything you need to know about UseClevr, from setup to billing and beyond.
            </p>
          </div>

          {allFaqCategories.map((section) => (
            <div key={section.category} className="mb-12">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {section.category}
              </h2>
              <FaqAccordion items={section.items} />
            </div>
          ))}

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Can&apos;t find the answer you&apos;re looking for?
            </p>
            <a href="mailto:support@useclevr.com">
              <Button variant="outline" className="gap-2 bg-transparent">
                Contact support
              </Button>
            </a>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
