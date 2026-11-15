import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  partnerApplications,
  partnerContracts,
  partnerContractTemplates,
  partnerContractDeliveries,
  partnerContractNativeInvitations as invitations,
  partnerContractNativeSignatures as signatures,
} from "@/lib/db/schema";
import { encryptEmailPayload } from "../public-applications";
import {
  ContractError,
  hashObject,
  sha256,
  safeEqual,
  requireFeature,
  nativeConsentText,
  nativeConsentVersion,
  nativeConsentVersions,
  type ProviderSnapshot,
  type Template,
} from "./domain";
import { contractDatabase, contractAudit } from "./records";
import {
  contractLock,
  contractRow,
  liveGates,
  notify,
  reserveLiveSend,
  type ContractRow,
} from "./lifecycle";
import { readArtifact, saveArtifact } from "./storage";
import { agreementText } from "./pdf";
import { templateChecksum } from "./catalog";
import { nativeExecutedPdf } from "./native-pdf";
import {
  attestNative,
  verifyNativeAttestation,
  type NativeSignaturePayload,
  type NativeAttestation,
  type NativeManifest,
  verifyNativeFiles,
} from "./native-crypto";
import type { ContractDb } from "./types";

export const nativeSigningCookie = "useclevr-native-signing";
const token = () => randomBytes(32).toString("base64url");
const validToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);
type Invitation = typeof invitations.$inferSelect;
type Receipt = NativeAttestation<NativeSignaturePayload>;
function secretHash(scope: string, value: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new ContractError("native_auth_configuration_missing", 503);
  return createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex");
}
export function nativeSecurityMetadata(request: Request) {
  return {
    userAgentHash: sha256((request.headers.get("user-agent") || "unknown").slice(0, 1000)),
    // Proxy-reported address is contextual evidence, never an identity factor.
    reportedAddressHash: secretHash(
      "native-address",
      (request.headers.get("x-real-ip") || "unknown").slice(0, 200),
    ),
  };
}
async function active(db: ContractDb, c: ContractRow) {
  requireFeature();
  if (
    c.mode !== "native" ||
    !["generated", "awaiting_partner_signature", "awaiting_company_signature"].includes(c.status)
  )
    throw new ContractError("native_agreement_not_active", 409);
  if (c.expiresAt <= new Date()) throw new ContractError("signing_invitation_expired", 410);
  const newest = await db.query.partnerContracts.findFirst({
    where: eq(partnerContracts.partnerId, c.partnerId),
    orderBy: [desc(partnerContracts.createdAt), desc(partnerContracts.revision)],
  });
  const app = await db.query.partnerApplications.findFirst({
    where: eq(partnerApplications.id, c.applicationId),
  });
  if (
    newest?.id !== c.id ||
    !app?.onboardedAt ||
    !["approved", "active"].includes(app.status) ||
    app.linkedUserId !== c.snapshot.userId ||
    app.partnerAccountId !== c.partnerId ||
    app.email.toLowerCase() !== c.snapshot.partnerEmail.toLowerCase()
  )
    throw new ContractError("native_agreement_identity_changed", 409);
  await liveGates(db, c);
  if (
    c.snapshot.partnerEmail.toLowerCase() === c.snapshot.companySigner.email.toLowerCase() ||
    c.snapshot.userId === c.snapshot.companySigner.reference
  )
    throw new ContractError("independent_company_countersigner_required");
  if (!c.sourceArtifactId || !c.documentChecksum)
    throw new ContractError("source_document_missing");
  return readArtifact(db, c.sourceArtifactId, c.id, c.documentChecksum);
}
async function issue(db: ContractDb, c: ContractRow, role: "partner" | "company") {
  const previous = await db.query.partnerContractNativeInvitations.findFirst({
    where: and(
      eq(invitations.contractId, c.id),
      eq(invitations.role, role),
      isNull(invitations.revokedAt),
    ),
  });
  if (previous) return;
  const raw = token(),
    id = randomUUID();
  const email = role === "partner" ? c.snapshot.partnerEmail : c.snapshot.companySigner.email;
  await db.insert(invitations).values({
    id,
    contractId: c.id,
    role,
    email: email.toLowerCase(),
    tokenHash: sha256(raw),
    documentChecksum: c.documentChecksum!,
    expiresAt: new Date(Math.min(c.expiresAt.getTime(), Date.now() + 48 * 3600000)),
  });
  await db.insert(partnerContractDeliveries).values({
    id: randomUUID(),
    contractId: c.id,
    kind: `native_invitation:${id}`,
    recipientRole: role,
    recipient: email,
    payload: encryptEmailPayload({ token: raw, invitationId: id }),
  });
  await contractAudit(
    db,
    "system",
    "native_invitation_issued",
    "Single-use signing invitation queued for the exact approved signer",
    {
      contractId: c.id,
      applicationId: c.applicationId,
      evidence: { invitationId: id, role, sourceChecksum: c.documentChecksum },
    },
  );
}
export async function sendNativeContract(id: string) {
  await contractDatabase().transaction(async (tx) => {
    await contractLock(tx, id);
    const c = await contractRow(tx, id);
    if (c.status === "fully_executed") return;
    await active(tx, c);
    // Validate the attestation key pair before sending an invitation.
    attestNative({ preflight: c.id });
    if (c.status === "generated") await reserveLiveSend(tx, c);
    await issue(tx, c, c.partnerSignedAt ? "company" : "partner");
    if (c.status === "generated")
      await tx
        .update(partnerContracts)
        .set({
          status: "awaiting_partner_signature",
          providerReference: `native:${id}`,
          updatedAt: new Date(),
        })
        .where(eq(partnerContracts.id, id));
  });
}
export async function renewNativeInvitation(
  id: string,
  actor: string,
  reason: string,
  confirmed: boolean,
) {
  if (!confirmed || reason.trim().length < 10)
    throw new ContractError("invitation_renewal_confirmation_required", 400);
  await contractDatabase().transaction(async (tx) => {
    await contractLock(tx, id);
    const c = await contractRow(tx, id);
    await active(tx, c);
    if (c.status === "generated") throw new ContractError("send_agreement_before_renewal");
    const role = c.partnerSignedAt ? "company" : "partner";
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.contractId, id),
          eq(invitations.role, role),
          isNull(invitations.revokedAt),
        ),
      );
    await issue(tx, c, role);
    await contractAudit(tx, actor, "native_invitation_renewed", reason, {
      contractId: id,
      evidence: { role },
    });
  });
}
async function invitation(db: ContractDb, raw: string, email: string) {
  if (!validToken(raw)) throw new ContractError("invalid_signing_invitation", 403);
  const i = await db.query.partnerContractNativeInvitations.findFirst({
    where: eq(invitations.tokenHash, sha256(raw)),
  });
  if (!i || i.email !== email.toLowerCase())
    throw new ContractError("invalid_signing_invitation", 403);
  await contractLock(db, i.contractId);
  const fresh = (await db.query.partnerContractNativeInvitations.findFirst({
    where: eq(invitations.id, i.id),
  }))!;
  if (fresh.revokedAt || fresh.usedAt)
    throw new ContractError("signing_invitation_used_or_revoked", 409);
  if (fresh.expiresAt <= new Date()) throw new ContractError("signing_invitation_expired", 410);
  const c = await contractRow(db, fresh.contractId);
  await active(db, c);
  if (
    fresh.documentChecksum !== c.documentChecksum ||
    (fresh.role === "company") !== !!c.partnerSignedAt
  )
    throw new ContractError("signing_order_or_document_changed", 409);
  return fresh;
}
export async function requestNativeCode(raw: string, email: string) {
  return contractDatabase().transaction(async (tx) => {
    const i = await invitation(tx, raw, email);
    if (i.attempts >= 5 || i.codeRequests >= 3)
      throw new ContractError("signing_verification_budget_exhausted", 429);
    if (i.codeSentAt && Date.now() - i.codeSentAt.getTime() < 60000)
      throw new ContractError("verification_cooldown", 429);
    const code = String(randomInt(100000, 1000000)),
      now = new Date();
    await tx
      .update(invitations)
      .set({
        codeHash: secretHash(i.id, code),
        codeExpiresAt: new Date(Math.min(i.expiresAt.getTime(), Date.now() + 600000)),
        codeSentAt: now,
        codeRequests: i.codeRequests + 1,
      })
      .where(eq(invitations.id, i.id));
    const deliveryId = randomUUID();
    await tx.insert(partnerContractDeliveries).values({
      id: deliveryId,
      contractId: i.contractId,
      kind: `native_code:${i.id}:${i.codeRequests + 1}`,
      recipientRole: i.role,
      recipient: i.email,
      payload: encryptEmailPayload({ code, invitationId: i.id }),
    });
    return { sent: true, deliveryId };
  });
}
export async function verifyNativeCode(raw: string, email: string, code: string) {
  const proof = token();
  const result = await contractDatabase().transaction(async (tx) => {
    const i = await invitation(tx, raw, email);
    if (!i.codeHash || !i.codeExpiresAt || i.codeExpiresAt <= new Date() || i.attempts >= 5)
      return { error: "signing_verification_expired" };
    await tx
      .update(invitations)
      .set({ attempts: i.attempts + 1 })
      .where(eq(invitations.id, i.id));
    if (!/^\d{6}$/.test(code) || !safeEqual(i.codeHash, secretHash(i.id, code)))
      return { error: "signing_verification_incorrect" };
    const now = new Date();
    await tx
      .update(invitations)
      .set({
        usedAt: now,
        verifiedAt: now,
        sessionHash: sha256(proof),
        sessionExpiresAt: new Date(Math.min(i.expiresAt.getTime(), Date.now() + 30 * 60000)),
        codeHash: null,
      })
      .where(eq(invitations.id, i.id));
    await contractAudit(
      tx,
      i.role,
      "native_email_verified",
      "Contract-bound one-time email proof consumed; no customer or administrator session granted",
      { contractId: i.contractId, evidence: { invitationId: i.id, role: i.role } },
    );
    return { verified: true };
  });
  if (result.error) throw new ContractError(result.error, 400);
  return proof;
}
async function session(db: ContractDb, proof: string): Promise<Invitation> {
  if (!validToken(proof)) throw new ContractError("signing_email_verification_required", 401);
  const i = await db.query.partnerContractNativeInvitations.findFirst({
    where: eq(invitations.sessionHash, sha256(proof)),
  });
  if (!i) throw new ContractError("signing_email_verification_required", 401);
  await contractLock(db, i.contractId);
  const fresh = (await db.query.partnerContractNativeInvitations.findFirst({
    where: eq(invitations.id, i.id),
  }))!;
  if (
    fresh.revokedAt ||
    !fresh.verifiedAt ||
    !fresh.sessionExpiresAt ||
    fresh.sessionExpiresAt <= new Date() ||
    fresh.expiresAt <= new Date()
  )
    throw new ContractError("signing_session_expired", 401);
  return fresh;
}
export async function reviewNativeAgreement(proof: string, pdf = false) {
  return contractDatabase().transaction(async (tx) => {
    requireFeature();
    const i = await session(tx, proof),
      c = await contractRow(tx, i.contractId);
    if (i.signedAt) return { signed: true as const, status: c.status };
    const source = await active(tx, c);
    if (i.documentChecksum !== c.documentChecksum)
      throw new ContractError("signing_document_changed");
    const t = await tx.query.partnerContractTemplates.findFirst({
      where: eq(partnerContractTemplates.id, c.templateId),
    });
    if (!t) throw new ContractError("agreement_template_missing");
    if (templateChecksum(t as Template) !== c.snapshot.templateHash)
      throw new ContractError("native_template_integrity_check_failed", 503);
    await tx
      .update(invitations)
      .set({ reviewedAt: i.reviewedAt || new Date() })
      .where(eq(invitations.id, i.id));
    if (pdf) return source;
    return {
      signed: false as const,
      contractId: c.id,
      role: i.role,
      email: i.email,
      legalName:
        i.role === "partner" ? c.snapshot.identity.signerName : c.snapshot.companySigner.name,
      documentChecksum: c.documentChecksum!,
      text: agreementText(t as Template, c.snapshot, c.id),
      consentVersion: nativeConsentVersion,
      consentText: nativeConsentText,
      expiresAt: i.sessionExpiresAt!.toISOString(),
    };
  });
}
export const nativeSigningInput = z
  .object({
    legalName: z.string().trim().min(2).max(200),
    documentChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    consentVersion: z.literal(nativeConsentVersion),
    consent: z.literal(true),
    reviewed: z.literal(true),
    action: z.literal("sign_agreement"),
  })
  .strict();
