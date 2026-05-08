"use client"

import { Brain, X } from "lucide-react"
import * as React from "react"
import { createPortal } from "react-dom"

export function HybridAiButton() {
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Brain className="h-3.5 w-3.5" />
        Hybrid AI
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex flex-col bg-background text-foreground animate-in fade-in duration-200"
              role="dialog"
              aria-modal="true"
              aria-labelledby="hybrid-ai-title"
            >
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 id="hybrid-ai-title" className="text-page-title tracking-tighter">
                  Hybrid AI Intelligence
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Close Hybrid AI"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <div className="mx-auto max-w-3xl space-y-6">
                  <p className="text-body-lg text-muted-foreground">
                    Hybrid AI combines deterministic metrics with generative explanation layer.
                  </p>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Cloud Mode</h3>
                      <div className="space-y-3">
                        <HybridPoint
                          tone="green"
                          title="Fast Processing"
                          description="Leverage powerful cloud infrastructure for quick analysis"
                        />
                        <HybridPoint
                          tone="green"
                          title="Always Available"
                          description="24/7 access to AI capabilities"
                        />
                        <HybridPoint
                          tone="green"
                          title="Advanced Features"
                          description="Access to latest AI models and features"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Local Mode</h3>
                      <div className="space-y-3">
                        <HybridPoint
                          tone="blue"
                          title="Data Privacy"
                          description="Your data never leaves your device"
                        />
                        <HybridPoint
                          tone="blue"
                          title="Offline Capable"
                          description="Work without internet connection"
                        />
                        <HybridPoint
                          tone="blue"
                          title="Custom Models"
                          description="Fine-tune AI for your specific needs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-4">
                    <h4 className="mb-2 text-sm font-semibold">How It Works</h4>
                    <p className="text-sm text-muted-foreground">
                      UseClevr intelligently switches between cloud and local AI based on your data
                      sensitivity, connection status, and processing requirements. You get powerful
                      cloud processing when you need it, and complete data privacy when required.
                    </p>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function HybridPoint({
  tone,
  title,
  description,
}: {
  tone: "green" | "blue"
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={[
          "mt-2 h-2 w-2 flex-shrink-0 rounded-full",
          tone === "green" ? "bg-green-500" : "bg-blue-500",
        ].join(" ")}
      />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
