import { timingSafeEqual } from "node:crypto";

import { checkSmtpStatus } from "@/lib/auth/verification-email";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorized = authorizeSmtpDebug(request);
  if (!authorized.success) return unauthorizedResponse();

  const status = await checkSmtpStatus({ sendTest: false });
  return NextResponse.json(stripServerOnlyErrorFields(status), {
    status: status.connected ? 200 : 503,
  });
}

export async function POST(request: NextRequest) {
  const authorized = authorizeSmtpDebug(request);
  if (!authorized.success) return unauthorizedResponse();

  const status = await checkSmtpStatus({ sendTest: true });
  return NextResponse.json(stripServerOnlyErrorFields(status), {
    status: status.connected && status.senderAccepted ? 200 : 503,
  });
}

function authorizeSmtpDebug(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return { success: true };

  const expected = process.env.SMTP_STATUS_TOKEN || process.env.ADMIN_AUTH_BYPASS_CODE || "";
  if (!expected) return { success: false };

  const supplied = request.headers.get("x-smtp-debug-token") || "";
  return { success: safeEquals(supplied, expected) };
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function safeEquals(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (inputBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(inputBuffer, expectedBuffer);
}

function stripServerOnlyErrorFields<T extends { error?: { stack?: string } }>(status: T) {
  if (!status.error) return status;
  const { stack: _stack, ...safeError } = status.error;
  return { ...status, error: safeError };
}
