import { deliverApplicationEmail } from "./public-applications";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  users,
  partnerContracts,
  partnerOnboardingSessions,
  partnerApplicationAudit,
  partnerApplicationEmails,
} from "@/lib/db/schema";
import { invitationSession } from "./invitation-access";
import { validatePasswordPolicy } from "@/lib/auth/password-policy";
import { ContractError } from "./contracts/domain";
import { readArtifact } from "./contracts/storage";
export async function establishPartnerCredentials(rawToken: string, password: string) {
  const session = await invitationSession(rawToken),
    db = getDb();
  if (!session || !db) throw new ContractError("invitation_verification_required", 401);
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user?.emailVerified) throw new ContractError("email_verification_required", 403);
  const policy = validatePasswordPolicy(password, {
    email: user.email || "",
    name: user.name || "",
  });
  if (!policy.passed) return { error: policy.message, status: 400 } as const;
  if (password.length > 200)
    return { error: "Use a password of at most 200 characters.", status: 400 } as const;
  const hash = await bcrypt.hash(password, 12);
  const notificationId = crypto.randomUUID();
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select "tokenHash" from "PartnerOnboardingSession" where "tokenHash"=${session.tokenHash} for update`,
    );
    const current = await tx.query.partnerOnboardingSessions.findFirst({
      where: eq(partnerOnboardingSessions.tokenHash, session.tokenHash),
    });
    if (!current || current.expiresAt <= new Date() || current.credentialSetAt)
      throw new ContractError("partner_account_setup_complete", 409);
    const contracts = await tx.query.partnerContracts.findMany({
      where: eq(partnerContracts.applicationId, session.applicationId),
    });
    const c = contracts.sort((a, b) => b.revision - a.revision)[0];
    if (
      !c ||
      c.snapshot.userId !== user.id ||
      c.mode !== "dropbox_live" ||
      c.status !== "fully_executed" ||
      !c.verifiedAt ||
      !c.executedAt ||
      !c.providerSnapshot?.complete ||
      !c.partnerSignedAt ||
      !c.companySignedAt ||
      !c.signedArtifactId ||
      !c.signedDocumentChecksum ||
      !c.auditArtifactId ||
      !c.auditEvidenceChecksum
    )
      throw new ContractError("complete_verified_agreement_before_account_setup", 409);
    await readArtifact(tx, c.signedArtifactId, c.id, c.signedDocumentChecksum);
    await readArtifact(tx, c.auditArtifactId, c.id, c.auditEvidenceChecksum);
    const [saved] = await tx
      .update(users)
      .set({ password: hash })
      .where(
        sql`${users.id}=${user.id} and ${users.password} is null and not exists(select 1 from "Account" where "userId"=${user.id})`,
      )
      .returning();
    await tx
      .update(partnerOnboardingSessions)
      .set({ credentialSetAt: new Date() })
      .where(eq(partnerOnboardingSessions.tokenHash, session.tokenHash));
    await tx.insert(partnerApplicationAudit).values({
      id: crypto.randomUUID(),
      applicationId: session.applicationId,
      actor: user.id,
      action: saved ? "partner_credentials_established" : "existing_login_retained",
    });
    await tx
      .insert(partnerApplicationEmails)
      .values({
        id: notificationId,
        applicationId: session.applicationId,
        kind: "account_update",
        recipient: user.email,
      });
    return { ready: true, existingLogin: !saved, next: "/partner/login" } as const;
  });
  await Promise.allSettled([deliverApplicationEmail(notificationId)]);
  return result;
}
