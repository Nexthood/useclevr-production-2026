"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import type { OnboardingStatus, OnboardingStep } from "@/lib/onboarding/status"
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Loader2,
  Map,
  PlayCircle,
  Upload,
  User,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"

const iconByStepId = {
  "profile-name": User,
  "profile-email": User,
  "business-name": Building2,
  "business-email": Building2,
  "business-industry": Building2,
  "business-location": Building2,
  "business-website": Building2,
  "business-description": Building2,
  "dataset-uploaded": Upload,
  "dataset-analyzed": BarChart3,
} as const

export function OnboardingProcessButton() {
  const [open, setOpen] = React.useState(false)
  const [tourOpen, setTourOpen] = React.useState(false)
  const [tourIndex, setTourIndex] = React.useState(0)
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

  const steps = status?.steps ?? []
  const incompleteSteps = steps.filter((step) => !step.complete)
  const activeTourStep = incompleteSteps[tourIndex] ?? incompleteSteps[0]
  const completionPercent = status?.completionPercent ?? 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 dark:text-cyan-100"
        title="Open setup progress"
      >
        <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Setup</span>
        <span>{completionPercent}%</span>
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Setup progress"
        description={
          status
            ? `${status.completedCount} of ${status.totalCount} items complete`
            : "Follow the main workflow from setup to analysis."
        }
        variant="fullscreen"
      >
        <div className="space-y-6">
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Progress includes filled profile fields, business profile fields, first data actions, and key dashboard pages visited at least once.
            </p>
          </div>

          {!status ? (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <ProgressSummary title="Profile" steps={steps.filter((step) => step.group === "Profile")} />
                <ProgressSummary title="Business" steps={steps.filter((step) => step.group === "Business profile")} />
                <ProgressSummary title="Workflow" steps={steps.filter((step) => step.group !== "Profile" && step.group !== "Business profile")} />
              </div>

              {incompleteSteps.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/35 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Map className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Tour guide</p>
                        <p className="text-sm text-muted-foreground">
                          Walk through the missing setup items one page at a time.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setTourIndex(0)
                        setTourOpen(true)
                      }}
                    >
                      Start tour
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                {steps.map((step, index) => (
                  <OnboardingStepCard
                    key={step.id}
                    step={step}
                    index={index}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
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

      <Modal
        open={tourOpen}
        onOpenChange={setTourOpen}
        title="Setup tour"
        description={
          activeTourStep
            ? `${tourIndex + 1} of ${incompleteSteps.length}: ${activeTourStep.group ?? "Setup"}`
            : "All setup items are complete."
        }
      >
        {activeTourStep ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/35 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{activeTourStep.group ?? "Setup"}</p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">{activeTourStep.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeTourStep.description}</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={tourIndex === 0}
                  onClick={() => setTourIndex((value) => Math.max(0, value - 1))}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={tourIndex >= incompleteSteps.length - 1}
                  onClick={() => setTourIndex((value) => Math.min(incompleteSteps.length - 1, value + 1))}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <Link
                href={activeTourStep.href}
                onClick={() => {
                  setTourOpen(false)
                  setOpen(false)
                }}
              >
                <Button size="sm" className="w-full sm:w-auto">
                  Open page
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">All setup items are complete.</p>
        )}
      </Modal>
    </>
  )
}

function ProgressSummary({ title, steps }: { title: string; steps: OnboardingStep[] }) {
  const complete = steps.filter((step) => step.complete).length
  const total = steps.length
  const percent = total > 0 ? Math.round((complete / total) * 100) : 0

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-primary">{percent}%</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {complete} of {total} complete
      </p>
    </div>
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
  const Icon = iconByStepId[step.id as keyof typeof iconByStepId] ?? Map

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
          {step.group && <p className="mt-1 text-xs font-medium text-primary">{step.group}</p>}
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
