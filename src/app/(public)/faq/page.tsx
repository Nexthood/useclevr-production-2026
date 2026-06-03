"use client"

import { FaqList } from "@/components/faq/faq-list"
import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { Button } from "@/components/ui/button"
import { allFaqCategories } from "@/lib/content/faq"
import { HelpCircle } from "lucide-react"
import * as React from "react"

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
            <FaqList categories={allFaqCategories} showFilter={false} initialCategory="All" />

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
