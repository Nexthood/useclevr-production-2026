import { NextResponse } from "next/server";
import { PassportError } from "./agent-passport-service";
import { debugError } from "@/lib/utils/debug";

export function passportApiError(error: unknown) {
  if (error instanceof PassportError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: "Provide a valid JSON object." }, { status: 400 });
  debugError("[AGENT_PASSPORT] Request failed", error);
  return NextResponse.json(
    { error: "Agent passports are temporarily unavailable." },
    { status: 503 },
  );
}

function configuredPassportOrigin() {
  const configured =
    process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localHttp =
      url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== "https:" && !localHttp)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

// TLS-terminating proxies can give Request.url an internal HTTP origin. Only a
// browser same-origin request from the server-configured app origin may use that
// fallback; forwarded headers never establish a trusted origin.
export function rejectCrossOriginPassportWrite(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const configuredSameOrigin = fetchSite === "same-origin" && origin === configuredPassportOrigin();
  if (
    (origin && origin !== new URL(request.url).origin && !configuredSameOrigin) ||
    fetchSite === "cross-site"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
