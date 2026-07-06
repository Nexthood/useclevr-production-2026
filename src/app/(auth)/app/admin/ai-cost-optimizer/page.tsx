"use client"

import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { Card } from "@/components/ui/card"
import { AlertTriangle, BarChart3, CircleDollarSign, CreditCard, Sparkles, Users, Wallet } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

interface ProviderStatus {
  configured: boolean
  providers: Array<{
    name: string
    type: string
    configured: boolean
  }>
  hasAnyProvider: boolean
}

interface Snapshot {
  summary: {
    totalCostEur: number
    totalCreditsUsed: number
    totalRequests: number
    uniqueUsers: number
    uniqueOrganizations: number
    avgCostPerRequestEur: number
    avgCreditsPerRequest: number
    successRate: number
  }
  providerBreakdown: Array<{
    provider: string
    costEur: number
    creditsUsed: number
    requests: number
    avgCostPerRequestEur: number
  }>
  planBreakdown: Array<{
    plan: string
    costEur: number
    creditsUsed: number
    requests: number
    avgCostPerRequestEur: number
    uniqueUsers: number
  }>
  organizationBreakdown: Array<{
    organizationId: string | null
    costEur: number
    requests: number
    avgCostPerRequestEur: number
    uniqueUsers: number
  }>
  topCustomers: Array<{
    userId: string
    email: string | null
    fullName: string | null
    tier: string | null
    costEur: number
    creditsUsed: number
    requests: number
    avgCostPerRequestEur: number
  }>
  recommendations: Array<{
    severity: "info" | "warning" | "danger"
    title: string
    detail: string
  }>
  providerStatus?: ProviderStatus
}

export default function AiCostOptimizerPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const res = await fetch("/api/admin/ai-cost-optimizer", { cache: "no-store" })
        const json = await res.json()
        if (!res.ok) {
          if (active) setError(json.error || json.message || "Failed to load optimizer data")
        } else {
          if (active) setSnapshot(json)
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load optimizer data")
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const summaryCards = useMemo(() => {
    if (!snapshot) return []
    return [
      {
        label: "Total cost",
        value: `€${snapshot.summary.totalCostEur.toFixed(2)}`,
        icon: CircleDollarSign,
      },
      {
        label: "Credits used",
        value: snapshot.summary.totalCreditsUsed.toLocaleString(),
        icon: CreditCard,
      },
      {
        label: "Requests",
        value: snapshot.summary.totalRequests.toLocaleString(),
        icon: Sparkles,
      },
      {
        label: "Active users",
        value: snapshot.summary.uniqueUsers.toLocaleString(),
        icon: Users,
      },
    ]
  }, [snapshot])

  return (
    <DashboardSubpageLayout
      title="AI Cost Optimizer"
      description="Review real AI spend, credit pressure, provider efficiency, and plan fit from live billing data."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "AI Cost Optimizer" }]}
      icon={BarChart3}
    >
      <div className="flex-1 overflow-y-auto space-y-6 px-5 py-5">
        {loading && <p className="text-sm text-muted-foreground">Loading optimizer data…</p>}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && snapshot && snapshot.summary.totalRequests === 0 && (
          <div className="space-y-4">
            {snapshot.providerStatus && !snapshot.providerStatus.hasAnyProvider && (
              <Card className="border-amber-500/50 bg-amber-500/10 p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground">AI providers are not configured yet.</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add OpenAI, Gemini, Anthropic, or local provider settings to start tracking usage and costs.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {snapshot.providerStatus.providers.map((provider) => (
                        <span
                          key={provider.type}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            provider.configured
                              ? "bg-green-500/20 text-green-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {provider.name}: {provider.configured ? "Configured" : "Not configured"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <Card className="border-border bg-card p-6">
              <div className="text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-semibold text-foreground">No AI usage data available yet.</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Analytics will appear after AI requests are processed.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  AI analyses, chat messages, and other AI-powered features will generate usage logs here.
                </p>
              </div>
            </Card>
          </div>
        )}

        {!loading && snapshot && (snapshot.summary.totalRequests > 0 || snapshot.providerStatus?.hasAnyProvider) && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon
                return (
                  <Card key={card.label} className="border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {card.label}
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-foreground">{card.value}</p>
                  </Card>
                )
              })}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <Card className="border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Provider cost breakdown</h3>
                  <span className="text-xs text-muted-foreground">Live from AI cost logs</span>
                </div>
                <div className="space-y-3">
                  {snapshot.providerBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No provider cost data yet.</p>
                  ) : (
                    snapshot.providerBreakdown.map((entry) => (
                      <div key={entry.provider} className="rounded-lg border border-border/70 bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{entry.provider}</span>
                          <span className="text-sm text-muted-foreground">€{entry.costEur.toFixed(2)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                          <span>{entry.requests} requests</span>
                          <span>~€{entry.avgCostPerRequestEur.toFixed(3)} / req</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Recommended actions</h3>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="space-y-3">
                  {snapshot.recommendations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recommendations yet.</p>
                  ) : (
                    snapshot.recommendations.map((recommendation, index) => (
                      <div key={`${recommendation.title}-${index}`} className="rounded-lg border border-border/70 bg-background p-3">
                        <p className="text-sm font-medium text-foreground">{recommendation.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{recommendation.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card className="border-border bg-card p-4">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Plan mix</h3>
                <div className="space-y-3">
                  {snapshot.planBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No plan mix data yet.</p>
                  ) : (
                    snapshot.planBreakdown.map((entry) => (
                      <div key={entry.plan} className="rounded-lg border border-border/70 bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{entry.plan}</span>
                          <span className="text-sm text-muted-foreground">{entry.uniqueUsers} users</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                          <span>€{entry.costEur.toFixed(2)}</span>
                          <span>{entry.requests} requests</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="border-border bg-card p-4">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Top customers</h3>
                <div className="space-y-3">
                  {snapshot.topCustomers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No customer spend data yet.</p>
                  ) : (
                    snapshot.topCustomers.map((customer) => (
                      <div key={customer.userId} className="rounded-lg border border-border/70 bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{customer.fullName || customer.email || customer.userId}</span>
                          <span className="text-sm text-muted-foreground">{customer.tier || "unknown"}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                          <span>€{customer.costEur.toFixed(2)}</span>
                          <span>{customer.requests} requests</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <Card className="border-border bg-card p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-primary" />
                Efficiency overview
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-sm text-muted-foreground">Avg cost / request</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">€{snapshot.summary.avgCostPerRequestEur.toFixed(3)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-sm text-muted-foreground">Avg credits / request</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{snapshot.summary.avgCreditsPerRequest.toFixed(1)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-sm text-muted-foreground">Success rate</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{(snapshot.summary.successRate * 100).toFixed(1)}%</p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardSubpageLayout>
  )
}
