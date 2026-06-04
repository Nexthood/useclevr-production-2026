"use client"

import { Modal } from "@/components/ui/modal"
import type { OnboardingStatus, OnboardingStep } from "@/lib/onboarding/status"
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Map,
  PlayCircle,
  Upload,
  User,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"

const iconByStepId: Record<string, React.ComponentType<{ className?: string }>> = {
  "profile-completed": User,
  "business-profile-completed": Building2,
  "dataset-uploaded": Upload,
  "dataset-analyzed": BarChart3,
  "pages-visited": Map,
}

const sectionOrder = ["Account", "Data", "Tour"]
const sectionLabels: Record<string, string> = {
  Account: "Account setup",
  Data: "Data workflow",
  Tour: "Guided tour",
}

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
         className="inline-flex h-full items-center gap-2 whitespace-nowrap border-l border-border/50 px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50 active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
         title="Open setup progress"
         aria-label={`Setup progress ${completionPercent}% complete`}
       >
         {completionPercent === 100 ? (
           <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
         ) : (
           <PlayCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
         )}
         <span className="hidden lg:inline">{completionPercent === 100 ? "Setup complete" : "Setup"}</span>
         <span className="hidden text-sm font-medium lg:inline">{completionPercent}%</span>
         {completionPercent > 0 && completionPercent < 100 && totalCount > 0 && (
           <>
             <span className="hidden text-muted-foreground/50 lg:inline">&bull;</span>
             <span className="hidden text-xs text-muted-foreground lg:inline">{completedCount}/{totalCount}</span>
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
        <div className="mx-auto max-w-lg space-y-6">
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
             <p className="mt-2 text-sm text-muted-foreground">
               Complete your account, upload data, and explore the dashboard.
             </p>
          </div>

          {!status ? (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : (
            <div className="space-y-6">
              {sectionOrder.map((section) => {
                const sectionSteps = steps.filter((s) => (s.section ?? s.group) === section)
                if (sectionSteps.length === 0) return null
                const done = sectionSteps.filter((s) => s.complete).length
                return (
                  <SectionBlock
                    key={section}
                    label={sectionLabels[section] ?? section}
                    total={sectionSteps.length}
                    done={done}
                    steps={sectionSteps}
                    onNavigate={() => setOpen(false)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

function SectionBlock({
  label,
  total,
  done,
  steps,
  onNavigate,
}: {
  label: string
  total: number
  done: number
  steps: OnboardingStep[]
  onNavigate: () => void
}) {
  const allDone = done === total
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {allDone ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
        ) : (
          <PlayCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground">{done}/{total}</span>
      </div>
      <div className="space-y-1">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  )
}

function StepRow({ step, onNavigate }: { step: OnboardingStep; onNavigate: () => void }) {
  const Icon = iconByStepId[step.id] ?? Map
  return (
    <Link
      href={step.href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-muted"
    >
      {step.complete ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
      ) : (
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className={step.complete ? "text-muted-foreground" : "text-foreground"}>
        {step.title}
      </span>
      {!step.complete && (
        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </Link>
  )
}
