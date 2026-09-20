import { auth } from "@/lib/auth/auth";
import { listUserBusinesses } from "@/lib/business/business-store";
import {
  buildConfirmedUsyContactPayload,
  checkUsyContactRateLimit,
  createUsyContactSubmissionGuard,
  fingerprintUsyContactSubmission,
  getUsyContactWebhookConfig,
  sendUsyContactWebhook,
  validateUsyContactPayload,
} from "@/lib/usy/contact";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Duplicate confirmations of the same confirmed request stay credit-neutral:
// the first successful handoff marks the fingerprint delivered so an immediate
// re-confirmation returns the success confirmation without a second webhook.
const submissionGuard = createUsyContactSubmissionGuard();

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  const session = await auth();
  const rateLimitKey = session?.user?.id ? `user:${session.user.id}` : `ip:${ip}`;

  if (!checkUsyContactRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { error: "Too many contact requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const parsed = validateUsyContactPayload(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid contact request." }, { status: 400 });
  }

  const config = getUsyContactWebhookConfig();
  if (config.missing) {
    return NextResponse.json(
      { error: "I cannot submit the request right now because the contact handoff is not configured." },
      { status: 503 },
    );
  }

  const userId = session?.user?.id ?? null;
  const organizationId = userId ? await getAuthorizedOrganizationId(userId) : null;
  const payload = buildConfirmedUsyContactPayload(parsed.data, { userId, organizationId });

  const fingerprint = fingerprintUsyContactSubmission(rateLimitKey, payload);
  const beginState = submissionGuard.begin(fingerprint);
  if (beginState === "delivered") {
    return NextResponse.json(
      { ok: true, message: "Your contact request has already been submitted." },
      { status: 202 },
    );
  }
  if (beginState === "pending") {
    return NextResponse.json(
      { error: "Your contact request is already being submitted. Please wait a moment before trying again." },
      { status: 409, headers: { "Retry-After": "10" } },
    );
  }

  const result = await sendUsyContactWebhook(payload, {
    webhookUrl: config.webhookUrl!,
    webhookSecret: config.webhookSecret!,
  });

  if (!result.ok) {
    // Free the fingerprint so the user can retry the same confirmed request.
    submissionGuard.release(fingerprint);
    return NextResponse.json(
      { error: "The contact handoff could not be completed. Please try again shortly." },
      { status: 502 },
    );
  }

  submissionGuard.confirm(fingerprint);
  return NextResponse.json({ ok: true, message: "Your contact request has been submitted." }, { status: 202 });
}

async function getAuthorizedOrganizationId(userId: string) {
  try {
    const businesses = await listUserBusinesses(userId);
    const primary = businesses.find((business) => business.isPrimary) || businesses[0];
    return primary?.id && primary.id !== "profile-primary" ? primary.id : null;
  } catch {
    return null;
  }
}
