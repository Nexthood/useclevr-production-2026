import { headers } from "next/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const h = headers()
  const relevantHeaders = {
    accept: h.get("accept"),
    rsc: h.get("rsc"),
    nextRouterStateTree: h.get("next-router-state-tree"),
    nextRouterPrefetch: h.get("next-router-prefetch"),
    nextUrl: h.get("next-url"),
    userAgent: h.get("user-agent"),
    xForwardedHost: h.get("x-forwarded-host"),
    xForwardedProto: h.get("x-forwarded-proto"),
    host: h.get("host"),
  }

  const diagnosis = {
    hasRscHeader: h.has("rsc"),
    hasNextRouterStateTree: h.has("next-router-state-tree"),
    hasNextRouterPrefetch: h.has("next-router-prefetch"),
    possibleCause:
      h.has("rsc") || h.has("next-router-state-tree") || h.has("next-router-prefetch")
        ? "Request contains Next.js RSC/navigation headers. Railway/proxy may be forwarding or triggering a partial App Router response."
        : "No obvious RSC/navigation headers detected on this debug request.",
    relevantHeaders,
  }

  return NextResponse.json({ diagnosis })
}
