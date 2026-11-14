import type { BusinessApplication } from "@/lib/partners/application";
import { featureEnabled } from "@/lib/partners/contracts/domain";
import { enqueuePreparation } from "@/lib/partners/contracts/records";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { getDb } from "@/lib/db";
import {
  partnerApplicationAudit,
  partnerApplications,
  partnerAccounts,
  users,
} from "@/lib/db/schema";
import { hashInvitation } from "@/lib/partners/public-applications";
import { validWriteOrigin } from "@/lib/partners/api";
import { getAccountReferralCode } from "@/lib/referrals/owner-code";

import {
  invitationFailure,
  onboardingFailures,
  OnboardingInvitationError,
  type OnboardingFailureCode,
} from "@/lib/partners/onboarding";

function failure(code: OnboardingFailureCode) {
  const { status, error } = onboardingFailures[code];
  return NextResponse.json({ code, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.success) return failure("authentication_required");
  if (!validWriteOrigin(request))
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.token !== "string" ||
    body.token.length < 32 ||
    body.token.length > 100 ||
    body.accepted !== true
  )
    return NextResponse.json({ error: "Invalid onboarding request." }, { status: 400 });
  const db = getDb();
  if (!db) return failure("onboarding_unavailable");
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, auth.userId) });
    const verifiedEmail = user?.email;
    if (!user?.emailVerified || !verifiedEmail) return failure("email_verification_required");
    const tokenHash = hashInvitation(body.token);
    const app = await db.query.partnerApplications.findFirst({
      where: eq(partnerApplications.invitationHash, tokenHash),
    });
    const invalid = invitationFailure(app, tokenHash, verifiedEmail);
    if (invalid) return failure(invalid);
    // A successful validation always has a persisted invitation.
    if (!app) return failure("invalid_invitation");
    const code = await getAccountReferralCode(user.id, verifiedEmail);
    await db.transaction(async (tx) => {
      await tx.execute(
        (await import("drizzle-orm"))
          .sql`select pg_advisory_xact_lock(hashtextextended(${`partner-application:${app.id}`},0))`,
      );
      const locked = await tx.query.partnerApplications.findFirst({
        where: eq(partnerApplications.id, app.id),
      });
      const unavailable = invitationFailure(locked, tokenHash, verifiedEmail);
      if (unavailable) throw new OnboardingInvitationError(unavailable);
      const existing = await tx.query.partnerAccounts.findFirst({
        where: eq(partnerAccounts.userId, user.id),
      });
      let partnerId = existing?.id;
      if (!existing) {
        partnerId = randomUUID();
        await tx.insert(partnerAccounts).values({
          id: partnerId,
          userId: user.id,
          code,
          name: user.name || app.fullName,
          country: app.country,
          market: null,
          status: "pending",
          agreement:
            "Partner onboarding completed; commercial agreement pending administrator review.",
          application: {
            partnershipType: app.category as BusinessApplication["partnershipType"],
            companyName: app.companyName || "",
            businessEmail: app.email,
            email: app.email,
            experience: app.experience,
            privacyVersion: "2026-11-08",
            acceptedAt: app.privacyAcceptedAt.toISOString(),
          },
        });
      }
      await tx
        .update(partnerApplications)
        .set({
          linkedUserId: user.id,
          partnerAccountId: partnerId!,
          onboardedAt: new Date(),
          invitationUsedAt: new Date(),
          // Retain only the one-way hash so a used invitation can be identified and rejected.
          invitationHash: tokenHash,
          updatedAt: new Date(),
        })
        .where(eq(partnerApplications.id, app.id));
      await tx.insert(partnerApplicationAudit).values({
        id: randomUUID(),
        applicationId: app.id,
        actor: user.id,
        action: "onboarding_completed",
      });
      if (featureEnabled()) await enqueuePreparation(tx, app.id);
    });
  } catch (error) {
    if (error instanceof OnboardingInvitationError) return failure(error.code);
    console.error("[partner-onboarding] completion failed", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return failure("onboarding_unavailable");
  }
  return NextResponse.json(
    {
      ok: true,
      status: "approved",
      note: "Onboarding is complete. Partner activation requires separate administrator authorization.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
