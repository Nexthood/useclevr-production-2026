"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { CreditCard, Sparkles, Store } from "lucide-react"
import Link from "next/link"

type UpgradeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan: string
  currentCount: number
  limit: number
}

export function UpgradeModal({ open, onOpenChange, currentPlan, currentCount, limit }: UpgradeModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Dataset Limit Reached" description={`Your current plan allows up to ${limit} datasets. You currently have ${currentCount} datasets.`}>
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Current plan: {currentPlan}</p>
              <p className="text-xs text-muted-foreground">
                {currentCount} of {limit} datasets used
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Pro</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">25 datasets, Hybrid AI Lite, priority processing, and downloads.</p>
            <Link href="/app/settings/checkout?plan=pro_monthly&discount=auto" className="block">
              <Button size="sm" className="w-full" onClick={() => onOpenChange(false)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </Button>
            </Link>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Business</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Unlimited datasets, advanced security, private deployment, and dedicated support.</p>
            <Link href="/app/settings/checkout?plan=business_monthly" className="block">
              <Button size="sm" variant="outline" className="w-full bg-transparent" onClick={() => onOpenChange(false)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Upgrade to Business
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
