import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { db } from "@/lib/db"
import { datasets, profiles } from "@/lib/db/schema"
import { count, desc, eq } from "drizzle-orm"
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Database,
  FileText,
  LineChart,
  PieChart,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import type React from "react"

export const metadata = {
  title: "Dashboard - UseClevr",
  description: "Analytics dashboard",
}

type DashboardStats = {
  datasets: number
  analyses: number
  reports: number
  hasProfile: boolean
  hasBusiness: boolean
  profile: {
    firstName: string | null
    fullName: string | null
    email: string | null
    businessName: string | null
    companyName: string | null
  } | null
  latestDataset: {
    id: string
    name: string
    fileName: string
    rowCount: number
    columnCount: number
    columns: string[]
    createdAt: Date
  } | null
}

type Tone = "cyan" | "purple" | "emerald" | "amber" | "slate"

async function getStats(userId: string | null): Promise<DashboardStats> {
  if (!userId) {
    return { datasets: 0, analyses: 0, reports: 0, hasProfile: false, hasBusiness: false, profile: null, latestDataset: null }
  }

  try {
    const [datasetCount, profile, latestDataset] = await Promise.all([
      db.select({ value: count() }).from(datasets).where(eq(datasets.userId, userId)),
      db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
        columns: { id: true, firstName: true, fullName: true, email: true, businessName: true, companyName: true },
      }),
      db.query.datasets.findFirst({
        where: eq(datasets.userId, userId),
        orderBy: [desc(datasets.createdAt)],
        columns: {
          id: true,
          name: true,
          fileName: true,
          rowCount: true,
          columnCount: true,
          columns: true,
          createdAt: true,
        },
      }),
    ])

    return {
      datasets: datasetCount[0]?.value || 0,
      analyses: datasetCount[0]?.value || 0,
      reports: 0,
      hasProfile: !!profile,
      hasBusiness: !!profile?.businessName,
      profile: profile
        ? {
            firstName: profile.firstName,
            fullName: profile.fullName,
            email: profile.email,
            businessName: profile.businessName,
            companyName: profile.companyName,
          }
        : null,
      latestDataset: latestDataset
        ? {
            ...latestDataset,
            columns: Array.isArray(latestDataset.columns) ? latestDataset.columns : [],
          }
        : null,
    }
  } catch {
    return { datasets: 0, analyses: 0, reports: 0, hasProfile: false, hasBusiness: false, profile: null, latestDataset: null }
  }
}

function getHealthScore(stats: DashboardStats) {
  const setupScore = (stats.hasProfile ? 26 : 0) + (stats.hasBusiness ? 28 : 0)
  const dataScore = Math.min(32, stats.datasets * 16)
  const analysisScore = Math.min(14, stats.analyses * 7)

  return Math.max(18, Math.min(100, setupScore + dataScore + analysisScore))
}

function getConfidenceScore(stats: DashboardStats) {
  const base = stats.datasets > 0 ? 62 : 34
  const setupScore = stats.hasBusiness ? 18 : stats.hasProfile ? 10 : 0
  const analysisScore = Math.min(16, stats.analyses * 8)

  return Math.max(24, Math.min(96, base + setupScore + analysisScore))
}

function getDashboardState(stats: DashboardStats) {
  if (stats.datasets === 0) {
    return {
      summary: "Upload a dataset or open a report to get started.",
      attention: "First dataset needed",
      aiStatus: "Waiting for business data",
    }
  }

  if (!stats.hasBusiness) {
    return {
      summary: "Your workspace has data. Complete the business profile so AI analysis can connect results to operating context.",
      attention: "Business profile needs context",
      aiStatus: "Data ready for deeper analysis",
    }
  }

  return {
    summary: "Your workspace is ready for executive analysis. Recent datasets can support KPI review, AI findings, and report generation.",
    attention: "Review newest dataset signals",
    aiStatus: "AI analysis ready",
  }
}

