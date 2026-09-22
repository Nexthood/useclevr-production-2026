"use client"

import { aggregateWorldMapRegions, type WorldMapRegion } from "@/lib/data/geographic-metric-semantics"
import { normalizeCountry } from "@/lib/geo/normalize-country"
import dynamic from "next/dynamic"
import * as React from "react"

export type RegionData = WorldMapRegion

interface WorldMapRevenueProps {
  regions: RegionData[]
  onRegionClick?: (region: RegionData) => void
}

const GeographicRevenueMap = dynamic(
  () => import("@/components/dashboard/geographic-revenue-map").then((mod) => mod.GeographicRevenueMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-400">
        Loading geographic map...
      </div>
    ),
  },
)

export function WorldMapRevenue({ regions, onRegionClick }: WorldMapRevenueProps) {
  const { mapped, unmapped, availableMetrics } = React.useMemo(
    () => aggregateWorldMapRegions(regions),
    [regions],
  )

  return (
    <GeographicRevenueMap
      data={mapped}
      metric="revenue"
      availableMetrics={availableMetrics}
      unmappedLocations={unmapped}
      onCountrySelect={(country) => {
        const matchingRegion = regions.find((region) => {
          const normalized = normalizeCountry(region.countryCode || region.name)
          return normalized?.countryCode === country.countryCode || region.name === country.countryName
        })
        if (matchingRegion) onRegionClick?.(matchingRegion)
      }}
    />
  )
}
