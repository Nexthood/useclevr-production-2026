import { randomUUID } from "node:crypto";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  partnerApplications,
  partnerConfigs,
  partnerContractAudit,
  partnerContractJobs,
  partnerContractProfiles,
  partnerContractProviderApprovals,
  partnerContractSchedules,
  partnerContractTemplates,
  users,
} from "@/lib/db/schema";
import { templates, templateChecksum } from "./catalog";
import {
  ContractError,
  hashObject,
  identitySchema,
  requireOwner,
  runtimePolicy,
  scheduleSchema,
  selectAgreement,
  text,
  validateLiveRuntime,
  type ContractIdentity,
  type CommercialSchedule,
} from "./domain";
import type { ContractDb } from "./types";
export function contractDatabase() {
  const db = getDb();
  if (!db) throw new ContractError("contract_database_unavailable", 503);
  return db;
}
export async function contractAudit(
  db: ContractDb,
  actor: string,
  action: string,
  reason: string,
  options: { contractId?: string; applicationId?: string; evidence?: Record<string, unknown> } = {},
) {
  await db.insert(partnerContractAudit).values({
    id: randomUUID(),
    actor,
    action,
    reason,
    contractId: options.contractId || null,
    applicationId: options.applicationId || null,
    evidence: options.evidence || {},
  });
}
export async function applicationLock(db: ContractDb, id: string) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`contract-application:${id}`},0))`,
  );
}
export async function policyLock(db: ContractDb, exclusive = false) {
  await db.execute(
    exclusive
      ? sql`select pg_advisory_xact_lock(hashtextextended('partner-contract-policy',0))`
      : sql`select pg_advisory_xact_lock_shared(hashtextextended('partner-contract-policy',0))`,
  );
}
export async function currentFinancialConfig(db: ContractDb) {
  return db.query.partnerConfigs.findFirst({
    where: lte(partnerConfigs.effectiveAt, new Date()),
    orderBy: [
      desc(partnerConfigs.effectiveAt),
      desc(partnerConfigs.createdAt),
      desc(partnerConfigs.id),
    ],
  });
}
export async function registerCatalog(db: ContractDb) {
  for (const t of templates) {
    const checksum = templateChecksum(t);
    await db
      .insert(partnerContractTemplates)
      .values({
        id: t.id,
        agreementType: t.agreementType,
        version: t.version,
        title: t.title,
        body: t.body,
        checksum,
      })
      .onConflictDoNothing();
    const saved = await db.query.partnerContractTemplates.findFirst({
      where: eq(partnerContractTemplates.id, t.id),
    });
    if (!saved || saved.checksum !== checksum || saved.body !== t.body)
      throw new ContractError("template_version_collision");
  }
}
export async function enqueueJob(
  db: ContractDb,
  kind: "prepare" | "send" | "reconcile" | "remind" | "cancel",
  key: string,
  options: { applicationId?: string; contractId?: string } = {},
  force = false,
) {
  await db
    .insert(partnerContractJobs)
    .values({ id: randomUUID(), key, kind, ...options })
    .onConflictDoUpdate({
      target: partnerContractJobs.key,
      set: { status: "pending", nextAttemptAt: new Date(), lastErrorCode: null },
      setWhere: force
        ? sql`${partnerContractJobs.status} in ('done','failed','pending')`
        : sql`${partnerContractJobs.status}='done'`,
    });
}
export async function enqueuePreparation(db: ContractDb, applicationId: string) {
  await enqueueJob(db, "prepare", `prepare:${applicationId}`, { applicationId });
}
export async function enqueueReadyApplications(db: ContractDb) {
  const apps = await db.query.partnerApplications.findMany({
    where: and(
      eq(partnerApplications.status, "approved"),
      sql`${partnerApplications.onboardedAt} is not null`,
    ),
    limit: 1000,
  });
  for (const a of apps) await enqueuePreparation(db, a.id);
}
export async function submitContractIdentity(
  userId: string,
  applicationId: string,
  input: unknown,
) {
  const identity = identitySchema.parse(input);
  return contractDatabase().transaction(async (tx) => {
    await applicationLock(tx, applicationId);
    const a = await tx.query.partnerApplications.findFirst({
      where: eq(partnerApplications.id, applicationId),
    });
    const u = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    if (
      !a ||
      a.linkedUserId !== userId ||
      !a.onboardedAt ||
      !["approved", "active"].includes(a.status) ||
      !u?.emailVerified ||
      u.email?.toLowerCase() !== a.email.toLowerCase()
    )
      throw new ContractError("verified_onboarded_applicant_required", 403);
    const last = await tx.query.partnerContractProfiles.findFirst({
      where: eq(partnerContractProfiles.applicationId, applicationId),
      orderBy: desc(partnerContractProfiles.version),
    });
    const checksum = hashObject(identity);
    if (last?.checksum === checksum) return last;
    const [profile] = await tx
      .insert(partnerContractProfiles)
      .values({
        id: randomUUID(),
        applicationId,
        version: (last?.version || 0) + 1,
        identity,
        checksum,
        consentVersion: "electronic-records-2026-11-v1",
        consentAt: new Date(),
        submittedBy: userId,
      })
      .returning();
    await contractAudit(
      tx,
      userId,
      "identity_submitted",
      "Partner declares legal identity, signing authority and electronic record consent",
      { applicationId, evidence: { profileId: profile.id, checksum } },
    );
    await enqueuePreparation(tx, applicationId);
    return profile;
  });
}
export async function reviewContractIdentity(actor: string, profileId: string, evidence: string) {
  return contractDatabase().transaction(async (tx) => {
    const p = await tx.query.partnerContractProfiles.findFirst({
      where: eq(partnerContractProfiles.id, profileId),
    });
    if (!p) throw new ContractError("identity_not_found", 404);
    if (p.reviewedAt) return p;
    const [reviewed] = await tx
      .update(partnerContractProfiles)
      .set({
        reviewedBy: actor,
        reviewedAt: new Date(),
        reviewEvidence: text(10, 1000).parse(evidence),
      })
      .where(
        and(
          eq(partnerContractProfiles.id, profileId),
          sql`${partnerContractProfiles.reviewedAt} is null`,
        ),
      )
      .returning();
    if (!reviewed) throw new ContractError("identity_review_changed");
    await contractAudit(tx, actor, "identity_reviewed", evidence, {
      applicationId: p.applicationId,
      evidence: { profileId, checksum: p.checksum },
    });
    await enqueuePreparation(tx, p.applicationId);
    return reviewed;
  });
}
export async function createSchedule(actor: string, applicationId: string, input: unknown) {
  const schedule = scheduleSchema.parse(input);
  return contractDatabase().transaction(async (tx) => {
    await applicationLock(tx, applicationId);
    const a = await tx.query.partnerApplications.findFirst({
      where: eq(partnerApplications.id, applicationId),
    });
    if (!a || !["approved", "active"].includes(a.status))
      throw new ContractError("approved_application_required");
    if (
      a.email.toLowerCase() === schedule.companySigner.email.toLowerCase() ||
      a.linkedUserId === schedule.companySigner.reference
    )
      throw new ContractError("independent_company_countersigner_required");
    const inferred = selectAgreement(a.category);
    if (inferred && inferred !== schedule.agreementType)
      throw new ContractError("agreement_type_conflicts_with_application");
    const config = await tx.query.partnerConfigs.findFirst({
      where: eq(partnerConfigs.id, schedule.financialConfigId),
    });
    if (!config) throw new ContractError("financial_policy_not_found");
    const checksum = hashObject(schedule);
    const [row] = await tx
      .insert(partnerContractSchedules)
      .values({
        id: randomUUID(),
        applicationId,
        version: schedule.version,
        agreementType: schedule.agreementType,
        schedule,
        checksum,
        financialConfigHash: hashObject(config.config),
        createdBy: actor,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new ContractError("commercial_terms_version_exists");
    await contractAudit(
      tx,
      actor,
      "schedule_created",
      inferred
        ? "Versioned commercial terms prepared"
        : "Explicit agreement classification for a nonstandard partnership requires owner legal review",
      {
        applicationId,
        evidence: { scheduleId: row.id, checksum, agreementType: schedule.agreementType },
      },
    );
    await enqueuePreparation(tx, applicationId);
    return row;
  });
}
export function assertFinalTerms(value: unknown) {
  const content = JSON.stringify(value);
  if (/\b(?:TBD|TODO|TBC)\b|\{\{|\[(?:INSERT|TO BE|TBD|TBC)/i.test(content))
    throw new ContractError("unresolved_legal_or_commercial_terms");
}
export async function approveVersion(
  actor: string,
  kind: "template" | "schedule",
  id: string,
  checksum: string,
  legalReviewReference: string,
  confirmLegalReview: boolean,
) {
  requireOwner(actor);
  if (!confirmLegalReview)
    throw new ContractError("explicit_legal_review_confirmation_required", 400);
  text(5, 1000).parse(legalReviewReference);
  return contractDatabase().transaction(async (tx) => {
    await policyLock(tx, true);
    if (kind === "template") {
      await registerCatalog(tx);
      const row = await tx.query.partnerContractTemplates.findFirst({
        where: eq(partnerContractTemplates.id, id),
      });
      if (!row || row.checksum !== checksum)
        throw new ContractError("reviewed_template_checksum_mismatch");
      if (row.revokedAt) throw new ContractError("template_approval_revoked");
      if (!row.approvedAt) {
        await tx
          .update(partnerContractTemplates)
          .set({ approvedBy: actor, approvedAt: new Date(), legalReviewReference })
          .where(
            and(
              eq(partnerContractTemplates.id, id),
              sql`${partnerContractTemplates.approvedAt} is null`,
            ),
          );
        await contractAudit(tx, actor, "template_legally_approved", legalReviewReference, {
          evidence: { templateId: id, checksum },
        });
      }
      await enqueueReadyApplications(tx);
    } else {
      const row = await tx.query.partnerContractSchedules.findFirst({
        where: eq(partnerContractSchedules.id, id),
      });
      if (!row || row.checksum !== checksum)
        throw new ContractError("reviewed_schedule_checksum_mismatch");
      if (row.revokedAt) throw new ContractError("schedule_approval_revoked");
      assertFinalTerms(row.schedule);
      const config = await currentFinancialConfig(tx);
      if (
        !config ||
        config.id !== row.schedule.financialConfigId ||
        hashObject(config.config) !== row.financialConfigHash
      )
        throw new ContractError("commercial_schedule_requires_current_financial_review");
      if (!row.approvedAt) {
        await tx
          .update(partnerContractSchedules)
          .set({ approvedBy: actor, approvedAt: new Date(), legalReviewReference })
          .where(
            and(
              eq(partnerContractSchedules.id, id),
              sql`${partnerContractSchedules.approvedAt} is null`,
            ),
          );
        await contractAudit(tx, actor, "commercial_terms_legally_approved", legalReviewReference, {
          applicationId: row.applicationId,
          evidence: { scheduleId: id, checksum, financialConfigHash: row.financialConfigHash },
        });
      }
      await enqueuePreparation(tx, row.applicationId);
    }
    return { approved: true };
  });
}
export async function revokeVersion(
  actor: string,
  kind: "template" | "schedule",
  id: string,
  reason: string,
) {
  requireOwner(actor);
  text(10, 1000).parse(reason);
  return contractDatabase().transaction(async (tx) => {
    await policyLock(tx, true);
    if (kind === "template")
      await tx
        .update(partnerContractTemplates)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(partnerContractTemplates.id, id),
            sql`${partnerContractTemplates.revokedAt} is null`,
          ),
        );
    else
      await tx
        .update(partnerContractSchedules)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(partnerContractSchedules.id, id),
            sql`${partnerContractSchedules.revokedAt} is null`,
          ),
        );
    await contractAudit(tx, actor, "legal_approval_revoked", reason, { evidence: { kind, id } });
    return { revoked: true };
  });
}
export async function approveRuntime(
  actor: string,
  checksum: string,
  legalReviewReference: string,
  confirm: boolean,
  revoke = false,
) {
  requireOwner(actor);
  if (!confirm) throw new ContractError("explicit_provider_approval_required", 400);
  text(5, 1000).parse(legalReviewReference);
  if (!revoke) validateLiveRuntime();
  const fingerprint = hashObject(runtimePolicy());
  if (checksum !== fingerprint) throw new ContractError("provider_configuration_changed");
  return contractDatabase().transaction(async (tx) => {
    await policyLock(tx, true);
    await tx.insert(partnerContractProviderApprovals).values({
      id: randomUUID(),
      fingerprint,
      status: revoke ? "revoked" : "approved",
      approvedBy: actor,
      legalReviewReference,
    });
    await contractAudit(
      tx,
      actor,
      revoke ? "provider_approval_revoked" : "provider_configuration_approved",
      legalReviewReference,
      { evidence: { fingerprint } },
    );
    if (!revoke) await enqueueReadyApplications(tx);
    return { approved: !revoke, fingerprint };
  });
}
export async function hasRuntimeApproval(db: ContractDb) {
  const fingerprint = hashObject(runtimePolicy());
  const row = await db.query.partnerContractProviderApprovals.findFirst({
    where: eq(partnerContractProviderApprovals.fingerprint, fingerprint),
    orderBy: [
      desc(partnerContractProviderApprovals.createdAt),
      desc(partnerContractProviderApprovals.id),
    ],
  });
  return row?.status === "approved";
}
export type { ContractIdentity, CommercialSchedule };
