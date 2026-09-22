"use client";

import { GeographicMapControls } from "@/components/dashboard/geographic-map-controls";
import {
  GeographicMapTooltip,
  formatMetric,
  formatMetricOrUnavailable,
  labelForMetric,
} from "@/components/dashboard/geographic-map-tooltip";
import {
  sumMeasuredGeographicValues,
  UNAVAILABLE_METRIC_LABEL,
} from "@/lib/data/geographic-metric-semantics";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { scaleSqrt } from "d3-scale";
import worldTopologyJson from "@/assets/maps/world-110m.json";
import { type KeyboardEvent, type MouseEvent, useMemo, useRef, useState } from "react";

export type GeographicMetric = {
  countryCode?: string;
  countryName: string;
  latitude: number;
  longitude: number;
  revenue?: number | null;
  orders?: number | null;
  customers?: number | null;
  datasets?: number;
};

export type MetricKey = "revenue" | "orders" | "customers" | "datasets";

type Props = {
  data: GeographicMetric[];
  metric?: MetricKey;
  availableMetrics?: MetricKey[];
  currency?: string;
  unmappedLocations?: number;
  onCountrySelect?: (country: GeographicMetric) => void;
};

type WorldTopology = {
  type?: string;
  objects?: {
    countries?: unknown;
  };
};

type CountryFeature = {
  id?: string | number;
  properties?: { name?: string } | null;
};

const MAP_WIDTH = 800;
const MAP_HEIGHT = 500;

// Invisible interaction target (viewBox units) so small bubbles stay clickable
// without enlarging the visible metric bubble.
const MIN_HIT_RADIUS = 14;

const worldTopology = worldTopologyJson as WorldTopology;
const hasWorldTopology =
  worldTopology.type === "Topology" && Boolean(worldTopology.objects?.countries);

// Same projection parameters the map rendered with before the dependency swap:
// geoMercator centered at [0, 18], scale 118, translated to the map center.
const projection = geoMercator()
  .center([0, 18])
  .scale(118)
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

const pathGenerator = geoPath(projection);

