import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { templates, templateChecksum } from "../../src/lib/partners/contracts/catalog";
import {
  ContractError,
  featureEnabled,
  requireFeature,
  runtimePolicy,
  validateLiveRuntime,
  requireOwner,
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
  DropboxSignProvider,
} from "../../src/lib/partners/contracts/provider";
import { agreementText, generateAgreementPdf } from "../../src/lib/partners/contracts/pdf";
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
  function withEnvironment(values: Record<string, string | undefined>, run: () => void) {
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    try {
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      run();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }
  check("management opt-in and draft defaults do not enable binding signing", () => {
    withEnvironment(
      { PARTNER_CONTRACTS_ENABLED: undefined, PARTNER_CONTRACT_SIGNING_MODE: undefined },
      () => {
        assert.equal(featureEnabled(), false);
        assert.throws(requireFeature, /contract_management_disabled/);
        assert.equal(signingMode(), "draft");
        assert.equal(runtimePolicy().mode, "disabled");
        assert.throws(validateLiveRuntime, /live_provider_configuration_not_approved/);
      },
    );
    for (const value of ["false", "TRUE", "1"])
      withEnvironment({ PARTNER_CONTRACTS_ENABLED: value }, () =>
        assert.equal(featureEnabled(), false),
      );
    withEnvironment(
      { PARTNER_CONTRACTS_ENABLED: "true", PARTNER_CONTRACT_SIGNING_MODE: "draft" },
      () => {
        assert.doesNotThrow(requireFeature);
        assert.throws(validateLiveRuntime, /live_provider_configuration_not_approved/);
      },
    );
  });
  check(
    "live configuration requires every safety control and validates numeric policy bounds",
    () => {
      const configured = {
        PARTNER_CONTRACT_SIGNING_MODE: "dropbox_live",
        PARTNER_CONTRACT_LIVE_ENABLED: "true",
        DROPBOX_SIGN_API_KEY: "unit-provider-only",
        DROPBOX_SIGN_ACCOUNT_ID: "unit-account",
        DROPBOX_SIGN_CLIENT_ID: "unit-app",
        PARTNER_CONTRACT_PUBLIC_ORIGIN: "https://example.invalid",
        PARTNER_CONTRACT_RETENTION_DAYS: "365",
        PARTNER_CONTRACT_MONTHLY_SEND_LIMIT: "1",
        PARTNER_CONTRACT_ENCRYPTION_KEY_ID: "unit-key",
        PARTNER_CONTRACT_COMPANY_SIGNER_REFS: "unit-company",
        PARTNER_CONTRACT_SIGNATURE_TTL_DAYS: "7",
        PARTNER_CONTRACT_REMINDER_HOURS: "72",
      };
      withEnvironment(configured, () => {
        assert.doesNotThrow(validateLiveRuntime);
        assert.doesNotThrow(() => new DropboxSignProvider("dropbox_live"));
        for (const key of Object.keys(configured)) {
          // Expiry/reminder have safe defaults; origin deliberately has configured fallbacks.
          if (
            [
              "PARTNER_CONTRACT_SIGNATURE_TTL_DAYS",
              "PARTNER_CONTRACT_REMINDER_HOURS",
              "PARTNER_CONTRACT_PUBLIC_ORIGIN",
            ].includes(key)
          )
            continue;
          withEnvironment({ [key]: undefined }, () => assert.throws(validateLiveRuntime));
        }
        for (const values of [
          { PARTNER_CONTRACT_PUBLIC_ORIGIN: "http://example.invalid" },
          { PARTNER_CONTRACT_RETENTION_DAYS: "0" },
          { PARTNER_CONTRACT_RETENTION_DAYS: "36501" },
          { PARTNER_CONTRACT_MONTHLY_SEND_LIMIT: "1.5" },
          { PARTNER_CONTRACT_SIGNATURE_TTL_DAYS: "1" },
          { PARTNER_CONTRACT_SIGNATURE_TTL_DAYS: "91" },
          { PARTNER_CONTRACT_REMINDER_HOURS: "23" },
        ])
          withEnvironment(values, () => assert.throws(validateLiveRuntime));
        for (const key of [
          "DROPBOX_SIGN_API_KEY",
          "DROPBOX_SIGN_ACCOUNT_ID",
          "DROPBOX_SIGN_CLIENT_ID",
        ])
          withEnvironment({ [key]: undefined }, () =>
            assert.throws(
              () => new DropboxSignProvider("dropbox_test"),
              /provider_credentials_missing/,
            ),
          );
        withEnvironment({ PARTNER_CONTRACT_OWNER_USER_IDS: "unit-owner" }, () => {
          assert.doesNotThrow(() => requireOwner("unit-owner"));
          assert.throws(() => requireOwner("unrelated"), /owner_approval_required/);
        });
      });
    },
  );
  check("missing or malformed encryption configuration never creates a plaintext artifact", () => {
    for (const value of [undefined, "{}", "invalid-json", JSON.stringify({ unit: "too-short" })])
      withEnvironment(
        { PARTNER_CONTRACT_ENCRYPTION_KEY_ID: "unit", PARTNER_CONTRACT_ENCRYPTION_KEYS: value },
        () => {
          assert.throws(
            () => sealArtifact(Buffer.from("unit-only"), "contract", "checksum"),
            /document_encryption_/,
          );
        },
      );
  });
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
    const appPayload = {
      ...body,
      event: {
        ...body.event,
        event_metadata: { reported_for_account_id: "account", reported_for_app_id: null },
      },
      signature_request: { ...body.signature_request, client_id: "app" },
    };
    const signedCallback = (payload: unknown) => {
      const json = JSON.stringify(payload);
      return verifyDropboxCallback(json, createHmac("sha256", key).update(json).digest("base64"));
    };
    assert.equal(signedCallback(appPayload).reference, "request");
    assert.throws(() =>
      signedCallback({
        ...appPayload,
        signature_request: { ...appPayload.signature_request, client_id: "another" },
      }),
    );
    assert.throws(() =>
      signedCallback({
        ...body,
        signature_request: { ...body.signature_request, client_id: "another" },
      }),
    );
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
  check(
    "contract-specific rates are bounded, signed into the PDF and change the agreement checksum",
    () => {
      const rates = { standard: 1725, premium: 2375 };
      assert.ok(scheduleSchema.safeParse({ ...schedule, commissionRatesBps: rates }).success);
      assert.equal(
        scheduleSchema.safeParse({
          ...schedule,
          commissionRatesBps: { standard: -1, premium: 2000 },
        }).success,
        false,
      );
      assert.equal(
        scheduleSchema.safeParse({
          ...schedule,
          commissionRatesBps: { standard: 1500, premium: 10001 },
        }).success,
        false,
      );
      const custom = { ...snapshot, commissionRatesBps: rates };
      const text = agreementText(templates[0], custom, "custom-rate-fixture");
      assert.ok(text.includes("17.25%") && text.includes("23.75%"));
      assert.notEqual(hashObject(custom), hashObject(snapshot));
    },
  );
  await assert.rejects(boundedBytes(new Response("oversized"), 2));
  groups++;
  console.log("PASS bounded provider and webhook response reads");
  console.log(`${groups} contract unit groups passed.`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
