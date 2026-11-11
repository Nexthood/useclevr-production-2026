import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  partnerApplications,
  partnerContractAudit,
  partnerContractDeliveries,
  partnerContractProfiles,
  partnerContractSchedules,
  partnerContracts,
  partnerContractTemplates,
  partnerContractWebhooks,
} from "@/lib/db/schema";
import {
  ContractError,
  hashObject,
  runtimePolicy,
  signingMode,
  terminalStates,
  validateLiveRuntime,
  verifySignatures,
  type ContractMode,
  type ContractSnapshot,
  type ProviderSnapshot,
  type Template,
} from "./domain";
import {
  contractAudit,
  contractDatabase,
  currentFinancialConfig,
  hasRuntimeApproval,
  applicationLock,
  enqueueJob,
  registerCatalog,
  policyLock,
} from "./records";
import { MockSignatureProvider, providerFor } from "./provider";
import { generateAgreementPdf } from "./pdf";
import { readArtifact, saveArtifact } from "./storage";
import type { ContractDb } from "./types";
export type ContractRow = typeof partnerContracts.$inferSelect;
async function contractLock(db: ContractDb, id: string) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`contract:${id}`},0))`);
}
export async function contractRow(db: ContractDb, id: string) {
  const c = await db.query.partnerContracts.findFirst({ where: eq(partnerContracts.id, id) });
  if (!c) throw new ContractError("contract_not_found", 404);
  return c;
}
export async function notify(
  db: ContractDb,
  c: ContractRow,
  kind: string,
  roles: ("partner" | "company")[],
) {
  if (c.mode === "draft") return;
  for (const role of roles)
    await db
      .insert(partnerContractDeliveries)
      .values({
        id: randomUUID(),
        contractId: c.id,
        kind,
        recipientRole: role,
        recipient: role === "partner" ? c.snapshot.partnerEmail : c.snapshot.companySigner.email,
      })
      .onConflictDoNothing();
}
export function contractProvider(db: ContractDb, c: ContractRow) {
  return providerFor(
    c.mode as ContractMode,
    () =>
      new MockSignatureProvider(
        async (id) => {
          const row = await db.query.partnerContracts.findFirst({
            where: eq(partnerContracts.id, id),
          });
          if (!row?.providerSnapshot || !row.sourceArtifactId || !row.documentChecksum) return null;
          return {
            snapshot: row.providerSnapshot,
            pdf: (await readArtifact(db, row.sourceArtifactId, row.id, row.documentChecksum)).bytes,
          };
        },
        async (id, s) => {
          await db
            .update(partnerContracts)
            .set({ providerSnapshot: s })
            .where(eq(partnerContracts.id, id));
        },
      ),
  );
}
export async function liveGates(
  db: ContractDb,
  c: Pick<ContractRow, "templateId" | "scheduleId" | "profileId" | "snapshot" | "mode">,
) {
  if (c.mode !== "dropbox_live") throw new ContractError("nonbinding_contract_cannot_activate");
  await policyLock(db);
  validateLiveRuntime();
  if (c.snapshot.runtimeHash !== hashObject(runtimePolicy()) || !(await hasRuntimeApproval(db)))
    throw new ContractError("provider_configuration_owner_approval_required");
  if (!runtimePolicy().companySignerReferences.includes(c.snapshot.companySigner.reference))
    throw new ContractError("company_signer_not_authorized");
  const [t, s, p, config] = await Promise.all([
    db.query.partnerContractTemplates.findFirst({
      where: eq(partnerContractTemplates.id, c.templateId),
    }),
    db.query.partnerContractSchedules.findFirst({
      where: eq(partnerContractSchedules.id, c.scheduleId),
    }),
    db.query.partnerContractProfiles.findFirst({
      where: eq(partnerContractProfiles.id, c.profileId),
    }),
    currentFinancialConfig(db),
  ]);
  if (
    !t?.approvedAt ||
    !t.approvedBy ||
    !t.legalReviewReference ||
    t.revokedAt ||
    t.checksum !== c.snapshot.templateHash
  )
    throw new ContractError("owner_legal_template_approval_required");
  if (
    !s?.approvedAt ||
    !s.approvedBy ||
    !s.legalReviewReference ||
    s.revokedAt ||
    s.checksum !== c.snapshot.scheduleHash
  )
    throw new ContractError("owner_commercial_schedule_approval_required");
  if (p) {
    const latestProfile = await db.query.partnerContractProfiles.findFirst({
      where: eq(partnerContractProfiles.applicationId, p.applicationId),
      orderBy: desc(partnerContractProfiles.version),
    });
    const latestSchedule = await db.query.partnerContractSchedules.findFirst({
      where: eq(partnerContractSchedules.applicationId, p.applicationId),
      orderBy: [desc(partnerContractSchedules.createdAt), desc(partnerContractSchedules.id)],
    });
    if (latestProfile?.id !== p.id || latestSchedule?.id !== s?.id)
      throw new ContractError("new_identity_or_terms_version_requires_agreement_review");
  }
  if (!p?.reviewedAt || !p.reviewedBy || p.checksum !== c.snapshot.profileHash)
    throw new ContractError("partner_legal_identity_review_required");
  if (
    !config ||
    config.id !== c.snapshot.financialConfigId ||
    hashObject(config.config) !== c.snapshot.financialConfigHash
  )
    throw new ContractError("executed_schedule_financial_policy_changed");
  if (c.snapshot.effectiveUntil && Date.parse(c.snapshot.effectiveUntil) <= Date.now())
    throw new ContractError("commercial_schedule_expired");
}
export async function prepareContract(applicationId: string) {
  return contractDatabase().transaction(async (tx) => {
    await applicationLock(tx, applicationId);
    await registerCatalog(tx);
    const app = await tx.query.partnerApplications.findFirst({
      where: eq(partnerApplications.id, applicationId),
    });
    if (
      !app ||
      !app.onboardedAt ||
      !app.partnerAccountId ||
      !app.linkedUserId ||
      !["approved", "active"].includes(app.status)
    )
      return { blocked: "approved_onboarded_application_required" };
    const profile = await tx.query.partnerContractProfiles.findFirst({
      where: eq(partnerContractProfiles.applicationId, applicationId),
      orderBy: desc(partnerContractProfiles.version),
    });
    const schedule = await tx.query.partnerContractSchedules.findFirst({
      where: eq(partnerContractSchedules.applicationId, applicationId),
      orderBy: [desc(partnerContractSchedules.createdAt), desc(partnerContractSchedules.id)],
    });
    if (!profile || !schedule)
      return { blocked: !profile ? "legal_identity_required" : "commercial_schedule_required" };
    const template = await tx.query.partnerContractTemplates.findFirst({
      where: eq(partnerContractTemplates.agreementType, schedule.agreementType),
      orderBy: [desc(partnerContractTemplates.createdAt), desc(partnerContractTemplates.id)],
    });
    if (!template) throw new ContractError("agreement_template_missing");
    const snapshot: ContractSnapshot = {
      applicationId,
      partnerId: app.partnerAccountId,
      userId: app.linkedUserId,
      partnerEmail: app.email,
      identity: profile.identity,
      company: schedule.schedule.company,
      companySigner: schedule.schedule.companySigner,
      terms: schedule.schedule.terms,
      financialConfigId: schedule.schedule.financialConfigId,
      financialConfigHash: schedule.financialConfigHash,
      effectiveUntil: schedule.schedule.effectiveUntil || null,
      templateHash: template.checksum,
      profileHash: profile.checksum,
      scheduleHash: schedule.checksum,
      runtimeHash: hashObject(runtimePolicy()),
      documentTitle: template.title,
    };
    let mode = signingMode();
    let blockingReason: string | null = null;
    if (mode === "dropbox_live")
      try {
        await liveGates(tx, {
          templateId: template.id,
          scheduleId: schedule.id,
          profileId: profile.id,
          snapshot,
          mode,
        });
      } catch (e) {
        mode = "draft";
        blockingReason = e instanceof ContractError ? e.code : "legal_approval_required";
      }
    const last = await tx.query.partnerContracts.findFirst({
      where: eq(partnerContracts.applicationId, applicationId),
      orderBy: desc(partnerContracts.revision),
    });
    if (
      last &&
      last.profileId === profile.id &&
      last.scheduleId === schedule.id &&
      last.templateId === template.id &&
      last.mode === mode &&
      last.snapshot.runtimeHash === snapshot.runtimeHash
    )
      return { contractId: last.id, blocked: blockingReason };
    if (last && !terminalStates.includes(last.status) && last.providerReference)
      throw new ContractError("cancel_previous_signature_request_before_new_version");
    const ttl = runtimePolicy().signatureTtlDays;
    if (!Number.isInteger(ttl) || ttl < 2 || ttl > 90)
      throw new ContractError("signature_expiry_configuration_invalid");
    const [c] = await tx
      .insert(partnerContracts)
      .values({
        id: randomUUID(),
        applicationId,
        partnerId: app.partnerAccountId,
        revision: (last?.revision || 0) + 1,
        agreementType: schedule.agreementType,
        templateId: template.id,
        templateVersion: template.version,
        profileId: profile.id,
        scheduleId: schedule.id,
        commercialTermsVersion: schedule.version,
        snapshot,
        mode,
        provider: mode === "draft" ? "preview" : mode === "mock" ? "mock" : "dropbox_sign",
        expiresAt: new Date(Date.now() + ttl * 86400000),
        lastErrorCode: blockingReason,
      })
      .returning();
    const pdf = generateAgreementPdf(template as Template, snapshot, c.id, mode !== "dropbox_live");
    const artifact = await saveArtifact(tx, c.id, "source", pdf);
    await tx
      .update(partnerContracts)
      .set({
        status: "generated",
        sourceArtifactId: artifact.id,
        documentChecksum: artifact.checksum,
        updatedAt: new Date(),
      })
      .where(eq(partnerContracts.id, c.id));
    await contractAudit(
      tx,
      "system",
      "contract_generated",
      mode === "draft"
        ? "Private non-binding draft; production signing is gated"
        : "Versioned personalized agreement generated",
      {
        contractId: c.id,
        applicationId,
        evidence: {
          templateId: template.id,
          templateHash: template.checksum,
          scheduleId: schedule.id,
          sourceChecksum: artifact.checksum,
          mode,
        },
      },
    );
    if (mode !== "draft")
      await enqueueJob(tx, "send", `send:${c.id}`, { contractId: c.id, applicationId });
    return { contractId: c.id, blocked: blockingReason };
  });
}
async function reserveLiveSend(db: ContractDb, c: ContractRow) {
  const month = new Date().toISOString().slice(0, 7);
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`contract-send-budget:${process.env.DROPBOX_SIGN_ACCOUNT_ID}:${month}`},0))`,
  );
  const result = await db.execute(
    sql`select count(*)::int as count from "PartnerContractAudit" where action='live_send_budget_reserved' and "createdAt">=date_trunc('month',now())`,
  );
  if (Number(result.rows[0]?.count || 0) >= runtimePolicy().monthlySendLimit)
    throw new ContractError("owner_monthly_signature_budget_exhausted");
  await contractAudit(
    db,
    "system",
    "live_send_budget_reserved",
    "Owner-approved application send cap reserved conservatively before external creation",
    { contractId: c.id, applicationId: c.applicationId, evidence: { month } },
  );
}
export async function sendContract(contractId: string) {
  const db = contractDatabase();
  let row: ContractRow | null = null;
  await db.transaction(async (tx) => {
    await contractLock(tx, contractId);
    const c = await contractRow(tx, contractId);
    if (terminalStates.includes(c.status) || c.providerReference) return;
    if (c.mode === "draft") throw new ContractError("draft_cannot_be_sent");
    if (c.mode === "dropbox_live") await liveGates(tx, c);
    if (["sending", "send_uncertain"].includes(c.status))
      throw new ContractError("provider_creation_requires_reconciliation");
    if (c.mode === "dropbox_live") await reserveLiveSend(tx, c);
    const rows = await tx
      .update(partnerContracts)
      .set({ status: "sending", lastErrorCode: null, updatedAt: new Date() })
      .where(eq(partnerContracts.id, c.id))
      .returning();
    row = rows[0];
  });
  if (!row) return;
  const c = row as ContractRow;
  try {
    if (!c.sourceArtifactId || !c.documentChecksum)
      throw new ContractError("source_document_missing");
    const pdf = await readArtifact(db, c.sourceArtifactId, c.id, c.documentChecksum);
    const state = await db.transaction(async (tx) => {
      if (c.mode === "dropbox_live") await liveGates(tx, c);
      return contractProvider(tx, c).send({
        contractId: c.id,
        sourceChecksum: c.documentChecksum!,
        pdf: pdf.bytes,
        snapshot: c.snapshot,
        expiresAt: c.expiresAt,
      });
    });
    verifySignatures(state, c.snapshot, c.id, c.documentChecksum, c.mode as ContractMode);
    await db.transaction(async (tx) => {
      await contractLock(tx, c.id);
      const fresh = await contractRow(tx, c.id);
      if (fresh.providerReference && fresh.providerReference !== state.reference)
        throw new ContractError("provider_reference_conflict");
      await tx
        .update(partnerContracts)
        .set({
          providerReference: state.reference,
          providerSnapshot: state,
          status: "sent",
          lastErrorCode: null,
          updatedAt: new Date(),
        })
        .where(eq(partnerContracts.id, c.id));
      await contractAudit(
        tx,
        "system",
        "signature_invitation_sent",
        "External provider accepts ordered partner then company signing request",
        {
          contractId: c.id,
          applicationId: c.applicationId,
          evidence: { providerReference: state.reference, mode: c.mode },
        },
      );
      await notify(tx, c, "agreement_ready", ["partner"]);
      await enqueueJob(tx, "reconcile", `reconcile:${c.id}`, {
        contractId: c.id,
        applicationId: c.applicationId,
      });
    });
  } catch (e) {
    await db
      .update(partnerContracts)
      .set({
        status: "send_uncertain",
        lastErrorCode: e instanceof ContractError ? e.code : "provider_creation_uncertain",
        updatedAt: new Date(),
      })
      .where(eq(partnerContracts.id, c.id));
    throw e;
  }
}
export async function reconcileContract(contractId: string) {
  const db = contractDatabase();
  let c = await contractRow(db, contractId);
  if (terminalStates.includes(c.status)) return;
  if (c.mode === "draft") return;
  const provider = contractProvider(db, c);
  if (!c.providerReference) {
    if (!["sending", "send_uncertain"].includes(c.status)) return;
    const found = await provider.find(c.id);
    if (!found) throw new ContractError("provider_creation_requires_owner_review");
    verifySignatures(found, c.snapshot, c.id, c.documentChecksum!, c.mode as ContractMode);
    await db.transaction(async (tx) => {
      await contractLock(tx, c.id);
      await tx
        .update(partnerContracts)
        .set({
          providerReference: found.reference,
          providerSnapshot: found,
          status: "sent",
          lastErrorCode: null,
          updatedAt: new Date(),
        })
        .where(eq(partnerContracts.id, c.id));
      await contractAudit(
        tx,
        "system",
        "provider_request_recovered",
        "Ambiguous creation reconciled by exact contract metadata",
        { contractId: c.id, evidence: { providerReference: found.reference } },
      );
    });
    c = await contractRow(db, c.id);
  }
  let state: ProviderSnapshot;
  try {
    state = await provider.get(c.providerReference!);
  } catch (e) {
    if (e instanceof ContractError && e.code === "provider_http_404") {
      const canceled = await db.query.partnerContractWebhooks.findFirst({
        where: and(
          eq(partnerContractWebhooks.providerReference, c.providerReference!),
          sql`${partnerContractWebhooks.eventType} in ('signature_request_canceled','signature_request_cancelled')`,
        ),
      });
      if (canceled) {
        await closeContract(
          c.id,
          "cancelled",
          "Authenticated provider cancellation callback and unavailable incomplete request",
        );
        return;
      }
    }
    throw e;
  }
  const signed = verifySignatures(
    state,
    c.snapshot,
    c.id,
    c.documentChecksum!,
    c.mode as ContractMode,
  );
  if (
    state.signers.some(
      (s) =>
        s.signedAt &&
        (Date.parse(s.signedAt) > c.expiresAt.getTime() ||
          Date.parse(s.signedAt) < c.createdAt.getTime() - 120000),
    )
  )
    throw new ContractError("signature_after_expiration");
  if (state.cancelled || state.expired || state.declined) {
    await closeContract(
      c.id,
      state.cancelled ? "cancelled" : state.expired ? "expired" : "rejected",
      "Authoritative external provider state",
    );
    return;
  }
  if (state.hasError) throw new ContractError("provider_signing_error");
  let signedPdf: Buffer | undefined;
  if (state.complete) {
    signedPdf = await provider.files(c.providerReference!);
  }
  await db.transaction(async (tx) => {
    await contractLock(tx, c.id);
    const fresh = await contractRow(tx, c.id);
    if (terminalStates.includes(fresh.status)) return;
    const partnerNew = !!signed.partner.signedAt && !fresh.partnerSignedAt,
      companyNew = !!signed.company.signedAt && !fresh.companySignedAt;
    if (
      (fresh.partnerSignedAt && !signed.partner.signedAt) ||
      (fresh.companySignedAt && !signed.company.signedAt)
    )
      throw new ContractError("provider_signature_regression");
    if (partnerNew) {
      await contractAudit(
        tx,
        "provider",
        "partner_signature_verified",
        "External provider confirms expected partner signer",
        {
          contractId: c.id,
          applicationId: c.applicationId,
          evidence: {
            signatureReference: signed.partner.providerSignatureId,
            signedAt: signed.partner.signedAt,
          },
        },
      );
      await notify(tx, c, "partner_signed", ["partner", "company"]);
      if (!signed.company.signedAt)
        await notify(tx, c, "company_countersignature_requested", ["company"]);
    }
    if (companyNew)
      await contractAudit(
        tx,
        "provider",
        "company_signature_verified",
        "External provider confirms authorized company countersignature",
        {
          contractId: c.id,
          applicationId: c.applicationId,
          evidence: {
            signatureReference: signed.company.providerSignatureId,
            signedAt: signed.company.signedAt,
          },
        },
      );
    const changes: Partial<typeof partnerContracts.$inferInsert> = {
      providerSnapshot: state,
      partnerSignedAt: signed.partner.signedAt ? new Date(signed.partner.signedAt) : null,
      companySignedAt: signed.company.signedAt ? new Date(signed.company.signedAt) : null,
      status: signed.partner.signedAt ? "awaiting_company_signature" : "awaiting_partner_signature",
      lastErrorCode: null,
      updatedAt: new Date(),
    };
    if (state.complete && signedPdf) {
      const artifact = await saveArtifact(tx, c.id, "signed", signedPdf);
      const evidence = await saveArtifact(
        tx,
        c.id,
        "audit",
        Buffer.from(
          JSON.stringify({
            schemaVersion: 1,
            simulation: c.mode !== "dropbox_live",
            provider: c.provider,
            providerReference: c.providerReference,
            sourceChecksum: c.documentChecksum!,
            signedChecksum: artifact.checksum,
            templateVersion: c.templateVersion,
            commercialTermsVersion: c.commercialTermsVersion,
            providerSnapshot: state,
            verification:
              "Authoritative provider read-back; expected signer identities and signing order verified; provider signed PDF includes its audit trail.",
          }),
        ),
      );
      Object.assign(changes, {
        status: "fully_executed",
        signedArtifactId: artifact.id,
        signedDocumentChecksum: artifact.checksum,
        auditArtifactId: evidence.id,
        auditEvidenceChecksum: evidence.checksum,
        verifiedAt: new Date(),
        executedAt: new Date(),
      });
      await contractAudit(
        tx,
        "system",
        "agreement_fully_executed",
        c.mode === "dropbox_live"
          ? "Both signatures verified and completed PDF plus provider evidence privately archived"
          : "Non-binding test simulation; commercial activation prohibited",
        {
          contractId: c.id,
          applicationId: c.applicationId,
          evidence: {
            signedChecksum: artifact.checksum,
            auditChecksum: evidence.checksum,
            mode: c.mode,
          },
        },
      );
      await notify(tx, c, "fully_executed", ["partner", "company"]);
    }
    await tx.update(partnerContracts).set(changes).where(eq(partnerContracts.id, c.id));
  });
}
export async function closeContract(
  id: string,
  status: "expired" | "cancelled" | "rejected",
  reason: string,
) {
  await contractDatabase().transaction(async (tx) => {
    await contractLock(tx, id);
    const c = await contractRow(tx, id);
    if (terminalStates.includes(c.status)) return;
    await tx
      .update(partnerContracts)
      .set({ status, updatedAt: new Date(), lastErrorCode: null })
      .where(eq(partnerContracts.id, id));
    await contractAudit(tx, "provider", `contract_${status}`, reason, {
      contractId: id,
      applicationId: c.applicationId,
    });
    await notify(tx, c, status, ["partner", "company"]);
  });
}
export async function cancelContract(id: string, actor: string, reason: string) {
  const db = contractDatabase(),
    c = await contractRow(db, id);
  if (c.status === "fully_executed")
    throw new ContractError("executed_agreement_requires_legal_amendment");
  if (terminalStates.includes(c.status)) return;
  if (!c.providerReference) {
    if (["sending", "send_uncertain"].includes(c.status))
      throw new ContractError("reconcile_uncertain_provider_request_before_cancellation");
    await closeContract(id, "cancelled", reason);
    return;
  }
  await contractAudit(db, actor, "cancellation_requested", reason, {
    contractId: id,
    applicationId: c.applicationId,
  });
  await contractProvider(db, c).cancel(c.providerReference);
  await enqueueJob(db, "reconcile", `reconcile:${id}`, { contractId: id });
}
export async function remindContract(id: string) {
  const db = contractDatabase(),
    c = await contractRow(db, id);
  if (!c.providerReference || terminalStates.includes(c.status)) return;
  const last = await db.query.partnerContractAudit.findFirst({
    where: and(
      eq(partnerContractAudit.contractId, id),
      eq(partnerContractAudit.action, "signing_reminder_sent"),
    ),
    orderBy: desc(partnerContractAudit.createdAt),
  });
  if (last && Date.now() - last.createdAt.getTime() < 24 * 3600000) return;
  const role = c.partnerSignedAt ? "company" : "partner";
  await contractProvider(db, c).remind(
    c.providerReference,
    role === "partner" ? c.snapshot.partnerEmail : c.snapshot.companySigner.email,
  );
  await contractAudit(
    db,
    "system",
    "signing_reminder_sent",
    "External provider sends a signing reminder",
    { contractId: id, applicationId: c.applicationId, evidence: { role } },
  );
  await notify(db, c, "signing_reminder", [role]);
}
export async function advanceMock(contractId: string, step: "partner" | "company" | "expire") {
  if (process.env.NODE_ENV === "production")
    throw new ContractError("mock_simulation_forbidden", 404);
  const db = contractDatabase(),
    c = await contractRow(db, contractId);
  if (c.mode !== "mock" || !c.providerSnapshot || terminalStates.includes(c.status))
    throw new ContractError("mock_request_not_active");
  const state = structuredClone(c.providerSnapshot);
  if (step === "company" && !state.signers[0].signedAt)
    throw new ContractError("partner_signature_required");
  if (step === "expire") state.expired = true;
  else {
    state.signers[step === "partner" ? 0 : 1].signedAt = new Date().toISOString();
    state.complete = state.signers.every((x) => !!x.signedAt);
  }
  await db
    .update(partnerContracts)
    .set({ providerSnapshot: state })
    .where(eq(partnerContracts.id, c.id));
  await enqueueJob(db, "reconcile", `reconcile:${c.id}`, { contractId: c.id });
}
