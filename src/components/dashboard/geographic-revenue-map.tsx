"use client";

import { GeographicMapControls } from "@/components/dashboard/geographic-map-controls";
import {
  GeographicMapTooltip,
  formatMetric,
  labelForMetric,
} from "@/components/dashboard/geographic-map-tooltip";
import worldTopologyJson from "@/assets/maps/world-110m.json";
import { scaleSqrt } from "d3-scale";
import { useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";

export type GeographicMetric = {
  countryCode?: string;
  countryName: string;
  latitude: number;
  longitude: number;
  revenue?: number;
  orders?: number;
  customers?: number;
  datasets?: number;
};

export type MetricKey = "revenue" | "orders" | "customers" | "datasets";

type Props = {
  data: GeographicMetric[];
  metric?: MetricKey;
  currency?: string;
  unmappedLocations?: number;
  onCountrySelect?: (country: GeographicMetric) => void;
};

type WorldTopology = {
  type?: string;
  objects?: {
    countries?: {
      geometries?: unknown[];
    };
  };
};

const worldTopology = worldTopologyJson as WorldTopology;
const countryCount = worldTopology.objects?.countries?.geometries?.length ?? 0;
const hasWorldTopology = worldTopology.type === "Topology" && countryCount > 0;

export function GeographicRevenueMap({
  data,
  metric = "revenue",
  currency = "USD",
  unmappedLocations = 0,
  onCountrySelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<GeographicMetric | null>(null);
  const [selected, setSelected] = useState<GeographicMetric | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(metric);
  const [zoom, setZoom] = useState(1);

  const sortedData = useMemo(() => {
    return [...data]
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
      .sort((a, b) => Number(b[selectedMetric] ?? 0) - Number(a[selectedMetric] ?? 0));
  }, [data, selectedMetric]);

  const values = useMemo(
    () => sortedData.map((item) => Number(item[selectedMetric] ?? 0)),
    [sortedData, selectedMetric],
  );
  const totalSelectedMetric = values.reduce((total, value) => total + value, 0);
  const totalRevenue = sortedData.reduce((total, item) => total + Number(item.revenue ?? 0), 0);
  const totalOrders = sortedData.reduce((total, item) => total + Number(item.orders ?? 0), 0);
  const topLocation = sortedData[0];

  const radiusScale = useMemo(() => {
    const maxValue = Math.max(...values, 1);
    return scaleSqrt().domain([0, maxValue]).range([4, 22]);
  }, [values]);

  if (sortedData.length === 0) {
    return <EmptyGeoState />;
  }

  if (!hasWorldTopology) {
    return <MapUnavailableState />;
  }

  const handleMarkerMove = (event: React.MouseEvent<SVGCircleElement>, item: GeographicMetric) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    setHovered(item);
  };

  const handleCountrySelect = (country: GeographicMetric) => {
    setSelected(country);
    onCountrySelect?.(country);
  };

  return (
    <div
      ref={containerRef}
      className="relative z-[125] overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/35"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,4fr)_minmax(220px,1.15fr)]">
        <div className="relative min-h-[390px] overflow-hidden bg-[#08111f] pt-20 sm:min-h-[480px] lg:pt-0">
          <GeographicMapControls
            metric={selectedMetric}
            onMetricChange={setSelectedMetric}
            onZoomIn={() => setZoom((value) => Math.min(value + 0.5, 6))}
            onZoomOut={() => setZoom((value) => Math.max(value - 0.5, 1))}
            onReset={() => {
              setZoom(1);
              setSelected(null);
            }}
          />

          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [0, 18], scale: 118 }}
            className="h-[390px] w-full sm:h-[480px] lg:h-[540px]"
          >
            <ZoomableGroup zoom={zoom} center={[0, 18]}>
              <Geographies geography={worldTopology}>
                {({ geographies }) =>
                  geographies.length > 0 ? (
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#1f2d44"
                        stroke="#62708a"
                        strokeWidth={0.45}
                        style={{
                          default: { outline: "none" },
                          hover: { fill: "#2d4264", outline: "none" },
                          pressed: { fill: "#355071", outline: "none" },
                        }}
                      />
                    ))
                  ) : (
                    <text
                      x="400"
                      y="225"
                      textAnchor="middle"
                      className="fill-slate-200 text-sm font-semibold"
                    >
                      World map data unavailable
                    </text>
                  )
                }
              </Geographies>

              {sortedData.map((item, index) => {
                const value = Number(item[selectedMetric] ?? 0);
                const selectedCountry = selected?.countryCode === item.countryCode;

                return (
                  <Marker
                    key={`${item.countryCode || item.countryName}-${selectedMetric}`}
                    coordinates={[item.longitude, item.latitude]}
                  >
                    <circle
                      r={radiusScale(value)}
                      fill={index === 0 ? "#a78bfa" : "#22d3ee"}
                      opacity={selectedCountry ? 0.92 : 0.75}
                      stroke="rgba(255,255,255,0.65)"
                      strokeWidth={selectedCountry ? 1.5 : 1}
                      className="cursor-pointer transition-transform hover:scale-110 focus:outline-none"
                      tabIndex={0}
                      role="button"
                      aria-label={`${item.countryName}: ${formatMetric(value, selectedMetric, currency)}`}
                      onMouseMove={(event) => handleMarkerMove(event, item)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(item)}
                      onBlur={() => setHovered(null)}
                      onClick={() => handleCountrySelect(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") handleCountrySelect(item);
                      }}
                    />
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>

          {hovered && (
            <GeographicMapTooltip
              item={hovered}
              metric={selectedMetric}
              total={totalSelectedMetric}
              rank={sortedData.findIndex((item) => item.countryName === hovered.countryName) + 1}
              x={tooltipPosition.x}
              y={tooltipPosition.y}
              currency={currency}
            />
          )}
        </div>

        <aside className="border-t border-slate-800 bg-slate-900/80 p-4 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <SummaryCard
              label="Total mapped revenue"
              value={formatMetric(totalRevenue, "revenue", currency)}
            />
            <SummaryCard
              label="Total mapped orders"
              value={formatMetric(totalOrders, "orders", currency)}
            />
            <SummaryCard label="Top location" value={topLocation?.countryName || "No data"} />
            <SummaryCard
              label="Mapped locations"
              value={formatMetric(sortedData.length, "datasets", currency)}
            />
            <SummaryCard
              label="Unmapped locations"
              value={formatMetric(unmappedLocations, "datasets", currency)}
            />
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Top countries by {labelForMetric(selectedMetric).toLowerCase()}
            </p>
            <div className="space-y-2">
              {sortedData.slice(0, 5).map((item, index) => {
                const value = Number(item[selectedMetric] ?? 0);
                const share = totalSelectedMetric > 0 ? (value / totalSelectedMetric) * 100 : 0;
                return (
                  <button
                    key={`${item.countryCode || item.countryName}-rank`}
                    type="button"
                    onClick={() => handleCountrySelect(item)}
                    className="group w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-slate-100">
                        {index + 1}. {item.countryName}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-cyan-200">
                        {formatMetric(value, selectedMetric, currency)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <span
                        className="block h-full rounded-full bg-cyan-300"
                        style={{ width: `${Math.max(5, share)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {selected && (
        <div className="absolute bottom-4 right-4 z-20 w-[min(320px,calc(100%-2rem))] rounded-lg border border-slate-700 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/70 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{selected.countryName}</p>
              <p className="mt-1 text-xs text-slate-400">Country detail</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SummaryCard
              label="Revenue"
              value={formatMetric(Number(selected.revenue ?? 0), "revenue", currency)}
            />
            <SummaryCard
              label="Orders"
              value={formatMetric(Number(selected.orders ?? 0), "orders", currency)}
            />
            <SummaryCard
              label="Customers"
              value={formatMetric(Number(selected.customers ?? 0), "customers", currency)}
            />
            <SummaryCard
              label="Datasets"
              value={formatMetric(Number(selected.datasets ?? 0), "datasets", currency)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyGeoState() {
  return (
    <div className="flex max-h-[180px] min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-cyan-300/20 bg-slate-950/70 p-5 text-center">
      <p className="text-sm font-semibold text-white">No geographic data detected</p>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
        Upload geographic data with country, country_code, city, region, market, or location
        columns.
      </p>
      <a
        href="/app/datasets"
        className="mt-3 rounded-md bg-cyan-400/15 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/25"
      >
        Upload geographic data
      </a>
    </div>
  );
}

function MapUnavailableState() {
  return (
    <div className="flex max-h-[220px] min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-cyan-300/20 bg-slate-950/70 p-5 text-center">
      <p className="text-sm font-semibold text-white">World map data unavailable</p>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
        Geographic context cannot be loaded for this view.
      </p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
