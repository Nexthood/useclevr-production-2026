import { getAppHealth } from "@/lib/health/app-health"
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(await getAppHealth())
}

export async function HEAD() {
  const health = await getAppHealth()
  return new Response(null, {
    status: 200,
    headers: {
      "x-useclevr-app": health.app,
      "x-useclevr-database": health.database,
      "x-useclevr-helper": health.helper,
    },
  })
}

export async function POST() {
  const health = await getAppHealth()
  const ready = health.database === "healthy"

  return NextResponse.json({
    ...health,
    ok: ready,
    status: ready ? "ready" : "not-ready",
  }, { status: ready ? 200 : 503 })
}
