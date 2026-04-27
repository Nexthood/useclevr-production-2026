"use client"

import * as React from "react"
import { Download, FileText, Loader2 } from "lucide-react"

interface DownloadReportButtonProps {
  analysisData: {
    insight?: string
    explanation?: string
    recommendation?: string
    data?: any[]
  }
  disabled?: boolean
}

export function DownloadReportButton({ analysisData, disabled = false }: DownloadReportButtonProps) {
  const [isDownloading, setIsDownloading] = React.useState(false)

  const handleDownload = async (format: 'csv' | 'pdf') => {
    if (isDownloading || disabled) return

    setIsDownloading(true)

    try {
      const response = await fetch("/api/reports/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysisData,
          format,
        }),
      })

      if (!response.ok) {
        throw new Error("Download failed")
      }

      // Handle blob response for download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `analysis-report-${Date.now()}.${format === 'csv' ? 'csv' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Download error:", error)
    } finally {
      setIsDownloading(false)
    }
  }

  if (disabled) {
    return null
  }

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={() => handleDownload('csv')}
        disabled={isDownloading || disabled}
        className="download-btn flex items-center gap-2"
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Download Report (CSV)
      </button>
    </div>
  )
}

// Upgrade Prompt Component
interface UpgradePromptProps {
  onUpgrade?: () => void
}

export function UpgradePrompt({ onUpgrade }: UpgradePromptProps) {
  return (
    <div className="bg-[#141A23] border border-[#2A3442] rounded-lg p-4 mt-4">
      <p className="text-sm text-[#E6EDF3] mb-3">
        You have reached the free limit (5 analyses). Upgrade to UseClevr Pro for unlimited insights.
      </p>
      <button
        onClick={onUpgrade}
        className="download-btn flex items-center justify-center gap-2 w-full"
      >
        Upgrade to Pro
      </button>
    </div>
  )
}

// Analysis Limit Reached Component
interface AnalysisLimitReachedProps {
  analysisCount: number
  onUpgrade?: () => void
}

export function AnalysisLimitReached({ analysisCount = 5, onUpgrade }: AnalysisLimitReachedProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-[#141A23] border border-[#2A3442] flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-[#8B97A8]" />
      </div>
      <h3 className="text-lg font-semibold text-[#E6EDF3] mb-2">
        Free Limit Reached
      </h3>
      <p className="text-sm text-[#8B97A8] mb-4 max-w-sm">
        You have used all {analysisCount} of your free AI analyses. Upgrade to Pro for unlimited insights and full report downloads.
      </p>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="download-btn flex items-center justify-center gap-2"
        >
          Upgrade to Pro
        </button>
      )}
    </div>
  )
}
