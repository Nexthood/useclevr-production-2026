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

interface WorldMapRevenueProps {
  regions: RegionData[]
  onRegionClick?: (region: RegionData) => void
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function getPerformanceColor(growth: number | null, margin: number | null): string {
  if (growth === null && margin === null) return "#06b6d4"
  
  const effectiveGrowth = growth ?? 0
  const effectiveMargin = margin ?? 0
  
  if (effectiveGrowth < -10 || effectiveMargin < 0) return "#ef4444"
  if (effectiveGrowth < 10 || effectiveMargin < 15) return "#f59e0b"
  return "#a855f7"
}

function getBubbleSize(revenue: number, maxRevenue: number): number {
  const minSize = 8
  const maxSize = 35
  const ratio = maxRevenue > 0 ? Math.min(revenue / maxRevenue, 1) : 0
  return minSize + ratio * (maxSize - minSize)
}

function mercatorProjection(lat: number, lng: number): { x: number; y: number } {
  const minLat = -60
  const maxLat = 85
  const latClamped = Math.max(minLat, Math.min(maxLat, lat))
  
  const x = ((lng + 180) / 360) * 100
  const y = ((90 - latClamped) / 180) * 100
  
  return { x, y }
}

function WorldMapSVG() {
  return (
    <g fill="hsl(215, 20%, 18%)" stroke="hsl(215, 15%, 30%)" strokeWidth="0.3">
      <path d="M 8,42 L 8,35 L 18,35 L 18,30 L 25,30 L 25,35 L 35,35 L 35,28 L 42,28 L 42,35 L 50,35 L 50,42 L 42,42 L 42,50 L 35,50 L 35,42 L 25,42 L 25,50 L 18,50 L 18,42 Z" />
      <path d="M 55,35 L 62,35 L 62,28 L 70,28 L 70,22 L 78,22 L 78,28 L 85,28 L 85,35 L 92,35 L 92,42 L 85,42 L 85,50 L 78,50 L 78,42 L 70,42 L 70,50 L 62,50 L 62,42 L 55,42 Z" />
      <path d="M 15,55 L 25,55 L 25,60 L 35,60 L 35,55 L 45,55 L 45,65 L 35,65 L 35,72 L 25,72 L 25,65 L 15,65 Z" />
      <path d="M 50,55 L 58,55 L 58,48 L 65,48 L 65,55 L 75,55 L 75,62 L 65,62 L 65,70 L 58,70 L 58,62 L 50,62 Z" />
      <path d="M 78,55 L 88,55 L 88,48 L 95,48 L 95,40 L 102,40 L 102,48 L 110,48 L 110,55 L 118,55 L 118,48 L 125,48 L 125,55 L 135,55 L 135,62 L 125,62 L 125,70 L 118,70 L 118,78 L 110,78 L 110,70 L 102,70 L 102,78 L 95,78 L 95,70 L 88,70 L 88,78 L 78,78 Z" />
    </g>
  )
}

export function WorldMapRevenue({ regions, onRegionClick }: WorldMapRevenueProps) {
  const [hoveredRegion, setHoveredRegion] = React.useState<RegionData | null>(null)
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 })

  if (!regions || regions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <div className="mb-4 rounded-full bg-cyan-500/10 p-3">
          <svg className="h-8 w-8 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground">No location data detected</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Add a country, region, city, or market column to unlock map insights.
        </p>
      </div>
    )
  }

  const maxRevenue = Math.max(...regions.map((r) => r.revenue), 1)

  const handleMouseMove = (e: React.MouseEvent<SVGGElement>, region: RegionData) => {
    const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect()
    if (!rect) return
    setTooltipPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 100 60"
        className="h-[280px] w-full rounded-lg bg-gradient-to-b from-slate-900 to-slate-950"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="bubbleGradient" cx="30%" cy="30%">
            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        <WorldMapSVG />
        
        {regions.map((region) => {
          const lat = region.latitude ?? 0
          const lng = region.longitude ?? 0
          const coords = mercatorProjection(lat, lng)
          const size = getBubbleSize(region.revenue, maxRevenue)
          const color = getPerformanceColor(region.growth, region.margin)
          
          return (
            <g
              key={region.name}
              className="cursor-pointer transition-opacity hover:opacity-90"
              onClick={() => onRegionClick?.(region)}
              onMouseEnter={() => setHoveredRegion(region)}
              onMouseLeave={() => setHoveredRegion(null)}
              onMouseMove={(e) => handleMouseMove(e, region)}
            >
              <circle
                cx={coords.x}
                cy={coords.y}
                r={size}
                fill={color}
                fillOpacity="0.7"
                stroke={color}
                strokeWidth="1"
                filter="url(#glow)"
              />
              <circle
                cx={coords.x}
                cy={coords.y}
                r={size * 0.4}
                fill="url(#bubbleGradient)"
              />
            </g>
          )
        })}
      </svg>

      {hoveredRegion && (
        <div
          className="absolute z-50 pointer-events-none rounded-lg border border-border bg-slate-900/95 p-3 shadow-xl backdrop-blur-sm"
          style={{
            left: Math.min(tooltipPosition.x + 10, 340),
            top: Math.min(tooltipPosition.y - 10, 220),
          }}
        >
          <p className="font-semibold text-foreground">{hoveredRegion.name}</p>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Revenue</span>
              <span className="font-medium text-cyan-400">{formatCurrency(hoveredRegion.revenue)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Orders</span>
              <span className="font-medium text-foreground">{hoveredRegion.orders.toLocaleString()}</span>
            </div>
            {hoveredRegion.margin !== null && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Margin</span>
                <span className="font-medium text-foreground">{hoveredRegion.margin.toFixed(1)}%</span>
              </div>
            )}
            {hoveredRegion.growth !== null && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Performance</span>
                <span className={`font-medium ${hoveredRegion.growth >= 10 ? "text-purple-400" : hoveredRegion.growth >= 0 ? "text-amber-400" : "text-red-400"}`}>
                  {hoveredRegion.growth >= 0 ? "+" : ""}{hoveredRegion.growth.toFixed(0)}%
                </span>
              </div>
            )}
            {hoveredRegion.topCategory && (
              <div className="pt-1 border-t border-border/50 mt-1">
                <span className="text-muted-foreground">Top: </span>
                <span className="text-foreground">{hoveredRegion.topCategory}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span>Low</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Bubble size = Revenue</span>
        </div>
      </div>
    </div>
  )
}
