import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { getDb } from "@/lib/db";
import { partnerApplicationAudit, partnerApplications, partnerAccounts, users } from "@/lib/db/schema";
import { hashInvitation } from "@/lib/partners/public-applications";
import { validWriteOrigin } from "@/lib/partners/api";
import { getAccountReferralCode } from "@/lib/referrals/owner-code";

export async function POST(request: Request) {
  const auth = await requireSession(); if (!auth.success) return auth.error;
  if (!validWriteOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== "string" || body.token.length < 32 || body.token.length > 100 || body.accepted !== true) return NextResponse.json({ error: "Invalid onboarding request." }, { status: 400 });
  const db = getDb(); if (!db) return NextResponse.json({ error: "Onboarding is temporarily unavailable." }, { status: 503 });
  const user = await db.query.users.findFirst({ where: eq(users.id, auth.userId) });
  const verifiedEmail = user?.email;
  if (!user?.emailVerified || !verifiedEmail) return NextResponse.json({ error: "Verify your UseClevr account email before continuing." }, { status: 403 });
  const app = await db.query.partnerApplications.findFirst({ where: and(eq(partnerApplications.invitationHash, hashInvitation(body.token)), eq(partnerApplications.status, "approved"), isNull(partnerApplications.invitationUsedAt)) });
  if (!app || !app.invitationExpiresAt || app.invitationExpiresAt < new Date() || app.email.toLowerCase() !== verifiedEmail.toLowerCase()) return NextResponse.json({ error: "This invitation is invalid, expired, or belongs to a different verified email." }, { status: 403 });
  const code = await getAccountReferralCode(user.id, verifiedEmail);
  try {
    await db.transaction(async (tx) => {
      await tx.execute((await import("drizzle-orm")).sql`select pg_advisory_xact_lock(hashtextextended(${`partner-application:${app.id}`},0))`);
      const locked = await tx.query.partnerApplications.findFirst({ where: and(eq(partnerApplications.id, app.id), eq(partnerApplications.status, "approved"), isNull(partnerApplications.invitationUsedAt)) });
      if (!locked || !locked.invitationExpiresAt || locked.invitationExpiresAt < new Date() || locked.email.toLowerCase() !== verifiedEmail.toLowerCase()) throw new Error("invitation_unavailable");
      const existing = await tx.query.partnerAccounts.findFirst({ where: eq(partnerAccounts.userId, user.id) });
      let partnerId = existing?.id;
      if (!existing) {
        partnerId = randomUUID();
        await tx.insert(partnerAccounts).values({
          id: partnerId, userId: user.id, code, name: user.name || app.fullName, country: app.country,
          market: null, status: "pending", agreement: "Partner onboarding completed; commercial agreement pending administrator review.",
          application: { partnershipType: app.category as import("@/lib/partners/application").BusinessApplication["partnershipType"], companyName: app.companyName || "", businessEmail: app.email, email: app.email, experience: app.experience, privacyVersion: "2026-11-08", acceptedAt: app.privacyAcceptedAt.toISOString() },
        });
      }
      await tx.update(partnerApplications).set({ linkedUserId: user.id, partnerAccountId: partnerId!, onboardedAt: new Date(), invitationUsedAt: new Date(), invitationHash: null, updatedAt: new Date() }).where(eq(partnerApplications.id, app.id));
      await tx.insert(partnerApplicationAudit).values({ id: randomUUID(), applicationId: app.id, actor: user.id, action: "onboarding_completed" });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invitation_unavailable") return NextResponse.json({ error: "This invitation has already been used or expired." }, { status: 409 });
    console.error("[partner-onboarding] completion failed", { type: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Onboarding could not be completed. Please contact the partner team." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, status: "approved", note: "Onboarding is complete. Partner activation requires separate administrator authorization." }, { headers: { "Cache-Control": "no-store" } });
}
