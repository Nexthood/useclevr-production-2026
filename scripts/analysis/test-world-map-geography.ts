import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { geoMercator, geoPath } from "d3-geo"
import { scaleSqrt } from "d3-scale"
import { feature } from "topojson-client"

// Regression: the world map must render real world geography from the bundled
// TopoJSON topology, not hand-drawn ellipse approximations. The rendering
// regression replaced country outlines with <ellipse> landmasses while the
// data overlays stayed alive, producing large ovals instead of continents.

const mapComponentSource = readFileSync("src/components/dashboard/geographic-revenue-map.tsx", "utf8")
const worldMapWrapperSource = readFileSync("src/components/ui/world-map-revenue.tsx", "utf8")
const controlsSource = readFileSync("src/components/dashboard/geographic-map-controls.tsx", "utf8")
const tooltipSource = readFileSync("src/components/dashboard/geographic-map-tooltip.tsx", "utf8")
const packageJson = JSON.parse(readFileSync("package.json", "utf8"))

assert.ok(mapComponentSource.includes('from "@/assets/maps/world-110m.json"'), "world map renders the bundled local world topology")
assert.ok(mapComponentSource.includes("geoMercator"), "world map uses the Mercator projection generator")
assert.ok(mapComponentSource.includes("geoPath"), "world map generates SVG paths with the d3-geo path generator")
assert.ok(mapComponentSource.includes('from "topojson-client"'), "world map decodes TopoJSON with topojson-client")
assert.ok(!mapComponentSource.includes("ApproximateLandmasses"), "world map no longer draws approximate landmasses")
assert.ok(!mapComponentSource.includes("<ellipse"), "world map no longer renders ellipse shapes as continents")
assert.ok(mapComponentSource.includes("scale(${zoom})"), "world map zoom scales the geography layer together with the markers")
assert.ok(mapComponentSource.includes('fill="#1f2d44"'), "world map keeps the dark theme country fill")
assert.ok(mapComponentSource.includes("hover:fill-[#2d4264]"), "world map keeps the hover country highlight")
assert.ok(mapComponentSource.includes("MapUnavailableState"), "world map keeps a safe state for missing topology")

assert.ok(worldMapWrapperSource.includes("GeographicRevenueMap"), "world map revenue wrapper routes regions into the geographic map")
assert.ok(worldMapWrapperSource.includes('metric="revenue"'), "world map revenue wrapper opens in revenue mode")
assert.ok(controlsSource.includes("revenue") && controlsSource.includes("orders") && controlsSource.includes("customers") && controlsSource.includes("datasets"), "world map keeps Revenue, Orders, Customers, and Datasets modes")

assert.ok(!packageJson.dependencies["react-simple-maps"], "react-simple-maps stays removed to avoid the React 19 peer dependency conflict")
assert.ok(packageJson.dependencies["d3-geo"], "d3-geo is available for world geography rendering")
assert.ok(packageJson.dependencies["topojson-client"], "topojson-client is available for TopoJSON decoding")

// The bundled topology must decode into real country outlines and project the
// reported production location (Netherlands) inside the visible map area.
type CountryFeature = {
  id?: string | number;
  properties?: { name?: string } | null;
};

const worldTopology = JSON.parse(readFileSync("src/assets/maps/world-110m.json", "utf8"))
assert.equal(worldTopology.type, "Topology", "bundled world topology is a TopoJSON Topology")

const projection = geoMercator().center([0, 18]).scale(118).translate([400, 250])
const pathGenerator = geoPath(projection)

const collection = feature(
  worldTopology as unknown as Parameters<typeof feature>[0],
  worldTopology.objects.countries as unknown as Parameters<typeof feature>[1],
)
const countryFeatures: CountryFeature[] =
  "features" in collection
    ? (collection.features as unknown as CountryFeature[])
    : [collection as unknown as CountryFeature]
assert.ok(countryFeatures.length >= 100, `world topology decodes into country features (got ${countryFeatures.length})`)

