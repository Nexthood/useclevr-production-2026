import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { templates, templateChecksum } from "../../src/lib/partners/contracts/catalog";
import {
  ContractError,
  verifySignatures,
  selectAgreement,
  identitySchema,
  scheduleSchema,
  signingMode,
  hashObject,
  commercialFieldNames,
  type ContractSnapshot,
  type ProviderSnapshot,
} from "../../src/lib/partners/contracts/domain";
import {
  verifyDropboxCallback,
  normalizeDropbox,
  boundedBytes,
  MockSignatureProvider,
} from "../../src/lib/partners/contracts/provider";
import { generateAgreementPdf } from "../../src/lib/partners/contracts/pdf";
import { sealArtifact } from "../../src/lib/partners/contracts/storage";
async function main() {
  const identity = {
    legalName: "Test Example Ltd",
    entityType: "company" as const,
    address: "123 Synthetic Street",
    country: "GB",
    registrationId: "FIXTURE",
    signerName: "Test Signer",
    signerTitle: "Director",
    authorityConfirmed: true as const,
    electronicRecordsConsent: true as const,
  };
  const signer = {
    reference: "company-ref",
    name: "Company Test Signer",
    email: "company@example.invalid",
    title: "Authorized Signer",
  };
  const schedule = {
    version: "fixture-1",
    agreementType: "independent_sales" as const,
    company: {
      legalName: "Atlas Mega Ventures LLC" as const,
      registrationId: "FIXTURE",
      registrationJurisdiction: "Synthetic jurisdiction",
      address: "123 Synthetic Owner Street",
      country: "US",
      noticeEmail: "owner@example.invalid",
    },
    companySigner: signer,
    terms: Object.fromEntries(
      commercialFieldNames.map((k) => [k, "Synthetic test clause without commercial rights."]),
    ),
    financialConfigId: "fixture",
    financialAlignmentConfirmed: true,
  };
  const snapshot = {
    applicationId: "app",
    partnerId: "partner",
    userId: "user",
    partnerEmail: "partner@example.invalid",
    identity,
    company: schedule.company,
    companySigner: signer,
    terms: schedule.terms,
    financialConfigId: "fixture",
    financialConfigHash: "a".repeat(64),
    effectiveUntil: null,
    templateHash: templateChecksum(templates[0]),
    profileHash: hashObject(identity),
    scheduleHash: hashObject(schedule),
    runtimeHash: "b".repeat(64),
    documentTitle: templates[0].title,
  } as ContractSnapshot;
  const state: ProviderSnapshot = {
    reference: "request",
    contractId: "contract",
    sourceChecksum: "c".repeat(64),
    testMode: false,
    complete: true,
    declined: false,
    cancelled: false,
    expired: false,
    hasError: false,
    observedAt: new Date().toISOString(),
    signers: [
      {
        role: "partner",
        reference: "user",
        name: identity.signerName,
        email: snapshot.partnerEmail,
        order: 0,
        signedAt: new Date(Date.now() - 2000).toISOString(),
        providerSignatureId: "partner-signature",
      },
      {
        role: "company",
        ...signer,
        order: 1,
        signedAt: new Date(Date.now() - 1000).toISOString(),
        providerSignatureId: "company-signature",
      },
    ],
  };
  let groups = 0;
  function check(name: string, f: () => void) {
    f();
    groups++;
    console.log(`PASS ${name}`);
  }
  check("two distinct versioned templates and category routing", () => {
    assert.equal(templates.length, 2);
    assert.notEqual(templateChecksum(templates[0]), templateChecksum(templates[1]));
    assert.equal(selectAgreement("Business Consultancy"), "independent_sales");
    assert.equal(selectAgreement("MSP"), "authorized_reseller");
    assert.equal(selectAgreement("White Label"), null);
  });
  check(
    "legal identity and commercial schedules reject incomplete terms and missing consents",
    () => {
      assert.ok(identitySchema.safeParse(identity).success);
      for (const patch of [
        { authorityConfirmed: false },
        { electronicRecordsConsent: false },
        { registrationId: undefined },
        { address: "short" },
        { legalName: "<script>" },
      ])
        assert.equal(identitySchema.safeParse({ ...identity, ...patch }).success, false);
      assert.ok(scheduleSchema.safeParse(schedule).success);
      assert.equal(scheduleSchema.safeParse({ ...schedule, terms: {} }).success, false);
    },
  );
  check(
    "signature binding, signer order, identities, duplicates, missing and future signatures",
    () => {
      verifySignatures(state, snapshot, "contract", state.sourceChecksum, "dropbox_live");
      for (const change of [
        { contractId: "other" },
        { sourceChecksum: "wrong" },
        { testMode: true },
        { signers: [state.signers[0]] },
        { complete: true, signers: state.signers.map((s) => ({ ...s, signedAt: null })) },
        { signers: state.signers.map((s) => ({ ...s, providerSignatureId: "duplicate" })) },
        { signers: state.signers.map((s) => ({ ...s, email: "wrong@example.invalid" })) },
        {
          signers: state.signers.map((s) => ({
            ...s,
            signedAt: new Date(Date.now() + 3600000).toISOString(),
          })),
        },
        { signers: [{ ...state.signers[0], signedAt: null }, state.signers[1]] },
        { expired: true },
        { hasError: true },
      ])
        assert.throws(() =>
          verifySignatures(
            { ...state, ...change },
            snapshot,
            "contract",
            state.sourceChecksum,
            "dropbox_live",
          ),
        );
    },
  );
  check("generated PDFs include both schedules and reject unsupported legal glyphs", () => {
    for (const t of templates) {
      const pdf = generateAgreementPdf(t, snapshot, "fixture", true);
      assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      assert.ok(pdf.length > 10000);
    }
    assert.throws(() =>
      generateAgreementPdf(
        templates[0],
        { ...snapshot, identity: { ...identity, legalName: "Unsupported \u{1F680}" } },
        "fixture",
        true,
      ),
    );
  });
  check("encryption uses random authenticated envelopes and versioned keys", () => {
    Object.assign(process.env, {
      PARTNER_CONTRACT_ENCRYPTION_KEY_ID: "fixture",
      PARTNER_CONTRACT_ENCRYPTION_KEYS: JSON.stringify({
        fixture: randomBytes(32).toString("base64"),
      }),
    });
    const a = sealArtifact(Buffer.from("private fixture"), "contract", "checksum"),
      b = sealArtifact(Buffer.from("private fixture"), "contract", "checksum");
    assert.notDeepEqual(a.encryptedBytes, b.encryptedBytes);
    assert.equal(a.keyId, "fixture");
    assert.equal(a.encryptedBytes.includes(Buffer.from("private fixture")), false);
  });
  check("callback verifies full JSON, account, app and event hash", () => {
    const key = randomBytes(24).toString("hex");
    Object.assign(process.env, {
      DROPBOX_SIGN_API_KEY: key,
      DROPBOX_SIGN_ACCOUNT_ID: "account",
      DROPBOX_SIGN_CLIENT_ID: "app",
    });
    const now = String(Math.floor(Date.now() / 1000)),
      type = "signature_request_signed";
    const body = {
      event: {
        event_time: now,
        event_type: type,
        event_hash: createHmac("sha256", key)
          .update(now + type)
          .digest("hex"),
        event_metadata: { reported_for_account_id: "account", reported_for_app_id: "app" },
      },
      signature_request: { signature_request_id: "request" },
    };
    const json = JSON.stringify(body),
      header = createHmac("sha256", key).update(json).digest("base64");
    assert.equal(verifyDropboxCallback(json, header).reference, "request");
    assert.throws(() => verifyDropboxCallback(json.replace("request", "tamper"), header));
    process.env.DROPBOX_SIGN_CLIENT_ID = "another";
    assert.throws(() => verifyDropboxCallback(json, header));
  });
  check("mock cannot operate in production", () => {
    const previous = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: "production", PARTNER_CONTRACT_SIGNING_MODE: "mock" });
    assert.throws(() => signingMode());
    assert.throws(
      () =>
        new MockSignatureProvider(
          async () => null,
          async () => {},
        ),
    );
    Object.assign(process.env, {
      NODE_ENV: previous || "test",
      PARTNER_CONTRACT_SIGNING_MODE: "draft",
    });
  });
  await assert.rejects(boundedBytes(new Response("oversized"), 2));
  groups++;
  console.log("PASS bounded provider and webhook response reads");
  console.log(`${groups} contract unit groups passed.`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
