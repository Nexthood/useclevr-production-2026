"use client"

import type { GeographicMetric, MetricKey } from "@/components/dashboard/geographic-revenue-map"

export function GeographicMapTooltip({
  item,
  metric,
  total,
  rank,
  x,
  y,
  currency = "USD",
}: {
  item: GeographicMetric
  metric: MetricKey
  total: number
  rank: number
  x: number
  y: number
  currency?: string
}) {
  const value = Number(item[metric] ?? 0)
  const share = total > 0 ? (value / total) * 100 : 0

  return (
    <div
      className="pointer-events-none absolute z-20 w-56 rounded-lg border border-slate-700 bg-slate-950/95 p-3 text-xs shadow-2xl shadow-slate-950/70 backdrop-blur"
      style={{
        left: `min(${x + 16}px, calc(100% - 240px))`,
        top: `min(${y + 16}px, calc(100% - 168px))`,
      }}
      role="status"
    >
      <p className="text-sm font-semibold text-white">{item.countryName}</p>
      <div className="mt-2 space-y-1.5">
        <TooltipLine label={labelForMetric(metric)} value={formatMetric(value, metric, currency)} accent />
        <TooltipLine label="Orders" value={formatNumber(Number(item.orders ?? 0))} />
        {item.customers !== undefined && <TooltipLine label="Customers" value={formatNumber(Number(item.customers ?? 0))} />}
        {item.datasets !== undefined && <TooltipLine label="Datasets" value={formatNumber(Number(item.datasets ?? 0))} />}
        <TooltipLine label="Share" value={`${share.toFixed(1)}%`} />
        <TooltipLine label="Rank" value={`#${rank}`} />
      </div>
    </div>
  )
}

export function formatMetric(value: number, metric: MetricKey, currency = "USD") {
  if (metric === "revenue") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: Math.abs(value) >= 100_000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
    }).format(value)
  }
  return formatNumber(value)
}

export function labelForMetric(metric: MetricKey) {
  if (metric === "revenue") return "Revenue"
  if (metric === "orders") return "Orders"
  if (metric === "customers") return "Customers"
  return "Datasets"
}

function TooltipLine({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className={accent ? "font-semibold text-cyan-100" : "font-medium text-slate-100"}>{value}</span>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0)
}
