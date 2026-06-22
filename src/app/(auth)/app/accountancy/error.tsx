"use client"

import { Button } from "@/components/ui/button"
import { Calculator } from "lucide-react"
import Link from "next/link"

export default function AccountancyError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center p-5">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
          <Calculator className="h-6 w-6 text-red-500" />
        </div>
        <h1 className="mb-2 text-xl font-bold">Accountancy workspace unavailable</h1>
        <p className="mb-6 text-muted-foreground">
          We couldn&apos;t load this page. Try returning to the Pre-Bookkeeping Center.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset} variant="outline">
            Retry
          </Button>
          <Link href="/app/accountancy">
            <Button>Go to Pre-Bookkeeping Center</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}