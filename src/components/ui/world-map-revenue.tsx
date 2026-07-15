"use client"

import type { GeographicMetric } from "@/components/dashboard/geographic-revenue-map"
import { normalizeCountry } from "@/lib/geo/normalize-country"
import dynamic from "next/dynamic"
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
  datasets?: number
  customers?: number
  topProduct?: string
  topCategory?: string
}

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
  const { mapped, unmapped } = React.useMemo(() => {
    const aggregate = new Map<string, GeographicMetric>()
    let unmappedCount = 0

    for (const region of regions || []) {
      const normalized = normalizeCountry(region.countryCode || region.name)
      const hasExplicitCoordinates = Number.isFinite(region.latitude) && Number.isFinite(region.longitude)

      if (!normalized && !hasExplicitCoordinates) {
        unmappedCount += 1
        if (process.env.NODE_ENV !== "production") {
          console.warn("[WorldMapRevenue] Unmapped geographic location excluded from map", region.name)
        }
        continue
      }

      const locationKey = normalized?.countryCode || region.name
      const existing = aggregate.get(locationKey) || {
        countryCode: locationKey,
        countryName: normalized?.countryName || region.name,
        latitude: (hasExplicitCoordinates ? Number(region.latitude) : normalized?.latitude) ?? 0,
        longitude: (hasExplicitCoordinates ? Number(region.longitude) : normalized?.longitude) ?? 0,
        revenue: 0,
        orders: 0,
        customers: 0,
        datasets: 0,
      }

      existing.revenue = Number(existing.revenue || 0) + Number(region.revenue || 0)
      existing.orders = Number(existing.orders || 0) + Number(region.orders || 0)
      existing.customers = Number(existing.customers || 0) + Number(region.customers || 0)
      existing.datasets = Number(existing.datasets || 0) + Number(region.datasets || 0)
      aggregate.set(locationKey, existing)
    }

    return { mapped: Array.from(aggregate.values()), unmapped: unmappedCount }
  }, [regions])

  return (
    <GeographicRevenueMap
      data={mapped}
      metric="revenue"
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
