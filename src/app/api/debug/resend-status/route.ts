import { timingSafeEqual } from "node:crypto";

import { checkResendStatus } from "@/lib/auth/verification-email";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorized = authorizeResendDebug(request);
  if (!authorized.success) return unauthorizedResponse();

  const status = await checkResendStatus({ sendTest: false });
  return NextResponse.json(stripServerOnlyErrorFields(status), {
    status: status.status === "configured" || status.status === "sent" ? 200 : 503,
  });
}

export async function POST(request: NextRequest) {
  const authorized = authorizeResendDebug(request);
  if (!authorized.success) return unauthorizedResponse();

  const status = await checkResendStatus({ sendTest: true });
  return NextResponse.json(stripServerOnlyErrorFields(status), {
    status: status.sent ? 200 : 503,
  });
}

function authorizeResendDebug(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return { success: true };

  const expected = process.env.RESEND_STATUS_TOKEN || process.env.ADMIN_AUTH_BYPASS_CODE || "";
  if (!expected) return { success: false };

  const supplied = request.headers.get("x-resend-debug-token") || "";
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

function stripServerOnlyErrorFields<T extends { error?: { stack?: string }; domain?: { error?: { stack?: string } } }>(
  status: T,
) {
  const safeStatus = { ...status };

  if (safeStatus.error) {
    const { stack: _stack, ...safeError } = safeStatus.error;
    safeStatus.error = safeError;
  }

  if (safeStatus.domain?.error) {
    const { stack: _stack, ...safeError } = safeStatus.domain.error;
    safeStatus.domain = {
      ...safeStatus.domain,
      error: safeError,
    };
  }

  return safeStatus;
}
