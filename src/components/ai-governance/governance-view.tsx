import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { getAiGovernanceSnapshot } from "@/lib/ai-governance/governance-service"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FileBarChart2,
  FileText,
  History,
  Info,
  KeyRound,
  MessageSquare,
  RefreshCw,
  Server,
  Settings,
  ShieldAlert,
  UserCheck,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import type React from "react"

export const AI_GOVERNANCE_SECTIONS = [
  { slug: "overview", label: "Overview" },
  { slug: "transparency", label: "Transparency" },
  { slug: "providers", label: "Providers" },
  { slug: "models", label: "Models" },
  { slug: "audit-log", label: "Audit Log" },
  { slug: "ai-policies", label: "Policies" },
  { slug: "privacy", label: "Privacy" },
  { slug: "compliance", label: "Compliance" },
  { slug: "risk", label: "Risk" },
  { slug: "feedback", label: "Feedback" },
  { slug: "reports", label: "Reports" },
] as const

export type AiGovernanceSection = (typeof AI_GOVERNANCE_SECTIONS)[number]["slug"]
export type AiGovernanceSnapshot = Awaited<ReturnType<typeof getAiGovernanceSnapshot>>
type GovernanceStatus = "Ready" | "Needs setup" | "Needs data" | "Warning" | "Error"

export function normalizeGovernanceSection(value?: string | null): AiGovernanceSection {
  const found = AI_GOVERNANCE_SECTIONS.find((section) => section.slug === value)
  return found?.slug || "overview"
}