export function GeographicRevenueMap({
  data,
  metric = "revenue",
  availableMetrics,
  currency = "USD",
  unmappedLocations = 0,
  onCountrySelect,
}: Props) {
  const selectableMetrics = useMemo(
    () => availableMetrics ?? (["revenue", "orders", "customers", "datasets"] as MetricKey[]),
    [availableMetrics],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<GeographicMetric | null>(null);
  const [selected, setSelected] = useState<GeographicMetric | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(metric);
  const [zoom, setZoom] = useState(1);

  const countryPaths = useMemo(() => {
    if (!hasWorldTopology || !worldTopology.objects?.countries) return [];
    const collection = feature(
      worldTopologyJson as unknown as Parameters<typeof feature>[0],
      worldTopology.objects.countries as unknown as Parameters<typeof feature>[1],
    );
    const countryFeatures: CountryFeature[] =
      "features" in collection
        ? (collection.features as CountryFeature[])
        : [collection as unknown as CountryFeature];
    return countryFeatures
      .map((countryFeature) => ({
        id: String(countryFeature.id ?? ""),
        name: String(countryFeature.properties?.name ?? ""),
        d: pathGenerator(countryFeature as Parameters<typeof pathGenerator>[0]) || "",
      }))
      .filter((country) => country.d.length > 0);
  }, []);

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
  // null only when no region reports a measured value; measured zeros sum as zeros
  const totalRevenue = sumMeasuredGeographicValues(sortedData.map((item) => item.revenue ?? null));
  const totalOrders = sumMeasuredGeographicValues(sortedData.map((item) => item.orders ?? null));
  const topLocation = sortedData[0];

  const radiusScale = useMemo(() => {
    const maxValue = Math.max(...values, 1);
    return scaleSqrt().domain([0, maxValue]).range([4, 22]);
  }, [values]);

  // Projected centers depend only on the projection and data; hover and
  // selection must never re-project or displace them.
  const projectedPoints = useMemo(
    () =>
      new Map(
        sortedData.map((item) => {
          const point = projection([item.longitude, item.latitude]);
          return [item, point ?? null] as const;
        }),
      ),
    [sortedData],
  );

  // Deterministic marker stacking: large bubbles render first so smaller
  // bubbles paint on top and win hit-testing in overlaps. Only a selection
  // raises a marker above the stack; hover never reorders markers.
  const orderedMarkerData = useMemo(() => {
    if (!selected) return sortedData;
    const selectedIndex = sortedData.indexOf(selected);
    if (selectedIndex < 0) return sortedData;
    const ordered = [...sortedData];
    ordered.splice(selectedIndex, 1);
    ordered.push(selected);
    return ordered;
  }, [sortedData, selected]);

  if (sortedData.length === 0) {
    return <EmptyGeoState />;
  }

  if (!hasWorldTopology || countryPaths.length === 0) {
    return <MapUnavailableState />;
  }

  const handleMarkerMove = (event: MouseEvent<SVGCircleElement>, item: GeographicMetric) => {
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

  const handleMarkerKeyDown = (
    event: KeyboardEvent<SVGCircleElement>,
    item: GeographicMetric,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCountrySelect(item);
    }
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
            availableMetrics={selectableMetrics}
            onMetricChange={setSelectedMetric}
            onZoomIn={() => setZoom((value) => Math.min(value + 0.5, 6))}
            onZoomOut={() => setZoom((value) => Math.max(value - 0.5, 1))}
            onReset={() => {
              setZoom(1);
              setSelected(null);
            }}
          />

          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="h-[390px] w-full sm:h-[480px] lg:h-[540px]"
            role="img"
            aria-label="Geographic revenue map"
          >
            <g
              transform={`translate(${(MAP_WIDTH / 2) * (1 - zoom)} ${(MAP_HEIGHT / 2) * (1 - zoom)}) scale(${zoom})`}
            >
              <g>
                {countryPaths.map((country) => (
                  <path
                    key={country.id || country.name}
                    d={country.d}
                    fill="#1f2d44"
                    stroke="#62708a"
                    strokeWidth={0.45}
                    className="transition-colors outline-none hover:fill-[#2d4264]"
                  />
                ))}
              </g>
              {orderedMarkerData.map((item) => {
                const value = Number(item[selectedMetric] ?? 0);
                const selectedCountry = selected?.countryCode === item.countryCode;
                const hoveredCountry = hovered?.countryCode === item.countryCode;
                const emphasized = hoveredCountry || selectedCountry;
                const point = projectedPoints.get(item);

                if (!point) return null;

                // The center is the immutable projected coordinate: identical
                // across normal, hover, and selected for the same zoom state.
                const x = point[0];
                const y = point[1];
                const visualRadius = radiusScale(value);
                const hitRadius = Math.max(visualRadius, MIN_HIT_RADIUS);

                return (
                  <g key={`${item.countryCode || item.countryName}-${selectedMetric}`}>
                    {emphasized && (
                      <circle
                        cx={x}
                        cy={y}
                        r={visualRadius + 4}
                        fill="none"
                        stroke="rgba(165,243,252,0.55)"
                        strokeWidth={1.5}
                        pointerEvents="none"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={visualRadius}
                      fill={item === topLocation ? "#a78bfa" : "#22d3ee"}
                      opacity={selectedCountry ? 0.92 : hoveredCountry ? 0.9 : 0.75}
                      stroke={emphasized ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)"}
                      strokeWidth={emphasized ? 1.5 : 1}
                      pointerEvents="none"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={hitRadius}
                      fill="transparent"
                      pointerEvents="all"
                      className="cursor-pointer focus:outline-none"
                      tabIndex={0}
                      role="button"
                      aria-label={`${item.countryName}: ${formatMetric(value, selectedMetric, currency)}`}
                      onMouseMove={(event) => handleMarkerMove(event, item)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(item)}
                      onBlur={() => setHovered(null)}
                      onClick={() => handleCountrySelect(item)}
                      onKeyDown={(event) => handleMarkerKeyDown(event, item)}
                    />
                  </g>
                );
              })}
            </g>
          </svg>

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
              value={totalRevenue === null ? UNAVAILABLE_METRIC_LABEL : formatMetric(totalRevenue, "revenue", currency)}
            />
            <SummaryCard
              label="Total mapped orders"
              value={totalOrders === null ? UNAVAILABLE_METRIC_LABEL : formatMetric(totalOrders, "orders", currency)}
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
              value={formatMetricOrUnavailable(selected.revenue, "revenue", currency)}
            />
            <SummaryCard
              label="Orders"
              value={formatMetricOrUnavailable(selected.orders, "orders", currency)}
            />
            <SummaryCard
              label="Customers"
              value={formatMetricOrUnavailable(selected.customers, "customers", currency)}
            />
            <SummaryCard
              label="Datasets"
              value={formatMetricOrUnavailable(selected.datasets, "datasets", currency)}
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
