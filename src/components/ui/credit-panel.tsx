"use client"

import { CreditCard, Settings, TrendingUp } from "lucide-react"
import Link from "next/link"
import * as React from "react"

interface CreditPanelProps {
  includedBalance: number
  purchasedBalance: number
  totalAvailable: number
  planId: string
}

export function CreditPanel({ includedBalance, purchasedBalance, totalAvailable, planId }: CreditPanelProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary/80"
        title="Credits and subscription"
      >
        <CreditCard className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span>Credits</span>
        <span className="text-muted-foreground">{totalAvailable.toLocaleString()}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-popover py-3 text-popover-foreground shadow-lg">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {includedBalance.toLocaleString()} included
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {purchasedBalance.toLocaleString()} purchased
              </p>
              <p className="text-xs text-muted-foreground">
                {totalAvailable.toLocaleString()} total available
              </p>
            </div>
            <div className="py-1">
              <Link
                href="/app/settings/subscription?tab=billing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <TrendingUp className="h-4 w-4 text-primary" />
                Upgrade plan
              </Link>
              <Link
                href="/app/settings/billing/usage"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                Billing & usage
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