const normalizedName = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
function receipt(row: typeof signatures.$inferSelect): Receipt {
  return {
    payload: row.payload,
    checksum: row.checksum,
    keyId: row.keyId,
    signature: row.signature,
  };
}
function validateReceipts(c: ContractRow, receipts: Receipt[]) {
  if (receipts.length !== 2) throw new ContractError("native_both_signatures_required");
  for (const [index, r] of receipts.entries()) {
    const p = verifyNativeAttestation(r),
      role = index === 0 ? "partner" : "company";
    if (
      p.version !== 1 ||
      p.contractId !== c.id ||
      p.role !== role ||
      p.sourceChecksum !== c.documentChecksum ||
      p.snapshotChecksum !== hashObject(c.snapshot) ||
      p.verifiedEmail !==
        (index === 0 ? c.snapshot.partnerEmail : c.snapshot.companySigner.email).toLowerCase() ||
      p.signerReference !==
        (index === 0 ? c.snapshot.userId : c.snapshot.companySigner.reference) ||
      normalizedName(p.legalName) !==
        normalizedName(
          index === 0 ? c.snapshot.identity.signerName : c.snapshot.companySigner.name,
        ) ||
      normalizedName(p.typedName) !== normalizedName(p.legalName) ||
      nativeConsentVersions[p.consentVersion] !== p.consentText ||
      p.affirmativeAction !== "sign_agreement" ||
      p.previousEvidenceHash !== (index === 0 ? null : receipts[0].checksum) ||
      !Number.isFinite(Date.parse(p.signedAt)) ||
      !Number.isFinite(Date.parse(p.verifiedAt)) ||
      !Number.isFinite(Date.parse(p.documentPresentedAt)) ||
      Date.parse(p.documentPresentedAt) < Date.parse(p.verifiedAt) ||
      Date.parse(p.signedAt) < c.createdAt.getTime() ||
      Date.parse(p.signedAt) > c.expiresAt.getTime() ||
      Date.parse(p.signedAt) < Date.parse(p.verifiedAt) ||
      Date.parse(p.signedAt) < Date.parse(p.documentPresentedAt) ||
      (index === 1 && p.signedAt < receipts[0].payload.signedAt)
    )
      throw new ContractError("native_evidence_binding_invalid", 503);
  }
}
export async function signNativeAgreement(
  proof: string,
  input: unknown,
  security: NativeSignaturePayload["security"],
) {
  const b = nativeSigningInput.parse(input);
  return contractDatabase().transaction(async (tx) => {
    const i = await session(tx, proof),
      c = await contractRow(tx, i.contractId);
    if (i.signedAt) throw new ContractError("signing_action_already_used", 409);
    const source = await active(tx, c);
    if (
      !i.reviewedAt ||
      b.documentChecksum !== i.documentChecksum ||
      b.documentChecksum !== c.documentChecksum
    )
      throw new ContractError("review_exact_agreement_before_signing", 409);
    if (
      (i.role === "company") !== !!c.partnerSignedAt ||
      !["awaiting_partner_signature", "awaiting_company_signature"].includes(c.status)
    )
      throw new ContractError("partner_signature_required_first");
    const expectedName =
      i.role === "partner" ? c.snapshot.identity.signerName : c.snapshot.companySigner.name;
    if (normalizedName(b.legalName) !== normalizedName(expectedName))
      throw new ContractError("signer_name_requires_identity_review", 400);
    const previous = await tx.query.partnerContractNativeSignatures.findFirst({
      where: and(eq(signatures.contractId, c.id), eq(signatures.role, "partner")),
    });
    if (previous) verifyNativeAttestation(receipt(previous));
    const now = new Date();
    const attestation = attestNative<NativeSignaturePayload>({
      version: 1,
      contractId: c.id,
      role: i.role as "partner" | "company",
      sourceChecksum: c.documentChecksum!,
      snapshotChecksum: hashObject(c.snapshot),
      signerReference:
        i.role === "partner" ? c.snapshot.userId : c.snapshot.companySigner.reference,
      legalName: expectedName,
      typedName: b.legalName,
      verifiedEmail: i.email,
      verifiedAt: i.verifiedAt!.toISOString(),
      documentPresentedAt: i.reviewedAt.toISOString(),
      signedAt: now.toISOString(),
      consentVersion: nativeConsentVersion,
      consentText: nativeConsentText,
      affirmativeAction: b.action,
      previousEvidenceHash: previous?.checksum || null,
      security,
    });
    await tx
      .insert(signatures)
      .values({ id: randomUUID(), contractId: c.id, role: i.role, ...attestation });
    await tx.update(invitations).set({ signedAt: now }).where(eq(invitations.id, i.id));
    await contractAudit(
      tx,
      attestation.payload.signerReference,
      `native_${i.role}_signed`,
      "Email-verified signer explicitly consents and signs the exact immutable agreement",
      {
        contractId: c.id,
        applicationId: c.applicationId,
        evidence: { receiptChecksum: attestation.checksum, keyId: attestation.keyId, role: i.role },
      },
    );
    if (i.role === "partner") {
      await tx
        .update(partnerContracts)
        .set({ partnerSignedAt: now, status: "awaiting_company_signature", updatedAt: now })
        .where(eq(partnerContracts.id, c.id));
      await issue(tx, { ...c, partnerSignedAt: now }, "company");
      await notify(tx, c, "partner_signed", ["partner"]);
    } else {
      const receipts = [receipt(previous!), attestation];
      validateReceipts(c, receipts);
      const finalPdf = await nativeExecutedPdf(source.bytes, receipts);
      const signed = await saveArtifact(tx, c.id, "signed", finalPdf);
      const manifest = attestNative<NativeManifest>({
        version: 1,
        contractId: c.id,
        sourceChecksum: c.documentChecksum!,
        signedChecksum: signed.checksum,
        snapshotChecksum: hashObject(c.snapshot),
        completedAt: now.toISOString(),
        receipts,
      });
      const evidence = await saveArtifact(tx, c.id, "audit", Buffer.from(JSON.stringify(manifest)));
      const state: ProviderSnapshot = {
        reference: `native:${c.id}`,
        contractId: c.id,
        sourceChecksum: c.documentChecksum!,
        testMode: false,
        complete: true,
        declined: false,
        cancelled: false,
        expired: false,
        hasError: false,
        observedAt: now.toISOString(),
        signers: receipts.map((r, index) => ({
          role: index === 0 ? "partner" : "company",
          reference: r.payload.signerReference,
          name: index === 0 ? c.snapshot.identity.signerName : c.snapshot.companySigner.name,
          email: r.payload.verifiedEmail,
          order: index,
          signedAt: r.payload.signedAt,
          providerSignatureId: r.checksum,
        })),
      };
      await tx
        .update(partnerContracts)
        .set({
          companySignedAt: now,
          providerSnapshot: state,
          status: "fully_executed",
          signedArtifactId: signed.id,
          signedDocumentChecksum: signed.checksum,
          auditArtifactId: evidence.id,
          auditEvidenceChecksum: evidence.checksum,
          verifiedAt: now,
          executedAt: now,
          updatedAt: now,
        })
        .where(eq(partnerContracts.id, c.id));
      await contractAudit(
        tx,
        "system",
        "agreement_fully_executed",
        "Both native email-verified signatures, signed evidence manifest and final PDF privately archived; activation remains separate",
        {
          contractId: c.id,
          evidence: {
            signedChecksum: signed.checksum,
            auditChecksum: evidence.checksum,
            mode: c.mode,
          },
        },
      );
      await notify(tx, c, "fully_executed", ["partner", "company"]);
    }
    return {
      signed: true,
      contractId: c.id,
      role: i.role,
      status: i.role === "partner" ? "awaiting_company_signature" : "fully_executed",
    };
  });
}
export async function verifyNativeExecution(db: ContractDb, c: ContractRow) {
  if (
    c.mode !== "native" ||
    c.status !== "fully_executed" ||
    !c.sourceArtifactId ||
    !c.documentChecksum ||
    !c.signedArtifactId ||
    !c.signedDocumentChecksum ||
    !c.auditArtifactId ||
    !c.auditEvidenceChecksum
  )
    throw new ContractError("native_execution_required");
  const source = await readArtifact(db, c.sourceArtifactId, c.id, c.documentChecksum);
  const signed = await readArtifact(db, c.signedArtifactId, c.id, c.signedDocumentChecksum);
  const archive = await readArtifact(db, c.auditArtifactId, c.id, c.auditEvidenceChecksum);
  let envelope: NativeAttestation<NativeManifest>;
  try {
    envelope = JSON.parse(archive.bytes.toString());
  } catch {
    throw new ContractError("native_evidence_integrity_check_failed", 503);
  }
  const manifest = verifyNativeFiles(envelope, signed.bytes, source.bytes);
  if (
    manifest.version !== 1 ||
    manifest.contractId !== c.id ||
    manifest.sourceChecksum !== c.documentChecksum ||
    manifest.signedChecksum !== c.signedDocumentChecksum ||
    manifest.snapshotChecksum !== hashObject(c.snapshot) ||
    manifest.completedAt !== c.executedAt?.toISOString()
  )
    throw new ContractError("native_archive_binding_invalid", 503);
  validateReceipts(c, manifest.receipts);
  if (
    manifest.receipts[0].payload.signedAt !== c.partnerSignedAt?.toISOString() ||
    manifest.receipts[1].payload.signedAt !== c.companySignedAt?.toISOString() ||
    manifest.completedAt !== manifest.receipts[1].payload.signedAt
  )
    throw new ContractError("native_archive_binding_invalid", 503);
  const rows = await db.query.partnerContractNativeSignatures.findMany({
    where: eq(signatures.contractId, c.id),
  });
  if (
    rows.length !== 2 ||
    rows.some((r) => !manifest.receipts.some((a) => hashObject(a) === hashObject(receipt(r))))
  )
    throw new ContractError("native_archive_receipts_mismatch", 503);
  return manifest;
}
