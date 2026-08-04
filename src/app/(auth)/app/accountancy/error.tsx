"use client"

import { AccountancyUpload } from "@/components/accountancy/accountancy-upload"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BookOpenCheck, Receipt } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

export default function AccountancyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[ACCOUNTANCY] Page render failed.", error)
  }, [error])

  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center p-5">
      <div className="w-full max-w-2xl">
        <Card className="border-primary/30 bg-primary/5 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <BookOpenCheck className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">Pre-bookkeeping center</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload receipts, invoices, bank exports, PDFs, Excel, or CSV files. We extract, categorize, and generate a
                bookkeeping summary ready for your accountant.
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card p-5 mt-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Business Profile context</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bookkeeping uses saved setup values for tax country, currency, fiscal year, VAT/sales tax, payroll, and
              fixed-cost assumptions.
            </p>
          </div>
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load Accountancy. Retry the page and check the server logs for the saved error details.
          </div>
          <Button type="button" variant="outline" className="mt-4" onClick={reset}>
            Retry
          </Button>
        </Card>

        <Card className="border-border bg-card p-5 mt-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Upload documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add receipts, invoices, bank exports, or accounting documents for pre-bookkeeping insights.
            </p>
          </div>
          <AccountancyUpload />
        </Card>

        <Card id="bookkeeping-package" className="border-border bg-card p-5 mt-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Bookkeeping package</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add accountant details, confirm the tax period from your Business Profile, export the package, or prepare
              an email handoff.
            </p>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Accountant email</span>
                <input
                  type="email"
                  placeholder="accountant@example.com"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Company name</span>
                <input
                  type="text"
                  placeholder="Company name"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Tax period</span>
                <input
                  type="text"
                  placeholder="2026 Q2 or FY 2026"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Notes/message</span>
              <textarea
                placeholder="Add questions, missing documents, or accountant instructions."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" className="gap-2">
                <Receipt className="h-4 w-4" />
                Generate bookkeeping package
              </Button>
              <Button type="button" variant="outline" className="gap-2 bg-transparent" disabled>
                PDF report
              </Button>
              <Button type="button" variant="outline" className="gap-2 bg-transparent" disabled>
                Excel file
              </Button>
              <Button type="button" variant="outline" className="gap-2 bg-transparent" disabled>
                CSV file
              </Button>
              <Button type="button" variant="secondary" className="gap-2" disabled>
                Send to accountant
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Upload documents first to generate the bookkeeping package for export and accountant email handoff.
            </p>
          </div>
        </Card>

        <div className="mt-5 text-center">
          <Link href="/app/accountancy" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            Return to Accountancy
          </Link>
        </div>
      </div>
    </div>
  )
}
