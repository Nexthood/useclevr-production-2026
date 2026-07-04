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

const COUNTRY_COORDS: Record<string, { lat: number; lng: number; code: string }> = {
  "united states": { lat: 37.0902, lng: -95.7129, code: "US" },
  "usa": { lat: 37.0902, lng: -95.7129, code: "US" },
  "us": { lat: 37.0902, lng: -95.7129, code: "US" },
  "united kingdom": { lat: 55.3781, lng: -3.436, code: "GB" },
  "uk": { lat: 55.3781, lng: -3.436, code: "GB" },
  "great britain": { lat: 55.3781, lng: -3.436, code: "GB" },
  "germany": { lat: 51.1657, lng: 10.4515, code: "DE" },
  "france": { lat: 46.2276, lng: 2.2137, code: "FR" },
  "spain": { lat: 40.4637, lng: -3.7492, code: "ES" },
  "italy": { lat: 41.8719, lng: 12.5674, code: "IT" },
  "netherlands": { lat: 52.1326, lng: 5.2913, code: "NL" },
  "belgium": { lat: 50.5039, lng: 4.4699, code: "BE" },
  "switzerland": { lat: 46.8182, lng: 8.2275, code: "CH" },
  "austria": { lat: 47.5162, lng: 14.5501, code: "AT" },
  "poland": { lat: 51.9194, lng: 19.1451, code: "PL" },
  "sweden": { lat: 60.1282, lng: 18.6435, code: "SE" },
  "norway": { lat: 60.472, lng: 8.4689, code: "NO" },
  "denmark": { lat: 56.2639, lng: 9.5018, code: "DK" },
  "finland": { lat: 61.9241, lng: 25.7482, code: "FI" },
  "ireland": { lat: 53.1424, lng: -7.6921, code: "IE" },
  "portugal": { lat: 39.3999, lng: -8.2245, code: "PT" },
  "greece": { lat: 39.0742, lng: 21.8243, code: "GR" },
  "czech republic": { lat: 49.8175, lng: 15.473, code: "CZ" },
  "hungary": { lat: 47.1625, lng: 19.5033, code: "HU" },
  "romania": { lat: 45.9432, lng: 24.9668, code: "RO" },
  "canada": { lat: 56.1304, lng: -106.3468, code: "CA" },
  "mexico": { lat: 23.6345, lng: -102.5528, code: "MX" },
  "brazil": { lat: -14.235, lng: -51.9253, code: "BR" },
  "argentina": { lat: -38.4161, lng: -63.6167, code: "AR" },
  "chile": { lat: -35.6751, lng: -71.543, code: "CL" },
  "colombia": { lat: 4.5709, lng: -74.2973, code: "CO" },
  "australia": { lat: -25.2744, lng: 133.7751, code: "AU" },
  "new zealand": { lat: -40.9006, lng: 174.886, code: "NZ" },
  "japan": { lat: 36.2048, lng: 138.2529, code: "JP" },
  "china": { lat: 35.8617, lng: 104.1954, code: "CN" },
  "india": { lat: 20.5937, lng: 78.9629, code: "IN" },
  "south korea": { lat: 35.9078, lng: 127.7669, code: "KR" },
  "korea": { lat: 35.9078, lng: 127.7669, code: "KR" },
  "singapore": { lat: 1.3521, lng: 103.8198, code: "SG" },
  "hong kong": { lat: 22.3193, lng: 114.1694, code: "HK" },
  "taiwan": { lat: 23.6978, lng: 120.9605, code: "TW" },
  "thailand": { lat: 15.87, lng: 100.9925, code: "TH" },
  "malaysia": { lat: 4.2105, lng: 101.9758, code: "MY" },
  "indonesia": { lat: -0.7893, lng: 113.9213, code: "ID" },
  "philippines": { lat: 12.8797, lng: 121.774, code: "PH" },
  "vietnam": { lat: 14.0583, lng: 108.2772, code: "VN" },
  "uae": { lat: 23.4241, lng: 53.8478, code: "AE" },
  "united arab emirates": { lat: 23.4241, lng: 53.8478, code: "AE" },
  "saudi arabia": { lat: 23.8859, lng: 45.0792, code: "SA" },
  "israel": { lat: 31.0461, lng: 34.8516, code: "IL" },
  "turkey": { lat: 38.9637, lng: 35.2433, code: "TR" },
  "egypt": { lat: 26.8206, lng: 30.8025, code: "EG" },
  "south africa": { lat: -30.5595, lng: 22.9375, code: "ZA" },
  "nigeria": { lat: 9.082, lng: 8.6753, code: "NG" },
  "russia": { lat: 61.524, lng: 105.3188, code: "RU" },
  "ukraine": { lat: 48.3794, lng: 31.1656, code: "UA" },
  // Regions
  "europe": { lat: 50, lng: 10, code: "EU" },
  "asia": { lat: 30, lng: 100, code: "AS" },
  "north america": { lat: 40, lng: -100, code: "NA" },
  "south america": { lat: -15, lng: -60, code: "SA" },
  "africa": { lat: 0, lng: 20, code: "AF" },
  "oceania": { lat: -25, lng: 135, code: "OC" },
  "middle east": { lat: 25, lng: 45, code: "ME" },
  "central america": { lat: 15, lng: -90, code: "CA" },
  "western europe": { lat: 48, lng: 5, code: "WE" },
  "eastern europe": { lat: 50, lng: 25, code: "EE" },
  "northern europe": { lat: 60, lng: 10, code: "NE" },
  "southern europe": { lat: 38, lng: 15, code: "SE" },
  "western asia": { lat: 30, lng: 45, code: "WA" },
  "eastern asia": { lat: 35, lng: 130, code: "EA" },
  "southern asia": { lat: 20, lng: 78, code: "SA" },
  "southeast asia": { lat: 15, lng: 105, code: "SEA" },
  "central asia": { lat: 42, lng: 65, code: "CA" },
  "northwestern europe": { lat: 55, lng: -5, code: "NWE" },
  "west europe": { lat: 48, lng: 2, code: "WE" },
  "east asia": { lat: 35, lng: 130, code: "EA" },
}

function getRegionCoords(name: string): { lat: number; lng: number; code: string } | undefined {
  const normalized = name.toLowerCase().trim()
  
  // Direct match
  if (COUNTRY_COORDS[normalized]) {
    return COUNTRY_COORDS[normalized]
  }
  
  // Try matching parts
  const parts = normalized.split(/[\s,-]+/)
  for (const part of parts) {
    if (COUNTRY_COORDS[part]) {
      return COUNTRY_COORDS[part]
    }
  }
  
  // Try contains match
  for (const [key, coords] of Object.entries(COUNTRY_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords
    }
  }
  
  return undefined
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
          // Use provided coordinates or try to look up by name
          let lat = region.latitude
          let lng = region.longitude
          
          // If no coordinates, try to get from region name
          if ((lat === undefined || lng === undefined) && region.name) {
            const coords = getRegionCoords(region.name)
            if (coords) {
              lat = coords.lat
              lng = coords.lng
            }
          }
          
          // Skip if still no valid coordinates
          if (lat === undefined || lng === undefined) {
            return null
          }
          
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
