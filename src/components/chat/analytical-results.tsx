"use client"

export type GrossMarginAnalyticalResult = {
  intent: "gross_margin"
  status: "success"
  revenue: number | null
  cogs: number | null
  grossProfit: number | null
  grossMarginPercent: number
  period: string | null
  calculationMethod: "revenue_minus_cogs" | "gross_profit_over_revenue" | "existing_gross_margin"
  sourceColumns: Record<string, string>
  currencyCode?: string | null
}

export type SupportedAnalyticalResult = GrossMarginAnalyticalResult

export function normalizeAnalyticalResult(value: unknown): SupportedAnalyticalResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = value as Partial<GrossMarginAnalyticalResult>
  if (candidate.intent === "gross_margin" && candidate.status === "success" && typeof candidate.grossMarginPercent === "number") {
    return {
      intent: "gross_margin",
      status: "success",
      revenue: numberOrNull(candidate.revenue),
      cogs: numberOrNull(candidate.cogs),
      grossProfit: numberOrNull(candidate.grossProfit),
      grossMarginPercent: candidate.grossMarginPercent,
      period: typeof candidate.period === "string" ? candidate.period : null,
      calculationMethod: candidate.calculationMethod ?? "revenue_minus_cogs",
      sourceColumns: candidate.sourceColumns && typeof candidate.sourceColumns === "object" ? candidate.sourceColumns : {},
      currencyCode: typeof candidate.currencyCode === "string" ? candidate.currencyCode : null,
    }
  }
  return null
}

export function AnalyticalResultView({ result }: { result: SupportedAnalyticalResult }) {
  if (result.intent === "gross_margin") return <GrossMarginResult result={result} />
  return null
}

function GrossMarginResult({ result }: { result: GrossMarginAnalyticalResult }) {
  return (
    <div className="space-y-4" data-analytical-result="gross_margin">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">Current gross margin</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{formatPercent(result.grossMarginPercent)}</p>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <KpiTile label="Revenue" value={formatCurrencyLike(result.revenue, result.currencyCode)} />
        <KpiTile label="COGS" value={formatCurrencyLike(result.cogs, result.currencyCode)} />
        <KpiTile label="Gross profit" value={formatCurrencyLike(result.grossProfit, result.currencyCode)} />
      </div>

      <div className="rounded-lg border border-border/70 bg-background p-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Calculation</p>
        <p className="mt-1 text-sm text-foreground">{calculationLabel(result.calculationMethod)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Source columns: {Object.entries(result.sourceColumns).map(([field, column]) => `${field}: ${column}`).join(", ")}
        </p>
      </div>
    </div>
  )
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-base font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function calculationLabel(method: GrossMarginAnalyticalResult["calculationMethod"]) {
  if (method === "gross_profit_over_revenue") return "Gross profit ÷ Revenue"
  if (method === "existing_gross_margin") return "Validated gross margin field"
  return "(Revenue − COGS) ÷ Revenue"
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function formatCurrencyLike(value: number | null, currencyCode?: string | null) {
  if (value === null) return "Not required"
  if (currencyCode) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value)
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value)
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}
