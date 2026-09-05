import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { loadDashboardDatasetAggregation } from "@/lib/data/dashboard-dataset-aggregation"
import { getOrCreateDailyHealthBrief, listDailyHealthBriefs, type ExecutiveDailyBrief } from "@/lib/executive/daily-health"
import { Activity, AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Sparkles, Target, TrendingUp } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Executive Daily Health - UseClevr",
  description: "Daily executive health checks and history",
}

type DailyHealthPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DailyHealthPage({ searchParams }: DailyHealthPageProps) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect("/login")

  const params = (await searchParams) || {}
  const window = parseWindow(params.window)
  const selectedDatasetId = parseDatasetId(params.datasetId)
  const initialDashboardData = await loadDashboardDatasetAggregation(userId, { datasetId: selectedDatasetId })
  const activeDatasetId = selectedDatasetId ?? initialDashboardData.latestUpload?.id ?? null
  const dashboardData = activeDatasetId
    ? await loadDashboardDatasetAggregation(userId, { datasetId: activeDatasetId, includeCompatibleDatasets: true })
    : initialDashboardData
  const hasActiveDatasets = dashboardData.activeDatasetCount > 0
  const [today, history] = await Promise.all([
    hasActiveDatasets && activeDatasetId ? getOrCreateDailyHealthBrief({ userId, datasetId: activeDatasetId }) : Promise.resolve(null),
    activeDatasetId ? listDailyHealthBriefs({ userId, datasetId: activeDatasetId, limit: windowToLimit(window) }) : Promise.resolve([]),
  ])
  const reports = hasActiveDatasets ? mergeToday(today, history).slice(0, windowToLimit(window)) : []

  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto w-full max-w-[1440px] space-y-7 px-4 pb-8 pt-2 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href={activeDatasetId ? `/app?datasetId=${encodeURIComponent(activeDatasetId)}` : "/app"} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-700 dark:text-cyan-100">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Executive Daily Health</h1>
                <p className="mt-1 text-sm text-muted-foreground">{hasActiveDatasets ? "Cached daily briefs for this workspace." : "Upload a dataset to activate the Executive Daily Health Check."}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["today", "yesterday", "7d", "30d"] as const).map((item) => (
              <Link
                key={item}
                href={buildDailyHealthHref({ window: item, datasetId: activeDatasetId })}
                className={[
                  "rounded-lg border px-3 py-2 text-sm font-medium transition",
                  window === item
                    ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-700 dark:text-cyan-100"
                    : "border-border bg-background/60 text-muted-foreground hover:border-primary/35 hover:text-foreground",
                ].join(" ")}
              >
                {windowLabel(item)}
              </Link>
            ))}
          </div>
        </div>

        {today && hasActiveDatasets ? <FullBrief brief={today} /> : <EmptyBrief />}

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Brief History</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {reports.length === 0 ? (
              <Card className="border-dashed p-6 text-sm text-muted-foreground">Daily health history appears after the first brief is generated.</Card>
            ) : (
              reports.map((brief) => <HistoryCard key={brief.id} brief={brief} />)
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function FullBrief({ brief }: { brief: ExecutiveDailyBrief }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
        <div className="mt-5 flex items-center gap-5">
          <ScoreRing value={brief.score} />
          <div>
            <p className="text-sm text-muted-foreground">Business Health Score</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{brief.score}/100</p>
            <p className="mt-3 text-sm text-muted-foreground">AI Confidence: {brief.aiConfidence}/100</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <MetricLine label="Generated" value={formatDate(brief.createdAt)} />
          <MetricLine label="Engine" value={brief.generatedBy === "ai" ? "AI generated" : "Deterministic"} />
          <MetricLine label="Model" value={brief.modelName || "No model"} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Executive Summary</h2>
        </div>
        <p className="text-base leading-8 text-foreground">{brief.executiveSummary}</p>
        {brief.alerts.length > 0 && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {brief.alerts.slice(0, 4).map((alert) => (
              <div key={`${alert.type}-${alert.title}`} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <BriefPanel icon={Target} title="Today's Priorities" items={brief.todaysPriorities} />
      <BriefPanel icon={TrendingUp} title="Top Opportunities" items={brief.topOpportunities} />
      <BriefPanel icon={AlertTriangle} title="Critical Risks" items={brief.criticalRisks} />
      <BriefPanel icon={Activity} title="Anomalies" items={brief.anomalies} />

      <Card className="p-5 xl:col-span-2">
        <h2 className="text-xl font-semibold text-foreground">Recommended Actions</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {brief.recommendedActions.map((action) => (
            <div key={`${action.priority}-${action.suggestedAction}`} className="rounded-lg border border-border bg-background/60 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={priorityClass(action.priority)}>{action.priority}</span>
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{action.confidence}% confidence</span>
              </div>
              <p className="font-semibold text-foreground">{action.suggestedAction}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.reason}</p>
              <p className="mt-3 text-sm font-medium text-cyan-700 dark:text-cyan-100">{action.estimatedImpact}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-semibold text-foreground">Forecast</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{brief.forecast}</p>
      </Card>
      <Card className="p-5">
        <h2 className="text-xl font-semibold text-foreground">Estimated Business Impact</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{brief.estimatedBusinessImpact}</p>
      </Card>
    </section>
  )
}

function BriefPanel({ icon: Icon, title, items }: { icon: React.ComponentType<{ className?: string }>; title: string; items: string[] }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">No items available.</p>
        ) : (
          items.map((item) => (
            <p key={item} className="rounded-lg border border-border bg-background/60 p-3 text-sm leading-6 text-foreground">{item}</p>
          ))
        )}
      </div>
    </Card>
  )
}

function HistoryCard({ brief }: { brief: ExecutiveDailyBrief }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{brief.date}</p>
          <p className="mt-1 text-sm text-muted-foreground">{brief.executiveSummary}</p>
        </div>
        <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-lg font-semibold text-cyan-700 dark:text-cyan-100">{brief.score}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {brief.todaysPriorities.slice(0, 3).map((priority) => (
          <span key={priority} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{priority}</span>
        ))}
      </div>
    </Card>
  )
}