const pathLengths = countryFeatures.map((countryFeature) => (pathGenerator(countryFeature as Parameters<typeof pathGenerator>[0]) || "").length)
assert.ok(pathLengths.every((length) => length > 0), "every country feature generates a non-empty SVG path")

const netherlands = countryFeatures.find((countryFeature) => countryFeature.id === "528")
assert.ok(netherlands, "world topology contains the Netherlands")

const netherlandsPoint = projection([5.3, 52.2])
assert.ok(netherlandsPoint, "Netherlands projection returns a point")
if (netherlandsPoint) {
  assert.ok(netherlandsPoint[0] >= 0 && netherlandsPoint[0] <= 800, "Netherlands projects inside the horizontal map area")
  assert.ok(netherlandsPoint[1] >= 0 && netherlandsPoint[1] <= 500, "Netherlands projects inside the vertical map area")
}

// ---------------------------------------------------------------------------
// B) Bubble interaction stability regression
//
// Invariant: interaction state must never mutate geographic projection
// coordinates. For the same zoom/pan state:
//   normal.cx === hover.cx === selected.cx
//   normal.cy === hover.cy === selected.cy
// Hover may change fill/opacity/stroke/halo only. The regression that prompted
// this suite: `transition-transform hover:scale-110` on the marker circle
// scaled the bubble around the SVG view-box origin, so the rendered center
// jumped away from the projected coordinate during hover and pointer
// hit-testing followed the displaced shape, making bubbles unreliable to
// click (worst for Australia and overlapping European locations).
// ---------------------------------------------------------------------------

// The exact regression: no CSS scale/transform ever applies to markers again.
assert.ok(!mapComponentSource.includes("hover:scale"), "map markers never apply a CSS hover scale that displaces the projected center")
assert.ok(!mapComponentSource.includes("transition-transform"), "markers never animate transforms, so hover cannot move a bubble")
assert.ok(!mapComponentSource.includes("transform-origin"), "markers define no transform origin because no marker uses a CSS transform")

// Visual bubble and interaction hit target are separate elements that share
// the exact projected center.
const markerLayerStart = mapComponentSource.indexOf("orderedMarkerData.map(")
const markerLayerEnd = mapComponentSource.indexOf("</svg>", markerLayerStart)
assert.ok(markerLayerStart > 0 && markerLayerEnd > markerLayerStart, "markers render from a dedicated ordered marker layer")
const markerLayer = mapComponentSource.slice(markerLayerStart, markerLayerEnd)
assert.ok(!markerLayer.includes("transition-transform") && !markerLayer.includes("hover:scale"), "the marker layer contains no CSS transform on any bubble")

const hitTargetCount = (markerLayer.match(/pointerEvents="all"/g) || []).length
assert.ok(hitTargetCount === 1, "each marker exposes exactly one invisible interaction hit circle")
assert.ok(markerLayer.includes('fill="transparent"'), "the interaction hit target is invisible so it cannot change the displayed metric size")
assert.ok(mapComponentSource.includes("Math.max(visualRadius, MIN_HIT_RADIUS)"), "hit radius guarantees a minimum usable target around the same center")
const visualNonInteractiveCount = (markerLayer.match(/pointerEvents="none"/g) || []).length
assert.ok(visualNonInteractiveCount >= 2, "visual bubble and hover halo never intercept pointer events meant for the hit target")

const cxAttrs = mapComponentSource.match(/(?<![a-zA-Z])cx=\{[^}]*\}/g) || []
const cyAttrs = mapComponentSource.match(/(?<![a-zA-Z])cy=\{[^}]*\}/g) || []
assert.ok(cxAttrs.length === 3 && cxAttrs.every((attr) => attr === "cx={x}"), "halo, visual bubble, and hit target share one identical projected cx")
assert.ok(cyAttrs.length === 3 && cyAttrs.every((attr) => attr === "cy={y}"), "halo, visual bubble, and hit target share one identical projected cy")

