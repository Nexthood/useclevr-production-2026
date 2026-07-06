"use client"

import * as React from "react"

export type RegionData = {
  name: string
  countryCode?: string
  latitude?: number
  longitude?: number
  revenue: number
  orders: number
  profit: number
  margin: number | null
  growth: number | null
  topProduct?: string
  topCategory?: string
}

type ProjectedRegion = RegionData & {
  x: number
  y: number
  code?: string
}

interface WorldMapRevenueProps {
  regions: RegionData[]
  onRegionClick?: (region: RegionData) => void
}

const LOCATION_COORDS: Record<string, { lat: number; lng: number; code: string }> = {
  "united states": { lat: 37.0902, lng: -95.7129, code: "US" },
  usa: { lat: 37.0902, lng: -95.7129, code: "US" },
  us: { lat: 37.0902, lng: -95.7129, code: "US" },
  "new york": { lat: 40.7128, lng: -74.006, code: "NYC" },
  "los angeles": { lat: 34.0522, lng: -118.2437, code: "LA" },
  chicago: { lat: 41.8781, lng: -87.6298, code: "CHI" },
  canada: { lat: 56.1304, lng: -106.3468, code: "CA" },
  mexico: { lat: 23.6345, lng: -102.5528, code: "MX" },
  brazil: { lat: -14.235, lng: -51.9253, code: "BR" },
  argentina: { lat: -38.4161, lng: -63.6167, code: "AR" },
  chile: { lat: -35.6751, lng: -71.543, code: "CL" },
  colombia: { lat: 4.5709, lng: -74.2973, code: "CO" },
  "united kingdom": { lat: 55.3781, lng: -3.436, code: "GB" },
  uk: { lat: 55.3781, lng: -3.436, code: "GB" },
  london: { lat: 51.5074, lng: -0.1278, code: "LON" },
  germany: { lat: 51.1657, lng: 10.4515, code: "DE" },
  berlin: { lat: 52.52, lng: 13.405, code: "BER" },
  france: { lat: 46.2276, lng: 2.2137, code: "FR" },
  paris: { lat: 48.8566, lng: 2.3522, code: "PAR" },
  spain: { lat: 40.4637, lng: -3.7492, code: "ES" },
  madrid: { lat: 40.4168, lng: -3.7038, code: "MAD" },
  italy: { lat: 41.8719, lng: 12.5674, code: "IT" },
  netherlands: { lat: 52.1326, lng: 5.2913, code: "NL" },
  amsterdam: { lat: 52.3676, lng: 4.9041, code: "AMS" },
  belgium: { lat: 50.5039, lng: 4.4699, code: "BE" },
  switzerland: { lat: 46.8182, lng: 8.2275, code: "CH" },
  austria: { lat: 47.5162, lng: 14.5501, code: "AT" },
  poland: { lat: 51.9194, lng: 19.1451, code: "PL" },
  sweden: { lat: 60.1282, lng: 18.6435, code: "SE" },
  norway: { lat: 60.472, lng: 8.4689, code: "NO" },
  denmark: { lat: 56.2639, lng: 9.5018, code: "DK" },
  finland: { lat: 61.9241, lng: 25.7482, code: "FI" },
  ireland: { lat: 53.1424, lng: -7.6921, code: "IE" },
  portugal: { lat: 39.3999, lng: -8.2245, code: "PT" },
  greece: { lat: 39.0742, lng: 21.8243, code: "GR" },
  hungary: { lat: 47.1625, lng: 19.5033, code: "HU" },
  budapest: { lat: 47.4979, lng: 19.0402, code: "BUD" },
  romania: { lat: 45.9432, lng: 24.9668, code: "RO" },
  australia: { lat: -25.2744, lng: 133.7751, code: "AU" },
  "new zealand": { lat: -40.9006, lng: 174.886, code: "NZ" },
  japan: { lat: 36.2048, lng: 138.2529, code: "JP" },
  tokyo: { lat: 35.6762, lng: 139.6503, code: "TYO" },
  china: { lat: 35.8617, lng: 104.1954, code: "CN" },
  india: { lat: 20.5937, lng: 78.9629, code: "IN" },
  "south korea": { lat: 35.9078, lng: 127.7669, code: "KR" },
  singapore: { lat: 1.3521, lng: 103.8198, code: "SG" },
  "hong kong": { lat: 22.3193, lng: 114.1694, code: "HK" },
  thailand: { lat: 15.87, lng: 100.9925, code: "TH" },
  malaysia: { lat: 4.2105, lng: 101.9758, code: "MY" },
  indonesia: { lat: -0.7893, lng: 113.9213, code: "ID" },
  vietnam: { lat: 14.0583, lng: 108.2772, code: "VN" },
  "united arab emirates": { lat: 23.4241, lng: 53.8478, code: "AE" },
  uae: { lat: 23.4241, lng: 53.8478, code: "AE" },
  "saudi arabia": { lat: 23.8859, lng: 45.0792, code: "SA" },
  turkey: { lat: 38.9637, lng: 35.2433, code: "TR" },
  egypt: { lat: 26.8206, lng: 30.8025, code: "EG" },
  "south africa": { lat: -30.5595, lng: 22.9375, code: "ZA" },
  nigeria: { lat: 9.082, lng: 8.6753, code: "NG" },
  europe: { lat: 50, lng: 10, code: "EU" },
  asia: { lat: 30, lng: 100, code: "AS" },
  "north america": { lat: 40, lng: -100, code: "NA" },
  "south america": { lat: -15, lng: -60, code: "SA" },
  africa: { lat: 0, lng: 20, code: "AF" },
  oceania: { lat: -25, lng: 135, code: "OC" },
  "middle east": { lat: 25, lng: 45, code: "ME" },
  "western europe": { lat: 48, lng: 5, code: "WE" },
  "eastern europe": { lat: 50, lng: 25, code: "EE" },
  "northern europe": { lat: 60, lng: 10, code: "NE" },
  "southern europe": { lat: 38, lng: 15, code: "SE" },
  "southeast asia": { lat: 15, lng: 105, code: "SEA" },
}

