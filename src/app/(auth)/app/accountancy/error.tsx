"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BookOpenCheck } from "lucide-react"
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
              <h2 className="text-2xl font-semibold text-foreground">Accountancy workspace</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Accountancy is the financial overview hub: accounting datasets, tax context, monthly reporting, and
                compliance tools. Uploads stay in the Pre-bookkeeping workspace.
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
              Upload accounting CSV, Excel, or PDF files in the Pre-bookkeeping workspace; saved accounting datasets
              return here for financial review.
            </p>
          </div>
          <Link
            href="/app/prebookkeeping"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Open Pre-bookkeeping
          </Link>
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
