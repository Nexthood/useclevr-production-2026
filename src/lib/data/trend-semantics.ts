export type TrendSemanticState = "trend" | "snapshot" | "unavailable"

export type TrendSeriesPoint = {
  label: string
  value: number | null
}

export type TrendSemanticsInput = {
  metricLabel: string
  series: TrendSeriesPoint[]
  metricValue: number | null
  unavailableReason: string
}

export type TrendSemanticsResult = {
  state: TrendSemanticState
  data: { label: string; value: number }[]
  snapshotValue: number | null
  emptyLabel: string
}

export const MINIMUM_TREND_OBSERVATIONS = 2

export function usableTrendObservations(series: TrendSeriesPoint[]): { label: string; value: number }[] {
  return series.filter((point): point is { label: string; value: number } =>
    typeof point.value === "number" && Number.isFinite(point.value) && String(point.label).trim().length > 0,
  )
}

export function isTrendEligible(series: TrendSeriesPoint[]): boolean {
  const usable = usableTrendObservations(series)
  if (usable.length < MINIMUM_TREND_OBSERVATIONS) return false
  return new Set(usable.map((point) => String(point.label).trim())).size >= MINIMUM_TREND_OBSERVATIONS
}

export function snapshotTrendExplanation(metricLabel: string): string {
  return `No sufficient time-series data is available for a ${metricLabel.toLowerCase()} trend.`
}

export function unavailableTrendTitle(metricLabel: string): string {
  return `${metricLabel} data unavailable`
}

export function snapshotTrendTitle(metricLabel: string): string {
  return `${metricLabel} Snapshot`
}

export function resolveTrendSemantics(input: TrendSemanticsInput): TrendSemanticsResult {
  if (!isTrendEligible(input.series)) {
    const snapshotValue = finiteNumber(input.metricValue) ?? latestUsableSeriesValue(input.series)
    if (snapshotValue === null) {
      return {
        state: "unavailable",
        data: [],
        snapshotValue: null,
        emptyLabel: input.unavailableReason,
      }
    }
    return {
      state: "snapshot",
      data: [],
      snapshotValue,
      emptyLabel: snapshotTrendExplanation(input.metricLabel),
    }
  }
  return {
    state: "trend",
    data: usableTrendObservations(input.series),
    snapshotValue: null,
    emptyLabel: "",
  }
}

function finiteNumber(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function latestUsableSeriesValue(series: TrendSeriesPoint[]): number | null {
  const usable = usableTrendObservations(series)
  return usable.length > 0 ? usable[usable.length - 1].value : null
}
