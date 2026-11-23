import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  partnerAccounts,
  partnerApplicationEmails,
  partnerApplications,
  partnerAudit,
  partnerContractJobs,
  partnerOnboardingChallenges,
  partnerOnboardingSessions,
} from "@/lib/db/schema";
import type { partnerRegistrationDeletionReasons } from "./application";
import { applicationLock } from "./contracts/records";
import { lockPartner, type PartnerTx } from "./store";

const blockers: Record<string, string> = {
  activation:
    "This account has a commercial activation or approval on record. Use suspension or termination to retain its history.",
  termination: "This account has a termination record that must be retained.",
  payout_hold: "This account has a payout hold that must be retained.",
  status:
    "This account is suspended. Retain its record and manage its status from the partner details.",
  review_evidence: "This account has commercial review evidence or notes that must be retained.",
  signed_agreement:
    "This account has a signed agreement or signature evidence that must be retained.",
  agreement:
    "This account has a prepared agreement that must be retained. Review it in Contract Management.",
  payouts: "This account has payout history that must be retained.",
  commissions: "This account has commission records that must be retained.",
  payments: "This account has partner payment records that must be retained.",
  referrals: "This account has protected referral attributions that must be retained.",
  financial_review: "This account has a financial review record that must be retained.",
  different_identity:
    "A linked application belongs to another UseClevr identity. Review the association in Applications.",
  application_status:
    "A linked application is under review or active. Review its status in Applications.",
  application_approval:
    "A linked application has approval on record without a corresponding invitation. Review its history in Applications.",
  completed_credentials:
    "Credential setup or a completed login decision is on record for a linked application.",
  unverified_onboarding:
    "A linked application's onboarding history does not establish that only identity verification occurred. Review its audit history in Applications.",
  legal_identity:
    "A linked application has a legal identity and consent submission that must be retained.",
  commercial_schedule: "A linked application has a commercial schedule that must be retained.",
  legal_history:
    "A linked application has agreement or contract audit records that must be retained.",
  contract_job:
    "A linked application has a running or protected contract job. Review its status in Contract Management.",
  application_history:
    "A linked application has an audit or delivery record that requires review before deletion.",
  other_application:
    "A separate application is using this account or email. Review it in Applications before deleting this account.",
  audit_history: "This account has administrative history that must be retained with the account.",
};
const protectedAccount = "This account has protected records and cannot be deleted.";

type AccountDeletionRecord = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  blocker: string | null;
  applicationScope: string[];
};

async function accountDeletionRecord(db: Database | PartnerTx, partnerId: string) {
  const result = await db.execute<AccountDeletionRecord>(sql`
    SELECT p.id, p.name, u.email, p.status,
      partner_account_deletion_blocker(p.id) AS blocker,
      ARRAY(
        SELECT jsonb_build_array(a.id, a.status, a."linkedUserId", a."onboardedAt",
          a."invitationUsedAt", a."invitationExpiresAt")::text
        FROM "PartnerProgramApplication" a WHERE a."partnerAccountId" = p.id ORDER BY a.id
      ) AS "applicationScope"
    FROM "PartnerAccount" p LEFT JOIN "User" u ON u.id = p."userId"
    WHERE p.id = ${partnerId}
  `);
  return result.rows[0];
}

function deletionScope(record: AccountDeletionRecord) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        record.id,
        record.name,
        record.email,
        record.status,
        record.applicationScope,
      ]),
    )
    .digest("hex");
}

export async function previewPartnerAccountDeletion(db: Database, partnerId: string) {
  const record = await accountDeletionRecord(db, partnerId);
  if (!record) return null;
  const { blocker, applicationScope, ...details } = record;
  return {
    ...details,
    permitted: blocker === null,
    explanation: blocker === null ? null : blockers[blocker] || protectedAccount,
    applicationCount: applicationScope.length,
    scope: deletionScope(record),
  };
}

