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

// Cookie-authenticated mutations must originate from the same application.
export function rejectCrossOriginPassportWrite(request: Request) {
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
