"use client"

import { Button } from "@/components/ui/button"
import { debugError } from "@/lib/utils/debug"
import { FileText, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

export function GenerateReportAction({
  datasetId,
  disabled = false,
  label = "Generate Report",
  variant = "default",
  className = "",
}: {
  datasetId: string
  disabled?: boolean
  label?: string
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  className?: string
}) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idempotencyKeyRef = useRef(`dashboard-report:${datasetId}:${createClientId()}`)

  async function handleGenerateReport() {
    if (isGenerating || disabled) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({ datasetId, idempotencyKey: idempotencyKeyRef.current }),
      })
      const rawBody = await response.text()
      let result: Record<string, unknown> = {}

      try {
        result = rawBody ? JSON.parse(rawBody) : {}
      } catch {
        result = {}
      }

      if (!response.ok || result.success !== true) {
        const message = typeof result.error === "string"
          ? result.error
          : typeof result.message === "string"
            ? result.message
            : "Report generation failed."
        throw new Error(getSafeReportErrorMessage(message))
      }

      const reportId = typeof result.reportId === "string" ? result.reportId : null
      const redirectUrl = typeof result.redirectUrl === "string" ? result.redirectUrl : "/app/downloads"

      if (reportId) {
        sessionStorage.setItem("lastGeneratedReportId", reportId)
      }

      router.push(redirectUrl)
      router.refresh()
    } catch (generationError) {
      debugError("[Dashboard] Report generation failed:", generationError)
      setError(generationError instanceof Error ? generationError.message : "Report generation failed.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
      <Button
        type="button"
        variant={variant}
        className={["shrink-0 whitespace-nowrap", className].filter(Boolean).join(" ")}
        disabled={disabled || isGenerating}
        onClick={handleGenerateReport}
        aria-busy={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        {isGenerating ? "Generating..." : label}
      </Button>
      {error && (
        <p className="max-w-xs text-right text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

function getSafeReportErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  const exposesDatabaseDetails =
    normalized.includes("failed query") ||
    normalized.includes("insert into") ||
    normalized.includes("aicostlog") ||
    normalized.includes("sql") ||
    normalized.includes("parameters:")

  return exposesDatabaseDetails ? "Failed to generate report" : message
}

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
