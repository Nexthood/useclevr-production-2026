import { NextResponse } from "next/server";
import { PartnerRuleError } from "./errors";

export function assertPartnerAccess(sessionUserId: string, ownerUserId: string) {
  if (!sessionUserId || sessionUserId !== ownerUserId) throw new Error("Forbidden");
}
export function validWriteOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || !origin) return false;
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL;
  const trusted = configured ? new URL(configured).origin : new URL(request.url).origin;
  return origin === new URL(request.url).origin || (site === "same-origin" && origin === trusted);
}
export function partnerApiError(error: unknown) {
  if (error instanceof PartnerRuleError)
    return NextResponse.json({ error: error.message }, { status: 409 });
  // Do not return SQL, connection strings, or provider errors to a client.
  console.error("[partners] request failed", {
    type: error instanceof Error ? error.name : "unknown",
  });
  return NextResponse.json(
    { error: "Partner information is temporarily unavailable. Retry or contact an administrator." },
    { status: 503 },
  );
}
