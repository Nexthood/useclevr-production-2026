import { eq, sql } from "drizzle-orm";
import { partnerContractDeliveries, partnerContractNativeInvitations } from "@/lib/db/schema";
import { ContractError, hashObject, runtimePolicy, isLiveMode, sha256 } from "./domain";
import { decryptEmailPayload } from "../public-applications";
import { contractAudit, contractDatabase } from "./records";
import { contractRow } from "./lifecycle";
import { readArtifact } from "./storage";
const subjects: Record<string, string> = {
  agreement_ready: "Your UseClevr agreement is ready for signature",
  signing_reminder: "Reminder: UseClevr partner agreement",
  partner_signed: "Partner signature completed",
  company_countersignature_requested: "Atlas Mega Ventures LLC countersignature requested",
  fully_executed: "Your UseClevr agreement is fully executed",
  expired: "UseClevr signature request expired",
  cancelled: "UseClevr signature request cancelled",
  rejected: "UseClevr signature request declined",
  activation_confirmed: "UseClevr partner activation confirmed",
};
export async function deliverContractEmail(deliveryId: string) {
  const db = contractDatabase();
  let acquired = false;
  await db.transaction(async (tx) => {
    const locked = await tx.execute(
      sql`select id from "PartnerContractDelivery" where id=${deliveryId} for update skip locked`,
    );
    if (!locked.rows.length) return;
    const d = await tx.query.partnerContractDeliveries.findFirst({
      where: eq(partnerContractDeliveries.id, deliveryId),
    });
    if (
      !d ||
      d.status === "sent" ||
      d.status === "uncertain" ||
      d.status === "failed" ||
      (d.status === "sending" && d.leaseUntil && d.leaseUntil > new Date())
    )
      return;
    if (
      d.idempotencyExpiresAt &&
      d.idempotencyExpiresAt <= new Date() &&
      d.lastErrorCode === "email_response_uncertain"
    ) {
      await tx
        .update(partnerContractDeliveries)
        .set({
          status: "uncertain",
          leaseUntil: null,
          lastErrorCode: "provider_delivery_review_required",
        })
        .where(eq(partnerContractDeliveries.id, d.id));
      return;
    }
    await tx
      .update(partnerContractDeliveries)
      .set({
        status: "sending",
        attempts: d.attempts + 1,
        leaseUntil: new Date(Date.now() + 120000),
        firstAttemptAt: d.firstAttemptAt || new Date(),
        idempotencyExpiresAt: d.idempotencyExpiresAt || new Date(Date.now() + 23 * 3600000),
        lastErrorCode: "email_response_uncertain",
      })
      .where(eq(partnerContractDeliveries.id, d.id));
    acquired = true;
  });
  if (!acquired) return;
  const d = (await db.query.partnerContractDeliveries.findFirst({
    where: eq(partnerContractDeliveries.id, deliveryId),
  }))!;
  try {
    const c = await contractRow(db, d.contractId);
    const origin = runtimePolicy().origin;
    if (!/^https:\/\//.test(origin) && process.env.NODE_ENV === "production")
      throw new ContractError("email_origin_requires_https");
    const link = `${origin.replace(/\/$/, "")}/partners/contracts?contract=${encodeURIComponent(c.id)}`;
    const nonbinding = !isLiveMode(c.mode);
    const nativeInvitation = d.kind.startsWith("native_invitation:");
    const nativeCode = d.kind.startsWith("native_code:");
    const label = nativeInvitation
      ? "Review and sign your UseClevr agreement"
      : nativeCode
        ? "Your UseClevr signing verification code"
        : subjects[d.kind];
    if (!label) throw new ContractError("unknown_contract_email_kind");
    let text = `${nonbinding ? "NON-BINDING TEST / DRAFT\n\n" : ""}${label}.\nAgreement: ${c.snapshot.documentTitle}\nTemplate version: ${c.templateVersion}\nCommercial terms version: ${c.commercialTermsVersion}\n\n${d.kind === "fully_executed" ? "Both signatures are verified and a PDF copy is attached. Commercial activation still requires a separate administrator decision." : d.kind === "activation_confirmed" ? "An administrator explicitly authorized partner activation. Commission and payout rules still apply." : c.mode === "native" ? "Use the secure UseClevr signing invitation sent to your verified email. Contact the partner team if it expires." : "Review your agreement and status in the secure partner portal. For signing, use the separate invitation sent by the approved signature provider."}\n${link}\n\nAtlas Mega Ventures LLC · UseClevr Partner Program`;
    if (nativeInvitation || nativeCode) {
      const payload = decryptEmailPayload(d.payload);
      const i = await db.query.partnerContractNativeInvitations.findFirst({
        where: eq(partnerContractNativeInvitations.id, payload.invitationId || ""),
      });
      if (
        c.mode !== "native" ||
        !i ||
        i.contractId !== c.id ||
        i.email !== d.recipient.toLowerCase() ||
        i.revokedAt ||
        i.usedAt ||
        i.expiresAt <= new Date() ||
        !["awaiting_partner_signature", "awaiting_company_signature"].includes(c.status)
      )
        throw new ContractError("native_email_expired");
      if (nativeInvitation) {
        if (!payload.token || sha256(payload.token) !== i.tokenHash)
          throw new ContractError("native_email_payload_invalid");
        // Fragment tokens never enter HTTP request URLs or server access logs.
        text = `${label}.\n${origin.replace(/\/$/, "")}/partners/sign#token=${encodeURIComponent(payload.token)}\nThis single-use invitation expires at ${i.expiresAt.toISOString()}. Verify your email with a one-time code, review the complete agreement, and explicitly consent before signing. Do not forward this link. Signing does not activate commercial privileges.`;
      } else {
        if (
          !payload.code ||
          !i.codeExpiresAt ||
          i.codeExpiresAt <= new Date() ||
          !d.kind.endsWith(`:${i.codeRequests}`)
        )
          throw new ContractError("native_email_expired");
        text = `Your UseClevr agreement signing code is ${payload.code}. It expires at ${i.codeExpiresAt.toISOString()}. Do not share this code. Enter it only in the UseClevr signing page you opened from your invitation.`;
      }
    }
    const attachments: { filename: string; content: string }[] = [];
    if (d.kind === "fully_executed") {
      if (c.status !== "fully_executed" || !c.signedArtifactId || !c.signedDocumentChecksum)
        throw new ContractError("signed_document_not_ready");
      const file = await readArtifact(db, c.signedArtifactId, c.id, c.signedDocumentChecksum);
      attachments.push({
        filename: nonbinding ? "NON-BINDING-TEST-agreement.pdf" : "executed-partner-agreement.pdf",
        content: file.bytes.toString("base64"),
      });
      if (c.mode === "native") {
        await (await import("./native")).verifyNativeExecution(db, c);
        const manifest = await readArtifact(db, c.auditArtifactId!, c.id, c.auditEvidenceChecksum!);
        attachments.push({
          filename: "execution-evidence.json",
          content: manifest.bytes.toString("base64"),
        });
      }
    }
    const payload = {
      from: process.env.EMAIL_FROM || "UseClevr <auth@useclevr.com>",
      to: [d.recipient],
      subject: `${nonbinding ? "NON-BINDING TEST - " : ""}${label}`,
      text,
      ...(attachments.length ? { attachments } : {}),
    };
    const payloadChecksum = hashObject(payload);
    if (d.payloadChecksum && d.payloadChecksum !== payloadChecksum)
      throw new ContractError("email_payload_changed_requires_review");
    await db
      .update(partnerContractDeliveries)
      .set({ payloadChecksum })
      .where(eq(partnerContractDeliveries.id, d.id));
    let providerId: string;
    if (c.mode === "mock") {
      if (process.env.NODE_ENV === "production")
        throw new ContractError("mock_email_forbidden_in_production");
      providerId = `mock:${d.id}`;
    } else {
      if (!process.env.RESEND_API_KEY) throw new ContractError("email_provider_not_configured");
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `partner-contract-${d.id}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      }).catch(() => {
        throw new ContractError("email_response_uncertain", 502);
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || typeof body.id !== "string")
        throw new ContractError(`email_http_${r.status}`, 502);
      providerId = body.id;
    }
    await db.transaction(async (tx) => {
      await tx
        .update(partnerContractDeliveries)
        .set({
          status: "sent",
          providerId,
          sentAt: new Date(),
          leaseUntil: null,
          lastErrorCode: null,
        })
        .where(eq(partnerContractDeliveries.id, d.id));
      await contractAudit(
        tx,
        "system",
        "contract_email_sent",
        c.mode === "mock"
          ? "Non-binding local mock; no external email"
          : "Email provider accepted an idempotent contract notification",
        {
          contractId: c.id,
          applicationId: c.applicationId,
          evidence: { kind: d.kind, recipientRole: d.recipientRole, deliveryId: d.id },
        },
      );
    });
  } catch (e) {
    const code = e instanceof ContractError ? e.code : "email_response_uncertain";
    await db
      .update(partnerContractDeliveries)
      .set({
        status:
          d.attempts >= 5 ||
          [
            "email_payload_changed_requires_review",
            "native_email_expired",
            "native_email_payload_invalid",
          ].includes(code)
            ? "failed"
            : "pending",
        nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** d.attempts)),
        leaseUntil: null,
        lastErrorCode: code,
      })
      .where(eq(partnerContractDeliveries.id, d.id));
  }
}
export async function retryContractDelivery(id: string, actor: string) {
  const db = contractDatabase();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from "PartnerContractDelivery" where id=${id} for update`);
    const d = await tx.query.partnerContractDeliveries.findFirst({
      where: eq(partnerContractDeliveries.id, id),
    });
    if (!d) throw new ContractError("delivery_not_found", 404);
    if (d.status === "sent") return;
    if (d.status === "sending" && d.leaseUntil && d.leaseUntil > new Date())
      throw new ContractError("delivery_in_progress");
    if (
      d.status === "uncertain" ||
      (d.idempotencyExpiresAt &&
        d.idempotencyExpiresAt <= new Date() &&
        d.lastErrorCode === "email_response_uncertain")
    )
      throw new ContractError("provider_delivery_review_required");
    await tx
      .update(partnerContractDeliveries)
      .set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), leaseUntil: null })
      .where(eq(partnerContractDeliveries.id, id));
    await contractAudit(
      tx,
      actor,
      "contract_email_retry_requested",
      "Administrator requests an idempotent delivery retry",
      { contractId: d.contractId, evidence: { deliveryId: d.id, kind: d.kind } },
    );
  });
  await deliverContractEmail(id);
}
