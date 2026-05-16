import { NextRequest, NextResponse } from "next/server"

interface ForecastPoint {
  period: number
  value: number
}

function toFiniteNumbers(values: unknown) {
  if (!Array.isArray(values)) return []
  return values.map(Number).filter((value) => Number.isFinite(value))
}

function linearForecast(values: number[], periods: number): ForecastPoint[] {
  if (values.length === 0) return []
  if (values.length === 1) {
    return Array.from({ length: periods }, (_, index) => ({
      period: index + 1,
      value: values[0],
    }))
  }

  const n = values.length
  const sumX = values.reduce((sum, _value, index) => sum + index, 0)
  const sumY = values.reduce((sum, value) => sum + value, 0)
  const sumXY = values.reduce((sum, value, index) => sum + index * value, 0)
  const sumXX = values.reduce((sum, _value, index) => sum + index * index, 0)
  const denominator = n * sumXX - sumX * sumX
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return Array.from({ length: periods }, (_, index) => {
    const x = n + index
    return {
      period: index + 1,
      value: Number((intercept + slope * x).toFixed(2)),
    }
  })
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "POST numeric values to generate a lightweight linear forecast.",
    example: { values: [100, 120, 140], periods: 3 },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const values = toFiniteNumbers(body.values)
  const periods = Math.min(Math.max(Number(body.periods) || 3, 1), 12)

  if (values.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one numeric value in `values`." },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    method: "linear_trend",
    inputCount: values.length,
    periods,
    forecast: linearForecast(values, periods),
  })
}
