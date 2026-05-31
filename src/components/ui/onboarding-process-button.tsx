"use client"

import { Modal } from "@/components/ui/modal"
import type { OnboardingStatus, OnboardingStep } from "@/lib/onboarding/status"
import {
  BarChart3,
  Building2,
  CheckCircle2,
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

const AUTO_SHOWN_KEY = "useclevr_progress_auto_shown"

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
        const alreadyShown = typeof window !== "undefined" && localStorage.getItem(AUTO_SHOWN_KEY)
        if (payload.autoOpen && !alreadyShown) {
          localStorage.setItem(AUTO_SHOWN_KEY, "true")
          setOpen(true)
        }
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
   const completionPercent = status?.completionPercent ?? 0
   const completedCount = status?.completedCount ?? 0
   const totalCount = status?.totalCount ?? steps.length

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
         <span className="hidden sm:inline">{completionPercent}%</span>
         {completionPercent > 0 && totalCount > 0 && (
           <>
             <span className="hidden sm:inline"> • </span>
             <span className="hidden sm:inline">{completedCount}/{totalCount} steps</span>
           </>
         )}
       </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Setup progress"
         description={
           status
             ? `${status.completedCount} of ${status.totalCount} setup steps complete`
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
               Progress includes completing profile setup, business profile, uploading data, running analysis, and visiting key dashboard pages.
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
        </div>
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
      className="rounded-lg border border-border bg-background p-4 transition hover:border-primary/40 hover:bg-muted"
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
