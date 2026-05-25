"use client"

import { CreditCard, Settings, TrendingUp } from "lucide-react"
import Link from "next/link"
import * as React from "react"

interface CreditPanelProps {
  remainingCredits: string
  totalCredits: number
}

export function CreditPanel({ remainingCredits, totalCredits }: CreditPanelProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
        title="Credits and subscription"
      >
        <CreditCard className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span>Credit</span>
        <span className="text-muted-foreground">{remainingCredits} / {totalCredits}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-300 bg-white py-2 shadow-lg dark:border-slate-700 dark:bg-slate-950">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {remainingCredits} of {totalCredits} credits remaining
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade for unlimited analysis
              </p>
            </div>
            <div className="py-1">
              <Link
                href="/app/settings/subscription"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-sm text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
              >
                <TrendingUp className="h-4 w-4 text-primary" />
                Upgrade plan
              </Link>
              <Link
                href="/app/settings/billing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-sm text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
              >
                <Settings className="h-4 w-4" />
                Billing settings
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
