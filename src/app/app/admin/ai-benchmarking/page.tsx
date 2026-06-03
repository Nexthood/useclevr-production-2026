"use client"

import { AppPageHeader } from "@/components/layout/app-page-header"
import { BarChart3, Loader2 } from "lucide-react"
import * as React from "react"

interface BenchmarkRow {
  providerName: string
  modelName: string
  totalQueries: number
  averageLatencyMs: number
  errorRate: number
  averageTokens: number
  positiveFeedback: number
  negativeFeedback: number
}

export default function AiBenchmarkingPage() {
  const [benchmarks, setBenchmarks] = React.useState<BenchmarkRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dateRange, setDateRange] = React.useState("7")

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const from = new Date()
        from.setDate(from.getDate() - parseInt(dateRange))
        const res = await fetch(`/api/admin/ai-traces?view=benchmarking&from=${from.toISOString()}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setBenchmarks(Array.isArray(data.benchmarking) ? data.benchmarking : [])
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [dateRange])

  return (
    <div className="flex flex-1 flex-col">
      <AppPageHeader
        title="AI Benchmarking"
        description="Compare provider performance, latency, error rates, and user satisfaction."
        icon={BarChart3}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Period:</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : benchmarks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No benchmarking data available yet. Data appears after users interact with the AI assistant.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-foreground">Provider</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Model</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Queries</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Avg latency</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Error rate</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Avg tokens</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Positive</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Negative</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Satisfaction</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((row, i) => {
                  const satisfaction =
                    row.positiveFeedback + row.negativeFeedback > 0
                      ? ((row.positiveFeedback / (row.positiveFeedback + row.negativeFeedback)) * 100).toFixed(0)
                      : "N/A"
                  return (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{row.providerName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.modelName}</td>
                      <td className="px-4 py-3 text-right text-foreground">{row.totalQueries}</td>
                      <td className="px-4 py-3 text-right text-foreground">{Math.round(row.averageLatencyMs)}ms</td>
                      <td
                        className={`px-4 py-3 text-right ${
                          row.errorRate > 0.1
                            ? "text-destructive"
                            : row.errorRate > 0.05
                            ? "text-amber-500"
                            : "text-foreground"
                        }`}
                      >
                        {(row.errorRate * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">{Math.round(row.averageTokens)}</td>
                      <td className="px-4 py-3 text-right text-green-500">{row.positiveFeedback}</td>
                      <td className="px-4 py-3 text-right text-destructive">{row.negativeFeedback}</td>
                      <td className="px-4 py-3 text-right text-foreground">{satisfaction}{satisfaction !== "N/A" ? "%" : ""}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
