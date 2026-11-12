import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  partnerAccounts,
  partnerApplications,
  partnerContracts,
  partnerApplicationAudit,
} from "@/lib/db/schema";
import { ContractError, featureEnabled, type ContractMode, verifySignatures } from "./domain";
import { contractDatabase, contractAudit, applicationLock } from "./records";
import { liveGates, notify, type ContractRow } from "./lifecycle";
import { readArtifact } from "./storage";
import type { ContractDb } from "./types";
export async function executedAgreement(db: ContractDb, partnerId: string, applicationId?: string) {
  if (!featureEnabled())
    throw new ContractError("executed_agreement_required_before_new_commercial_activation");
  const c = await db.query.partnerContracts.findFirst({
    where: eq(partnerContracts.partnerId, partnerId),
    orderBy: [desc(partnerContracts.createdAt), desc(partnerContracts.revision)],
  });
  if (
    !c ||
    c.status !== "fully_executed" ||
    c.mode !== "dropbox_live" ||
    !c.executedAt ||
    !c.verifiedAt ||
    !c.partnerSignedAt ||
    !c.companySignedAt ||
    !c.providerReference ||
    !c.sourceArtifactId ||
    !c.documentChecksum ||
    !c.signedArtifactId ||
    !c.signedDocumentChecksum ||
    !c.auditArtifactId ||
    !c.auditEvidenceChecksum ||
    !c.providerSnapshot?.complete
  )
    throw new ContractError("fully_executed_production_agreement_required");
  await applicationLock(db, c.applicationId);
  const newest = await db.query.partnerContracts.findFirst({
    where: eq(partnerContracts.partnerId, partnerId),
    orderBy: [desc(partnerContracts.createdAt), desc(partnerContracts.revision)],
  });
  if (newest?.id !== c.id) throw new ContractError("agreement_version_changed");
  if (applicationId && applicationId !== c.applicationId)
    throw new ContractError("agreement_application_mismatch");
  const a = await db.query.partnerApplications.findFirst({
    where: eq(partnerApplications.id, c.applicationId),
  });
  const p = await db.query.partnerAccounts.findFirst({ where: eq(partnerAccounts.id, partnerId) });
  if (
    !a ||
    !p ||
    !a.onboardedAt ||
    !["approved", "active"].includes(a.status) ||
    a.partnerAccountId !== partnerId ||
    a.linkedUserId !== p.userId ||
    c.snapshot.userId !== p.userId ||
    c.snapshot.partnerEmail.toLowerCase() !== a.email.toLowerCase()
  )
    throw new ContractError("agreement_partner_identity_mismatch");
  await liveGates(db, c);
  verifySignatures(
    c.providerSnapshot,
    c.snapshot,
    c.id,
    c.documentChecksum,
    c.mode as ContractMode,
  );
  await readArtifact(db, c.sourceArtifactId, c.id, c.documentChecksum);
  await readArtifact(db, c.signedArtifactId, c.id, c.signedDocumentChecksum);
  await readArtifact(db, c.auditArtifactId, c.id, c.auditEvidenceChecksum);
  return c;
}
export const executedAgreementReference = (c: ContractRow) =>
  `Executed agreement ${c.id}; template ${c.templateVersion}; commercial schedule ${c.commercialTermsVersion}; signed SHA-256 ${c.signedDocumentChecksum}`;
export async function authorizeManualActivation(
  db: ContractDb,
  partnerId: string,
  actor: string,
  reason: string,
  applicationId?: string,
) {
  if (!featureEnabled())
    throw new ContractError("executed_agreement_required_before_new_commercial_activation");
  if (reason.trim().length < 10) throw new ContractError("activation_audit_reason_required", 400);
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`partner:${partnerId}`},0))`,
  );
  await db.execute(
    sql`select id from "PartnerContract" where "partnerId"=${partnerId} order by "createdAt" desc,"revision" desc limit 1 for update`,
  );
  const c = await executedAgreement(db, partnerId, applicationId);
  await db.execute(sql`select set_config('app.partner_contract_activation',${partnerId},true)`);
  await contractAudit(db, actor, "manual_activation_authorized", reason, {
    contractId: c.id,
    applicationId: c.applicationId,
    evidence: { signedChecksum: c.signedDocumentChecksum },
  });
  return c;
}
export async function recordManualActivation(
  db: ContractDb,
  c: ContractRow,
  actor: string,
  reason: string,
) {
  await contractAudit(db, actor, "partner_manually_activated", reason, {
    contractId: c.id,
    applicationId: c.applicationId,
    evidence: { partnerId: c.partnerId },
  });
  await db.insert(partnerApplicationAudit).values({
    id: randomUUID(),
    applicationId: c.applicationId,
    actor,
    action: "activated",
    reason,
  });
  await notify(db, c, "activation_confirmed", ["partner", "company"]);
}
export async function activateExecutedContract(
  contractId: string,
  actor: string,
  reason: string,
  confirmed: boolean,
) {
  if (!confirmed) throw new ContractError("explicit_activation_confirmation_required", 400);
  return contractDatabase().transaction(async (tx) => {
    const row = await tx.query.partnerContracts.findFirst({
      where: eq(partnerContracts.id, contractId),
    });
    if (!row) throw new ContractError("contract_not_found", 404);
    const before = await tx.query.partnerAccounts.findFirst({
      where: eq(partnerAccounts.id, row.partnerId),
    });
    if (before?.status === "active") return { active: true, alreadyActive: true };
    if (before?.status !== "pending")
      throw new ContractError("review_partner_suspension_or_termination_before_activation");
    const c = await authorizeManualActivation(tx, row.partnerId, actor, reason, row.applicationId);
    await tx
      .update(partnerAccounts)
      .set({
        status: "active",
        approvedAt: new Date(),
        agreement: executedAgreementReference(c),
        commercialReview: { status: "approved", evidence: executedAgreementReference(c) },
      })
      .where(and(eq(partnerAccounts.id, c.partnerId), eq(partnerAccounts.status, "pending")));
    await recordManualActivation(tx, c, actor, reason);
    return { active: true };
  });
}
