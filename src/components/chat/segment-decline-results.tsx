"use client"

import { Button } from "@/components/ui/button"
import * as React from "react"

export type SegmentDeclineFindingPayload = {
  dimension: string
  dimensionLabel: string
  segment: string
  previousValue: number
  currentValue: number
  absoluteChange: number
  changePercent: number
}

export type SegmentDeclineAnalysisPayload = {
  ok: true
  metric: string
  metricLabel: string
  currencyCode?: string | null
  periodComparison: {
    previous: string
    current: string
    ignoredLatestPeriod?: string
  }
  decliningSegments: SegmentDeclineFindingPayload[]
}

export type SegmentDeclineGroupName =
  | "Startup Stage"
  | "Acquisition Channel"
  | "Plan"
  | "Geography"
  | "Other"

export type SegmentDeclinePresentationGroup = {
  key: SegmentDeclineGroupName
  title: SegmentDeclineGroupName
  rows: SegmentDeclineFindingPayload[]
  visibleRows: SegmentDeclineFindingPayload[]
  hiddenCount: number
}

export type SegmentDeclinePresentation = {
  summary: string
  groups: SegmentDeclinePresentationGroup[]
  tableRows: Array<{
    dimension: string
    segment: string
    previousPeriod: string
    currentPeriod: string
    previousValue: number
    currentValue: number
    changePercent: number
  }>
}

const DEFAULT_VISIBLE_PER_GROUP = 3
const GROUP_ORDER: SegmentDeclineGroupName[] = ["Startup Stage", "Acquisition Channel", "Plan", "Geography", "Other"]

export function normalizeSegmentDeclineAnalysis(value: unknown): SegmentDeclineAnalysisPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = value as Partial<SegmentDeclineAnalysisPayload>
  if (candidate.ok !== true || !Array.isArray(candidate.decliningSegments)) return null
  const periodComparison = candidate.periodComparison
  if (!periodComparison || typeof periodComparison.previous !== "string" || typeof periodComparison.current !== "string") return null

  return {
    ok: true,
    metric: typeof candidate.metric === "string" ? candidate.metric : "metric",
    metricLabel: typeof candidate.metricLabel === "string" ? candidate.metricLabel : "Metric",
    currencyCode: typeof candidate.currencyCode === "string" ? candidate.currencyCode : null,
    periodComparison,
    decliningSegments: candidate.decliningSegments.filter(isFindingPayload),
  }
}

export function buildSegmentDeclinePresentation(
  analysis: SegmentDeclineAnalysisPayload,
  expandedGroups: ReadonlySet<SegmentDeclineGroupName> = new Set(),
): SegmentDeclinePresentation {
  const sortedFindings = [...analysis.decliningSegments].sort(compareDeclines)
  const grouped = new Map<SegmentDeclineGroupName, SegmentDeclineFindingPayload[]>()

  for (const finding of sortedFindings) {
    const groupName = groupNameForDimension(finding.dimension)
    grouped.set(groupName, [...(grouped.get(groupName) ?? []), finding])
  }

  const groups = GROUP_ORDER
    .map((groupName) => {
      const rows = grouped.get(groupName) ?? []
      const visibleRows = expandedGroups.has(groupName) ? rows : rows.slice(0, DEFAULT_VISIBLE_PER_GROUP)
      return {
        key: groupName,
        title: groupName,
        rows,
        visibleRows,
        hiddenCount: Math.max(0, rows.length - visibleRows.length),
      }
    })
    .filter((group) => group.rows.length > 0)

  return {
    summary: buildExecutiveSummary(groups),
    groups,
    tableRows: sortedFindings.map((finding) => ({
      dimension: finding.dimensionLabel,
      segment: finding.segment,
      previousPeriod: analysis.periodComparison.previous,
      currentPeriod: analysis.periodComparison.current,
      previousValue: finding.previousValue,
      currentValue: finding.currentValue,
      changePercent: finding.changePercent,
    })),
  }
}

export function SegmentDeclineResults({ analysis }: { analysis: SegmentDeclineAnalysisPayload }) {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<SegmentDeclineGroupName>>(new Set())
  const presentation = React.useMemo(
    () => buildSegmentDeclinePresentation(analysis, expandedGroups),
    [analysis, expandedGroups],
  )

  function toggleGroup(groupName: SegmentDeclineGroupName) {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupName)) next.delete(groupName)
      else next.add(groupName)
      return next
    })
  }

  return (
    <div className="space-y-4" data-segment-decline-results="true">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
        <p className="text-sm font-medium leading-6 text-foreground">{presentation.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Compared {analysis.periodComparison.previous} to {analysis.periodComparison.current}
          {analysis.periodComparison.ignoredLatestPeriod ? `; ${analysis.periodComparison.ignoredLatestPeriod} is excluded as incomplete.` : "."}
        </p>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {presentation.groups.map((group) => (
          <section key={group.key} className="min-w-0 rounded-lg border border-border/70 bg-background p-3">
            <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
              <h3 className="truncate text-sm font-semibold text-foreground">{group.title}</h3>
              <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {group.rows.length}
              </span>
            </div>

            <div className="space-y-2">
              {group.visibleRows.map((finding) => (
                <SegmentDeclineCard
                  key={`${finding.dimension}-${finding.segment}`}
                  finding={finding}
                  currencyCode={analysis.currencyCode}
                />
              ))}
            </div>

            {group.hiddenCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 px-2 text-xs"
                onClick={() => toggleGroup(group.key)}
              >
                Show all {group.rows.length}
              </Button>
            )}
            {expandedGroups.has(group.key) && group.rows.length > DEFAULT_VISIBLE_PER_GROUP && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 px-2 text-xs"
                onClick={() => toggleGroup(group.key)}
              >
                Show less
              </Button>
            )}
          </section>
        ))}
      </div>

      <SegmentDeclineTable rows={presentation.tableRows} currencyCode={analysis.currencyCode} />
    </div>
  )
}