function findLocation(name: string) {
  const normalized = name.toLowerCase().trim()
  if (LOCATION_COORDS[normalized]) return LOCATION_COORDS[normalized]

  const cleanParts = normalized.split(/[,/|-]/).map((part) => part.trim()).filter(Boolean)
  for (const part of cleanParts) {
    if (LOCATION_COORDS[part]) return LOCATION_COORDS[part]
  }

  return Object.entries(LOCATION_COORDS).find(([key]) => normalized.includes(key) || key.includes(normalized))?.[1]
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "$0"
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "No margin"
  return `${value.toFixed(1)}%`
}

function project(lat: number, lng: number) {
  const latClamped = Math.max(-58, Math.min(78, lat))
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((82 - latClamped) / 150) * 100,
  }
}

function markerRadius(revenue: number, maxRevenue: number) {
  const ratio = maxRevenue > 0 ? Math.sqrt(Math.max(revenue, 0) / maxRevenue) : 0
  return 0.95 + ratio * 2.45
}

function performanceColor(region: RegionData) {
  if ((region.growth ?? 0) < -10 || (region.margin ?? 1) < 0) return "#fb7185"
  if ((region.growth ?? 0) > 10 || (region.margin ?? 0) > 25) return "#c084fc"
  return "#22d3ee"
}

function EmptyGeoState() {
  return (
    <div className="rounded-lg border border-dashed border-cyan-300/20 bg-slate-950/40 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21s7-5.33 7-11a7 7 0 10-14 0c0 5.67 7 11 7 11z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10.5h.01" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-foreground">No geographic data detected.</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Upload data with country, city, region, or location columns to generate a map.
      </p>
    </div>
  )
}

