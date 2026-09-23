import type { ReactNode } from "react"
import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { RiskDatasetSelector } from "@/components/risk-intelligence/risk-dataset-selector"
import { auth } from "@/lib/auth/auth"
import { getHybridAiFeatureAccess } from "@/lib/hybrid-ai/feature-gate"
import {
  RISK_CATEGORY_LABELS,
  type RiskCategorySummary,
  type RiskFinding,
  type RiskIntelligenceResult,
} from "@/lib/risk-intelligence/risk-engine"
import {
  calculateRiskIntelligenceForDataset,
  listRiskIntelligenceDatasets,
  riskScopeEmptyMessage,
  type RiskDatasetSummary,
} from "@/lib/risk-intelligence/risk-service"
import { RISK_SEVERITY_LABELS, type RiskSeverity } from "@/lib/risk-intelligence/risk-rules"
import { parseCanonicalDate } from "@/lib/data/canonical-date"
import { AlertTriangle, ArrowDownWideNarrow, CheckCircle2, Gauge, LockKeyhole, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

type RiskIntelligencePageProps = {
  searchParams?: Promise<{ datasetId?: string; scope?: string }>
}

export default async function RiskIntelligencePage({ searchParams }: RiskIntelligencePageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const access = await getHybridAiFeatureAccess(session.user.id, session.user.role, session.user.email)
  const canUseRiskIntelligence = access.enabledFeatureIds.includes("dashboardInsights")

  if (!canUseRiskIntelligence) {
    return (
      <DashboardSubpageLayout
        title="Risk Intelligence"
        description="Deterministic business-risk scoring from uploaded datasets."
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Risk Intelligence" }]}
      >
        <LockedState />
      </DashboardSubpageLayout>
    )
  }

  const params = await searchParams
  const requestedScope = params?.scope || "standard"
  const requestedDatasetId = params?.datasetId || null
  let supportedDatasets: RiskDatasetSummary[] = []
  let selectedDatasetId: string | null = null
  let riskResult: Awaited<ReturnType<typeof calculateRiskIntelligenceForDataset>> | null = null
  let loadError: string | null = null
  let selectionRedirectHref: string | null = null

  try {
    const datasets = await listRiskIntelligenceDatasets({
      id: session.user.id,
      role: access.role,
      email: session.user.email,
    }, {
      scope: requestedScope,
    })
    supportedDatasets = datasets.filter((dataset) => dataset.supported)
    selectedDatasetId =
      supportedDatasets.find((dataset) => dataset.id === requestedDatasetId)?.id || supportedDatasets[0]?.id || null

    if (requestedDatasetId && selectedDatasetId && requestedDatasetId !== selectedDatasetId) {
      selectionRedirectHref = `/app/risk-intelligence?datasetId=${encodeURIComponent(selectedDatasetId)}&scope=${encodeURIComponent(requestedScope)}`
    } else if (requestedDatasetId && !selectedDatasetId) {
      selectionRedirectHref = `/app/risk-intelligence?scope=${encodeURIComponent(requestedScope)}`
    }

    riskResult = selectedDatasetId && !selectionRedirectHref
      ? await calculateRiskIntelligenceForDataset(selectedDatasetId, {
          id: session.user.id,
          role: access.role,
          email: session.user.email,
        }, {
          scope: requestedScope,
        })
      : null
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Risk Intelligence could not load."
    console.error("[RISK_INTELLIGENCE_PAGE] Failed to render risk workspace", {
      error: serializeRiskPageError(error),
      requestedScope,
      requestedDatasetId,
      userId: session.user.id,
    })
  }

  if (selectionRedirectHref) redirect(selectionRedirectHref)

  const intelligence = riskResult?.success ? riskResult.result : null

  return (
    <DashboardSubpageLayout
      title="Risk Intelligence"
      description="Deterministic risk scoring for inventory, financial, profitability, cash-flow, concentration, and data-quality signals."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Risk Intelligence" }]}
    >
      <div className="space-y-5">
        {supportedDatasets.length > 0 ? (
          <RiskDatasetSelector datasets={supportedDatasets} selectedDatasetId={selectedDatasetId} scope={requestedScope} />
        ) : null}

        {intelligence ? (
          <RiskDashboard intelligence={intelligence} />
        ) : loadError ? (
          <ProblemState reason={loadError} />
        ) : (
          <EmptyState message={riskResult && !riskResult.success ? riskResult.error : riskScopeEmptyMessage(requestedScope)} />
        )}
      </div>
    </DashboardSubpageLayout>
  )
}

function ProblemState({ reason }: { reason: string }) {
  return (
    <section className="flex min-h-[360px] items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-center">
      <div className="max-w-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/30 bg-background">
          <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Problem detected</h2>
        <p className="mt-2 text-sm text-muted-foreground">Risk Intelligence could not load for this dataset.</p>
        <p className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          Reason: {safeRiskPageReason(reason)}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/app/risk-intelligence"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </Link>
          <Link
            href="/app/dashboard"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </section>
  )
}

function LockedState() {
  return (
    <section className="flex min-h-[420px] items-center justify-center rounded-lg border border-border bg-card p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Hybrid AI Lite required</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Risk Intelligence uses the same dashboard-insights entitlement as Hybrid AI Lite.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/app/settings/checkout?plan=pro_monthly"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Upgrade to Pro
          </Link>
          <Link
            href="/app/settings/checkout?plan=business_monthly"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
          >
            Upgrade to Business
          </Link>
        </div>
      </div>
    </section>
  )
}

function RiskDashboard({ intelligence }: { intelligence: RiskIntelligenceResult }) {
  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Overall risk score</p>
              <div className="mt-2 flex items-end gap-3">
                <span className="text-5xl font-semibold text-foreground">{intelligence.overallScore}</span>
                <span className="pb-2 text-sm text-muted-foreground">/100</span>
              </div>
              <SeverityBadge severity={intelligence.overallSeverity} className="mt-3" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(["critical", "high", "medium", "low"] as const).map((severity) => (
                <div key={severity} className="rounded-md border border-border bg-background px-3 py-2">
                  <p className="text-lg font-semibold text-foreground">{intelligence.severityCounts[severity]}</p>
                  <p className="text-xs text-muted-foreground">{RISK_SEVERITY_LABELS[severity]}</p>
                </div>
              ))}
            </div>
          </div>
          <details className="mt-4 rounded-md border border-border bg-background px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-primary">How is the overall risk score calculated?</summary>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <p>{intelligence.scoringModel.ruleScoring}</p>
              <p>{intelligence.scoringModel.categoryAggregation}</p>
              <p>{intelligence.scoringModel.overallAggregation}</p>
              <p className="break-words rounded-md border border-border px-2 py-1 font-mono text-[11px] text-foreground">
                {intelligence.scoringModel.overallFormula}
              </p>
              <div className="space-y-1">
                {intelligence.scoringModel.severityBands.map((band) => (
                  <p key={band.severity}>
                    {band.label}: {band.condition}
                  </p>
                ))}
              </div>
            </div>
          </details>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="space-y-3 text-sm">
            <MetaRow label="Dataset" value={intelligence.dataset.name} />
            <MetaRow label="Module scope" value={intelligence.scope} />
            <MetaRow label="Rows" value={intelligence.dataset.rowCount.toLocaleString()} />
            <MetaRow label="Last calculated" value={formatDateTime(intelligence.calculatedAt)} />
            <MetaRow label="Trend" value={intelligence.trendComparison} />
          </div>
          <Link
            href={intelligence.dataset.sourceHref}
            className="mt-4 inline-flex min-h-9 items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Open source
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {intelligence.categorySummaries.map((summary) => (
          <RiskSummaryCard key={summary.category} summary={summary} />
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Prioritized risks</h2>
            <p className="text-xs text-muted-foreground">Sorted by severity, rule score, and weighted contribution.</p>
          </div>
          <ArrowDownWideNarrow className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        {intelligence.findings.length > 0 ? (
          <div className="divide-y divide-border">
            {intelligence.findings.map((finding) => (
              <RiskFindingRow key={finding.ruleId} finding={finding} />
            ))}
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">No triggered risk rules for the selected dataset.</div>
        )}
      </section>
    </>
  )
}

function RiskSummaryCard({ summary }: { summary: RiskCategorySummary }) {
  const Icon = summary.triggeredRuleCount > 0 ? ShieldAlert : CheckCircle2
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{summary.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.triggeredRuleCount} of {summary.applicableRuleCount} applicable rules triggered
          </p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-2xl font-semibold text-foreground">{summary.score}</span>
        </div>
        <SeverityBadge severity={summary.severity} />
      </div>
      {summary.topTriggeredRules.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {summary.topTriggeredRules.map((rule) => (
            <li key={rule.ruleId} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{rule.title}:</span> {rule.metricDisplay}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

function RiskFindingRow({ finding }: { finding: RiskFinding }) {
  const explanation = finding.explanation
  return (
    <article className="px-5 py-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <span className="text-xs text-muted-foreground">{RISK_CATEGORY_LABELS[finding.category]}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-foreground">{finding.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{explanation.evidence.whatHappened}</p>
          <Link href={finding.sourceHref} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">
            {finding.sourceLabel}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <MetricPill label="Rule score" value={`${finding.score} / 100`} />
          <MetricPill label={explanation.metricLabel} value={explanation.metricDisplay} />
          <MetricPill label="Contribution to category" value={explanation.score.contributionDisplay} />
        </div>
      </div>
      <details className="mt-3 rounded-md border border-border bg-background px-3 py-2">
        <summary className="cursor-pointer rounded-md text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2">
          Why {finding.severityLabel.toLowerCase()}? How was this calculated?
        </summary>
        <div className="mt-4 space-y-5">
          <RiskWhatHappenedSection finding={finding} />
          <RiskWhySeveritySection finding={finding} />
          <RiskInvestigationSection finding={finding} />
          <RiskTechnicalSection finding={finding} />
        </div>
      </details>
    </article>
  )
}

function RiskWhatHappenedSection({ finding }: { finding: RiskFinding }) {
  const evidence = finding.explanation.evidence
  const previous = evidence.values[0]
  const current = evidence.values[1]
  const showsComparison = Boolean(
    evidence.periodsCompared && evidence.absoluteChange && evidence.percentChange && previous && current,
  )
  return (
    <section>
      <RiskSectionHeading>What happened</RiskSectionHeading>
      {showsComparison ? (
        <div className="mt-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
            <RiskValueCard caption={previous.label} value={previous.display} captionBadge="Previous" />
            <div className="flex items-center justify-center py-1 sm:py-0">
              <span aria-hidden="true" className="rotate-90 text-base text-muted-foreground sm:rotate-0">
                →
              </span>
              <span className="sr-only">changed to</span>
            </div>
            <RiskValueCard caption={current.label} value={current.display} captionBadge="Current" />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <RiskChangeStat label="Absolute change" display={evidence.absoluteChange?.display ?? ""} />
            <RiskChangeStat label="Relative change" display={evidence.percentChange?.display ?? ""} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Periods compared: <span className="font-medium text-foreground">{evidence.periodsCompared}</span>
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <ul className="grid gap-2 sm:grid-cols-2">
            {evidence.values.map((value) => (
              <li key={value.label} className="min-w-0 rounded-md border border-border bg-card px-3 py-2">
                <p className="break-words text-[11px] text-muted-foreground">{value.label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-foreground">{value.display}</p>
              </li>
            ))}
          </ul>
          {evidence.absoluteChange ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Change: <span className="font-medium text-foreground">{evidence.absoluteChange.display}</span>
            </p>
          ) : null}
          {!showsComparison && evidence.percentChange ? (            <p className="text-xs text-muted-foreground">
              {finding.explanation.metricLabel}: <span className="font-medium text-foreground">{evidence.percentChange.display}</span>
            </p>
          ) : null}
          {evidence.periodsCompared ? (
            <p className="text-xs text-muted-foreground">
              Periods compared: <span className="font-medium text-foreground">{evidence.periodsCompared}</span>
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}

function RiskWhySeveritySection({ finding }: { finding: RiskFinding }) {
  const explanation = finding.explanation
  return (
    <section>
      <RiskSectionHeading>Why {finding.severityLabel}?</RiskSectionHeading>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <RiskStatCard label="Measured" caption={explanation.metricLabel} value={explanation.metricDisplay} />
        <RiskStatCard label={`${finding.severityLabel} threshold`} value={explanation.threshold.display} />
        <RiskStatCard label="Risk score" value={`${finding.score} / 100`} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{explanation.threshold.severityReason}</p>
      <ul className="mt-3 space-y-1">
        {explanation.threshold.bands.map((band) => (
          <li
            key={`${band.severity}-${band.display}`}
            className={
              band.matched
                ? "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 font-semibold text-foreground"
                : "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-transparent px-2 py-1.5 text-muted-foreground"
            }
          >
            <span>{RISK_SEVERITY_LABELS[band.severity]}</span>
            <span>{band.display}</span>
            <span>
              score {band.score}
              {band.matched ? " — matched" : ""}
            </span>
          </li>
        ))}
      </ul>
      {explanation.evidence.interpretation ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">What this means: </span>
          {explanation.evidence.interpretation}
        </p>
      ) : null}
    </section>
  )
}

function RiskInvestigationSection({ finding }: { finding: RiskFinding }) {
  return (
    <section>
      <RiskSectionHeading>Recommended investigation</RiskSectionHeading>
      <p className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
        {finding.explanation.investigation}
      </p>
    </section>
  )
}

function RiskTechnicalSection({ finding }: { finding: RiskFinding }) {
  const explanation = finding.explanation
  const evidence = explanation.evidence
  return (
    <details className="rounded-md border border-border bg-card px-3 py-2">
      <summary className="cursor-pointer rounded-md text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2">
        Technical calculation details
      </summary>
      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <p>
          Rule score: <span className="font-medium text-foreground">{explanation.score.ruleScore} / 100</span> ({finding.severityLabel} band)
        </p>
        <p>
          Importance weight: <span className="font-medium text-foreground">{explanation.score.weight}</span>
        </p>
        <p>
          Weighted contribution:{" "}
          <span className="break-words font-mono text-[11px] text-foreground">{explanation.score.contributionDisplay}</span>
        </p>
        <p>{explanation.score.contributionNote}</p>
        {explanation.score.categoryFormula ? (
          <p className="break-words rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground">
            {explanation.score.categoryFormula}
          </p>
        ) : null}
        <p>
          Source metric: <span className="font-medium text-foreground">{evidence.sourceMetric}</span>
        </p>
        {evidence.sourceColumns.length > 0 ? (
          <p className="break-words">
            Source columns: <span className="font-medium text-foreground">{evidence.sourceColumns.join(", ")}</span>
          </p>
        ) : null}
        {evidence.periodsCompared ? (
          <p>
            Periods compared: <span className="font-medium text-foreground">{evidence.periodsCompared}</span>
          </p>
        ) : null}
        {evidence.scope ? (
          <p className="break-words">
            Row scope: <span className="font-medium text-foreground">{evidence.scope}</span>
          </p>
        ) : null}
        {evidence.unavailable.length > 0 ? (
          <p className="break-words">Not available: {evidence.unavailable.join(" ")}</p>
        ) : null}
      </div>
    </details>
  )
}

function RiskSectionHeading({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">{children}</p>
}

function RiskValueCard({ caption, value, captionBadge }: { caption: string; value: string; captionBadge: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
          {captionBadge}
        </span>
        <span className="break-words text-[11px] text-muted-foreground">{caption}</span>
      </div>
      <p className="mt-1 break-words text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

function RiskChangeStat({ label, display }: { label: string; display: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{display}</p>
    </div>
  )
}

function RiskStatCard({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
      {caption ? <p className="mt-1 break-words text-[11px] text-muted-foreground">{caption}</p> : null}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <section className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-card p-6 text-center">
      <div className="max-w-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Risk Intelligence needs business data</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link
          href="/app/upload"
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Upload dataset
        </Link>
      </div>
    </section>
  )
}

function SeverityBadge({ severity, className = "" }: { severity: RiskSeverity; className?: string }) {
  const classes: Record<RiskSeverity, string> = {
    low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    medium: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    high: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    critical: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  }
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${classes[severity]} ${className}`}>
      {RISK_SEVERITY_LABELS[severity]}
    </span>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function formatDateTime(value: string) {
  const date = parseCanonicalDate(value)
  if (!date) return "Not available"
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function safeRiskPageReason(reason: string) {
  const text = reason.trim().toLowerCase()
  if (text.includes("database")) return "The risk data source is temporarily unavailable."
  if (text.includes("access") || text.includes("denied") || text.includes("unauthorized")) return "This dataset is not available in the current session."
  if (text.includes("not found")) return "The selected dataset is no longer available."
  return "The selected dataset could not be prepared for risk analysis."
}

function serializeRiskPageError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message, stack: error.cause.stack } : undefined,
    }
  }
  return { message: String(error) }
}