export default async function AppDashboard() {
  const session = await auth()
  const userId = session?.user?.id ?? null
  const stats = await getStats(userId)
  const healthScore = getHealthScore(stats)
  const confidenceScore = getConfidenceScore(stats)
  const dashboardState = getDashboardState(stats)
  const setupItems = [
    { label: "Profile", complete: stats.hasProfile, href: "/app/settings/profile" },
    { label: "Business Profile", complete: stats.hasBusiness, href: "/app/business" },
    { label: "Dataset Upload", complete: stats.datasets > 0, href: "/app/datasets" },
    { label: "Analysis", complete: stats.analyses > 0, href: "/app/downloads" },
  ]
  const completedSetup = setupItems.filter((item) => item.complete).length

  const kpis = [
    {
      label: "Active datasets",
      value: String(stats.datasets),
      change: stats.datasets > 0 ? "Ready" : "Start",
      detail: stats.datasets > 0 ? "Available for analysis" : "Upload your first file",
      href: "/app/datasets",
      icon: Database,
      tone: "cyan" as Tone,
    },
    {
      label: "Recent analyses",
      value: String(stats.analyses),
      change: stats.analyses > 0 ? "Synced" : "Pending",
      detail: stats.analyses > 0 ? "Based on uploaded datasets" : "Run analysis after upload",
      href: "/app/downloads",
      icon: BarChart3,
      tone: "purple" as Tone,
    },
    {
      label: "Generated reports",
      value: String(stats.reports),
      change: "Available",
      detail: "Reports appear after export",
      href: "/app/downloads",
      icon: FileText,
      tone: "slate" as Tone,
    },
    {
      label: "Workspace setup",
      value: `${completedSetup}/4`,
      change: completedSetup === 4 ? "Complete" : "In progress",
      detail: "Improves AI context quality",
      href: stats.hasBusiness ? "/app/business" : "/app/business/setup",
      icon: CheckCircle2,
      tone: completedSetup === 4 ? "emerald" as Tone : "amber" as Tone,
    },
  ]

  const insights = [
    {
      title: "AI readiness",
      icon: Brain,
      tone: "purple" as Tone,
      items: [
        stats.datasets > 0 ? "Uploaded data is available for AI review." : "Upload a dataset to unlock AI findings.",
        stats.hasBusiness ? "Business context is available for sharper recommendations." : "Business profile context is needed for better recommendations.",
        "UseClevr keeps analysis tied to your uploaded spreadsheets.",
      ],
    },
    {
      title: "Performance focus",
      icon: TrendingUp,
      tone: "cyan" as Tone,
      items: [
        stats.analyses > 0 ? "Recent analyses can be reviewed from Reports & Downloads." : "Run your first analysis after uploading a dataset.",
        "Dashboards highlight trends, risks, opportunities, and recommended actions.",
        "Executive review starts with the newest complete dataset.",
      ],
    },
    {
      title: "Operating context",
      icon: Building2,
      tone: "emerald" as Tone,
      items: [
        stats.hasProfile ? "Your profile is ready." : "Complete your profile to personalize the workspace.",
        stats.hasBusiness ? "Business Profile is complete." : "Business Profile setup improves KPI interpretation.",
        "Accountancy and business sections extend the same operating view.",
      ],
    },
  ]

  const risks = [
    {
      title: "No active data",
      status: stats.datasets > 0 ? "Low" : "High",
      detail: stats.datasets > 0 ? "Datasets are available for review." : "AI cannot surface business patterns until a dataset is uploaded.",
    },
    {
      title: "Missing business context",
      status: stats.hasBusiness ? "Low" : "Medium",
      detail: stats.hasBusiness ? "Business Profile context is available." : "Recommendations improve after industry, costs, margins, and operating assumptions are set.",
    },
    {
      title: "Report coverage",
      status: stats.reports > 0 ? "Low" : "Medium",
      detail: stats.reports > 0 ? "Generated reports are available." : "Exported reports appear after analysis and report generation.",
    },
  ]

  const opportunities = [
    {
      title: "Revenue analysis",
      value: stats.datasets > 0 ? "Ready" : "Upload data",
      detail: "Review sales trends, growth areas, and customer movement from spreadsheet data.",
    },
    {
      title: "Margin review",
      value: stats.hasBusiness ? "Context ready" : "Needs profile",
      detail: "Add business assumptions to make margin, cost, and profitability insights more precise.",
    },
    {
      title: "Executive reporting",
      value: stats.analyses > 0 ? "Available" : "Run analysis",
      detail: "Create report-style summaries for owners, finance teams, and operators.",
    },
    {
      title: "Data quality review",
      value: stats.datasets > 0 ? "Ready" : "Needs data",
      detail: "Check missing values, duplicates, and column structure before deeper analysis.",
    },
  ]

  const recommendations = [
    {
      title: stats.datasets > 0 ? "Review your newest dataset analysis" : "Upload your first business spreadsheet",
      priority: "High",
      impact: stats.datasets > 0 ? "Turns recent data into actionable KPI review" : "Unlocks insights, risks, opportunities, and dashboards",
      effort: "Low",
      href: stats.datasets > 0 ? "/app/downloads" : "/app/datasets",
    },
    {
      title: stats.hasBusiness ? "Use Business Profile context during analysis" : "Complete your Business Profile",
      priority: stats.hasBusiness ? "Medium" : "High",
      impact: "Improves the quality of AI recommendations and executive summaries",
      effort: "Medium",
      href: stats.hasBusiness ? "/app/business" : "/app/business/setup",
    },
    {
      title: "Open the AI Assistant with a selected dataset",
      priority: "Medium",
      impact: "Ask targeted questions about trends, risks, and next actions",
      effort: "Low",
      href: "/app/assistant",
    },
  ]

  const activity = [
    {
      label: stats.datasets > 0 ? "Dataset library active" : "Dataset library waiting",
      detail: stats.datasets > 0 ? `${stats.datasets} dataset${stats.datasets === 1 ? "" : "s"} available` : "Upload CSV or Excel files",
      href: "/app/datasets",
    },
    {
      label: stats.hasBusiness ? "Business context complete" : "Business setup open",
      detail: stats.hasBusiness ? "AI has operating context" : "Add business details for better analysis",
      href: stats.hasBusiness ? "/app/business" : "/app/business/setup",
    },
    {
      label: "Reports & Downloads",
      detail: stats.reports > 0 ? `${stats.reports} report${stats.reports === 1 ? "" : "s"} available` : "Reports appear after generation",
      href: "/app/downloads",
    },
  ]

  const quickActions = [
    { label: "Upload new dataset", href: "/app/datasets", icon: Database },
    { label: "Complete business profile", href: "/app/business/profile", icon: Building2 },
    { label: "Open AI Assistant", href: "/app/assistant", icon: Sparkles },
    { label: "Manage subscription", href: "/app/settings/subscription", icon: ShoppingCart },
  ]

  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto w-full max-w-[1520px] space-y-10 px-5 pb-8 sm:px-6 lg:px-8 xl:px-10">
        <section className="relative overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 translate-x-1/3 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative grid gap-8 xl:grid-cols-[0.9fr_1.1fr] xl:items-stretch">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                AI executive workspace
              </div>
              <div className="max-w-3xl space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  Dashboard
                </h1>
                <p className="text-base leading-8 text-muted-foreground sm:text-lg">
                  {dashboardState.summary}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatusTile label="Today's summary" value={dashboardState.attention} tone="cyan" />
                <StatusTile label="Active datasets" value={String(stats.datasets)} tone="purple" />
                <StatusTile label="Quick AI status" value={dashboardState.aiStatus} tone="slate" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ScoreCard value={healthScore} label="Business Health Score" tone="cyan" />
              <ScoreCard value={confidenceScore} label="AI Confidence Score" tone="purple" />
              <div className="lg:col-span-2 rounded-lg border border-border bg-background/60 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Executive signal</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">Workspace readiness trend</h2>
                  </div>
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-100">
                    Live setup
                  </span>
                </div>
                <MiniTrendChart stats={stats} />
              </div>
            </div>
          </div>
        </section>

        <DashboardSection
          icon={Activity}
          title="Business Health"
          description="A compact view of setup quality, data availability, and AI readiness."
        >
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {setupItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-lg border border-border bg-background/60 p-4 transition hover:border-primary/35 hover:bg-primary/5"
                  >
                    <CheckCircle2 className={["mb-3 h-5 w-5", item.complete ? "text-cyan-600 dark:text-cyan-200" : "text-muted-foreground"].join(" ")} />
                    <p className="font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.complete ? "Complete" : "Needs attention"}</p>
                  </Link>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <Brain className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">AI operating context</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                UseClevr combines uploaded spreadsheet data with your business profile to produce clearer KPI explanations, risks, opportunities, and recommendations.
              </p>
              <div className="mt-5 grid gap-2">
                {["Spreadsheet data", "Business assumptions", "Analysis history"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{item}</span>
                    <span className="font-medium text-foreground">
                      {index === 0 ? (stats.datasets > 0 ? "Ready" : "Needed") : index === 1 ? (stats.hasBusiness ? "Ready" : "Needed") : (stats.analyses > 0 ? "Ready" : "Pending")}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </DashboardSection>

        <DashboardSection
          icon={BarChart3}
          title="Live KPIs"
          description="The key workspace metrics that determine what UseClevr can analyze right now."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          icon={Sparkles}
          title="AI Insights"
          description="Current AI findings and readiness signals based on your workspace state."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {insights.map((insight) => {
              const Icon = insight.icon
              return (
                <Card key={insight.title} className="p-5">
                  <Icon className={["mb-4 h-6 w-6", toneIconClass(insight.tone)].join(" ")} />
                  <h3 className="text-lg font-semibold text-foreground">{insight.title}</h3>
                  <div className="mt-4 space-y-3">
                    {insight.items.map((item) => (
                      <p key={item} className="text-sm leading-6 text-muted-foreground">{item}</p>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </DashboardSection>

        <DashboardSection
          icon={PieChart}
          title="Interactive Charts"
          description="Report-style visual containers prepared for revenue, profit, category, and regional analysis."
        >
          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <Card className="p-5">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Analysis coverage</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Dataset and setup coverage across the executive workflow.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Revenue trend", "Profit trend", "Category view"].map((pill) => (
                    <span key={pill} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
              <ExecutiveAreaChart stats={stats} />
            </Card>
            <Card className="p-5">
              <div className="mb-5 flex items-center gap-3">
                <LineChart className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold text-foreground">Opportunity heatmap</h3>
              </div>
              <div className="grid gap-3">
                {opportunities.map((opportunity, index) => (
                  <div key={opportunity.title} className="rounded-lg border border-border bg-background/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{opportunity.title}</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{opportunity.value}</p>
                      </div>
                      <span className={["rounded-full px-2.5 py-1 text-xs font-semibold", index < 2 ? "bg-cyan-300/10 text-cyan-700 dark:text-cyan-100" : "bg-primary/10 text-primary"].join(" ")}>
                        {index < 2 ? "High" : "Watch"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{opportunity.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </DashboardSection>

        <section className="grid gap-6 xl:grid-cols-2">
          <DashboardSection
            icon={Target}
            title="Top Opportunities"
            description="The next value areas UseClevr can help investigate."
            compact
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {opportunities.map((opportunity) => (
                <Card key={opportunity.title} className="p-5">
                  <p className="text-sm text-muted-foreground">{opportunity.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{opportunity.value}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{opportunity.detail}</p>
                </Card>
              ))}
            </div>
          </DashboardSection>

          <DashboardSection
            icon={ShieldAlert}
            title="Top Risks"
            description="Workspace risks that affect AI output quality and business visibility."
            compact
          >
            <div className="space-y-3">
              {risks.map((risk) => (
                <Card key={risk.title} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold text-foreground">{risk.title}</h3>
                    <span className={riskBadgeClass(risk.status)}>{risk.status} risk</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{risk.detail}</p>
                </Card>
              ))}
            </div>
          </DashboardSection>
        </section>

        <DashboardSection
          icon={Brain}
          title="AI Recommendations"
          description="Prioritized next actions with expected impact and estimated effort."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {recommendations.map((recommendation) => (
              <Link key={recommendation.title} href={recommendation.href} className="group">
                <Card className="h-full p-5 transition hover:border-primary/35 hover:bg-primary/5">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className={recommendation.priority === "High" ? "rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-100" : "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"}>
                      {recommendation.priority} priority
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                      {recommendation.effort} effort
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{recommendation.title}</h3>
                  <p className="mt-3 text-sm font-medium text-cyan-700 dark:text-cyan-100">{recommendation.impact}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    Open action
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </DashboardSection>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <DashboardSection
            icon={Activity}
            title="Recent Activity"
            description="Current workspace signals and where to continue."
            compact
          >
            <Card className="p-5">
              <div className="space-y-3">
                {activity.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/60 px-4 py-3 transition hover:border-primary/35 hover:bg-primary/5"
                  >
                    <span>
                      <span className="block font-medium text-foreground">{item.label}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{item.detail}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </Card>
          </DashboardSection>

          <DashboardSection
            icon={CircleDollarSign}
            title="Quick Actions"
            description="Primary actions for the next executive review cycle."
            compact
          >
            <Card className="p-5">
              <div className="grid gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-4 py-3 text-sm font-medium text-foreground transition hover:border-cyan-300/35 hover:bg-cyan-300/5"
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-primary" />
                        {action.label}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  )
                })}
              </div>
            </Card>
          </DashboardSection>
        </section>
      </div>
    </div>
  )
}

function DashboardSection({
  icon: Icon,
  title,
  description,
  children,
  compact = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <section className={compact ? "space-y-4" : "space-y-5"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-700 dark:text-cyan-100">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      {children}
    </section>
  )
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={["mt-2 text-sm font-semibold leading-6", toneTextClass(tone)].join(" ")}>{value}</p>
    </div>
  )
}

function ScoreCard({ value, label, tone }: { value: number; label: string; tone: "cyan" | "purple" }) {
  const stroke = tone === "cyan" ? "#22D3EE" : "#A78BFA"
  const circumference = 2 * Math.PI * 42
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-background/60 p-5">
      <svg className="h-24 w-24 shrink-0 text-foreground" viewBox="0 0 100 100" role="img" aria-label={`${label}: ${value} out of 100`}>
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-muted/60" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="10"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" fill="currentColor" textAnchor="middle" className="text-xl font-bold">
          {value}
        </text>
      </svg>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {value >= 80 ? "Strong executive signal with focused next actions." : value >= 55 ? "Useful signal with setup improvements available." : "Needs more business data for stronger analysis."}
        </p>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  change,
  detail,
  href,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  change: string
  detail: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full p-5 transition hover:border-primary/35 hover:bg-primary/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
          <span className={["flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneBgClass(tone)].join(" ")}>
            <Icon className={["h-5 w-5", toneIconClass(tone)].join(" ")} />
          </span>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{detail}</p>
          <span className={["rounded-full px-2.5 py-1 text-xs font-semibold", tonePillClass(tone)].join(" ")}>
            {change}
          </span>
        </div>
      </Card>
    </Link>
  )
}

function MiniTrendChart({ stats }: { stats: DashboardStats }) {
  const data = [
    22,
    stats.hasProfile ? 38 : 26,
    stats.hasBusiness ? 54 : 34,
    stats.datasets > 0 ? 68 : 42,
    stats.analyses > 0 ? 82 : 50,
    stats.datasets > 1 ? 88 : stats.datasets > 0 ? 72 : 54,
  ]
  const points = data.map((value, index) => `${index * 56},${96 - value}`).join(" ")

  return (
    <svg className="h-36 w-full overflow-visible" viewBox="0 0 280 112" role="img" aria-label="Workspace readiness trend">
      <defs>
        <linearGradient id="dashboardMiniArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[20, 48, 76, 104].map((y) => (
        <line key={y} x1="0" x2="280" y1={y} y2={y} className="stroke-border" strokeWidth="1" />
      ))}
      <polygon points={`0,112 ${points} 280,112`} fill="url(#dashboardMiniArea)" />
      <polyline points={points} fill="none" stroke="#22D3EE" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      <polyline points="0,82 56,78 112,70 168,58 224,46 280,36" fill="none" stroke="#A78BFA" strokeDasharray="6 7" strokeLinecap="round" strokeWidth="2.5" />
      {data.map((value, index) => (
        <circle key={`${value}-${index}`} cx={index * 56} cy={96 - value} r="4" fill="#22D3EE" />
      ))}
    </svg>
  )
}

function ExecutiveAreaChart({ stats }: { stats: DashboardStats }) {
  const bars = [
    { label: "Profile", value: stats.hasProfile ? 84 : 32, color: "bg-cyan-300" },
    { label: "Business", value: stats.hasBusiness ? 88 : 38, color: "bg-primary" },
    { label: "Datasets", value: Math.min(92, stats.datasets * 28 + 24), color: "bg-cyan-300" },
    { label: "Analyses", value: Math.min(88, stats.analyses * 26 + 18), color: "bg-primary" },
    { label: "Reports", value: Math.min(76, stats.reports * 24 + 16), color: "bg-muted-foreground" },
  ]

  return (
    <div className="grid min-h-[320px] gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-lg border border-border bg-background/60 p-4">
        <MiniTrendChart stats={stats} />
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-cyan-300" /> Workspace readiness</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-primary" /> AI confidence path</span>
        </div>
      </div>
      <div className="space-y-4">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{bar.label}</span>
              <span className="text-muted-foreground">{bar.value}/100</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted">
              <div className={["h-full rounded-full", bar.color].join(" ")} style={{ width: `${bar.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function riskBadgeClass(status: string) {
  if (status === "High") return "rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-200"
  if (status === "Medium") return "rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-200"
  return "rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-100"
}

function toneTextClass(tone: Tone) {
  if (tone === "purple") return "text-primary"
  if (tone === "emerald") return "text-emerald-700 dark:text-emerald-200"
  if (tone === "amber") return "text-amber-700 dark:text-amber-200"
  if (tone === "slate") return "text-foreground"
  return "text-cyan-700 dark:text-cyan-100"
}

function toneIconClass(tone: Tone) {
  if (tone === "purple") return "text-primary"
  if (tone === "emerald") return "text-emerald-700 dark:text-emerald-200"
  if (tone === "amber") return "text-amber-700 dark:text-amber-200"
  if (tone === "slate") return "text-muted-foreground"
  return "text-cyan-700 dark:text-cyan-100"
}

function toneBgClass(tone: Tone) {
  if (tone === "purple") return "bg-primary/10"
  if (tone === "emerald") return "bg-emerald-500/10"
  if (tone === "amber") return "bg-amber-500/10"
  if (tone === "slate") return "bg-muted"
  return "bg-cyan-300/10"
}

function tonePillClass(tone: Tone) {
  if (tone === "purple") return "bg-primary/10 text-primary"
  if (tone === "emerald") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
  if (tone === "amber") return "bg-amber-500/10 text-amber-700 dark:text-amber-200"
  if (tone === "slate") return "bg-muted text-muted-foreground"
  return "bg-cyan-300/10 text-cyan-700 dark:text-cyan-100"
}