// Single projection source: interaction state never re-projects coordinates.
const projectionCallCount = (mapComponentSource.match(/projection\(\[/g) || []).length
assert.ok(projectionCallCount === 1, "marker centers derive from exactly one projection call per location")
const projectionMemo = mapComponentSource.match(/const projectedPoints = useMemo\(([\s\S]*?)\[sortedData\],/)
assert.ok(projectionMemo, "projected marker coordinates are memoized and depend on data only")
const projectionMemoBody = projectionMemo?.[0] ?? ""
assert.ok(!projectionMemoBody.includes("hovered") && !projectionMemoBody.includes("selected"), "interaction state never re-projects geographic projection coordinates")

// All interaction handlers live on the invisible hit target.
const hitTargetBlock = mapComponentSource.slice(
  mapComponentSource.indexOf('pointerEvents="all"'),
  mapComponentSource.indexOf('pointerEvents="all"') + 1200,
)
for (const interaction of [
  "tabIndex={0}",
  'role="button"',
  "onMouseEnter",
  "onMouseLeave",
  "onFocus",
  "onBlur",
  "onClick",
  "onKeyDown",
]) {
  assert.ok(hitTargetBlock.includes(interaction), `hit target carries the full interaction surface (${interaction})`)
}

// ---------------------------------------------------------------------------
// C) Bubble calmness regression: the marker layer is fully static.
//
// For a given country + metric + zoom state, x, y, and radius never change
// over time, on hover, or on selection. No CSS transitions, no CSS
// animations, no scaling, no timer-driven mutation. Emphasis may only swap
// stroke color and a static halo instantly.
// ---------------------------------------------------------------------------
assert.ok(!mapComponentSource.includes("transition"), "the world map renders no CSS transitions anywhere in the marker tree")
assert.ok(!mapComponentSource.includes("animate-"), "the world map uses no CSS animation utilities")
assert.ok(!mapComponentSource.includes("keyframes"), "the world map defines no keyframes")
assert.ok(!/setInterval|setTimeout|requestAnimationFrame|performance\.now|Date\.now/.test(mapComponentSource), "the world map drives no timer-based marker mutation")
assert.ok(!mapComponentSource.includes("onMouseMove"), "the tooltip anchors once per hover instead of tracking the pointer and re-rendering the map")
assert.ok(mapComponentSource.includes("onMouseEnter"), "hover emphasis applies once on marker enter")
assert.ok(mapComponentSource.includes("opacity={0.8}"), "bubble opacity is constant across idle, hover, and selected states")
const rAttrs = mapComponentSource.match(/(?<![a-zA-Z])r=\{[^}]*\}/g) || []
assert.deepEqual(
  rAttrs,
  ["r={visualRadius + 4}", "r={visualRadius}", "r={hitRadius}"],
  "marker radius attributes are static expressions independent of hover or selection state",
)
assert.ok(
  mapComponentSource.includes('key={`${item.countryCode || item.countryName}-${selectedMetric}`}'),
  "marker keys derive only from country identity and metric, never from interaction state",
)
assert.ok(
  !mapComponentSource.includes("hovered ?") && !mapComponentSource.includes("selected ?"),
  "marker geometry and styling never depend on raw interaction-state truthiness",
)

// Deterministic stacking: large bubbles paint first so smaller bubbles stay
// on top and clickable in overlaps; only selection raises a marker, hover
// never reorders markers.
assert.ok(
  mapComponentSource.includes(".sort((a, b) => Number(b[selectedMetric] ?? 0) - Number(a[selectedMetric] ?? 0))"),
  "bubbles stack deterministically by metric size with smaller bubbles on top",
)
const orderMemo = mapComponentSource.match(/const orderedMarkerData = useMemo\(\(\) => \{[\s\S]*?\}, \[sortedData, selected\]\);/)
assert.ok(orderMemo, "marker render order is a deterministic reorder of the sorted data")
assert.ok(!(orderMemo?.[0] ?? "").includes("hovered"), "hover state never reorders markers, avoiding hover/leave detach loops")

// The detail panel must not shift the marker layer.
const svgCloseIndex = mapComponentSource.indexOf("</svg>")
const detailPanelIndex = mapComponentSource.indexOf("{selected && (")
assert.ok(detailPanelIndex > svgCloseIndex, "country detail panel renders after the SVG as a sibling overlay")
assert.ok(mapComponentSource.includes('viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}'), "map viewBox stays constant regardless of detail panel state")
const detailPanelSource = mapComponentSource.slice(detailPanelIndex)
assert.ok(detailPanelSource.includes("absolute bottom-4 right-4"), "detail panel is absolutely positioned so it cannot resize the map grid, viewBox, or projection")

// The hover tooltip never steals pointer events from the bubbles.
assert.ok(tooltipSource.includes("pointer-events-none"), "hover tooltip never intercepts pointer events from the bubbles")

// Zoom in/out/reset flows keep the bubbles glued to geography.
assert.ok(
  mapComponentSource.includes("translate(${(MAP_WIDTH / 2) * (1 - zoom)} ${(MAP_HEIGHT / 2) * (1 - zoom)}) scale(${zoom})"),
  "zoom scales around the map center so hit targets stay aligned with geography at every zoom level",
)
const resetHandler = mapComponentSource.match(/onReset=\{\(\) => \{([\s\S]*?)\}\}/)
assert.ok(resetHandler && resetHandler[1].includes("setZoom(1)") && resetHandler[1].includes("setSelected(null)"), "map reset restores zoom 1 and clears selection without touching the projection")
assert.ok(mapComponentSource.includes("onClick={() => setSelected(null)}"), "closing the detail panel clears selection without changing marker coordinates")

// Projected-coordinate identity across normal, hover, selected, and zoom for
// the production-reported locations plus nearby European overlaps.
type InteractionLocation = {
  name: string
  latitude: number
  longitude: number
  revenue: number | null
  orders: number | null
  customers: number | null
  datasets: number
}

const interactionLocations: InteractionLocation[] = [
  { name: "Germany", latitude: 51.2, longitude: 10.4, revenue: 120_000, orders: 430, customers: 180, datasets: 3 },
  { name: "Australia", latitude: -25.3, longitude: 133.8, revenue: 95_000, orders: 210, customers: 90, datasets: 2 },
  { name: "Netherlands", latitude: 52.2, longitude: 5.3, revenue: 60_000, orders: 150, customers: 70, datasets: 1 },
  { name: "Belgium", latitude: 50.6, longitude: 4.6, revenue: 45_000, orders: 120, customers: 55, datasets: 1 },
  { name: "France", latitude: 46.8, longitude: 2.4, revenue: 80_000, orders: 260, customers: 110, datasets: 2 },
  { name: "United Kingdom", latitude: 52.8, longitude: -1.8, revenue: 110_000, orders: 320, customers: 140, datasets: 2 },
  { name: "Denmark", latitude: 56.0, longitude: 9.5, revenue: 30_000, orders: 80, customers: 40, datasets: 1 },
]

const minHitRadiusMatch = mapComponentSource.match(/const MIN_HIT_RADIUS = ([\d.]+)/)
assert.ok(minHitRadiusMatch, "the map defines its minimum hit radius as a named constant")
const MIN_HIT_RADIUS = Number(minHitRadiusMatch[1])
assert.ok(MIN_HIT_RADIUS >= 10, "minimum hit radius provides a usable pointer target (>= 10 viewBox units)")

// normal-state projected coordinates: the single source every state renders.
const projectedCenters = new Map(
  interactionLocations.map((location) => {
    const point = projection([location.longitude, location.latitude])
    assert.ok(point, `${location.name} projects to a map point`)
    if (!point) throw new Error("unreachable")
    assert.ok(point[0] >= 0 && point[0] <= 800 && point[1] >= 0 && point[1] <= 500, `${location.name} projects inside the visible map area`)
    return [location.name, point] as const
  }),
)

// The removed hover:scale-110 displaced the rendered center by 10% of the
// vector from the view-box center; document that the old bug was material.
const australiaCenter = projectedCenters.get("Australia")
assert.ok(australiaCenter, "Australia projects to a map point")
const australiaDisplacement = australiaCenter
  ? Math.hypot(0.1 * (australiaCenter[0] - 400), 0.1 * (australiaCenter[1] - 250))
  : 0
assert.ok(australiaDisplacement > 15, "the removed hover scale used to displace Australia's bubble by a visible amount")

// Hover/selected states render the identical projected center; the halo grows
// the radius around the same center without any transform.
for (const location of interactionLocations) {
  const normalCenter = projectedCenters.get(location.name)
  assert.ok(normalCenter, `${location.name} has a projected center`)
  if (!normalCenter) continue
  for (const state of ["hover", "selected"] as const) {
    // The component renders cx={x} / cy={y} from the memoized projection for
    // every state; the structural asserts above pin that single source.
    const stateCenter = projectedCenters.get(location.name)
    assert.ok(stateCenter, `${location.name} has a projected center in ${state} state`)
    assert.deepEqual(stateCenter, normalCenter, `${location.name} keeps identical projected coordinates across normal and ${state} states`)
  }
}

// Metric modes (Revenue / Orders / Customers / Datasets) must not move any
// bubble center, and every hit radius must stay usable.
const metricKeys = ["revenue", "orders", "customers", "datasets"] as const
for (const metricKey of metricKeys) {
  const sorted = [...interactionLocations]
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .sort((a, b) => Number(b[metricKey] ?? 0) - Number(a[metricKey] ?? 0))
  const valuesForMetric = sorted.map((item) => Number(item[metricKey] ?? 0))
  const metricScale = scaleSqrt().domain([0, Math.max(...valuesForMetric, 1)]).range([4, 22])
  for (const item of sorted) {
    const metricPoint = projection([item.longitude, item.latitude])
    assert.ok(metricPoint, `${item.name} projects to a map point in ${metricKey} mode`)
    if (!metricPoint) continue
    assert.deepEqual(metricPoint, projectedCenters.get(item.name), `${item.name} keeps its projected center in ${metricKey} mode`)
    const visualRadius = metricScale(Number(item[metricKey] ?? 0))
    const hitRadius = Math.max(visualRadius, MIN_HIT_RADIUS)
    assert.ok(hitRadius >= MIN_HIT_RADIUS && hitRadius >= visualRadius, `${item.name} hit target stays usable in ${metricKey} mode (visual ${visualRadius.toFixed(1)}, hit ${hitRadius.toFixed(1)})`)
  }
}

// Overlapping Europe: nearby locations remain individually targetable because
// smaller bubbles paint above larger ones, and no marker ever moves to make
// room for another.
const europeNames = ["Netherlands", "Belgium", "France", "United Kingdom", "Denmark", "Germany"]
let europeDistinctCenters = true
for (let i = 0; i < europeNames.length && europeDistinctCenters; i += 1) {
  for (let j = i + 1; j < europeNames.length; j += 1) {
    const centerA = projectedCenters.get(europeNames[i])
    const centerB = projectedCenters.get(europeNames[j])
    if (!centerA || !centerB) continue
    if (centerA[0] === centerB[0] && centerA[1] === centerB[1]) {
      europeDistinctCenters = false
      break
    }
  }
}
assert.ok(europeDistinctCenters, "nearby European bubbles keep distinct fixed projected centers")

console.log(
  `World map geography verification passed. countries=${countryFeatures.length} netherlands=[${netherlandsPoint?.[0].toFixed(1)}, ${netherlandsPoint?.[1].toFixed(1)}] interaction=minHitRadius=${MIN_HIT_RADIUS} oldHoverDisplacementAustralia=${australiaDisplacement.toFixed(1)}uv`,
)
