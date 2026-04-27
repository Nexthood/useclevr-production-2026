// app/api/debug/request-headers/route.ts
import { NextResponse } from 'next/server';

// ============================================================================
// DEBUG ENDPOINT - Incoming Request Header Inspection
//
// Purpose: Diagnose why Railway's reverse proxy may be triggering Next.js to
// return an RSC/Flight fragment instead of a full HTML document. Next.js
// returns partial responses when it sees headers like `RSC: 1`,
// `Next-Router-State-Tree`, or `Next-Router-Prefetch` — which a misconfigured
// proxy could be forwarding on every request, including the initial page load.
//
// Usage:
//   curl -s https://<your-railway-domain>/api/debug/request-headers | jq
//
// Returns: JSON object with all request headers, plus a focused section
// highlighting the RSC/proxy-related headers most likely to cause the issue.
// All headers are also printed to stdout so they appear in Railway logs.
// ============================================================================

// Headers known to trigger Next.js RSC / Flight responses or indicate
// proxy behaviour — checked explicitly so they stand out in the output.
const RSC_HEADERS = [
  'rsc',
  'next-router-state-tree',
  'next-router-prefetch',
  'next-url',
  'next-router-segment-prefetch',
];

const PROXY_HEADERS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'user-agent',
  'host',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
  'x-real-ip',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cdn-loop',
  'via',
  'forwarded',
];

export async function GET(request: Request) {
  // Collect every header into a plain object (Headers is not serialisable).
  const allHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    allHeaders[key] = value;
  });

  // Pull out the headers most relevant to the RSC / Flight diagnosis.
  const rscHeaders: Record<string, string | null> = {};
  for (const name of RSC_HEADERS) {
    rscHeaders[name] = request.headers.get(name);
  }

  const proxyHeaders: Record<string, string | null> = {};
  for (const name of PROXY_HEADERS) {
    proxyHeaders[name] = request.headers.get(name);
  }

  // Determine whether any RSC trigger headers are present.
  const rscTriggersPresent = RSC_HEADERS.filter(
    (name) => request.headers.get(name) !== null
  );

  const diagnosis = {
    rscResponseLikely: rscTriggersPresent.length > 0,
    rscTriggersPresent,
    explanation:
      rscTriggersPresent.length > 0
        ? `Next.js will return an RSC/Flight fragment instead of full HTML because the following headers are present: ${rscTriggersPresent.join(', ')}. If these are being injected by Railway's reverse proxy on every request, that is the root cause.`
        : 'No RSC trigger headers detected on this request. The issue may be intermittent, path-specific, or caused by a different mechanism.',
  };

  const payload = {
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    diagnosis,
    rscHeaders,
    proxyHeaders,
    allHeaders,
  };

  // Print to stdout so the data appears in Railway deployment logs.
  console.log('[DEBUG][request-headers] Incoming request headers:', JSON.stringify(payload, null, 2));

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      // Prevent this diagnostic response from being cached anywhere.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
