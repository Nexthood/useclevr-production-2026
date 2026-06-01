"use client"

import { MegaInstallerModal } from "@/components/modals/mega-installer-modal"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import type { HybridAiCreditCosts } from "@/lib/billing/settings-store"
import { Brain, Check, Download } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { billingPlans } from "@/lib/billing/plans"

const proPlan = billingPlans.find(p => p.id === "pro_monthly")!;
const businessPlan = billingPlans.find(p => p.id === "business_monthly")!;

export default function HybridAiButton({
  subscriptionTier = "free",
  hybridAiCreditCosts = { lite: 5, standard: 12, mega: 35 },
  mode = "button",
  className = "",
}: {
  subscriptionTier?: string
  hybridAiCreditCosts?: HybridAiCreditCosts
  mode?: "button" | "link"
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [installerOpen, setInstallerOpen] = React.useState(false)
  const hasLocalAiAccess = subscriptionTier === "pro" || subscriptionTier === "business" || subscriptionTier === "superadmin"
  const hybridTiers =
    subscriptionTier === "superadmin"
      ? (["lite", "mega"] as const)
      : subscriptionTier === "business"
        ? (["mega"] as const)
        : (["lite"] as const)
  const defaultTier = subscriptionTier === "business" ? "mega" : "lite"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          [
            mode === "link"
              ? "inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary/80"
              : "inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          ].filter(Boolean).join(" ")
        }
      >
        <Brain className="h-3.5 w-3.5" />
        Hybrid AI
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Hybrid AI"
        description="Cloud analysis with optional local AI for sensitive datasets."
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              Included workflow
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <HybridPoint title="Verified metrics" description="Deterministic calculations stay the source of truth." />
              <HybridPoint title="Cloud explanation" description="Gemini explains results when cloud AI is enabled." />
              <HybridPoint title="Local privacy mode" description="Run supported local models for private analysis." />
              <HybridPoint title="Offline-ready setup" description={`Lite uses ${hybridAiCreditCosts.lite} credits; MEGA uses ${hybridAiCreditCosts.mega}.`} />
            </div>
          </div>

          {hasLocalAiAccess ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">
                Local AI access is included in your plan.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {subscriptionTier === "business"
                  ? "Download or verify Hybrid AI MEGA for private business analysis."
                  : subscriptionTier === "superadmin"
                    ? "Download or verify Hybrid AI Lite and MEGA for testing."
                    : "Download or verify Hybrid AI Lite for offline use."}
              </p>
              <Button
                className="mt-5 w-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                onClick={() => {
                  setOpen(false)
                  setInstallerOpen(true)
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Local AI
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
               <PlanOption
                 title="Pro"
                 price={`€${proPlan.price}/month`}
                 description="Includes Hybrid AI Lite, unlimited datasets, and report downloads."
                 productId="pro_monthly"
                 onNavigate={() => setOpen(false)}
               />
               <PlanOption
                 title="Business"
                 price={`€${businessPlan.price}/month`}
                 description="Includes Hybrid AI MEGA, higher volume, advanced security, and dedicated support."
                 productId="business_monthly"
                 secondary
                 onNavigate={() => setOpen(false)}
               />
            </div>
          )}
        </div>
      </Modal>

      <MegaInstallerModal open={installerOpen} onOpenChange={setInstallerOpen} preselectTier={defaultTier} allowedTiers={[...hybridTiers]} />
    </>
  )
}

function HybridPoint({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function PlanOption({
  title,
  price,
  description,
  productId,
  secondary = false,
  onNavigate,
}: {
  title: string
  price: string
  description: string
  productId: string
  secondary?: boolean
  onNavigate?: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold">{price}</p>
      </div>
      <Link href={`/app/settings/checkout?plan=${productId}`} className="block" onClick={onNavigate}>
        <Button
          size="sm"
          variant={secondary ? "outline" : "default"}
          className={secondary ? "mt-4 w-full bg-transparent" : "mt-4 w-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"}
        >
          Review plan
        </Button>
      </Link>
    </div>
  )
}