export function WorldMapRevenue({ regions, onRegionClick }: WorldMapRevenueProps) {
  const [hoveredRegion, setHoveredRegion] = React.useState<ProjectedRegion | null>(null)
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 })

  const projectedRegions = React.useMemo<ProjectedRegion[]>(() => {
    return (regions || [])
      .map((region): ProjectedRegion | null => {
        const lookup = region.latitude !== undefined && region.longitude !== undefined
          ? { lat: region.latitude, lng: region.longitude, code: region.countryCode || region.name.slice(0, 3).toUpperCase() }
          : findLocation(region.name)

        if (!lookup) return null
        const point = project(lookup.lat, lookup.lng)

        return {
          ...region,
          ...point,
          code: lookup.code,
        }
      })
      .filter((region): region is ProjectedRegion => Boolean(region))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 18)
  }, [regions])

  if (!regions || regions.length === 0 || projectedRegions.length === 0) {
    return <EmptyGeoState />
  }

  const maxRevenue = Math.max(...projectedRegions.map((region) => region.revenue), 1)
  const totalRevenue = projectedRegions.reduce((sum, region) => sum + region.revenue, 0)
  const totalOrders = projectedRegions.reduce((sum, region) => sum + (region.orders || 0), 0)
  const topRegion = projectedRegions[0]
  const flowOrigin = topRegion || { x: 50, y: 45 }
  const visibleLabels = projectedRegions.slice(0, 4)

  const handleMouseMove = (event: React.MouseEvent<SVGGElement>, region: ProjectedRegion) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!rect) return
    setTooltipPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
    setHoveredRegion(region)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-950 shadow-lg shadow-cyan-950/20">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative min-h-[360px] overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.15),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.15),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Geographic performance</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Revenue distribution</h3>
            </div>
            <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
              {projectedRegions.length} mapped location{projectedRegions.length === 1 ? "" : "s"}
            </div>
          </div>

          <svg viewBox="0 0 100 58" className="h-[280px] w-full" role="img" aria-label="World revenue map">
            <defs>
              <linearGradient id="useclevrMapLand" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#334155" stopOpacity="0.58" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.38" />
              </linearGradient>
              <linearGradient id="useclevrFlow" x1="0" x2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.05" />
                <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#c084fc" stopOpacity="0.72" />
              </linearGradient>
              <filter id="useclevrPointGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="1.8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {[12, 24, 36, 48, 60, 72, 84].map((x) => (
              <line key={`lng-${x}`} x1={x} x2={x} y1="4" y2="54" stroke="#94a3b8" strokeDasharray="0.5 2.5" strokeOpacity="0.14" />
            ))}
            {[12, 22, 32, 42, 52].map((y) => (
              <line key={`lat-${y}`} x1="4" x2="96" y1={y} y2={y} stroke="#94a3b8" strokeDasharray="0.5 2.5" strokeOpacity="0.14" />
            ))}

            <g fill="url(#useclevrMapLand)" stroke="#67e8f9" strokeOpacity="0.14" strokeWidth="0.35">
              <path d="M8 19c4-5 11-7 18-5 4 1 6 3 9 3 3 1 7-1 10 2 2 3-1 6-5 7-4 2-5 5-9 6-6 1-8-4-12-4-5 0-12-3-11-9z" />
              <path d="M24 34c4 0 8 2 10 6 3 5 1 11-4 13-3-5-7-8-10-12-2-3-1-6 4-7z" />
              <path d="M45 18c6-6 16-8 25-5 8 2 15 1 21 5 3 3 1 6-4 6-7 0-11 4-17 4-5 0-10-3-15-2-6 1-13-2-10-8z" />
              <path d="M53 31c5-1 9 2 9 7 0 5-3 9-8 11-3-4-5-9-5-13 0-3 1-5 4-5z" />
              <path d="M73 38c5-2 14-1 18 3 3 3 1 8-5 9-6 0-14-3-17-7-1-2 1-4 4-5z" />
            </g>

            {projectedRegions.slice(1, 8).map((region) => {
              const cx = (flowOrigin.x + region.x) / 2
              const cy = Math.min(flowOrigin.y, region.y) - 8 - Math.abs(flowOrigin.x - region.x) * 0.03
              return (
                <path
                  key={`flow-${region.name}`}
                  d={`M ${flowOrigin.x} ${flowOrigin.y} Q ${cx} ${cy} ${region.x} ${region.y}`}
                  fill="none"
                  stroke="url(#useclevrFlow)"
                  strokeWidth="0.45"
                  strokeLinecap="round"
                  opacity="0.56"
                />
              )
            })}

            {projectedRegions.map((region) => {
              const radius = markerRadius(region.revenue, maxRevenue)
              const color = performanceColor(region)

              return (
                <g
                  key={region.name}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => onRegionClick?.(region)}
                  onMouseMove={(event) => handleMouseMove(event, region)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  onFocus={() => setHoveredRegion(region)}
                  onBlur={() => setHoveredRegion(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onRegionClick?.(region)
                  }}
                >
                  <circle cx={region.x} cy={region.y} r={radius + 1.7} fill={color} opacity="0.16" filter="url(#useclevrPointGlow)" />
                  <circle cx={region.x} cy={region.y} r={radius} fill={color} opacity="0.88" stroke="#f8fafc" strokeOpacity="0.55" strokeWidth="0.25" />
                  <circle cx={region.x - radius * 0.28} cy={region.y - radius * 0.28} r={Math.max(0.32, radius * 0.28)} fill="#fff" opacity="0.42" />
                </g>
              )
            })}

            {visibleLabels.map((region, index) => (
              <g key={`label-${region.name}`} pointerEvents="none">
                <rect
                  x={Math.min(region.x + 2.3, 78)}
                  y={Math.max(region.y - 3.6, 3)}
                  width={Math.min(18 + region.name.length * 0.45, 25)}
                  height="5.8"
                  rx="1.6"
                  fill="#020617"
                  fillOpacity={index === 0 ? "0.78" : "0.56"}
                  stroke={index === 0 ? "#22d3ee" : "#64748b"}
                  strokeOpacity="0.24"
                />
                <text x={Math.min(region.x + 3.8, 79.5)} y={Math.max(region.y + 0.2, 6.8)} fill="#e2e8f0" fontSize="2.2" fontWeight="600">
                  {region.name.slice(0, 18)}
                </text>
              </g>
            ))}
          </svg>

          {hoveredRegion && (
            <div
              className="pointer-events-none absolute z-20 min-w-52 rounded-lg border border-cyan-300/20 bg-slate-950/95 p-3 text-xs shadow-2xl shadow-cyan-950/50 backdrop-blur"
              style={{
                left: `min(${tooltipPosition.x + 18}px, calc(100% - 240px))`,
                top: `min(${tooltipPosition.y + 18}px, calc(100% - 132px))`,
              }}
            >
              <p className="font-semibold text-white">{hoveredRegion.name}</p>
              <div className="mt-2 space-y-1.5">
                <MetricLine label="Revenue" value={formatCurrency(hoveredRegion.revenue)} accent="cyan" />
                {hoveredRegion.orders > 0 && <MetricLine label="Orders" value={hoveredRegion.orders.toLocaleString()} />}
                <MetricLine label="Margin" value={formatPercent(hoveredRegion.margin)} />
                {hoveredRegion.growth !== null && (
                  <MetricLine label="Growth" value={`${hoveredRegion.growth >= 0 ? "+" : ""}${hoveredRegion.growth.toFixed(1)}%`} accent={hoveredRegion.growth >= 0 ? "purple" : "rose"} />
                )}
              </div>
              {(hoveredRegion.topCategory || hoveredRegion.topProduct) && (
                <p className="mt-2 border-t border-white/10 pt-2 text-slate-300">
                  Top: {hoveredRegion.topCategory || hoveredRegion.topProduct}
                </p>
              )}
            </div>
          )}
        </div>

        <aside className="border-t border-cyan-300/10 bg-slate-900/70 p-4 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <SummaryCard label="Total mapped revenue" value={formatCurrency(totalRevenue)} />
            <SummaryCard label="Top location" value={topRegion?.name || "No data"} />
            <SummaryCard label="Mapped orders" value={totalOrders > 0 ? totalOrders.toLocaleString() : "No data"} />
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Top locations</p>
            <div className="space-y-2">
              {projectedRegions.slice(0, 6).map((region, index) => {
                const share = totalRevenue > 0 ? (region.revenue / totalRevenue) * 100 : 0
                return (
                  <button
                    key={region.name}
                    type="button"
                    onClick={() => onRegionClick?.(region)}
                    className="group w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-slate-100">
                        {index + 1}. {region.name}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-cyan-200">{formatCurrency(region.revenue)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <span className="block h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-400" style={{ width: `${Math.max(5, share)}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function MetricLine({ label, value, accent }: { label: string; value: string; accent?: "cyan" | "purple" | "rose" }) {
  const accentClass = accent === "purple" ? "text-violet-300" : accent === "rose" ? "text-rose-300" : accent === "cyan" ? "text-cyan-200" : "text-slate-100"

  return (
    <div className="flex items-center justify-between gap-5">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${accentClass}`}>{value}</span>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
