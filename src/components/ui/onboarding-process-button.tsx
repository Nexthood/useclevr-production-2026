"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import type { OnboardingStatus, OnboardingStep } from "@/lib/onboarding/status"
import { BarChart3, Building2, CheckCircle2, HelpCircle, Loader2, PlayCircle, Upload, User } from "lucide-react"
import Link from "next/link"
import * as React from "react"

const iconByStepId = {
  profile: User,
  business: Building2,
  upload: Upload,
  analysis: BarChart3,
} as const

export function OnboardingProcessButton() {
  const [open, setOpen] = React.useState(false)
  const [status, setStatus] = React.useState<OnboardingStatus | null>(null)
  const seenRecordedRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/onboarding", { cache: "no-store" })
        if (!response.ok) return
        const payload = (await response.json()) as OnboardingStatus
        if (cancelled) return
        setStatus(payload)
        if (payload.autoOpen) setOpen(true)
      } catch {
        if (!cancelled) setStatus(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!open || seenRecordedRef.current) return
    seenRecordedRef.current = true
    fetch("/api/onboarding", { method: "POST" }).catch(() => undefined)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 dark:text-cyan-100"
        title="Open onboarding process"
      >
        <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Process</span>
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="UseClevr process"
        description={status ? `${status.completionPercent}% complete` : "Follow the main workflow from setup to analysis."}
        variant="fullscreen"
      >
        <div className="space-y-6">
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${status?.completionPercent ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete the setup panels once, then return here any time from the topbar.
            </p>
          </div>

          {!status ? (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {status.steps.map((step, index) => (
                <OnboardingStepCard
                  key={step.id}
                  step={step}
                  index={index}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/35 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <HelpCircle className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">Need help while processing?</p>
                <p className="text-sm text-muted-foreground">
                  Open the dashboard FAQ or create a support ticket from the Help menu.
                </p>
              </div>
            </div>
            <Link href="/app/faq" onClick={() => setOpen(false)}>
              <Button variant="outline" size="sm" className="w-full bg-transparent sm:w-auto">
                Open FAQ
              </Button>
            </Link>
          </div>
        </div>
      </Modal>
    </>
  )
}

function OnboardingStepCard({
  step,
  index,
  onNavigate,
}: {
  step: OnboardingStep
  index: number
  onNavigate: () => void
}) {
  const Icon = iconByStepId[step.id as keyof typeof iconByStepId] ?? PlayCircle

  return (
    <Link
      href={step.href}
      onClick={onNavigate}
      className="rounded-lg border border-border bg-background p-4 transition hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {step.complete ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Icon className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">Step {index + 1}</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">{step.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>
          <p className="mt-3 text-xs font-semibold text-primary">
            {step.complete ? "Completed" : "Open setup"}
          </p>
        </div>
      </div>
    </Link>
  )
}