function SegmentDeclineCard({
  finding,
  currencyCode,
}: {
  finding: SegmentDeclineFindingPayload
  currencyCode?: string | null
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-card px-3 py-2">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{finding.segment}</p>
          {groupNameForDimension(finding.dimension) === "Geography" && (
            <p className="text-[11px] text-muted-foreground">{finding.dimensionLabel}</p>
          )}
        </div>
        <p className="shrink-0 text-sm font-semibold text-destructive">{formatPercent(finding.changePercent)}</p>
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {formatValue(finding.previousValue, currencyCode)} <span aria-hidden="true">→</span> {formatValue(finding.currentValue, currencyCode)}
      </p>
    </div>
  )
}

function SegmentDeclineTable({
  rows,
  currencyCode,
}: {
  rows: SegmentDeclinePresentation["tableRows"]
  currencyCode?: string | null
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background">
      <div className="border-b border-border/70 px-3 py-2">
        <p className="text-sm font-semibold text-foreground">Result table</p>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-[760px] table-fixed text-sm">
          <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted text-xs text-muted-foreground">
            <tr>
              {["Dimension", "Segment", "Previous period", "Current period", "Previous value", "Current value", "Change %"].map((header) => (
                <th key={header} className="px-3 py-2 text-left font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((row) => (
              <tr key={`${row.dimension}-${row.segment}`} className="hover:bg-muted/40">
                <td className="w-32 px-3 py-2 align-top text-muted-foreground">{row.dimension}</td>
                <td className="w-36 px-3 py-2 align-top font-medium text-foreground">{row.segment}</td>
                <td className="w-32 px-3 py-2 align-top text-muted-foreground">{row.previousPeriod}</td>
                <td className="w-32 px-3 py-2 align-top text-muted-foreground">{row.currentPeriod}</td>
                <td className="w-32 px-3 py-2 align-top tabular-nums text-foreground">{formatValue(row.previousValue, currencyCode)}</td>
                <td className="w-32 px-3 py-2 align-top tabular-nums text-foreground">{formatValue(row.currentValue, currencyCode)}</td>
                <td className="w-24 px-3 py-2 align-top font-semibold tabular-nums text-destructive">{formatPercent(row.changePercent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function isFindingPayload(value: unknown): value is SegmentDeclineFindingPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<SegmentDeclineFindingPayload>
  return (
    typeof candidate.dimension === "string" &&
    typeof candidate.dimensionLabel === "string" &&
    typeof candidate.segment === "string" &&
    typeof candidate.previousValue === "number" &&
    typeof candidate.currentValue === "number" &&
    typeof candidate.absoluteChange === "number" &&
    typeof candidate.changePercent === "number"
  )
}

function buildExecutiveSummary(groups: SegmentDeclinePresentationGroup[]) {
  const allRows = groups.flatMap((group) => group.rows).sort(compareDeclines)
  const primaryRows = groups
    .filter((group) => group.key !== "Geography" && group.key !== "Other")
    .flatMap((group) => group.rows)
    .sort(compareDeclines)
  const strongest = primaryRows[0] ?? allRows[0]
  if (!strongest) return "No declining segments were detected in the selected complete periods."

  const parts = [`The ${strongest.segment} ${summaryDimensionLabel(strongest)} declined the most at ${formatPercent(strongest.changePercent)}.`]
  const channelGroup = groups.find((group) => group.key === "Acquisition Channel")
  const planGroup = groups.find((group) => group.key === "Plan")

  if (channelGroup?.rows.length) {
    const channels = channelGroup.rows.slice(0, 2).map((finding) => finding.segment)
    parts.push(`${joinNames(channels)} ${channels.length === 1 ? "was" : "were"} the weakest acquisition ${channels.length === 1 ? "channel" : "channels"}.`)
  }

  if (planGroup?.rows.length) {
    parts.push(`${planGroup.rows[0]?.segment} was the weakest plan.`)
  }

  return parts.join(" ")
}

function summaryDimensionLabel(finding: SegmentDeclineFindingPayload) {
  const groupName = groupNameForDimension(finding.dimension)
  if (groupName === "Startup Stage") return "startup stage"
  if (groupName === "Acquisition Channel") return "acquisition channel"
  if (groupName === "Plan") return "plan"
  if (groupName === "Geography") return finding.dimensionLabel.toLowerCase()
  return finding.dimensionLabel.toLowerCase()
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? ""
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`
}

function compareDeclines(a: SegmentDeclineFindingPayload, b: SegmentDeclineFindingPayload) {
  return a.changePercent - b.changePercent || a.dimensionLabel.localeCompare(b.dimensionLabel) || a.segment.localeCompare(b.segment)
}

function groupNameForDimension(dimension: string): SegmentDeclineGroupName {
  const normalized = dimension.toLowerCase().replace(/[^a-z0-9]+/g, "_")
  if (normalized.includes("startup_stage") || normalized === "stage") return "Startup Stage"
  if (normalized.includes("acquisition_channel") || normalized === "channel") return "Acquisition Channel"
  if (normalized.includes("plan")) return "Plan"
  if (normalized.includes("country") || normalized.includes("region") || normalized.includes("market")) return "Geography"
  return "Other"
}

function formatValue(value: number, currencyCode?: string | null) {
  if (currencyCode) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value)
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

function formatPercent(value: number) {
  const rounded = Math.abs(value).toFixed(1)
  return `${value < 0 ? "−" : "+"}${rounded}%`
}
