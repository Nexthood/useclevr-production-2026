export type DashboardChartPoint = {
  label: string
  value: number
}

export type DashboardChartLayoutPoint = DashboardChartPoint & {
  x: number
  y: number
}

export type DashboardChartDomain = {
  min: number
  max: number
}

export type DashboardChartLayout = {
  width: number
  height: number
  plot: {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }
  domain: DashboardChartDomain
  points: DashboardChartLayoutPoint[]
  linePoints: string
  areaPoints: string
  baselineY: number
  zeroY: number | null
}

export function paddedValueDomain(values: number[]): DashboardChartDomain {
  const finiteValues = values.filter(Number.isFinite)
  if (finiteValues.length === 0) return { min: -1, max: 1 }

  const minValue = Math.min(...finiteValues)
  const maxValue = Math.max(...finiteValues)
  const magnitude = Math.max(Math.abs(minValue), Math.abs(maxValue), 1)
  const span = maxValue - minValue
  const padding = Math.max(span * 0.12, magnitude * 0.04, 1)

  let min = minValue - padding
  let max = maxValue + padding

  if (span === 0) {
    min = minValue - padding
    max = maxValue + padding
  }

  if (min === max) {
    min -= 1
    max += 1
  }

  return { min, max }
}

export function buildAreaChartLayout(
  data: DashboardChartPoint[],
  options: {
    width?: number
    height?: number
    padding?: { top: number; right: number; bottom: number; left: number }
  } = {},
): DashboardChartLayout {
  const width = options.width ?? 560
  const height = options.height ?? 210
  const padding = options.padding ?? { top: 14, right: 14, bottom: 22, left: 14 }
  const plot = {
    left: padding.left,
    right: width - padding.right,
    top: padding.top,
    bottom: height - padding.bottom,
    width: width - padding.left - padding.right,
    height: height - padding.top - padding.bottom,
  }
  const domain = paddedValueDomain(data.map((point) => point.value))
  const range = Math.max(domain.max - domain.min, 1)
  const yForValue = (value: number) => plot.top + ((domain.max - value) / range) * plot.height
  const baselineY = clamp(yForValue(0), plot.top, plot.bottom)
  const points = data.map((point, index) => {
    const x = data.length === 1 ? plot.left + plot.width / 2 : plot.left + (index / (data.length - 1)) * plot.width
    return { ...point, x, y: yForValue(point.value) }
  })
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ")
  const areaPoints = points.length > 0
    ? `${points[0].x},${baselineY} ${linePoints} ${points[points.length - 1].x},${baselineY}`
    : ""
  const zeroY = domain.min < 0 && domain.max > 0 ? baselineY : null

  return {
    width,
    height,
    plot,
    domain,
    points,
    linePoints,
    areaPoints,
    baselineY,
    zeroY,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
