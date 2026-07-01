"use client"

import { MegaInstallerModal } from "@/components/modals/mega-installer-modal"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { billingPlans } from "@/lib/billing/plans"
import type { HybridAiCreditCosts } from "@/lib/billing/settings-store"
import { getHybridAiEntitlement, HYBRID_AI_MODULES } from "@/lib/hybrid-ai/features"
import { Brain, Check, PlugZap } from "lucide-react"
import Link from "next/link"
import * as React from "react"

const proPlan = billingPlans.find((plan) => plan.id === "pro_monthly")!
const businessPlan = billingPlans.find((plan) => plan.id === "business_monthly")!

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
  const entitlement = React.useMemo(() => getHybridAiEntitlement(subscriptionTier), [subscriptionTier])
  const hasLocalAiAccess = entitlement.canDownload
  const hybridTiers =
    entitlement.accessTier === "mega"
      ? (["lite", "mega"] as const)
      : (["lite"] as const)
  const defaultTier = subscriptionTier === "business" ? "mega" : "lite"
  const liteModules = HYBRID_AI_MODULES.filter((module) => module.tier === "lite")
  const megaModules = HYBRID_AI_MODULES.filter((module) => module.tier === "mega")

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
        UseClevr Hybrid AI
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="UseClevr Hybrid AI"
        description="Phase 1 connects your existing AI provider. Phase 2 adds the UseClevr Helper."
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              Hybrid AI workflow
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <HybridPoint title="Verified metrics" description="Deterministic calculations stay the source of truth." />
              <HybridPoint title="Connect Existing AI" description="Use Ollama, LM Studio, vLLM, or an OpenAI-compatible endpoint." />
              <HybridPoint title="Provider fallback" description="UseClevr can route to another enabled provider if the default is unavailable." />
              <HybridPoint title="Plan access" description={`Lite uses ${hybridAiCreditCosts.lite} credits; MEGA uses ${hybridAiCreditCosts.mega}.`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ModuleGroup title="Hybrid AI Lite" modules={liteModules.map((module) => module.name)} />
              <ModuleGroup title="Hybrid AI MEGA" modules={megaModules.slice(0, 6).map((module) => module.name)} />
            </div>
          </div>

          {hasLocalAiAccess ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">
                Recommended: connect your AI provider
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                BYOAI is available now for Hybrid AI. UseClevr Helper downloads are Phase 2 and marked coming soon.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Configure Ollama, LM Studio, vLLM, or another compatible provider in Settings.
              </p>
              <Link
                href="/app/settings/ai-providers"
                onClick={() => setOpen(false)}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-slate-950 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <PlugZap className="mr-2 h-4 w-4" />
                Connect AI Provider
              </Link>
              <Button
                variant="outline"
                className="mt-2 w-full bg-transparent"
                onClick={() => {
                  setOpen(false)
                  setInstallerOpen(true)
                }}
              >
                View Helper roadmap
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <PlanOption
                title="Pro"
                price={`€${proPlan.price}/month`}
                description="Includes UseClevr Hybrid AI Lite, unlimited datasets, and report downloads."
                productId="pro_monthly"
                onNavigate={() => setOpen(false)}
              />
              <PlanOption
                title="Business"
                price={`€${businessPlan.price}/month`}
                description="Includes UseClevr Hybrid AI MEGA, higher volume, advanced security, and dedicated support."
                productId="business_monthly"
                secondary
                onNavigate={() => setOpen(false)}
              />
            </div>
          )}
        </div>
      </Modal>

      <MegaInstallerModal
        open={installerOpen}
        onOpenChange={setInstallerOpen}
        preselectTier={defaultTier}
        allowedTiers={[...hybridTiers]}
        subscriptionTier={subscriptionTier}
      />
    </>
  )
}

function ModuleGroup({ title, modules }: { title: string; modules: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {modules.map((module) => (
          <span key={module} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
            {module}
          </span>
        ))}
      </div>
    </div>
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
