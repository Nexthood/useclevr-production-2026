import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { partnerAccounts, users } from "@/lib/db/schema";
import { assertPartnerAccess, partnerApiError, validWriteOrigin } from "@/lib/partners/api";
import { audit, database, id, partnerSummary } from "@/lib/partners/store";
import { applicationSchema, partnerPrivacyVersion } from "@/lib/partners/application";
import { getAccountReferralCode } from "@/lib/referrals/owner-code";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { PartnerRuleError } from "@/lib/partners/errors";
import { buildReferralLink } from "@/lib/referrals/referral-store";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  try {
    const partner = await database().query.partnerAccounts.findFirst({
      where: eq(partnerAccounts.userId, auth.userId),
    });
    if (!partner)
      return NextResponse.json(
        {
          error: "No partner application is registered for this account.",
        },
        { status: 404 },
      );
    assertPartnerAccess(auth.userId, partner.userId);
    if (["pending", "rejected"].includes(partner.status))
      return NextResponse.json(
        {
          application: {
            status: partner.status,
            name: partner.name,
            createdAt: partner.createdAt.toISOString(),
          },
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const offset = Math.max(
      0,
      Math.min(100000, Number(new URL(request.url).searchParams.get("offset")) || 0),
    );
    return NextResponse.json(
      {
        ...(await partnerSummary(partner.id, false, offset)),
        referralLink:
          partner.status === "active"
            ? buildReferralLink(new URL(request.url).origin, partner.code)
            : undefined,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return partnerApiError(error);
  }
}

// Identity and email always come from the authenticated, verified database account.
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  if (!validWriteOrigin(request))
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!checkRateLimit(`partner-application:${auth.userId}`, 5, 3600000))
    return NextResponse.json(
      { error: "Too many attempts. Try again in one hour." },
      {
        status: 429,
        headers: { "Retry-After": "3600" },
      },
    );
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "Send application/json." }, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > 24000)
    return NextResponse.json({ error: "Application is too large." }, { status: 413 });
  // Bound streamed bodies before parsing applicant text.
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Application required." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 24000) {
      await reader.cancel();
      return NextResponse.json({ error: "Application is too large." }, { status: 413 });
    }
    chunks.push(value);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
  } catch {
    return NextResponse.json({ error: "Invalid application JSON." }, { status: 400 });
  }
  const parsed = applicationSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Enter your name, two-letter country code, target market and experience, and accept the privacy notice and program terms.",
      },
      { status: 400 },
    );
  try {
    const db = database();
    const user = await db.query.users.findFirst({ where: eq(users.id, auth.userId) });
    if (!user?.emailVerified || !user.email)
      return NextResponse.json(
        { error: "Verify your account email before applying." },
        { status: 403 },
      );
    const code = await getAccountReferralCode(user.id, user.email);
    const application = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`referral-owner:${auth.userId}`},0))`,
      );
      const existing = await tx.query.partnerAccounts.findFirst({
        where: eq(partnerAccounts.userId, auth.userId),
      });
      if (existing)
        throw new PartnerRuleError(
          "An application already exists for this account. Check your application status.",
        );
      const partnerId = id();
      const acceptedAt = new Date().toISOString();
      const { name, country, market, experience } = parsed.data;
      const [row] = await tx
        .insert(partnerAccounts)
        .values({
          id: partnerId,
          userId: user.id,
          code,
          name,
          country,
          market,
          agreement: `Application terms ${partnerPrivacyVersion}; administrator agreement review required`,
          application: {
            email: user.email!,
            experience,
            privacyVersion: partnerPrivacyVersion,
            acceptedAt,
          },
        })
        .returning();
      await audit(
        tx,
        partnerId,
        user.id,
        "application_submitted",
        "Applicant submitted verified account application",
        {
          name,
          country,
          market,
          experience,
          email: user.email,
          privacyVersion: partnerPrivacyVersion,
          privacyAccepted: true,
          termsAccepted: true,
          acceptedAt,
        },
      );
      return { status: row.status, name: row.name, createdAt: row.createdAt.toISOString() };
    });
    return NextResponse.json(
      { application },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return partnerApiError(error);
  }
}
