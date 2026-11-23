import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { partnerAccounts, partnerApplications, partnerAudit } from "@/lib/db/schema";
import type { partnerRegistrationDeletionReasons } from "./application";
import { removeEligibleApplication } from "./application-deletion";
import { lockPartner, type PartnerTx } from "./store";

const blockers: Record<string, string> = {
  status:
    "Only never-approved Pending or Rejected accounts can be deleted. This account has a protected status, approval history, or a payout hold.",
  review_evidence: "This account has commercial review evidence or notes that must be retained.",
  agreement:
    "This account has an agreement on record. Its contract and signature history must be retained.",
  financial_history:
    "This account has referrals, financial transactions, commissions, or payout records that must be retained.",
  linked_application:
    "This account has a protected application, invitation, onboarding record, or legal record.",
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
  applicationIds: string[];
};

async function accountDeletionRecord(db: Database | PartnerTx, partnerId: string) {
  const result = await db.execute<AccountDeletionRecord>(sql`
    SELECT p.id, p.name, u.email, p.status,
      partner_account_deletion_blocker(p.id) AS blocker,
      ARRAY(SELECT a.id FROM "PartnerProgramApplication" a
        WHERE a."partnerAccountId" = p.id ORDER BY a.id) AS "applicationIds"
    FROM "PartnerAccount" p LEFT JOIN "User" u ON u.id = p."userId"
    WHERE p.id = ${partnerId}
  `);
  return result.rows[0];
}

function deletionScope(record: AccountDeletionRecord) {
  return createHash("sha256")
    .update(
      JSON.stringify([record.id, record.name, record.email, record.status, record.applicationIds]),
    )
    .digest("hex");
}

export async function previewPartnerAccountDeletion(db: Database, partnerId: string) {
  const record = await accountDeletionRecord(db, partnerId);
  if (!record) return null;
  const { blocker, applicationIds, ...details } = record;
  return {
    ...details,
    permitted: blocker === null,
    explanation: blocker === null ? null : blockers[blocker] || protectedAccount,
    applicationCount: applicationIds.length,
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
  try {
    return await db.transaction(async (tx) => {
      await lockPartner(tx, partnerId);
      const [account] = await tx
        .select({ id: partnerAccounts.id })
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
      const record = await accountDeletionRecord(tx, partnerId);
      if (record.blocker !== null)
        return {
          status: "protected",
          error: blockers[record.blocker] || protectedAccount,
        } as const;
      if (scope !== deletionScope(record))
        return {
          status: "protected",
          error:
            "The account or its linked applications changed. Close this dialog and review Delete again.",
        } as const;

      await tx.insert(partnerAudit).values({
        id: `account-deletion:${partnerId}`,
        actor,
        action: "partner_account_deleted",
        reason,
        data: { partnerId },
      });
      for (const application of applications) {
        // The blocker validates ownership and pending/rejected status before disassociating.
        await tx
          .update(partnerApplications)
          .set({ partnerAccountId: null, linkedUserId: null })
          .where(eq(partnerApplications.id, application.id));
        await removeEligibleApplication(tx, application.id, actor, reason);
      }
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
