"use client"

import { Button } from "@/components/ui/button"
import { Download, FileText, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type GenerateReportActionProps = {
  datasetId: string
}

type ReportResult = {
  reportId: string
  status: string
  redirectUrl: string
  previewUrl: string
  downloadUrl: string
  excelDownloadUrl?: string
  downloadsUrl: string
}

export function GenerateReportAction({ datasetId }: GenerateReportActionProps) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<ReportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generateReport() {
    if (isGenerating) return
    setIsGenerating(true)
    setError(null)

    try {
      const idempotencyKey = `report:${datasetId}`
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ datasetId, idempotencyKey }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.success) {
        throw new Error(body.error || "Report generation failed.")
      }
      const redirectUrl = body.redirectUrl || body.previewUrl || `/report/${body.reportId}`
      setResult({
        reportId: body.reportId,
        status: body.status || "ready",
        redirectUrl,
        previewUrl: body.previewUrl || `/report/${body.reportId}`,
        downloadUrl: body.downloadUrl || `/api/reports/download?id=${body.reportId}&format=pdf`,
        excelDownloadUrl: body.excelDownloadUrl,
        downloadsUrl: body.downloadsUrl || "/app/downloads",
      })
      router.push(redirectUrl)
      router.refresh()
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Report generation failed.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={generateReport} disabled={isGenerating} className="gap-2">
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {isGenerating ? "Generating..." : "Generate Report"}
      </Button>
      {result && (
        <>
          <Link href={result.redirectUrl}>
            <Button type="button" variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Report preview
            </Button>
          </Link>
          <Link href={result.downloadUrl}>
            <Button type="button" variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </Link>
          <Link href={result.downloadsUrl}>
            <Button type="button" variant="outline">Reports & Downloads</Button>
          </Link>
        </>
      )}
      {error && <p className="basis-full text-sm text-destructive">{error}</p>}
    </div>
  )
}
