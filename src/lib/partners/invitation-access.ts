import { createHmac, randomInt, randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";
import {
  partnerApplications,
  partnerApplicationAudit,
  partnerApplicationEmails,
  partnerAccounts,
  partnerOnboardingChallenges,
  partnerOnboardingSessions,
  referralCodeOwners,
  referralStats,
  users,
} from "@/lib/db/schema";
import {
  createInvitation,
  hashInvitation,
  encryptEmailPayload,
  deliverApplicationEmail,
} from "./public-applications";
import { ContractError, safeEqual, featureEnabled } from "./contracts/domain";
import { enqueuePreparation } from "./contracts/records";
import type { ContractDb } from "./contracts/types";

export const partnerInvitationCookie = "useclevr-partner-invitation";
const dbRequired = () => {
  const db = getDb();
  if (!db) throw new ContractError("onboarding_unavailable", 503);
  return db;
};
function codeHash(tokenHash: string, code: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new ContractError("onboarding_unavailable", 503);
  return createHmac("sha256", secret).update(`${tokenHash}:${code}`).digest("hex");
}
async function invitation(tx: ContractDb, token: string, email: string) {
  const hash = hashInvitation(token);
  // Same lock as authenticated onboarding, so both entry points share single-use protection.
  const before = await tx.query.partnerApplications.findFirst({
    where: eq(partnerApplications.invitationHash, hash),
  });
  if (!before || before.email.toLowerCase() !== email.toLowerCase())
    throw new ContractError("invalid_invitation", 403);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`partner-application:${before.id}`},0))`,
  );
  const app = await tx.query.partnerApplications.findFirst({
    where: eq(partnerApplications.id, before.id),
  });
  if (!app || app.invitationHash !== hash || app.status !== "approved")
    throw new ContractError("invalid_invitation", 403);
  if (app.invitationUsedAt) throw new ContractError("used_invitation", 409);
  if (!app.invitationExpiresAt || app.invitationExpiresAt <= new Date())
    throw new ContractError("expired_invitation", 410);
  return app;
}
export async function requestInvitationCode(token: string, email: string) {
  const emailId = randomUUID();
  await dbRequired().transaction(async (tx) => {
    const app = await invitation(tx, token, email);
    const previous = await tx.query.partnerOnboardingChallenges.findFirst({
      where: eq(partnerOnboardingChallenges.applicationId, app.id),
    });
    if (previous && Date.now() - previous.sentAt.getTime() < 60000)
      throw new ContractError("verification_cooldown", 429);
    const code = String(randomInt(100000, 1000000));
    const challenge = {
      applicationId: app.id,
      invitationHash: app.invitationHash!,
      codeHash: codeHash(app.invitationHash!, code),
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0,
    };
    await tx
      .insert(partnerOnboardingChallenges)
      .values(challenge)
      .onConflictDoUpdate({ target: partnerOnboardingChallenges.applicationId, set: challenge });
    await tx.insert(partnerApplicationEmails).values({
      id: emailId,
      applicationId: app.id,
      kind: "verification",
      recipient: app.email,
      payload: encryptEmailPayload({ code }),
    });
    await tx.insert(partnerApplicationAudit).values({
      id: randomUUID(),
      applicationId: app.id,
      actor: "invited_applicant",
      action: "verification_requested",
    });
  });
  // A delivery failure leaves a retryable outbox entry. Never expose the code to the browser.
  try {
    await deliverApplicationEmail(emailId);
  } catch {
    /* persisted outbox supports retry */
  }
  return { sent: true };
}
export async function verifyInvitationCode(token: string, email: string, code: string) {
  const session = createInvitation();
  const outcome = await dbRequired().transaction(async (tx) => {
    const app = await invitation(tx, token, email);
    const c = await tx.query.partnerOnboardingChallenges.findFirst({
      where: eq(partnerOnboardingChallenges.applicationId, app.id),
    });
    if (
      !c ||
      c.invitationHash !== app.invitationHash ||
      c.expiresAt <= new Date() ||
      c.attempts >= 5
    )
      return { error: "verification_expired" } as const;
    // Commit failed attempts instead of rolling them back through an exception.
    await tx
      .update(partnerOnboardingChallenges)
      .set({ attempts: c.attempts + 1 })
      .where(eq(partnerOnboardingChallenges.applicationId, app.id));
    if (!safeEqual(codeHash(c.invitationHash, code), c.codeHash))
      return { error: "verification_incorrect" } as const;
    // Email-level lock prevents duplicate identities across invitations and existing customer accounts.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`partner-email:${app.email.toLowerCase()}`},0))`,
    );
    const matches = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email})=${app.email.toLowerCase()}`)
      .limit(2);
    if (matches.length > 1) throw new ContractError("identity_review_required", 409);
    let user = matches[0];
    if (!user) {
      [user] = await tx
        .insert(users)
        .values({
          id: `user_${randomUUID()}`,
          email: app.email.toLowerCase(),
          name: app.fullName,
          emailVerified: new Date(),
        })
        .returning();
    } else if (!user.emailVerified) {
      // Reserve this identity for partner-only access. Credential setup must not adopt an unverified password.
      [user] = await tx
        .update(users)
        .set({ emailVerified: new Date(), password: null })
        .where(eq(users.id, user.id))
        .returning();
    }
    if (app.linkedUserId && app.linkedUserId !== user.id)
      throw new ContractError("identity_review_required", 409);
    let partner = await tx.query.partnerAccounts.findFirst({
      where: eq(partnerAccounts.userId, user.id),
    });
    if (!partner) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`referral-owner:${user.id}`},0))`,
      );
      let owner = await tx.query.referralCodeOwners.findFirst({
        where: eq(referralCodeOwners.userId, user.id),
      });
      if (!owner) {
        const referralCode = `uc-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
        await tx
          .insert(referralStats)
          .values({ code: referralCode, ownerUserId: user.id, ownerEmail: app.email });
        [owner] = await tx
          .insert(referralCodeOwners)
          .values({ userId: user.id, code: referralCode })
          .returning();
      }
      [partner] = await tx
        .insert(partnerAccounts)
        .values({
          id: randomUUID(),
          userId: user.id,
          code: owner.code,
          name: app.fullName,
          country: app.country,
          status: "pending",
          agreement: "Commercial agreement and administrator activation required.",
          application: {
            email: app.email,
            companyName: app.companyName || "",
            companyWebsite: app.companyWebsite || "",
            experience: app.experience,
            acceptedAt: app.privacyAcceptedAt.toISOString(),
            privacyVersion: app.privacyVersion,
          },
        })
        .returning();
    }
    if (app.partnerAccountId && app.partnerAccountId !== partner.id)
      throw new ContractError("identity_review_required", 409);
    await tx
      .update(partnerApplications)
      .set({
        linkedUserId: user.id,
        partnerAccountId: partner.id,
        onboardedAt: app.onboardedAt || new Date(),
        invitationUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(partnerApplications.id, app.id));
    // Renewal revokes every older scoped session for this application.
    await tx
      .delete(partnerOnboardingSessions)
      .where(eq(partnerOnboardingSessions.applicationId, app.id));
    await tx.insert(partnerOnboardingSessions).values({
      tokenHash: session.hash,
      applicationId: app.id,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    await tx.insert(partnerApplicationAudit).values({
      id: randomUUID(),
      applicationId: app.id,
      actor: user.id,
      action: "invitation_email_verified",
    });
    if (featureEnabled()) await enqueuePreparation(tx, app.id);
    return { verified: true } as const;
  });
  if ("error" in outcome) throw new ContractError(outcome.error!, 400);
  return session.token;
}
export async function invitationSession(rawToken?: string) {
  const token = rawToken ?? (await cookies()).get(partnerInvitationCookie)?.value;
  if (!token || token.length > 100) return null;
  const db = dbRequired();
  const s = await db.query.partnerOnboardingSessions.findFirst({
    where: and(
      eq(partnerOnboardingSessions.tokenHash, hashInvitation(token)),
      gt(partnerOnboardingSessions.expiresAt, new Date()),
    ),
  });
  if (!s) return null;
  const app = await db.query.partnerApplications.findFirst({
    where: eq(partnerApplications.id, s.applicationId),
  });
  if (app?.linkedUserId !== s.userId || !["approved", "active"].includes(app.status)) return null;
  return s;
}
// This grants no customer session, admin role, dataset access or commercial activation.
export async function partnerAgreementIdentity(request?: Request) {
  const raw = request
    ? (request.headers.get("cookie") || "")
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${partnerInvitationCookie}=`))
        ?.slice(partnerInvitationCookie.length + 1) || ""
    : undefined;
  const invitation = await invitationSession(raw);
  if (invitation)
    return { userId: invitation.userId, applicationId: invitation.applicationId, admin: false };
  const session = await auth();
  return session?.user?.id
    ? {
        userId: session.user.id,
        applicationId: undefined,
        admin: session.user.role === "superadmin",
      }
    : null;
}