export async function deletePartnerAccount(
  db: Database,
  partnerId: string,
  actor: string,
  reason: keyof typeof partnerRegistrationDeletionReasons,
  scope: string,
) {
  const changed = {
    status: "protected",
    error:
      "The account or its linked applications changed. Close this dialog and review Delete again.",
  } as const;
  try {
    return await db.transaction(async (tx) => {
      await lockPartner(tx, partnerId);
      const candidates = await tx
        .select({ id: partnerApplications.id })
        .from(partnerApplications)
        .where(eq(partnerApplications.partnerAccountId, partnerId))
        .orderBy(partnerApplications.id);
      // Match the invitation and contract workflows before taking row locks.
      for (const { id } of candidates) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`partner-application:${id}`},0))`,
        );
        await applicationLock(tx, id);
      }
      const [account] = await tx
        .select({ userId: partnerAccounts.userId })
        .from(partnerAccounts)
        .where(eq(partnerAccounts.id, partnerId))
        .for("update");
      if (!account) return { status: "missing" } as const;

      const applications = await tx
        .select({ id: partnerApplications.id })
        .from(partnerApplications)
        .where(eq(partnerApplications.partnerAccountId, partnerId))
        .orderBy(partnerApplications.id)
        .for("update");
      if (
        applications.some(({ id }, index) => id !== candidates[index]?.id) ||
        applications.length !== candidates.length
      )
        return changed;
      const record = await accountDeletionRecord(tx, partnerId);
      if (record.blocker !== null)
        return {
          status: "protected",
          error: blockers[record.blocker] || protectedAccount,
        } as const;
      if (scope !== deletionScope(record)) return changed;

      await tx.insert(partnerAudit).values({
        id: `account-deletion:${partnerId}`,
        actor,
        action: "partner_account_deleted",
        reason,
        data: { partnerId },
      });
      for (const { id } of applications)
        await removeLinkedRegistration(tx, id, partnerId, account.userId, actor, reason);
      await tx.delete(partnerAccounts).where(eq(partnerAccounts.id, partnerId));
      return { status: "deleted" } as const;
    });
  } catch (error) {
    const pg = error as { code?: string; cause?: { code?: string } } | undefined;
    if ((pg?.code || pg?.cause?.code) === "23503")
      return { status: "protected", error: protectedAccount } as const;
    throw error;
  }
}

async function removeLinkedRegistration(
  tx: PartnerTx,
  applicationId: string,
  partnerId: string,
  userId: string,
  actor: string,
  reason: keyof typeof partnerRegistrationDeletionReasons,
) {
  await tx.insert(partnerAudit).values({
    id: `application-deletion:${applicationId}`,
    actor,
    action: "partner_account_application_deleted",
    reason,
    data: { applicationId, partnerId },
  });
  await tx
    .delete(partnerOnboardingChallenges)
    .where(eq(partnerOnboardingChallenges.applicationId, applicationId));
  await tx
    .delete(partnerOnboardingSessions)
    .where(
      and(
        eq(partnerOnboardingSessions.applicationId, applicationId),
        eq(partnerOnboardingSessions.userId, userId),
        isNull(partnerOnboardingSessions.credentialSetAt),
      ),
    );
  await tx
    .delete(partnerContractJobs)
    .where(
      and(
        eq(partnerContractJobs.applicationId, applicationId),
        eq(partnerContractJobs.kind, "prepare"),
        isNull(partnerContractJobs.contractId),
        inArray(partnerContractJobs.status, ["pending", "failed", "done"]),
      ),
    );
  await tx
    .delete(partnerApplicationEmails)
    .where(
      and(
        eq(partnerApplicationEmails.applicationId, applicationId),
        inArray(partnerApplicationEmails.kind, [
          "receipt",
          "admin_notice",
          "rejected",
          "approved",
          "verification",
        ]),
      ),
    );
  await tx.delete(partnerApplications).where(eq(partnerApplications.id, applicationId));
}
