import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  return NextResponse.json({
    url: new URL("/app/settings/billing", request.nextUrl.origin).toString(),
    status: "provider_not_connected",
  })
}
