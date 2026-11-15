import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import * as schema from "../../src/lib/db/schema";
import {
  hashObject,
  nativeConsentVersion,
  sha256,
  validateLiveRuntime,
  runtimePolicy,
} from "../../src/lib/partners/contracts/domain";
import {
  attestNative,
  verifyNativeAttestation,
  verifyNativeFiles,
} from "../../src/lib/partners/contracts/native-crypto";
import {
  requestNativeCode,
  verifyNativeCode,
  reviewNativeAgreement,
  signNativeAgreement,
  renewNativeInvitation,
  verifyNativeExecution,
} from "../../src/lib/partners/contracts/native";
import {
  prepareContract,
  sendContract,
  cancelContract,
  contractRow,
} from "../../src/lib/partners/contracts/lifecycle";
import { approveRuntime } from "../../src/lib/partners/contracts/records";
import { activateExecutedContract } from "../../src/lib/partners/contracts/activation";
import { privateContractDocument } from "../../src/lib/partners/contracts/access";
import { deliverContractEmail } from "../../src/lib/partners/contracts/mail";
import { decryptEmailPayload } from "../../src/lib/partners/public-applications";
import type { ContractDatabase } from "../../src/lib/partners/contracts/types";
import { PDFDocument } from "pdf-lib";

type Fixture = { id: string; userId: string; partnerId: string; email: string };
export async function runNativeContractTests({
  db,
  pool,
  fixture,
  check,
}: {
  db: ContractDatabase;
  pool: Pool;
  fixture: () => Promise<Fixture>;
  check: (name: string, run: () => Promise<void>) => Promise<void>;
}) {
  const keys = generateKeyPairSync("ed25519");
  Object.assign(process.env, {
    PARTNER_CONTRACT_SIGNING_MODE: "native",
    PARTNER_CONTRACT_LIVE_ENABLED: "true",
    PARTNER_CONTRACT_MONTHLY_SEND_LIMIT: "100",
    PARTNER_CONTRACT_NATIVE_KEY_ID: "native-fixture",
    PARTNER_CONTRACT_NATIVE_PRIVATE_KEY: keys.privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("base64"),
    PARTNER_CONTRACT_NATIVE_PUBLIC_KEYS: JSON.stringify({
      "native-fixture": keys.publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    }),
  });
  delete process.env.DROPBOX_SIGN_API_KEY;
  delete process.env.DROPBOX_SIGN_ACCOUNT_ID;
  delete process.env.DROPBOX_SIGN_CLIENT_ID;
  process.env.AUTH_SECRET ||= "synthetic-native-authentication-fixture-only";
  const security = {
    userAgentHash: sha256("fixture browser"),
    reportedAddressHash: sha256("fixture network"),
  };
  async function atTime<T>(ms: number, run: () => Promise<T>) {
    const OriginalDate = globalThis.Date;
    globalThis.Date = new Proxy(OriginalDate, {
      construct(target, args) {
        return args.length ? Reflect.construct(target, args) : new OriginalDate(ms);
      },
      get(target, key) {
        return key === "now" ? () => ms : Reflect.get(target, key);
      },
    });
    try {
      return await run();
    } finally {
      globalThis.Date = OriginalDate;
    }
  }
  async function invite(id: string, role: string) {
    const rows = await db.query.partnerContractDeliveries.findMany({
      where: and(
        eq(schema.partnerContractDeliveries.contractId, id),
        eq(schema.partnerContractDeliveries.recipientRole, role),
      ),
    });
    const current = (
      await db.query.partnerContractNativeInvitations.findMany({
        where: eq(schema.partnerContractNativeInvitations.contractId, id),
      })
    ).find((i) => i.role === role && !i.revokedAt)!;
    const d = rows.find((d) => d.kind === `native_invitation:${current.id}`)!;
    return {
      raw: decryptEmailPayload(d.payload).token,
      email: current.email,
      row: current,
      delivery: d,
    };
  }
  async function code(raw: string, email: string) {
    const result = await requestNativeCode(raw, email);
    const delivery = (await db.query.partnerContractDeliveries.findFirst({
      where: eq(schema.partnerContractDeliveries.id, result.deliveryId),
    }))!;
    return decryptEmailPayload(delivery.payload).code;
  }
  const signing = (checksum: string, company = false) => ({
    legalName: company ? "Fixture Company Signer" : "Ｆｉｘｔｕｒｅ Ｐａｒｔｎｅｒ",
    documentChecksum: checksum,
    consentVersion: nativeConsentVersion,
    consent: true,
    reviewed: true,
    action: "sign_agreement",
  });
  let f: Fixture,
    id = "",
    partnerProof = "",
    companyProof = "";
  await check(
    "native requires live owner approval and works without Dropbox credentials",
    async () => {
      assert.doesNotThrow(validateLiveRuntime);
      f = await fixture();
      const draft = await prepareContract(f.id);
      assert.equal((await contractRow(db, draft.contractId!)).mode, "draft");
      await approveRuntime(
        "test-owner",
        hashObject(runtimePolicy()),
        "Synthetic native legal and security approval",
        true,
      );
      id = (await prepareContract(f.id)).contractId!;
      assert.equal((await contractRow(db, id)).mode, "native");
      assert.equal((await contractRow(db, id)).templateVersion, "2.0.0");
      const privateKey = process.env.PARTNER_CONTRACT_NATIVE_PRIVATE_KEY;
      process.env.PARTNER_CONTRACT_NATIVE_PRIVATE_KEY = generateKeyPairSync("ed25519")
        .privateKey.export({ type: "pkcs8", format: "der" })
        .toString("base64");
      await assert.rejects(sendContract(id), /native_attestation_configuration_invalid/);
      process.env.PARTNER_CONTRACT_NATIVE_PRIVATE_KEY = privateKey;
      assert.equal((await contractRow(db, id)).status, "generated");
      await sendContract(id);
      await sendContract(id);
      const sends = await db.query.partnerContractAudit.findMany({
        where: eq(schema.partnerContractAudit.contractId, id),
      });
      assert.equal(sends.filter((a) => a.action === "live_send_budget_reserved").length, 1);
      const rows = await db.query.partnerContractNativeInvitations.findMany({
        where: eq(schema.partnerContractNativeInvitations.contractId, id),
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].role, "partner");
      await assert.rejects(
        activateExecutedContract(id, "test-owner", "Unsigned native cannot activate", true),
      );
      const { delivery } = await invite(id, "partner");
      await deliverContractEmail(delivery.id);
      assert.equal(
        (await db.query.partnerContractDeliveries.findFirst({
          where: eq(schema.partnerContractDeliveries.id, delivery.id),
        }))!.status,
        "sent",
      );
    },
  );
  await check(
    "native rejects invalid tokens, wrong email, anonymous review and unauthorized countersigning",
    async () => {
      const i = await invite(id, "partner");
      await assert.rejects(
        requestNativeCode("x".repeat(43), i.email),
        /invalid_signing_invitation/,
      );
      await assert.rejects(
        requestNativeCode(i.raw, "company@example.invalid"),
        /invalid_signing_invitation/,
      );
      await assert.rejects(reviewNativeAgreement(i.raw), /signing_email_verification_required/);
      await assert.rejects(
        signNativeAgreement(i.raw, signing(i.row.documentChecksum, true), security),
      );
      await assert.rejects(privateContractDocument(id, "source", "unrelated", false));
      const api = await import("../../src/app/api/partners/contracts/native/route");
      assert.equal(
        (
          await api.GET(
            new Request("https://fixture.example.invalid/api/partners/contracts/native"),
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await api.POST(
            new Request("https://fixture.example.invalid/api/partners/contracts/native", {
              method: "POST",
              body: "{}",
            }),
          )
        ).status,
        403,
      );
    },
  );
  await check(
    "native expires invitations and email codes and commits failed verification attempts",
    async () => {
      const i = await invite(id, "partner");
      await atTime(i.row.expiresAt.getTime(), async () => {
        await assert.rejects(requestNativeCode(i.raw, i.email), /signing_invitation_expired/);
      });
      const value = await code(i.raw, i.email);
      await assert.rejects(requestNativeCode(i.raw, i.email), /verification_cooldown/);
      await atTime(Date.now() + 11 * 60000, async () => {
        await assert.rejects(
          verifyNativeCode(i.raw, i.email, value),
          /signing_verification_expired/,
        );
      });
      const incorrect = value === "100000" ? "100001" : "100000";
      await assert.rejects(
        verifyNativeCode(i.raw, i.email, incorrect),
        /signing_verification_incorrect/,
      );
      assert.equal(
        (await db.query.partnerContractNativeInvitations.findFirst({
          where: eq(schema.partnerContractNativeInvitations.id, i.row.id),
        }))!.attempts,
        1,
      );
      const outcomes = await Promise.allSettled([
        verifyNativeCode(i.raw, i.email, value),
        verifyNativeCode(i.raw, i.email, value),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      partnerProof = (
        outcomes.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<string>
      ).value;
      await assert.rejects(
        verifyNativeCode(i.raw, i.email, value),
        /signing_invitation_used_or_revoked/,
      );
      await assert.rejects(requestNativeCode(i.raw, i.email), /signing_invitation_used_or_revoked/);
    },
  );
  await check(
    "native requires exact document review, consent, legal name and an unexpired signing session",
    async () => {
      const c = await contractRow(db, id);
      await assert.rejects(
        signNativeAgreement(partnerProof, signing(c.documentChecksum!), security),
        /review_exact_agreement_before_signing/,
      );
      const view = await reviewNativeAgreement(partnerProof);
      assert.ok(
        "text" in view &&
          typeof view.text === "string" &&
          view.text.includes("Versioned Commercial Schedule") &&
          view.text.includes("Fixture Partner LLC"),
      );
      await assert.rejects(
        signNativeAgreement(
          partnerProof,
          { ...signing(c.documentChecksum!), consent: false },
          security,
        ),
      );
      await assert.rejects(
        signNativeAgreement(
          partnerProof,
          { ...signing(c.documentChecksum!), legalName: "Unauthorized Signer" },
          security,
        ),
        /signer_name_requires_identity_review/,
      );
      await assert.rejects(
        signNativeAgreement(partnerProof, signing("0".repeat(64)), security),
        /review_exact_agreement_before_signing/,
      );
      await atTime(Date.now() + 31 * 60000, async () => {
        await assert.rejects(reviewNativeAgreement(partnerProof), /signing_session_expired/);
      });
      await assert.rejects(
        pool.query('update "PartnerContract" set "documentChecksum"=$1 where id=$2', [
          "0".repeat(64),
          id,
        ]),
      );
      await assert.rejects(
        pool.query("update \"PartnerContract\" set snapshot='{}'::jsonb where id=$1", [id]),
      );
    },
  );
  await check(
    "native concurrent partner signing records exactly one signature and queues only the approved company signer",
    async () => {
      const c = await contractRow(db, id);
      const outcomes = await Promise.allSettled([
        signNativeAgreement(partnerProof, signing(c.documentChecksum!), security),
        signNativeAgreement(partnerProof, signing(c.documentChecksum!), security),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      await assert.rejects(
        signNativeAgreement(partnerProof, signing(c.documentChecksum!), security),
        /signing_action_already_used/,
      );
      assert.equal(
        (
          await db.query.partnerContractNativeSignatures.findMany({
            where: eq(schema.partnerContractNativeSignatures.contractId, id),
          })
        ).length,
        1,
      );
      assert.equal((await contractRow(db, id)).status, "awaiting_company_signature");
      const company = await invite(id, "company");
      assert.equal(company.email, "company@example.invalid");
      await assert.rejects(requestNativeCode(company.raw, f.email), /invalid_signing_invitation/);
      await assert.rejects(
        activateExecutedContract(id, "test-owner", "Single signature cannot activate", true),
      );
      const value = await code(company.raw, company.email);
      companyProof = await verifyNativeCode(company.raw, company.email, value);
      await reviewNativeAgreement(companyProof);
    },
  );
  await check(
    "native authorized countersigning archives full PDF, signed certificate and receipt chain without activation",
    async () => {
      const c = await contractRow(db, id);
      const concurrent = await Promise.allSettled([
        signNativeAgreement(companyProof, signing(c.documentChecksum!, true), security),
        signNativeAgreement(companyProof, signing(c.documentChecksum!, true), security),
      ]);
      assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
      const complete = await contractRow(db, id);
      assert.equal(complete.status, "fully_executed");
      const manifest = await verifyNativeExecution(db, complete);
      assert.equal(manifest.receipts.length, 2);
      assert.equal(manifest.receipts[0].payload.typedName, "Ｆｉｘｔｕｒｅ Ｐａｒｔｎｅｒ");
      assert.equal(manifest.receipts[0].payload.legalName, "Fixture Partner");
      assert.equal(
        manifest.receipts[1].payload.previousEvidenceHash,
        manifest.receipts[0].checksum,
      );
      const source = await privateContractDocument(id, "source", f.userId, false);
      const finalPdf = await privateContractDocument(id, "signed", f.userId, false);
      assert.ok(
        (await PDFDocument.load(finalPdf.bytes)).getPageCount() >
          (await PDFDocument.load(source.bytes)).getPageCount(),
      );
      assert.equal(
        (await db.query.partnerAccounts.findFirst({
          where: eq(schema.partnerAccounts.id, f.partnerId),
        }))!.status,
        "pending",
      );
      assert.equal(complete.snapshot.financialConfigHash, c.snapshot.financialConfigHash);
      const financial = await (
        await import("../../src/lib/partners/agreement-finance")
      ).signedFinancialConfig(db, f.partnerId);
      assert.equal(financial?.contractId, id);
      for (const d of await db.query.partnerContractDeliveries.findMany({
        where: eq(schema.partnerContractDeliveries.contractId, id),
      }))
        await deliverContractEmail(d.id);
      const completedMail = (
        await db.query.partnerContractDeliveries.findMany({
          where: eq(schema.partnerContractDeliveries.contractId, id),
        })
      ).filter((d) => d.kind === "fully_executed");
      assert.equal(completedMail.length, 2);
      assert.ok(completedMail.every((d) => d.status === "sent"));
      await assert.rejects(
        signNativeAgreement(companyProof, signing(c.documentChecksum!, true), security),
        /signing_action_already_used/,
      );
    },
  );
  await check(
    "native evidence, archived bytes and executed versions detect tampering and reject mutation",
    async () => {
      const complete = await contractRow(db, id),
        manifest = await verifyNativeExecution(db, complete);
      const source = await privateContractDocument(id, "source", f.userId, false);
      const signed = await privateContractDocument(id, "signed", f.userId, false);
      const audit = await privateContractDocument(id, "audit", "test-owner", true);
      const archivedEnvelope = JSON.parse(audit.bytes.toString());
      assert.doesNotThrow(() => verifyNativeFiles(archivedEnvelope, signed.bytes, source.bytes));
      assert.throws(() =>
        verifyNativeFiles(archivedEnvelope, Buffer.from("tampered"), source.bytes),
      );
      assert.throws(() =>
        verifyNativeFiles(archivedEnvelope, signed.bytes, Buffer.from("tampered")),
      );
      const altered = structuredClone(manifest.receipts[0]);
      altered.payload.legalName = "Forged signer";
      assert.throws(
        () => verifyNativeAttestation(altered),
        /native_evidence_integrity_check_failed/,
      );
      const envelope = attestNative({ fixture: true });
      envelope.signature = "invalid";
      assert.throws(
        () => verifyNativeAttestation(envelope),
        /native_evidence_integrity_check_failed/,
      );
      for (const table of ["PartnerContractNativeSignature", "PartnerContractArtifact"]) {
        await assert.rejects(pool.query(`delete from "${table}" where "contractId"=$1`, [id]));
      }
      await assert.rejects(
        pool.query(
          'update "PartnerContractNativeSignature" set payload=\'{}\' where "contractId"=$1',
          [id],
        ),
      );
      await assert.rejects(
        pool.query("update \"PartnerContract\" set status='generated' where id=$1", [id]),
      );
      for (const artifactId of [complete.signedArtifactId!, complete.auditArtifactId!]) {
        // Deliberate physical corruption in this disposable local fixture verifies read checks.
        const row = (
          await pool.query('select "encryptedBytes" from "PartnerContractArtifact" where id=$1', [
            artifactId,
          ])
        ).rows[0];
        await pool.query(
          'alter table "PartnerContractArtifact" disable trigger partner_contract_append_only',
        );
        try {
          await pool.query('update "PartnerContractArtifact" set "encryptedBytes"=$1 where id=$2', [
            Buffer.alloc(50),
            artifactId,
          ]);
          await assert.rejects(
            verifyNativeExecution(db, complete),
            /document_integrity_check_failed/,
          );
        } finally {
          await pool.query('update "PartnerContractArtifact" set "encryptedBytes"=$1 where id=$2', [
            row.encryptedBytes,
            artifactId,
          ]);
          await pool.query(
            'alter table "PartnerContractArtifact" enable trigger partner_contract_append_only',
          );
        }
      }
    },
  );
  await check("native activation retains explicit confirmation and owner gates", async () => {
    await assert.rejects(
      activateExecutedContract(id, "test-owner", "Reviewed native agreement", false),
      /explicit_activation_confirmation_required/,
    );
    const cap = process.env.PARTNER_CONTRACT_LIVE_ENABLED;
    process.env.PARTNER_CONTRACT_LIVE_ENABLED = "false";
    await assert.rejects(
      activateExecutedContract(id, "test-owner", "Live gate disabled must reject", true),
    );
    process.env.PARTNER_CONTRACT_LIVE_ENABLED = cap;
    await pool.query("begin");
    await assert.rejects(
      pool.query("update \"PartnerAccount\" set status='active' where id=$1", [f.partnerId]),
    );
    await pool.query("rollback");
    await activateExecutedContract(
      id,
      "test-owner",
      "Explicit reviewed native fixture activation",
      true,
    );
    assert.equal(
      (await db.query.partnerAccounts.findFirst({
        where: eq(schema.partnerAccounts.id, f.partnerId),
      }))!.status,
      "active",
    );
  });
  await check(
    "native verification budgets, renewal and cancellation revoke signing capabilities",
    async () => {
      const other = await fixture(),
        otherId = (await prepareContract(other.id)).contractId!;
      await sendContract(otherId);
      const old = await invite(otherId, "partner"),
        value = await code(old.raw, old.email);
      const incorrect = value === "100000" ? "100001" : "100000";
      for (let n = 0; n < 5; n++)
        await assert.rejects(verifyNativeCode(old.raw, old.email, incorrect));
      await assert.rejects(
        verifyNativeCode(old.raw, old.email, value),
        /signing_verification_expired/,
      );
      await assert.rejects(
        requestNativeCode(old.raw, old.email),
        /signing_verification_budget_exhausted/,
      );
      await assert.rejects(
        renewNativeInvitation(
          otherId,
          "test-owner",
          "Renew invitation after verified operator review",
          false,
        ),
      );
      await renewNativeInvitation(
        otherId,
        "test-owner",
        "Renew invitation after verified operator review",
        true,
      );
      await assert.rejects(
        requestNativeCode(old.raw, old.email),
        /signing_invitation_used_or_revoked/,
      );
      const replacement = await invite(otherId, "partner"),
        newCode = await code(replacement.raw, replacement.email);
      const proof = await verifyNativeCode(replacement.raw, replacement.email, newCode);
      await reviewNativeAgreement(proof);
      await renewNativeInvitation(
        otherId,
        "test-owner",
        "Operator renews and revokes previous verified session",
        true,
      );
      await assert.rejects(reviewNativeAgreement(proof), /signing_session_expired/);
      await cancelContract(otherId, "test-owner", "Cancel synthetic native request");
      assert.equal((await contractRow(db, otherId)).status, "cancelled");
      await assert.rejects(
        activateExecutedContract(otherId, "test-owner", "Cancelled native cannot activate", true),
      );
    },
  );
}
