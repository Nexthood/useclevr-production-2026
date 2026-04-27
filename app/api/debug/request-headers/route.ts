import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const relevantHeaders = {
    accept: request.headers.get("accept"),
    rsc: request.headers.get("rsc"),
    nextRouterStateTree: request.headers.get("next-router-state-tree"),
    nextRouterPrefetch: request.headers.get("next-router-prefetch"),
    nextUrl: request.headers.get("next-url"),
    userAgent: request.headers.get("user-agent"),
    xForwardedHost: request.headers.get("x-forwarded-host"),
    xForwardedProto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host"),
  }

  const hasRsc = request.headers.has("rsc")
  const hasNextRouterStateTree = request.headers.has("next-router-state-tree")
  const hasNextRouterPrefetch = request.headers.has("next-router-prefetch")

  const diagnosis = {
    hasRscHeader: hasRsc,
    hasNextRouterStateTree: hasNextRouterStateTree,
    hasNextRouterPrefetch: hasNextRouterPrefetch,
    possibleCause:
      hasRsc || hasNextRouterStateTree || hasNextRouterPrefetch
        ? "Request contains Next.js RSC/navigation headers. Railway/proxy may be forwarding or triggering a partial App Router response."
        : "No obvious RSC/navigation headers detected on this debug request.",
    relevantHeaders,
  }

  return NextResponse.json({ diagnosis })
}

