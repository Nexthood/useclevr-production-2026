"use client"

import { AppPageHeader } from "@/components/layout/app-page-header"
import { BarChart3, Loader2 } from "lucide-react"
import * as React from "react"

interface Analytics {
  totalQueries: number
  providerDistribution: Record<string, number>
  averageLatencyMs: number
  errorRate: number
  uniqueUsers: number
  feedbackPositive: number
  feedbackNegative: number
  topQueries: Array<{ prompt: string; count: number }>
}

export default function AiTracesPage() {
  const [analytics, setAnalytics] = React.useState<Analytics | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [dateRange, setDateRange] = React.useState("7")

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const from = new Date()
        from.setDate(from.getDate() - parseInt(dateRange))
        const res = await fetch(`/api/admin/ai-traces?from=${from.toISOString()}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setAnalytics(data)
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
        title="AI Traces Analytics"
        description="Monitor AI interaction usage, performance, and feedback across all users."
        icon={BarChart3}
      />

      <div className="flex-1 p-6">
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
        ) : analytics ? (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total queries" value={analytics.totalQueries.toLocaleString()} />
              <StatCard label="Unique users" value={analytics.uniqueUsers.toLocaleString()} />
              <StatCard
                label="Avg latency"
                value={`${Math.round(analytics.averageLatencyMs)}ms`}
              />
              <StatCard
                label="Error rate"
                value={`${(analytics.errorRate * 100).toFixed(1)}%`}
                variant={analytics.errorRate > 0.1 ? "danger" : analytics.errorRate > 0.05 ? "warning" : "normal"}
              />
              <StatCard label="Positive feedback" value={analytics.feedbackPositive.toLocaleString()} />
              <StatCard label="Negative feedback" value={analytics.feedbackNegative.toLocaleString()} />
              <StatCard
                label="Feedback rate"
                value={`${analytics.totalQueries > 0 ? (((analytics.feedbackPositive + analytics.feedbackNegative) / analytics.totalQueries) * 100).toFixed(1) : 0}%`}
              />
              <StatCard
                label="Satisfaction"
                value={
                  analytics.feedbackPositive + analytics.feedbackNegative > 0
                    ? `${((analytics.feedbackPositive / (analytics.feedbackPositive + analytics.feedbackNegative)) * 100).toFixed(0)}%`
                    : "N/A"
                }
              />
            </div>

            {/* Provider distribution */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Provider distribution</h3>
              <div className="space-y-2">
                {Object.entries(analytics.providerDistribution).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data</p>
                ) : (
                  Object.entries(analytics.providerDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([provider, count]) => {
                      const pct = analytics.totalQueries > 0 ? ((count / analytics.totalQueries) * 100).toFixed(1) : "0"
                      return (
                        <div key={provider} className="flex items-center gap-2">
                          <span className="w-32 text-sm text-foreground">{provider}</span>
                          <div className="flex-1 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-20 text-right text-xs text-muted-foreground">
                            {count} ({pct}%)
                          </span>
                        </div>
                      )
                    })
                )}
              </div>
            </div>

            {/* Top queries */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Most asked questions</h3>
              {analytics.topQueries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                <div className="space-y-1.5">
                  {analytics.topQueries.slice(0, 10).map((q, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-background px-3 py-2">
                      <span className="line-clamp-1 flex-1 text-sm text-foreground">{q.prompt}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{q.count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Failed to load analytics.</p>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  variant = "normal",
}: {
  label: string
  value: string
  variant?: "normal" | "warning" | "danger"
}) {
  const colorClass =
    variant === "danger"
      ? "text-destructive"
      : variant === "warning"
      ? "text-amber-500"
      : "text-foreground"

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}
