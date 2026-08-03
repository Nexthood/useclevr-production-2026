import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { getAiGovernanceSnapshot } from "@/lib/ai-governance/governance-service"
import Link from "next/link"
import type React from "react"

export const AI_GOVERNANCE_SECTIONS = [
  { slug: "overview", label: "Overview" },
  { slug: "transparency", label: "Transparency" },
  { slug: "providers", label: "Providers" },
  { slug: "models", label: "Models" },
  { slug: "audit-log", label: "Audit Log" },
  { slug: "ai-policies", label: "AI Policies" },
  { slug: "privacy", label: "Privacy" },
  { slug: "compliance", label: "Compliance" },
  { slug: "risk", label: "Risk" },
  { slug: "feedback", label: "Feedback" },
  { slug: "reports", label: "Reports" },
] as const

export type AiGovernanceSection = (typeof AI_GOVERNANCE_SECTIONS)[number]["slug"]
export type AiGovernanceSnapshot = Awaited<ReturnType<typeof getAiGovernanceSnapshot>>

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
    <div className="space-y-5">
      <section className="overflow-x-auto rounded-lg border border-border bg-card p-2">
        <div className="flex min-w-max gap-1">
          {AI_GOVERNANCE_SECTIONS.map((section) => (
            <Link
              key={section.slug}
              href={section.slug === "overview" ? "/app/ai-governance" : `/app/ai-governance/${section.slug}`}
              className={[
                "rounded-md px-3 py-2 text-sm font-medium transition",
                section.slug === activeSection
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {section.label}
            </Link>
          ))}
        </div>
      </section>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">AI Governance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{activeLabel}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Transparency, auditability, provider control, privacy, and human oversight for AI-assisted business decisions.
        </p>
      </div>

      {renderSection(activeSection, snapshot)}
    </div>
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
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Compliance score" value={`${snapshot.compliance.score}%`} detail="Transparency and oversight readiness" />
        <MetricCard label="AI requests" value={String(snapshot.audit.aiRequests)} detail="Provider audit metadata entries" />
        <MetricCard label="Providers" value={String(snapshot.providers.total)} detail={`${snapshot.providers.online} online`} />
        <MetricCard label="Manual overrides" value={String(snapshot.overrides.totalOverrides)} detail="Accept, reject, edit, and undo events" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ComplianceChecklist snapshot={snapshot} />
        <AiGeneratedExample snapshot={snapshot} />
      </div>
      <RiskSection snapshot={snapshot} compact />
    </div>
  )
}

function TransparencySection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <AiGeneratedExample snapshot={snapshot} />
      <Card>
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
            ["Generation timestamp", new Date(snapshot.generatedAt).toLocaleString()],
            ["Reasoning summary", "Shows the grounded reason or limitation behind recommendations"],
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
        <MetricCard label="Online" value={String(snapshot.providers.online)} detail="Healthy providers" />
        <MetricCard label="Offline" value={String(snapshot.providers.offline)} detail="Unavailable or untested" />
        <MetricCard label="Rate limited" value={String(snapshot.providers.rateLimited)} detail="Provider throttling" />
        <MetricCard label="Invalid key" value={String(snapshot.providers.invalidKey)} detail="Credential failures" />
        <MetricCard label="Fallback active" value={String(snapshot.providers.fallbackActive)} detail="Fallback providers" />
      </div>
      <Card>
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
              provider.status,
              provider.default ? "Yes" : "No",
              provider.fallback ? "Yes" : "No",
              provider.endpointHost,
              provider.lastCheckedAt ? new Date(provider.lastCheckedAt).toLocaleString() : "Not tested",
            ])}
            empty="No AI providers are configured yet."
          />
        </CardContent>
      </Card>
      <SettingsCard snapshot={snapshot} />
    </div>
  )
}

function ModelsSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {snapshot.providers.models.length > 0 ? snapshot.providers.models.map((model) => (
        <Card key={`${model.provider}-${model.model}`}>
          <CardHeader>
            <CardTitle>{model.model}</CardTitle>
            <CardDescription>{model.provider} · {model.status}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Default" value={model.default ? "Yes" : "No"} />
            <InfoTile label="Fallback" value={model.fallback ? "Yes" : "No"} />
            <InfoTile label="Endpoint" value={model.endpointHost} />
            <InfoTile label="Last checked" value={model.lastCheckedAt ? new Date(model.lastCheckedAt).toLocaleString() : "Not tested"} />
          </CardContent>
        </Card>
      )) : <EmptyCard title="No models configured" text="Connect an AI provider to register model metadata for governance review." />}
    </div>
  )
}

function AuditLogSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <Card>
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
            new Date(entry.timestamp).toLocaleString(),
            entry.datasetId || "No dataset",
            entry.providerName,
            entry.modelName,
            entry.mode,
            entry.latencyMs ? `${entry.latencyMs} ms` : "Not recorded",
            String(entry.tokens || 0),
            entry.result,
          ])}
          empty="No AI audit entries are available yet."
        />
      </CardContent>
    </Card>
  )
}

function PoliciesSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {snapshot.policies.map((policy) => (
        <Card key={policy.title}>
          <CardHeader>
            <CardTitle>{policy.title}</CardTitle>
            <CardDescription>{policy.summary}</CardDescription>
          </CardHeader>
        </Card>
      ))}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>AI literacy</CardTitle>
          <CardDescription>Short user education content for limits, confidence, verification, and human review.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
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
    <Card>
      <CardHeader>
        <CardTitle>Privacy posture</CardTitle>
        <CardDescription>Shows local processing availability, cloud routing, provider use, retention, and sensitive-data controls.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {snapshot.privacy.items.map((item) => (
          <InfoTile key={item.label} label={item.label} value={`${item.value} · ${item.status}`} />
        ))}
      </CardContent>
    </Card>
  )
}

function ComplianceSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <MetricCard label="Overall Compliance Score" value={`${snapshot.compliance.score}%`} detail="EU AI Act readiness controls" />
      <ComplianceChecklist snapshot={snapshot} />
    </div>
  )
}

function RiskSection({ snapshot, compact = false }: { snapshot: AiGovernanceSnapshot; compact?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI risk controls</CardTitle>
        <CardDescription>Hallucination, missing-data, confidence, data-quality, provider, and prompt-injection readiness.</CardDescription>
      </CardHeader>
      <CardContent className={compact ? "grid gap-3 lg:grid-cols-3" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
        {snapshot.risk.risks.map((risk) => (
          <InfoTile key={risk.label} label={`${risk.label}: ${risk.level}`} value={risk.detail} />
        ))}
      </CardContent>
    </Card>
  )
}

function FeedbackSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <MetricCard label="Feedback received" value={String(snapshot.audit.feedbackCount)} detail="Helpful and not helpful votes" />
        <MetricCard label="Manual overrides" value={String(snapshot.overrides.totalOverrides)} detail="Accept, reject, edit, undo" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent human oversight</CardTitle>
          <CardDescription>Manual actions are recorded separately from thumbs feedback.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            columns={["Time", "Action", "Dataset", "Trace", "Reason"]}
            rows={snapshot.overrides.recent.map((entry) => [
              new Date(entry.createdAt).toLocaleString(),
              entry.action,
              entry.datasetId || "No dataset",
              entry.traceId || "No trace",
              entry.reason || "No reason",
            ])}
            empty="No manual AI override has been recorded yet."
          />
        </CardContent>
      </Card>
    </div>
  )
}

function ReportsSection({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {snapshot.reports.map((report) => (
        <Card key={report.name}>
          <CardHeader>
            <CardTitle>{report.name}</CardTitle>
            <CardDescription>{report.metric}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={report.href}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Generate report
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function AiGeneratedExample({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI-generated</CardTitle>
        <CardDescription>Example transparency label shown with AI outputs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <MetadataLine label="Provider" value={latestProvider(snapshot)} />
        <MetadataLine label="Model" value={latestModel(snapshot)} />
        <MetadataLine label="Mode" value={formatMode(snapshot.settings.mode)} />
        <MetadataLine label="Confidence" value={estimateConfidence(snapshot)} />
        <MetadataLine label="Generated" value={new Date(snapshot.generatedAt).toLocaleString()} />
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Reasoning summary</p>
          <p className="mt-1 text-foreground">
            The answer uses available dataset context, deterministic calculations when possible, provider routing metadata, and confidence limits from data quality and provider status.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ComplianceChecklist({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance dashboard</CardTitle>
        <CardDescription>Readiness status for transparency, logging, oversight, provider monitoring, privacy, and audit preparation.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {snapshot.compliance.checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
            <span className="text-sm text-foreground">{check.label}</span>
            <StatusPill tone={check.complete ? "success" : "warning"}>{check.complete ? "Ready" : "Needs data"}</StatusPill>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SettingsCard({ snapshot }: { snapshot: AiGovernanceSnapshot }) {
  return (
    <Card>
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
        <InfoTile label="Logging" value={snapshot.settings.loggingEnabled ? "Enabled" : "Disabled"} />
        <InfoTile label="Retention" value={`${snapshot.settings.retentionDays} days`} />
      </CardContent>
    </Card>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-5 text-foreground">{value}</p>
    </div>
  )
}

function MetadataLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" | "danger" | "neutral" }) {
  const className = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    neutral: "border-border bg-muted text-muted-foreground",
  }[tone]
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>
}

function ResponsiveTable({ columns, rows, empty }: { columns: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
          <tr>{columns.map((column) => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={`${row.join("-")}-${index}`} className="align-top">
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="max-w-[260px] px-3 py-3 text-foreground">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
    </Card>
  )
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