function EmptyBrief() {
  return (
    <Card className="border-dashed p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 text-xl font-semibold text-foreground">No daily brief yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Upload a dataset to activate the Executive Daily Health Check.</p>
    </Card>
  )
}

function ScoreRing({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (value / 100) * circumference
  const color = value >= 75 ? "#34d399" : value >= 50 ? "#f59e0b" : "#fb7185"
  return (
    <svg className="h-28 w-28 shrink-0" viewBox="0 0 100 100" role="img" aria-label={`Health score ${value} out of 100`}>
      <circle cx="50" cy="50" r="40" fill="none" className="stroke-muted" strokeWidth="10" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" strokeWidth="10" transform="rotate(-90 50 50)" />
      <text x="50" y="56" fill="currentColor" textAnchor="middle" className="text-2xl font-bold text-foreground">{value}</text>
    </svg>
  )
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

function parseWindow(value: string | string[] | undefined) {
  const current = Array.isArray(value) ? value[0] : value
  if (current === "yesterday" || current === "7d" || current === "30d") return current
  return "today"
}

function parseDatasetId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
}

function buildDailyHealthHref(input: { window: ReturnType<typeof parseWindow>; datasetId: string | null }) {
  const query = new URLSearchParams({ window: input.window })
  if (input.datasetId) query.set("datasetId", input.datasetId)
  return `/app/daily-health?${query.toString()}`
}

function windowToLimit(value: ReturnType<typeof parseWindow>) {
  if (value === "30d") return 30
  if (value === "7d") return 7
  if (value === "yesterday") return 2
  return 1
}

function windowLabel(value: ReturnType<typeof parseWindow>) {
  if (value === "7d") return "Last 7 days"
  if (value === "30d") return "Last 30 days"
  if (value === "yesterday") return "Yesterday"
  return "Today"
}

function mergeToday(today: ExecutiveDailyBrief | null, history: ExecutiveDailyBrief[]) {
  const seen = new Set<string>()
  return [today, ...history].filter((brief): brief is ExecutiveDailyBrief => {
    if (!brief || seen.has(brief.id)) return false
    seen.add(brief.id)
    return true
  })
}

function priorityClass(priority: ExecutiveDailyBrief["recommendedActions"][number]["priority"]) {
  if (priority === "Critical") return "rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-200"
  if (priority === "High") return "rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-200"
  if (priority === "Low") return "rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
  return "rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-100"
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date)
}
