"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import type { OnboardingStatus } from "@/lib/onboarding/status"
import {
  ChevronLeft,
  ChevronRight,
  Map,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"

export function TourGuideButton() {
  const [tourOpen, setTourOpen] = React.useState(false)
  const [tourIndex, setTourIndex] = React.useState(0)
  const [status, setStatus] = React.useState<OnboardingStatus | null>(null)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/onboarding", { cache: "no-store" })
        if (!response.ok) return
        const payload = (await response.json()) as OnboardingStatus
        if (cancelled) return
        setStatus(payload)
      } catch {
        if (!cancelled) setStatus(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const steps = status?.steps ?? []
  const incompleteSteps = steps.filter((step) => !step.complete)
  const activeTourStep = incompleteSteps[tourIndex] ?? incompleteSteps[0]

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTourIndex(0)
          setTourOpen(true)
        }}
        className="inline-flex items-center justify-center rounded-md p-2 text-sm font-medium text-foreground/70 transition hover:bg-accent hover:text-foreground"
        title="Tour guide"
        aria-label="Open tour guide"
      >
        <Map className="h-4 w-4" aria-hidden="true" />
      </button>

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
                onClick={() => setTourOpen(false)}
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