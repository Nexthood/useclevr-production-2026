import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  partnerApplicationAudit,
  partnerApplicationEmails,
  partnerApplications,
  partnerAudit,
} from "@/lib/db/schema";
import type { partnerRegistrationDeletionReasons } from "./application";
import type { PartnerTx } from "./store";

type Registration = typeof partnerApplications.$inferSelect;
type DeletionReason = keyof typeof partnerRegistrationDeletionReasons;

export function canRequestRegistrationDeletion(application: Registration) {
  return (
    ["pending", "rejected"].includes(application.status) &&
    !application.partnerAccountId &&
    !application.linkedUserId &&
    !application.onboardedAt &&
    !application.invitationHash &&
    !application.invitationExpiresAt &&
    !application.invitationUsedAt
  );
}

export async function deletePartnerRegistration(
  db: Database,
  applicationId: string,
  actor: string,
  reason: DeletionReason,
) {
  try {
    return await db.transaction(async (tx) => {
      // Serialize competing deletes and reviews. Foreign keys also block new dependents
      // while the registration is locked.
      const [application] = await tx
        .select()
        .from(partnerApplications)
        .where(eq(partnerApplications.id, applicationId))
        .for("update");
      if (!application) return "missing";
      if (!canRequestRegistrationDeletion(application)) return "protected";
      await removeEligibleApplication(tx, applicationId, actor, reason);
      return "deleted";
    });
  } catch (error) {
    const pg = error as { code?: string; cause?: { code?: string } } | undefined;
    if ((pg?.code || pg?.cause?.code) === "23503") return "protected";
    throw error;
  }
}

// Callers lock the application and check its eligibility inside the same transaction.
export async function removeEligibleApplication(
  tx: PartnerTx,
  applicationId: string,
  actor: string,
  reason: DeletionReason,
) {
  await tx.insert(partnerAudit).values({
    id: `application-deletion:${applicationId}`,
    actor,
    action: "application_registration_deleted",
    reason,
    data: { applicationId },
  });
  await tx.delete(partnerApplicationEmails).where(
    and(
      eq(partnerApplicationEmails.applicationId, applicationId),
      inArray(partnerApplicationEmails.kind, ["receipt", "admin_notice", "rejected"]),
    ),
  );
  await tx
    .delete(partnerApplicationAudit)
    .where(eq(partnerApplicationAudit.applicationId, applicationId));
  // Other dependencies keep their restrictive foreign keys and roll back the deletion.
  await tx.delete(partnerApplications).where(eq(partnerApplications.id, applicationId));
}