export function AiGovernanceView({
  activeSection,
  snapshot,
}: {
  activeSection: AiGovernanceSection
  snapshot: AiGovernanceSnapshot
}) {
  const activeLabel = AI_GOVERNANCE_SECTIONS.find((section) => section.slug === activeSection)?.label || "Overview"

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-4 px-3 sm:px-5 lg:px-6">
      <section className="rounded-lg border border-cyan-400/20 bg-card/90 p-2.5 shadow-sm sm:p-3" aria-label="AI Governance live status">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <HeaderBadge label="Compliance score" value={`${snapshot.compliance.score}%`} status={statusForScore(snapshot.compliance.score)} />
          <HeaderBadge label="Active providers" value={`${snapshot.providers.online}/${snapshot.providers.total}`} status={snapshot.providers.online > 0 ? "Ready" : "Needs setup"} />
          <HeaderBadge label="Audit logging" value={snapshot.audit.aiRequests > 0 ? "Recording" : "No data"} status={snapshot.audit.aiRequests > 0 ? "Ready" : "Needs data"} />
          <HeaderBadge label="Human oversight" value={snapshot.overrides.totalOverrides > 0 ? "Active" : "No events"} status={snapshot.overrides.totalOverrides > 0 ? "Ready" : "Needs data"} />
          <HeaderBadge label="Last updated" value={formatDateTime(snapshot.generatedAt)} status="Ready" />
        </div>
      </section>

      <nav className="sticky top-16 z-20 overflow-x-auto rounded-lg border border-border bg-background/95 p-1.5 shadow-sm backdrop-blur" aria-label="AI Governance sections">
        <div className="flex min-w-max gap-1.5">
          {AI_GOVERNANCE_SECTIONS.map((section) => (
            <Link
              key={section.slug}
              href={section.slug === "overview" ? "/app/ai-governance" : `/app/ai-governance/${section.slug}`}
              aria-current={section.slug === activeSection ? "page" : undefined}
              className={[
                "inline-flex min-h-10 items-center rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                section.slug === activeSection
                  ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-950/20 ring-1 ring-cyan-200/40"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {section.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="-mb-1">
        <h3 className="text-xl font-semibold text-foreground">{activeLabel}</h3>
      </div>

      {renderSection(activeSection, snapshot)}
    </div>
  )
}

export function AiGovernanceHeaderActions({ activeSection = "overview" }: { activeSection?: AiGovernanceSection }) {
  return (
    <>
      <ActionButton href="/api/ai-governance/reports?type=compliance" icon={Download} label="Export compliance report" primary />
      <ActionButton href="/app/settings/ai-providers" icon={Settings} label="Configure AI" />
      <ActionButton
        href={activeSection === "overview" ? "/app/ai-governance" : `/app/ai-governance/${activeSection}`}
        icon={RefreshCw}
        label="Refresh status"
      />
    </>
  )
}

function renderSection(section: AiGovernanceSection, snapshot: AiGovernanceSnapshot) {
  switch (section) {
    case "transparency":
      return <TransparencySection snapshot={snapshot} />
    case "providers":
      return <ProvidersSection snapshot={snapshot} />
    case "models":
      return <ModelsSection snapshot={snapshot} />
    case "audit-log":
      return <AuditLogSection snapshot={snapshot} />
    case "ai-policies":
      return <PoliciesSection snapshot={snapshot} />
    case "privacy":
      return <PrivacySection snapshot={snapshot} />
    case "compliance":
      return <ComplianceSection snapshot={snapshot} />
    case "risk":
      return <RiskSection snapshot={snapshot} />
    case "feedback":
      return <FeedbackSection snapshot={snapshot} />
    case "reports":
      return <ReportsSection snapshot={snapshot} />
    default:
      return <OverviewSection snapshot={snapshot} />
  }
}

function OverviewSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="space-y-4">
      <OverviewStatusStrip snapshot={snapshot} />

      <div className="grid gap-4 xl:grid-cols-[5.5fr_6.5fr]">
        <ReadinessCard snapshot={snapshot} />
        <ControlMatrix snapshot={snapshot} />
      </div>

      <AiGeneratedExample snapshot={snapshot} />
    </div>
  )
}

function OverviewStatusStrip({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  const items = [
    {
      icon: Activity,
      label: "Requests",
      value: formatNumber(snapshot.audit.aiRequests),
      status: snapshot.audit.aiRequests > 0 ? "Ready" as const : "Needs data" as const,
      tooltip: "Provider audit request count.",
    },
    {
      icon: History,
      label: "Traces",
      value: formatNumber(snapshot.audit.interactionTraces),
      status: snapshot.audit.interactionTraces > 0 ? "Ready" as const : "Needs data" as const,
      tooltip: "AI interaction trace count.",
    },
    {
      icon: MessageSquare,
      label: "Feedback",
      value: formatNumber(snapshot.audit.feedbackCount),
      status: snapshot.audit.feedbackCount > 0 ? "Ready" as const : "Needs data" as const,
      tooltip: "Helpful and not-helpful feedback count.",
    },
    {
      icon: AlertTriangle,
      label: "Failures",
      value: formatNumber(snapshot.audit.failures),
      status: snapshot.audit.failures > 0 ? "Warning" as const : "Ready" as const,
      tooltip: "Provider failures recorded in audit metadata.",
    },
  ]

  return (
    <section className="grid gap-2 rounded-lg border border-border bg-card/70 p-2 shadow-sm sm:grid-cols-2 xl:grid-cols-4" aria-label="AI Governance activity status">
      {items.map((item) => (
        <CompactMetric key={item.label} {...item} />
      ))}
    </section>
  )
}

function ReadinessCard({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  const readiness = readinessModel(snapshot)
  const missing = snapshot.compliance.checks.filter((check) => !check.complete)
  const nextAction = nextRecommendedAction(snapshot)

  return (
    <Card className="overflow-hidden border-cyan-400/25 bg-card shadow-md shadow-cyan-950/10">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Compliance readiness</CardTitle>
            <CardDescription>Current readiness based on recorded controls and available governance data.</CardDescription>
          </div>
          <StatusPill status={readiness.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-5 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center xl:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="relative mx-auto h-36 w-36 md:h-40 md:w-40">
            <div className="absolute inset-0 rounded-full bg-muted" />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(rgb(34 211 238) ${snapshot.compliance.score * 3.6}deg, hsl(var(--muted)) 0deg)`,
              }}
            />
            <div className="absolute inset-3 grid place-items-center rounded-full border border-border bg-card">
              <span className="text-3xl font-semibold text-foreground">{snapshot.compliance.score}%</span>
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-lg font-semibold text-foreground">{readiness.label}</p>
            <p className="text-sm leading-6 text-muted-foreground">{readiness.explanation}</p>
            {missing.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Lowered by {missing.slice(0, 3).map((check) => check.label.toLowerCase()).join(", ")}
                {missing.length > 3 ? `, and ${missing.length - 3} more control${missing.length - 3 === 1 ? "" : "s"}` : ""}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">All tracked readiness controls currently have supporting data.</p>
            )}
          </div>
        </div>
        <div className="rounded-md border border-cyan-400/20 bg-cyan-400/5 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Next recommended action</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <p className="text-sm text-foreground">{nextAction.text}</p>
            <Link href={nextAction.href} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              {nextAction.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ControlMatrix({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  const controls = controlItems(snapshot)
  return (
    <Card className="border-border bg-card/95 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Control matrix</CardTitle>
        <CardDescription>Operational readiness across transparency, logging, oversight, privacy, and risk controls.</CardDescription>
      </CardHeader>
      <CardContent className="grid auto-rows-fr gap-3 md:grid-cols-2">
        {controls.map((control) => (
          <div key={control.label} className="flex h-full rounded-md border border-border bg-background p-3">
            <div className="flex w-full items-start gap-3">
              <StatusIcon status={control.status} />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{control.label}</p>
                  <StatusPill status={control.status} />
                </div>
                <p className="mt-1 flex-1 text-sm leading-5 text-muted-foreground">{control.description}</p>
                <Link href={control.href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
                  {control.action}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TransparencySection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[5fr_7fr]">
      <AiGeneratedExample snapshot={snapshot} />
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Required AI output metadata</CardTitle>
          <CardDescription>Assistant answers identify how and where the output was generated.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            ["AI-generated", "Displayed on assistant responses"],
            ["Provider", latestProvider(snapshot)],
            ["Model", latestModel(snapshot)],
            ["Mode", formatMode(snapshot.settings.mode)],
            ["Confidence score", estimateConfidence(snapshot)],
            ["Generation timestamp", formatDateTime(snapshot.generatedAt)],
            ["Reasoning summary", "Shows the grounded reason or limitation behind recommendations"],
            ["Human controls", "Accept, reject, edit, and undo"],
          ].map(([label, value]) => (
            <InfoTile key={label} label={label} value={value} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ProvidersSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon={CheckCircle2} label="Ready" value={formatNumber(snapshot.providers.online)} description="Healthy providers" status={snapshot.providers.online > 0 ? "Ready" : "Needs setup"} tooltip="Providers with successful health status." compact />
        <KpiCard icon={XCircle} label="Errors" value={formatNumber(snapshot.providers.offline)} description="Unavailable or untested" status={snapshot.providers.offline > 0 ? "Error" : "Ready"} tooltip="Providers without a healthy status." compact />
        <KpiCard icon={AlertTriangle} label="Warnings" value={formatNumber(snapshot.providers.rateLimited)} description="Provider throttling" status={snapshot.providers.rateLimited > 0 ? "Warning" : "Ready"} tooltip="Rate-limited providers need attention." compact />
        <KpiCard icon={KeyRound} label="Invalid keys" value={formatNumber(snapshot.providers.invalidKey)} description="Credential failures" status={snapshot.providers.invalidKey > 0 ? "Error" : "Ready"} tooltip="Invalid credentials block cloud calls." compact />
        <KpiCard icon={Zap} label="Fallback" value={formatNumber(snapshot.providers.fallbackActive)} description="Fallback providers" status={snapshot.providers.fallbackActive > 0 ? "Ready" : "Needs setup"} tooltip="Fallback providers protect continuity." compact />
      </div>
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Provider status</CardTitle>
          <CardDescription>API keys stay hidden. Only status, model, host, and routing metadata are displayed.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            columns={["Provider", "Model", "Status", "Default", "Fallback", "Endpoint", "Last checked"]}
            rows={snapshot.providers.models.map((provider) => [
              provider.provider,
              provider.model,
              <StatusPill key={`${provider.provider}-status`} status={normalizeProviderStatus(provider.status)} />,
              provider.default ? "Yes" : "No",
              provider.fallback ? "Yes" : "No",
              provider.endpointHost,
              provider.lastCheckedAt ? formatDateTime(provider.lastCheckedAt) : "Not tested",
            ])}
            empty={<EmptyState icon={Server} title="No provider configured" text="Configure at least one AI provider to monitor health and usage." actionHref="/app/settings/ai-providers" actionLabel="Configure AI provider" />}
          />
        </CardContent>
      </Card>
      <SettingsCard snapshot={snapshot} />
    </div>
  )
}

function ModelsSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {snapshot.providers.models.length > 0 ? snapshot.providers.models.map((model) => (
        <Card key={`${model.provider}-${model.model}`} className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{model.model}</CardTitle>
                <CardDescription>{model.provider}</CardDescription>
              </div>
              <StatusPill status={normalizeProviderStatus(model.status)} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <MetadataChip label="Default" value={model.default ? "Yes" : "No"} />
            <MetadataChip label="Fallback" value={model.fallback ? "Yes" : "No"} />
            <MetadataChip label="Endpoint" value={model.endpointHost} />
            <MetadataChip label="Last checked" value={model.lastCheckedAt ? formatDateTime(model.lastCheckedAt) : "Not tested"} />
          </CardContent>
        </Card>
      )) : <div className="md:col-span-2 xl:col-span-3"><EmptyState icon={Bot} title="No models configured" text="Connect an AI provider to register model metadata for governance review." actionHref="/app/settings/ai-providers" actionLabel="Configure AI" /></div>}
    </div>
  )
}

function AuditLogSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle>AI audit log</CardTitle>
        <CardDescription>
          Searchable audit APIs include user, tenant, dataset, prompt trace, provider, model, mode, timestamp, latency, tokens, confidence proxy, result, and manual override metadata.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveTable
          columns={["Timestamp", "Dataset", "Provider", "Model", "Mode", "Latency", "Tokens", "Result"]}
          rows={snapshot.recentAuditEntries.map((entry) => [
            formatDateTime(entry.timestamp),
            entry.datasetId || "No dataset",
            entry.providerName,
            entry.modelName,
            formatMode(entry.mode),
            entry.latencyMs ? `${entry.latencyMs} ms` : "Not recorded",
            formatNumber(entry.tokens || 0),
            <StatusPill key={`${entry.id}-result`} status={entry.success ? "Ready" : "Warning"} label={entry.result} />,
          ])}
          empty={<EmptyState icon={History} title="No AI requests recorded" text="Run an AI analysis to begin collecting governance data." actionHref="/app/assistant" actionLabel="Open AI Assistant" />}
        />
      </CardContent>
    </Card>
  )
}

function PoliciesSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {snapshot.policies.map((policy) => (
        <Card key={policy.title} className="border-border bg-card shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
              <FileText className="h-4 w-4" />
            </div>
            <CardTitle>{policy.title}</CardTitle>
            <CardDescription>{policy.summary}</CardDescription>
          </CardHeader>
        </Card>
      ))}
      <Card className="border-border bg-card shadow-sm lg:col-span-2">
        <CardHeader>
          <CardTitle>AI literacy</CardTitle>
          <CardDescription>Short user education content for limits, confidence, verification, and human review.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.literacy.map((item) => (
            <InfoTile key={item.title} label={item.title} value={item.body} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function PrivacySection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle>Privacy posture</CardTitle>
        <CardDescription>Local processing availability, cloud routing, provider use, retention, and sensitive-data controls.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.privacy.items.map((item) => (
          <InfoTile key={item.label} label={item.label} value={item.value} status={normalizeDataStatus(item.status)} />
        ))}
      </CardContent>
    </Card>
  )
}

function ComplianceSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[4fr_8fr]">
      <ReadinessCard snapshot={snapshot} />
      <ControlMatrix snapshot={snapshot} />
    </div>
  )
}

function RiskSection({ snapshot, compact = false }: { snapshot: AiGovernanceSnapshot; compact?: boolean }) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle>AI risk controls</CardTitle>
        <CardDescription>Hallucination, missing-data, confidence, data-quality, provider, and prompt-injection readiness.</CardDescription>
      </CardHeader>
      <CardContent className={compact ? "grid gap-3 lg:grid-cols-3" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
        {snapshot.risk.risks.map((risk) => (
          <InfoTile key={risk.label} label={risk.label} value={risk.detail} status={normalizeRiskStatus(risk.level)} />
        ))}
      </CardContent>
    </Card>
  )
}

function FeedbackSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[4fr_8fr]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <KpiCard icon={MessageSquare} label="Feedback received" value={formatNumber(snapshot.audit.feedbackCount)} description="Helpful and not helpful votes" status={snapshot.audit.feedbackCount > 0 ? "Ready" : "Needs data"} tooltip="Feedback is recorded from assistant response controls." />
        <KpiCard icon={UserCheck} label="Manual overrides" value={formatNumber(snapshot.overrides.totalOverrides)} description="Accept, reject, edit, undo" status={snapshot.overrides.totalOverrides > 0 ? "Ready" : "Needs data"} tooltip="Manual control events confirm human oversight." />
      </div>
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Recent human oversight</CardTitle>
          <CardDescription>Manual actions are recorded separately from thumbs feedback.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            columns={["Time", "Action", "Dataset", "Trace", "Reason"]}
            rows={snapshot.overrides.recent.map((entry) => [
              formatDateTime(entry.createdAt),
              entry.action,
              entry.datasetId || "No dataset",
              entry.traceId || "No trace",
              entry.reason || "No reason",
            ])}
            empty={<EmptyState icon={UserCheck} title="No audit events" text="Audit events will appear when users interact with AI-generated outputs." actionHref="/app/assistant" actionLabel="Review AI outputs" />}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function ReportsSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  const reports = reportCards(snapshot)
  return (
    <div className="space-y-4">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Report center</CardTitle>
          <CardDescription>
            Generate governance reports only when enough tenant data exists to make the export meaningful.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <ReportCard key={report.name} report={report} />
        ))}
      </div>
    </div>
  )
}

function AiGeneratedExample({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <Card className="border-cyan-400/20 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>AI-generated response</CardTitle>
            <CardDescription>Compact transparency metadata shown with AI-assisted outputs.</CardDescription>
          </div>
          <StatusPill status="Ready" label="AI-generated" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <MetadataChip label="Provider" value={latestProvider(snapshot)} />
          <MetadataChip label="Model" value={latestModel(snapshot)} />
          <MetadataChip label="Mode" value={formatMode(snapshot.settings.mode)} />
          <MetadataChip label="Confidence" value={estimateConfidence(snapshot)} />
          <MetadataChip label="Generated" value={formatDateTime(snapshot.generatedAt)} />
          <MetadataChip label="Dataset" value={snapshot.recentAuditEntries[0]?.datasetId || snapshot.recentTraces[0]?.datasetId || "No dataset"} />
          <MetadataChip label="Human review" value={snapshot.overrides.totalOverrides > 0 ? "Oversight recorded" : "No override recorded"} />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <InfoTile label="Reasoning summary" value="The answer uses available dataset context, deterministic calculations when possible, provider routing metadata, and confidence limits." />
          <InfoTile label="Data sources" value={snapshot.recentAuditEntries.length > 0 || snapshot.recentTraces.length > 0 ? "Recent AI audit logs and interaction traces" : "No AI request data recorded yet"} status={snapshot.recentAuditEntries.length > 0 || snapshot.recentTraces.length > 0 ? "Ready" : "Needs data"} />
          <InfoTile label="Limitations" value="Low data coverage, missing providers, or provider failures reduce readiness and should be reviewed before relying on outputs." status={snapshot.providers.total > 0 ? "Ready" : "Needs setup"} />
        </div>
      </CardContent>
    </Card>
  )
}

function SettingsCard({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle>AI settings</CardTitle>
        <CardDescription>Governance defaults. Provider credentials remain managed in AI Providers settings.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Preferred provider" value={snapshot.settings.preferredProviderId || "Default routing"} />
        <InfoTile label="Preferred model" value={snapshot.settings.preferredModel || "Provider default"} />
        <InfoTile label="Mode" value={formatMode(snapshot.settings.mode)} />
        <InfoTile label="Fallback provider" value={snapshot.settings.fallbackProviderId || "UseClevr fallback policy"} />
        <InfoTile label="Temperature" value={String(snapshot.settings.temperature)} />
        <InfoTile label="Max tokens" value={snapshot.settings.maxTokens.toLocaleString()} />
        <InfoTile label="Logging" value={snapshot.settings.loggingEnabled ? "Enabled" : "Disabled"} status={snapshot.settings.loggingEnabled ? "Ready" : "Warning"} />
        <InfoTile label="Retention" value={`${snapshot.settings.retentionDays} days`} />
      </CardContent>
    </Card>
  )
}

function CompactMetric({
  icon: Icon,
  label,
  value,
  status,
  tooltip,
}: {
  icon: LucideIcon
  label: string
  value: string
  status: GovernanceStatus
  tooltip: string
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-md border border-border bg-background/80 px-3 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
          <button type="button" title={tooltip} aria-label={`${label}: ${tooltip}`} className="rounded-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-0.5 truncate text-lg font-semibold text-foreground">{value}</p>
      </div>
      <StatusDot status={status} />
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  description,
  status,
  tooltip,
  compact = false,
}: {
  icon: LucideIcon
  label: string
  value: string
  description: string
  status: GovernanceStatus
  tooltip: string
  compact?: boolean
}) {
  if (compact) {
    return (
      <Card className="h-full border-border bg-card/90 shadow-sm">
        <CardContent className="relative flex h-full min-h-[184px] flex-col items-center p-4 pt-8 text-center">
          <button type="button" title={tooltip} aria-label={`${label}: ${tooltip}`} className="absolute right-4 top-4 rounded-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="mt-4 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
          <div className="mt-4">
            <StatusPill status={status} />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <button type="button" title={tooltip} aria-label={`${label}: ${tooltip}`} className="rounded-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="mt-3">
          <StatusPill status={status} />
        </div>
      </CardContent>
    </Card>
  )
}

function ReportCard({ report }: { report: ReturnType<typeof reportCards>[number] }) {
  const Icon = report.icon
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
            <Icon className="h-5 w-5" />
          </div>
          <StatusPill status={report.status} />
        </div>
        <CardTitle className="pt-2 text-base">{report.name}</CardTitle>
        <CardDescription>{report.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <MetadataChip label="Data" value={report.data} />
          <MetadataChip label="Last generated" value={report.lastGenerated} />
        </div>
        <div className="flex flex-wrap gap-2">
          {report.canGenerate ? (
            <Link href={report.href} className="inline-flex min-h-9 items-center justify-center rounded-md bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              Generate report
            </Link>
          ) : (
            <span aria-disabled="true" className="inline-flex min-h-9 items-center justify-center rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
              Generate report
            </span>
          )}
          <Link href={report.setupHref} className="inline-flex min-h-9 items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            {report.setupLabel}
          </Link>
        </div>
        {!report.canGenerate && <p className="text-sm text-muted-foreground">{report.disabledReason}</p>}
      </CardContent>
    </Card>
  )
}

function ActionButton({ href, icon: Icon, label, primary = false }: { href: string; icon: LucideIcon; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
        primary ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "border border-border bg-background text-foreground hover:bg-muted",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

function HeaderBadge({ label, value, status }: { label: string; value: string; status: GovernanceStatus }) {
  return (
    <div className="rounded-md border border-border bg-background/85 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <StatusDot status={status} />
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function InfoTile({ label, value, status }: { label: string; value: string; status?: GovernanceStatus }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        {status && <StatusPill status={status} />}
      </div>
      <p className="mt-2 text-sm leading-5 text-foreground">{value}</p>
    </div>
  )
}

function MetadataChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm">
      <span className="shrink-0 text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium text-foreground">{value}</span>
    </span>
  )
}

function StatusPill({ status, label }: { status: GovernanceStatus; label?: string }) {
  const styles = statusStyles(status)
  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles.className}`}>
      <styles.Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label || status}
    </span>
  )
}

function StatusIcon({ status }: { status: GovernanceStatus }) {
  const styles = statusStyles(status)
  return (
    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${styles.className}`}>
      <styles.Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}

function StatusDot({ status }: { status: GovernanceStatus }) {
  const styles = statusStyles(status)
  return <span aria-label={status} className={`h-2.5 w-2.5 rounded-full ${styles.dotClassName}`} />
}

function ResponsiveTable({ columns, rows, empty }: { columns: string[]; rows: React.ReactNode[][]; empty: React.ReactNode }) {
  if (rows.length === 0) return <>{empty}</>
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
          <tr>{columns.map((column) => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={index} className="align-top">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[280px] px-3 py-3 text-foreground">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ icon: Icon, title, text, actionHref, actionLabel }: { icon: LucideIcon; title: string; text: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">{title}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
          </div>
        </div>
        <Link href={actionHref} className="inline-flex min-h-9 items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          {actionLabel}
        </Link>
      </div>
    </div>
  )
}

function readinessModel(snapshot: AiGovernanceSnapshot) {
  const score = snapshot.compliance.score
  if (score >= 85) return { status: "Ready" as const, label: "Ready", explanation: "Governance controls have strong supporting evidence across the current dataset." }
  if (score >= 65) return { status: "Warning" as const, label: "Partially ready", explanation: "Core controls exist, but additional data or oversight evidence improves audit readiness." }
  if (score >= 35) return { status: "Needs data" as const, label: "Needs work", explanation: "Several controls need provider activity, audit events, feedback, or human oversight evidence." }
  return { status: "Needs setup" as const, label: "Critical", explanation: "The module is rendering safely, but most governance evidence has not been collected yet." }
}

function nextRecommendedAction(snapshot: AiGovernanceSnapshot) {
  if (snapshot.providers.total === 0) return { text: "Configure at least one AI provider so provider health and model metadata can be monitored.", label: "Configure AI", href: "/app/settings/ai-providers" }
  if (snapshot.audit.aiRequests === 0) return { text: "Run an AI analysis to start collecting audit logs, request metadata, latency, and provider usage.", label: "Open AI Assistant", href: "/app/assistant" }
  if (snapshot.overrides.totalOverrides === 0) return { text: "Review an AI-generated output and record a human decision to prove oversight.", label: "Review AI outputs", href: "/app/assistant" }
  return { text: "Export the current compliance report and keep monitoring readiness as AI usage grows.", label: "Export report", href: "/api/ai-governance/reports?type=compliance" }
}

function controlItems(snapshot: AiGovernanceSnapshot) {
  return [
    {
      label: "Transparency",
      status: "Ready" as GovernanceStatus,
      description: "AI outputs show provider, model, mode, confidence, timestamp, and reasoning summary.",
      action: "View transparency",
      href: "/app/ai-governance/transparency",
    },
    {
      label: "Logging",
      status: snapshot.audit.aiRequests > 0 ? "Ready" as const : "Needs data" as const,
      description: snapshot.audit.aiRequests > 0 ? `${formatNumber(snapshot.audit.aiRequests)} AI request log entries are available.` : "No AI request logs have been recorded yet.",
      action: "View audit log",
      href: "/app/ai-governance/audit-log",
    },
    {
      label: "Human oversight",
      status: snapshot.overrides.totalOverrides > 0 ? "Ready" as const : "Needs data" as const,
      description: snapshot.overrides.totalOverrides > 0 ? `${formatNumber(snapshot.overrides.totalOverrides)} manual override events are recorded.` : "No accept, reject, edit, or undo events are recorded yet.",
      action: "View feedback",
      href: "/app/ai-governance/feedback",
    },
    {
      label: "Provider monitoring",
      status: snapshot.providers.total > 0 ? "Ready" as const : "Needs setup" as const,
      description: snapshot.providers.total > 0 ? `${formatNumber(snapshot.providers.total)} provider configuration${snapshot.providers.total === 1 ? "" : "s"} monitored.` : "No AI providers are configured for health monitoring.",
      action: "View providers",
      href: "/app/ai-governance/providers",
    },
    {
      label: "Privacy",
      status: snapshot.risk.privacyGaps > 0 ? "Needs setup" as const : "Ready" as const,
      description: snapshot.risk.privacyGaps > 0 ? "One or more privacy controls need setup data." : "Retention, provider route, and sensitive-data controls are visible.",
      action: "View privacy",
      href: "/app/ai-governance/privacy",
    },
    {
      label: "Audit readiness",
      status: snapshot.audit.aiRequests > 0 ? "Ready" as const : "Needs data" as const,
      description: snapshot.audit.aiRequests > 0 ? "Audit report data is available." : "Audit reports need AI request history before they become meaningful.",
      action: "View reports",
      href: "/app/ai-governance/reports",
    },
    {
      label: "Feedback",
      status: snapshot.audit.feedbackCount > 0 ? "Ready" as const : "Needs data" as const,
      description: snapshot.audit.feedbackCount > 0 ? `${formatNumber(snapshot.audit.feedbackCount)} feedback events are recorded.` : "No helpful or not-helpful feedback is recorded yet.",
      action: "View feedback",
      href: "/app/ai-governance/feedback",
    },
    {
      label: "Risk controls",
      status: snapshot.risk.highCount > 0 ? "Warning" as const : "Ready" as const,
      description: snapshot.risk.highCount > 0 ? `${formatNumber(snapshot.risk.highCount)} elevated risk area${snapshot.risk.highCount === 1 ? "" : "s"} need review.` : "Tracked AI risk controls are not elevated.",
      action: "View risk",
      href: "/app/ai-governance/risk",
    },
  ]
}

function reportCards(snapshot: AiGovernanceSnapshot) {
  const lastGenerated = formatDateTime(snapshot.generatedAt)
  return [
    {
      icon: FileBarChart2,
      name: "AI Usage Report",
      description: "Review provider usage, models, requests, latency, and failures.",
      data: `${formatNumber(snapshot.audit.aiRequests)} requests`,
      lastGenerated,
      status: snapshot.audit.aiRequests > 0 ? "Ready" as const : "Needs data" as const,
      href: "/api/ai-governance/reports?type=usage",
      canGenerate: snapshot.audit.aiRequests > 0,
      disabledReason: "Run an AI analysis to collect provider usage data before generating this report.",
      setupHref: "/app/assistant",
      setupLabel: "Run AI analysis",
    },
    {
      icon: History,
      name: "Audit Report",
      description: "Export interaction traces, audit events, oversight actions, and result metadata.",
      data: `${formatNumber(snapshot.recentTraces.length + snapshot.recentAuditEntries.length)} audit records`,
      lastGenerated,
      status: snapshot.recentTraces.length + snapshot.recentAuditEntries.length > 0 ? "Ready" as const : "Needs data" as const,
      href: "/api/ai-governance/reports?type=audit",
      canGenerate: snapshot.recentTraces.length + snapshot.recentAuditEntries.length > 0,
      disabledReason: "Audit reports need AI request or interaction history.",
      setupHref: "/app/assistant",
      setupLabel: "Open AI Assistant",
    },
    {
      icon: Server,
      name: "Provider Statistics",
      description: "Review configured providers, model status, fallback state, and health checks.",
      data: `${formatNumber(snapshot.providers.total)} providers`,
      lastGenerated,
      status: snapshot.providers.total > 0 ? "Ready" as const : "Needs setup" as const,
      href: "/api/ai-governance/reports?type=providers",
      canGenerate: snapshot.providers.total > 0,
      disabledReason: "Configure at least one AI provider before generating provider statistics.",
      setupHref: "/app/settings/ai-providers",
      setupLabel: "Configure AI",
    },
    {
      icon: ShieldAlert,
      name: "Error Report",
      description: "Review provider failures, unavailable routes, rejected keys, and fallback events.",
      data: `${formatNumber(snapshot.audit.failures)} failures`,
      lastGenerated,
      status: snapshot.audit.failures > 0 ? "Warning" as const : "Needs data" as const,
      href: "/api/ai-governance/reports?type=errors",
      canGenerate: snapshot.audit.failures > 0,
      disabledReason: "No provider failures are recorded, so there is no error report data yet.",
      setupHref: "/app/ai-governance/providers",
      setupLabel: "View providers",
    },
    {
      icon: ClipboardCheck,
      name: "Compliance Report",
      description: "Export readiness controls, current score, policy coverage, and missing evidence.",
      data: `${snapshot.compliance.score}% readiness`,
      lastGenerated,
      status: statusForScore(snapshot.compliance.score),
      href: "/api/ai-governance/reports?type=compliance",
      canGenerate: true,
      disabledReason: "",
      setupHref: "/app/ai-governance/compliance",
      setupLabel: "View compliance",
    },
  ]
}

function latestProvider(snapshot: AiGovernanceSnapshot) {
  return snapshot.recentAuditEntries[0]?.providerName || snapshot.providers.models[0]?.provider || "Direct Data Analysis"
}

function latestModel(snapshot: AiGovernanceSnapshot) {
  return snapshot.recentAuditEntries[0]?.modelName || snapshot.providers.models[0]?.model || "Deterministic engine"
}

function estimateConfidence(snapshot: AiGovernanceSnapshot) {
  const base = snapshot.compliance.score
  const penalty = snapshot.risk.highCount * 8 + snapshot.risk.privacyGaps * 5
  return `${Math.max(45, Math.min(98, base - penalty))}%`
}

function formatMode(mode: string) {
  if (mode === "local") return "Local AI"
  if (mode === "byok") return "Hybrid AI"
  if (mode === "useclevr_cloud") return "Cloud AI"
  return "Hybrid AI"
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not available"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function statusForScore(score: number): GovernanceStatus {
  if (score >= 85) return "Ready"
  if (score >= 65) return "Warning"
  if (score >= 35) return "Needs data"
  return "Needs setup"
}

function normalizeProviderStatus(value: string): GovernanceStatus {
  if (value === "Online" || value === "Fallback Active") return "Ready"
  if (value === "Rate Limited") return "Warning"
  if (value === "Invalid Key" || value === "Offline") return "Error"
  return "Needs setup"
}

function normalizeDataStatus(value: string): GovernanceStatus {
  if (value === "Configured") return "Ready"
  if (value === "Limited") return "Warning"
  return "Needs setup"
}

function normalizeRiskStatus(value: string): GovernanceStatus {
  if (value === "Elevated") return "Warning"
  if (value === "Limited") return "Needs setup"
  if (value === "Medium") return "Needs data"
  return "Ready"
}

function statusStyles(status: GovernanceStatus): { Icon: LucideIcon; className: string; dotClassName: string } {
  if (status === "Ready") {
    return { Icon: CheckCircle2, className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dotClassName: "bg-emerald-400" }
  }
  if (status === "Warning") {
    return { Icon: AlertTriangle, className: "border-yellow-500/35 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300", dotClassName: "bg-yellow-400" }
  }
  if (status === "Error") {
    return { Icon: XCircle, className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300", dotClassName: "bg-red-400" }
  }
  if (status === "Needs setup") {
    return { Icon: Settings, className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", dotClassName: "bg-cyan-400" }
  }
  return { Icon: Clock3, className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", dotClassName: "bg-amber-400" }
}
