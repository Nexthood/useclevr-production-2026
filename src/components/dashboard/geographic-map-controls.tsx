"use client"

import type { MetricKey } from "@/components/dashboard/geographic-revenue-map"

const METRIC_LABELS: Record<MetricKey, string> = {
  revenue: "Revenue",
  orders: "Orders",
  customers: "Customers",
  datasets: "Datasets",
}

export function GeographicMapControls({
  metric,
  availableMetrics,
  onMetricChange,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  metric: MetricKey
  availableMetrics: MetricKey[]
  onMetricChange: (metric: MetricKey) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}) {
  return (
    <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-2">
      <div className="flex rounded-lg border border-slate-700/80 bg-slate-950/90 p-1 shadow-lg backdrop-blur">
        {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => {
          const isSelectable = availableMetrics.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => isSelectable && onMetricChange(key)}
              disabled={!isSelectable}
              aria-disabled={!isSelectable}
              title={isSelectable ? undefined : `${METRIC_LABELS[key]} data is not available in the current dataset`}
              className={[
                "rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
                metric === key
                  ? "bg-cyan-400/15 text-cyan-100"
                  : isSelectable
                    ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                    : "cursor-not-allowed text-slate-600 line-through opacity-60",
              ].join(" ")}
            >
              {METRIC_LABELS[key]}
            </button>
          )
        })}
      </div>

      <div className="flex rounded-lg border border-slate-700/80 bg-slate-950/90 p-1 shadow-lg backdrop-blur">
        <button type="button" onClick={onZoomIn} className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-100 hover:bg-slate-800" aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={onZoomOut} className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-100 hover:bg-slate-800" aria-label="Zoom out">
          -
        </button>
        <button type="button" onClick={onReset} className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800" aria-label="Reset map view">
          Reset
        </button>
      </div>
    </div>
  )
}
