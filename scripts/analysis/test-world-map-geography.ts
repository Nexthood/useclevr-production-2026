import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { geoMercator, geoPath } from "d3-geo"
import { feature } from "topojson-client"

// Regression: the world map must render real world geography from the bundled
// TopoJSON topology, not hand-drawn ellipse approximations. The rendering
// regression replaced country outlines with <ellipse> landmasses while the
// data overlays stayed alive, producing large ovals instead of continents.

const mapComponentSource = readFileSync("src/components/dashboard/geographic-revenue-map.tsx", "utf8")
const worldMapWrapperSource = readFileSync("src/components/ui/world-map-revenue.tsx", "utf8")
const controlsSource = readFileSync("src/components/dashboard/geographic-map-controls.tsx", "utf8")
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

console.log(`World map geography verification passed. countries=${countryFeatures.length} netherlands=[${netherlandsPoint?.[0].toFixed(1)}, ${netherlandsPoint?.[1].toFixed(1)}]`)
