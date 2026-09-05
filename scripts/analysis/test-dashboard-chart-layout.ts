import assert from "node:assert/strict"

import { buildAreaChartLayout, type DashboardChartPoint } from "../../src/lib/data/dashboard-chart-layout"

function main() {
  assertContained("positive-only revenue", [
    { label: "Jan", value: 12000 },
    { label: "Feb", value: 18500 },
    { label: "Mar", value: 26000 },
  ])
  assertContained("negative-only profit", [
    { label: "Jan", value: -12000 },
    { label: "Feb", value: -8500 },
    { label: "Mar", value: -21500 },
  ])
  assertContained("mixed positive and negative profit", [
    { label: "Jan", value: 9000 },
    { label: "Feb", value: -14500 },
    { label: "Mar", value: 10700 },
    { label: "Apr", value: -2200 },
  ], { expectZeroLine: true })
  assertContained("zero values", [
    { label: "Jan", value: 0 },
    { label: "Feb", value: 0 },
    { label: "Mar", value: 0 },
  ], { expectZeroLine: true })
  assertContained("large value range", [
    { label: "Jan", value: -950000 },
    { label: "Feb", value: 0 },
    { label: "Mar", value: 1250000 },
  ], { expectZeroLine: true })

  const professionalServicesRevenue = [
    { label: "Jan", value: 113420 },
    { label: "Feb", value: 127880 },
    { label: "Mar", value: 139250 },
    { label: "Apr", value: 144620 },
    { label: "May", value: 168290 },
  ]
  const professionalServicesProfit = [
    { label: "Jan", value: 16420 },
    { label: "Feb", value: 19100 },
    { label: "Mar", value: 21380 },
    { label: "Apr", value: 23260 },
    { label: "May", value: 27513 },
  ]
  assert.equal(sum(professionalServicesRevenue), 693460, "professional-services revenue fixture must match selected-dashboard total")
  assert.equal(sum(professionalServicesProfit), 107673, "professional-services profit fixture must match selected-dashboard total")
  assertContained("professional-services revenue trend", professionalServicesRevenue)
  assertContained("professional-services profit trend", professionalServicesProfit)

  for (const size of [
    { width: 320, height: 180 },
    { width: 560, height: 210 },
    { width: 960, height: 260 },
  ]) {
    assertContained(`responsive ${size.width}x${size.height}`, [
      { label: "Jan", value: 693460 },
      { label: "Feb", value: -107673 },
      { label: "Mar", value: 0 },
      { label: "Apr", value: 412000 },
    ], { expectZeroLine: true, ...size })
  }

  process.stdout.write("Dashboard chart layout tests passed.\n")
}

function assertContained(
  label: string,
  data: DashboardChartPoint[],
  options: { expectZeroLine?: boolean; width?: number; height?: number } = {},
) {
  const layout = buildAreaChartLayout(data, options)
  assert(layout.domain.min < Math.min(...data.map((point) => point.value)), `${label}: domain must pad below the minimum value`)
  assert(layout.domain.max > Math.max(...data.map((point) => point.value)), `${label}: domain must pad above the maximum value`)
  assert(layout.linePoints.length > 0, `${label}: line points must render`)
  assert(layout.areaPoints.length > 0, `${label}: area points must render`)
  assert(layout.baselineY >= layout.plot.top && layout.baselineY <= layout.plot.bottom, `${label}: area baseline must stay inside plot bounds`)

  for (const point of layout.points) {
    assert(point.x >= layout.plot.left && point.x <= layout.plot.right, `${label}: point x must stay inside plot bounds`)
    assert(point.y > layout.plot.top && point.y < layout.plot.bottom, `${label}: point y must stay inside padded plot bounds`)
  }

  if (options.expectZeroLine) {
    assert(layout.zeroY !== null, `${label}: zero line must be available when zero is in the domain`)
    assert(layout.zeroY > layout.plot.top && layout.zeroY < layout.plot.bottom, `${label}: zero line must stay inside plot bounds`)
  }
}

function sum(data: DashboardChartPoint[]) {
  return data.reduce((total, point) => total + point.value, 0)
}

main()
