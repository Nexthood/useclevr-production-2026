import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL, eq } from "drizzle-orm";
async function main() {
  const base = "postgresql://postgres@127.0.0.1:55438/partner_tests";
  const namespace = `contract_test_${Date.now()}`;
  const adminPool = new Pool({ connectionString: base });
  await adminPool.query(`create schema "${namespace}"`);
  await adminPool.end();
  const target = `${base}?options=-csearch_path%3D${namespace}`;
  Object.assign(process.env, {
    DATABASE_URL: target,
    DIRECT_URL: "",
    NEON_USE_SERVERLESS: "false",
    NEON_USE_WS_POOL: "false",
    NODE_ENV: "test",
    PARTNER_CONTRACTS_ENABLED: "true",
    PARTNER_CONTRACT_SIGNING_MODE: "mock",
    PARTNER_CONTRACT_ENCRYPTION_KEY_ID: "local-fixture",
    PARTNER_CONTRACT_ENCRYPTION_KEYS: JSON.stringify({
      "local-fixture": randomBytes(32).toString("base64"),
    }),
    PARTNER_CONTRACT_OWNER_USER_IDS: "test-owner",
    PARTNER_CONTRACT_COMPANY_SIGNER_REFS: "atlas-fixture",
    PARTNER_CONTRACT_PUBLIC_ORIGIN: "https://fixture.example.invalid",
    PARTNER_CONTRACT_RETENTION_DAYS: "30",
    PARTNER_CONTRACT_MONTHLY_SEND_LIMIT: "10",
    PARTNER_CONTRACT_LIVE_ENABLED: "true",
    DROPBOX_SIGN_ACCOUNT_ID: "fixture-account",
    DROPBOX_SIGN_CLIENT_ID: "fixture-app",
    DROPBOX_SIGN_API_KEY: randomBytes(24).toString("hex"),
    RESEND_API_KEY: randomBytes(24).toString("hex"),
  });
  const pool = new Pool({ connectionString: target });
  const schema = await import("../../src/lib/db/schema");
  const dialect = new PgDialect();
  const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
  for (const table of [
    schema.users,
    schema.profiles,
    schema.referralStats,
    schema.referralAttributions,
    schema.referralEvents,
    schema.userCredits,
    schema.creditLedger,
  ]) {
    const config = getTableConfig(table);
    const columns = config.columns.map((c) => {
      let value = `${quote(c.name)} ${c.getSQLType()}${c.primary ? " primary key" : ""}${c.notNull ? " not null" : ""}${c.isUnique ? " unique" : ""}`;
      if (c.default !== undefined) {
        const def =
          c.default instanceof SQL
            ? dialect.sqlToQuery(c.default).sql
            : typeof c.default === "number" || typeof c.default === "boolean"
              ? String(c.default)
              : `'${(typeof c.default === "object" ? JSON.stringify(c.default) : String(c.default)).replace(/'/g, "''")}'`;
        value += ` default ${def}`;
      }
      return value;
    });
    await pool.query(`create table ${quote(config.name)} (${columns.join(",")})`);
    for (const index of config.indexes) {
      const cols = index.config.columns.map((c) => ("name" in c ? quote(String(c.name)) : null));
      if (cols.every(Boolean))
        await pool.query(
          `create ${index.config.unique ? "unique " : ""}index if not exists ${quote(index.config.name!)} on ${quote(config.name)} (${cols.join(",")})`,
        );
    }
  }

  for (const file of [
    "0038_global_partner_program.sql",
    "0039_partner_policy_controls.sql",
    "0040_partner_applications.sql",
    "0041_reseller_review.sql",
    "0042_public_partner_applications.sql",
  ]) {
    await pool.query(
      await readFile(new URL(`../../src/lib/db/migrations/${file}`, import.meta.url), "utf8"),
    );
  }
  const {
    contractDatabase,
    submitContractIdentity,
    reviewContractIdentity,
    createSchedule,
    approveVersion,
    approveRuntime,
    registerCatalog,
  } = await import("../../src/lib/partners/contracts/records");
  const { prepareContract, sendContract, reconcileContract, advanceMock, cancelContract } =
    await import("../../src/lib/partners/contracts/lifecycle");
  const { activateExecutedContract } = await import("../../src/lib/partners/contracts/activation");
  const { privateContractDocument } = await import("../../src/lib/partners/contracts/access");
  const { deliverContractEmail, retryContractDelivery } =
    await import("../../src/lib/partners/contracts/mail");
  const { acceptDropboxWebhook, runContractWorker } =
    await import("../../src/lib/partners/contracts/worker");
  const { hashObject, runtimePolicy, commercialFieldNames, verifySignatures } =
    await import("../../src/lib/partners/contracts/domain");
  const { defaultConfig } = await import("../../src/lib/partners/rules");
  const db = contractDatabase();
  let passed = 0;
  const { getAccountReferralCode } = await import("../../src/lib/referrals/owner-code");
  async function check(name: string, f: () => Promise<void>) {
    await f();
    console.log(`PASS ${name}`);
    passed++;
  }
  await db.insert(schema.users).values([
    { id: "legacy", email: "legacy@example.invalid", emailVerified: new Date() },
    { id: "test-owner", email: "owner@example.invalid", emailVerified: new Date() },
  ]);
  await db.insert(schema.partnerAccounts).values({
    id: "legacy",
    userId: "legacy",
    code: await getAccountReferralCode("legacy", "legacy@example.invalid"),
    name: "Legacy fixture",
    country: "US",
    agreement: "Existing agreement",
    status: "active",
  });
  const before = await db.query.partnerAccounts.findMany();
  const migration = await readFile(
    new URL("../../src/lib/db/migrations/0043_partner_contracts.sql", import.meta.url),
    "utf8",
  );
  await check(
    "0043 transactional migration, repeatability and existing active partner preservation",
    async () => {
      for (let i = 0; i < 2; i++) {
        const client = await pool.connect();
        try {
          await client.query("begin");
          await client.query(migration);
          await client.query("commit");
        } finally {
          client.release();
        }
      }
      assert.deepEqual(await db.query.partnerAccounts.findMany(), before);
    },
  );
  await db.insert(schema.partnerConfigs).values({
    id: "fixture-policy",
    config: defaultConfig,
    actor: "test-owner",
    reason: "Synthetic fixture only",
    effectiveAt: new Date("2020-01-01Z"),
  });
  const originalConfig = hashObject((await db.query.partnerConfigs.findFirst())!.config);
  let sequence = 0;
  async function fixture(type: "independent_sales" | "authorized_reseller" = "independent_sales") {
    const id = `fixture-${++sequence}`,
      userId = `${id}-user`,
      partnerId = `${id}-partner`,
      email = `${id}@example.invalid`;
    await db
      .insert(schema.users)
      .values({ id: userId, email, emailVerified: new Date(), name: "Fixture Partner" });
    await db.insert(schema.partnerAccounts).values({
      id: partnerId,
      userId,
      code: await getAccountReferralCode(userId, email),
      name: "Fixture Partner",
      country: "US",
      agreement: "Agreement pending",
      status: "pending",
    });
    await db.insert(schema.partnerApplications).values({
      id,
      program: type === "independent_sales" ? "work_with_us" : "reseller_enterprise",
      category: type === "independent_sales" ? "Referral Partner" : "MSP",
      fullName: "Fixture Partner",
      email,
      country: "US",
      experience: "Synthetic lifecycle fixture",
      privacyAcceptedAt: new Date(),
      privacyVersion: "fixture",
      status: "approved",
      reviewedBy: "test-owner",
      reviewedAt: new Date(),
      linkedUserId: userId,
      partnerAccountId: partnerId,
      onboardedAt: new Date(),
    });
    const profile = await submitContractIdentity(userId, id, {
      legalName: "Fixture Partner LLC",
      entityType: "company",
      registrationId: "LOCAL-FIXTURE",
      address: "123 Synthetic Test Street",
      country: "US",
      signerName: "Fixture Partner",
      signerTitle: "Director",
      authorityConfirmed: true,
      electronicRecordsConsent: true,
    });
    await reviewContractIdentity(
      "test-owner",
      profile.id,
      "Synthetic identity reviewed in disposable test database",
    );
    const schedule = await createSchedule("test-owner", id, {
      version: "fixture-1",
      agreementType: type,
      company: {
        legalName: "Atlas Mega Ventures LLC",
        registrationId: "TEST-ONLY",
        registrationJurisdiction: "Synthetic jurisdiction",
        address: "123 Synthetic Owner Street",
        country: "US",
        noticeEmail: "owner@example.invalid",
      },
      companySigner: {
        reference: "atlas-fixture",
        name: "Fixture Company Signer",
        email: "company@example.invalid",
        title: "Authorized fixture signer",
      },
      terms: Object.fromEntries(
        commercialFieldNames.map((k) => [
          k,
          "Synthetic test terms only; no commercial rights or financial policy changes.",
        ]),
      ),
      financialConfigId: "fixture-policy",
      financialAlignmentConfirmed: true,
    });
    await approveVersion(
      "test-owner",
      "schedule",
      schedule.id,
      schedule.checksum,
      "Synthetic counsel review fixture only",
      true,
    );
    return { id, userId, partnerId, email, profile, schedule };
  }
  await registerCatalog(db);
  for (const t of await db.query.partnerContractTemplates.findMany())
    await approveVersion(
      "test-owner",
      "template",
      t.id,
      t.checksum,
      "Synthetic counsel review fixture only",
      true,
    );
  let mockId = "";
  await check(
    "mock complete ordered lifecycle, private PDF archive, emails and no activation",
    async () => {
      const f = await fixture();
      const p = await prepareContract(f.id);
      mockId = p.contractId!;
      assert.equal((await prepareContract(f.id)).contractId, mockId);
      await sendContract(mockId);
      await assert.rejects(advanceMock(mockId, "company"));
      await advanceMock(mockId, "partner");
      await reconcileContract(mockId);
      assert.equal(
        (await db.query.partnerContracts.findFirst({
          where: eq(schema.partnerContracts.id, mockId),
        }))!.status,
        "awaiting_company_signature",
      );
      await advanceMock(mockId, "company");
      await reconcileContract(mockId);
      const c = (await db.query.partnerContracts.findFirst({
        where: eq(schema.partnerContracts.id, mockId),
      }))!;
      assert.equal(c.status, "fully_executed");
      assert.ok(c.signedArtifactId && c.auditArtifactId);
      assert.equal(
        (await privateContractDocument(mockId, "signed", f.userId, false)).bytes
          .subarray(0, 5)
          .toString(),
        "%PDF-",
      );
      await assert.rejects(
        activateExecutedContract(mockId, "test-owner", "Synthetic manual review", true),
      );
      assert.equal(
        (await db.query.partnerAccounts.findFirst({
          where: eq(schema.partnerAccounts.id, f.partnerId),
        }))!.status,
        "pending",
      );
      for (const d of await db.query.partnerContractDeliveries.findMany({
        where: eq(schema.partnerContractDeliveries.contractId, mockId),
      }))
        await deliverContractEmail(d.id);
      assert.ok(
        (await db.query.partnerContractDeliveries.findMany()).every((d) => d.status === "sent"),
      );
    },
  );
  await check(
    "unauthorized private documents, immutable audit, artifacts and executed versions",
    async () => {
      await assert.rejects(privateContractDocument(mockId, "signed", "unrelated", false));
      for (const table of ["PartnerContractAudit", "PartnerContractArtifact", "PartnerContract"]) {
        await assert.rejects(
          pool.query(
            `delete from "${table}" where "${table === "PartnerContract" ? "id" : "contractId"}"=$1`,
            [mockId],
          ),
        );
      }
      await assert.rejects(
        pool.query(`update "PartnerContract" set "templateVersion"='tampered' where id=$1`, [
          mockId,
        ]),
      );
    },
  );
  let raw: any = null;
  let sendCalls = 0,
    emailCalls = 0,
    failCreation = false,
    failEmail = false;
  const emailKeys = new Set<string>();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://api.resend.com/emails") {
      emailCalls++;
      if (failEmail) return Response.json({ error: "fixture" }, { status: 503 });
      const key = new Headers(init?.headers).get("Idempotency-Key")!;
      emailKeys.add(key);
      return Response.json({ id: `mail-${key}` });
    }
    assert.ok(
      url.startsWith("https://api.hellosign.com/v3/"),
      "No other external network is allowed in fixture",
    );
    if (url.endsWith("/account"))
      return Response.json({ account: { account_id: "fixture-account" } });
    if (url.endsWith("/signature_request/send")) {
      sendCalls++;
      const form = init!.body as FormData;
      raw = {
        signature_request_id: `request-${sendCalls}`,
        test_mode: form.get("test_mode") === "1",
        is_complete: false,
        is_declined: false,
        has_error: false,
        metadata: Object.fromEntries(
          ["contract_id", "source_sha256", "partner_ref", "company_ref", "runtime_hash"].map(
            (k) => [k, form.get(`metadata[${k}]`)],
          ),
        ),
        signatures: [0, 1].map((i) => ({
          signature_id: `sig-${sendCalls}-${i}`,
          signer_email_address: form.get(`signers[${i}][email_address]`),
          signer_name: form.get(`signers[${i}][name]`),
          order: i,
          status_code: "awaiting_signature",
          signed_at: null,
        })),
      };
      if (failCreation) throw new Error("Synthetic connection loss after acceptance");
      return Response.json({ signature_request: raw });
    }
    if (url.includes("/signature_request/list"))
      return Response.json({ signature_requests: raw ? [raw] : [] });
    if (url.includes("/signature_request/files/"))
      return new Response(
        (await privateContractDocument(raw.metadata.contract_id, "source", "test-owner", true))
          .bytes,
        { headers: { "Content-Type": "application/pdf" } },
      );
    if (url.includes("/signature_request/remind/") || url.includes("/signature_request/cancel/"))
      return Response.json({});
    return Response.json({ signature_request: raw });
  }) as typeof fetch;
  process.env.PARTNER_CONTRACT_SIGNING_MODE = "dropbox_live";
  await approveRuntime(
    "test-owner",
    hashObject(runtimePolicy()),
    "Synthetic provider legal and privacy review",
    true,
  );
  let liveId = "";
  let livePartner = "";
  await check(
    "live-adapter fixture validates both signatures before manual activation; application state remains approved",
    async () => {
      const f = await fixture("authorized_reseller");
      livePartner = f.partnerId;
      liveId = (await prepareContract(f.id)).contractId!;
      await sendContract(liveId);
      assert.equal(raw.signatures[0].order, 0);
      assert.equal(raw.signatures[1].order, 1);
      await assert.rejects(
        activateExecutedContract(liveId, "test-owner", "Cannot activate unsigned fixture", true),
      );
      await assert.rejects(
        pool.query(`update "PartnerAccount" set status='active' where id=$1`, [f.partnerId]),
      );
      raw.is_complete = true;
      await assert.rejects(reconcileContract(liveId));
      raw.is_complete = false;
      raw.signatures[1].status_code = "signed";
      raw.signatures[1].signed_at = Math.floor(Date.now() / 1000);
      await assert.rejects(reconcileContract(liveId));
      raw.signatures[1].status_code = "awaiting_signature";
      raw.signatures[1].signed_at = null;
      raw.signatures[0].status_code = "signed";
      raw.signatures[0].signed_at = Math.floor(Date.now() / 1000);
      await reconcileContract(liveId);
      assert.equal(
        (await db.query.partnerContracts.findFirst({
          where: eq(schema.partnerContracts.id, liveId),
        }))!.status,
        "awaiting_company_signature",
      );
      raw.signatures[1].status_code = "signed";
      raw.signatures[1].signed_at = raw.signatures[0].signed_at;
      raw.is_complete = true;
      await reconcileContract(liveId);
      const c = (await db.query.partnerContracts.findFirst({
        where: eq(schema.partnerContracts.id, liveId),
      }))!;
      assert.equal(c.status, "fully_executed");
      assert.equal(
        (await db.query.partnerAccounts.findFirst({
          where: eq(schema.partnerAccounts.id, f.partnerId),
        }))!.status,
        "pending",
      );
      await assert.rejects(
        activateExecutedContract(liveId, "test-owner", "Synthetic manual activation", false),
      );
      await activateExecutedContract(
        liveId,
        "test-owner",
        "Synthetic explicit administrator activation",
        true,
      );
      assert.equal(
        (await db.query.partnerAccounts.findFirst({
          where: eq(schema.partnerAccounts.id, f.partnerId),
        }))!.status,
        "active",
      );
      assert.equal(
        (await db.query.partnerApplications.findFirst({
          where: eq(schema.partnerApplications.id, f.id),
        }))!.status,
        "approved",
      );
    },
  );
  function callback(time = String(Math.floor(Date.now() / 1000))) {
    const event_type = "signature_request_all_signed",
      event_hash = createHmac("sha256", process.env.DROPBOX_SIGN_API_KEY!)
        .update(time + event_type)
        .digest("hex");
    const json = JSON.stringify({
      event: {
        event_type,
        event_time: time,
        event_hash,
        event_metadata: {
          reported_for_account_id: "fixture-account",
          reported_for_app_id: "fixture-app",
        },
      },
      signature_request: { signature_request_id: raw.signature_request_id },
    });
    return {
      json,
      header: Buffer.from(
        createHmac("sha256", process.env.DROPBOX_SIGN_API_KEY!).update(json).digest("hex"),
      ).toString("base64"),
    };
  }
  await check(
    "authenticated callback, content tampering, replay idempotency and stale replay rejection",
    async () => {
      const b = callback();
      await assert.rejects(acceptDropboxWebhook(b.json, "invalid"));
      await assert.rejects(acceptDropboxWebhook(b.json + " ", b.header));
      assert.equal((await acceptDropboxWebhook(b.json, b.header)).duplicate, undefined);
      assert.equal((await acceptDropboxWebhook(b.json, b.header)).duplicate, true);
      const stale = callback(String(Math.floor(Date.now() / 1000) - 73 * 3600));
      await assert.rejects(acceptDropboxWebhook(stale.json, stale.header));
      assert.equal((await db.query.partnerContractWebhooks.findMany()).length, 1);
    },
  );
  await check(
    "delivery retries use stable idempotency keys and successful deliveries cannot be resent",
    async () => {
      const rows = await db.query.partnerContractDeliveries.findMany({
        where: eq(schema.partnerContractDeliveries.contractId, liveId),
      });
      const d = rows.find((d) => d.kind === "fully_executed")!;
      failEmail = true;
      await deliverContractEmail(d.id);
      assert.equal(
        (await db.query.partnerContractDeliveries.findFirst({
          where: eq(schema.partnerContractDeliveries.id, d.id),
        }))!.status,
        "pending",
      );
      failEmail = false;
      await retryContractDelivery(d.id, "test-owner");
      const count = emailCalls;
      await retryContractDelivery(d.id, "test-owner");
      assert.equal(emailCalls, count);
      assert.equal(emailKeys.size, 1);
      assert.equal(
        (await db.query.partnerContractDeliveries.findFirst({
          where: eq(schema.partnerContractDeliveries.id, d.id),
        }))!.status,
        "sent",
      );
    },
  );
  await check("ambiguous signature creation is reconciled without duplicate sending", async () => {
    const f = await fixture();
    const id = (await prepareContract(f.id)).contractId!;
    failCreation = true;
    await assert.rejects(sendContract(id));
    const count = sendCalls;
    await assert.rejects(sendContract(id));
    assert.equal(sendCalls, count);
    failCreation = false;
    await reconcileContract(id);
    assert.ok(
      (await db.query.partnerContracts.findFirst({ where: eq(schema.partnerContracts.id, id) }))!
        .providerReference,
    );
  });
  await check(
    "provider expiry closes request and keeps commercial activation disabled",
    async () => {
      raw.signatures[0].status_code = "expired";
      raw.signatures[1].status_code = "expired";
      raw.is_complete = false;
      const id = raw.metadata.contract_id;
      await reconcileContract(id);
      assert.equal(
        (await db.query.partnerContracts.findFirst({ where: eq(schema.partnerContracts.id, id) }))!
          .status,
        "expired",
      );
      await assert.rejects(
        activateExecutedContract(id, "test-owner", "Expired fixture must not activate", true),
      );
    },
  );
  await check(
    "unsigned activation remains blocked when feature is disabled and owner approval cannot be forged",
    async () => {
      process.env.PARTNER_CONTRACTS_ENABLED = "false";
      await assert.rejects(
        activateExecutedContract(mockId, "test-owner", "Disabled feature must fail closed", true),
      );
      process.env.PARTNER_CONTRACTS_ENABLED = "true";
      await assert.rejects(
        approveRuntime("unrelated", hashObject(runtimePolicy()), "Forged approval attempt", true),
      );
    },
  );
  await check(
    "route authentication, role checks, CSRF, private downloads and webhook body bounds",
    async () => {
      const { setSession } = await import("./mock-auth.mjs");
      const admin = await import("../../src/app/api/admin/partner-contracts/route");
      const partner = await import("../../src/app/api/partners/contracts/route");
      const docs = await import("../../src/app/api/partners/contracts/[id]/documents/[kind]/route");
      const callbackApi =
        await import("../../src/app/api/webhooks/partner-contracts/dropbox-sign/route");
      const workerApi = await import("../../src/app/api/internal/partner-contracts/run/route");
      setSession(null);
      assert.equal((await admin.GET()).status, 401);
      assert.equal((await partner.GET()).status, 401);
      setSession({ user: { id: "unrelated", role: "user" } });
      assert.equal((await admin.GET()).status, 403);
      assert.equal(
        (
          await docs.GET(new Request("https://fixture.example.invalid"), {
            params: Promise.resolve({ id: liveId, kind: "signed" }),
          })
        ).status,
        404,
      );
      setSession({ user: { id: "test-owner", role: "superadmin" } });
      assert.equal(
        (
          await admin.POST(
            new Request("https://fixture.example.invalid/api/admin/partner-contracts", {
              method: "POST",
              headers: {
                origin: "https://unrelated.example.invalid",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ action: "run" }),
            }),
          )
        ).status,
        403,
      );
      const download = await docs.GET(new Request("https://fixture.example.invalid"), {
        params: Promise.resolve({ id: liveId, kind: "signed" }),
      });
      assert.equal(download.status, 200);
      assert.equal(download.headers.get("Cache-Control"), "private, no-store");
      assert.equal(download.headers.get("X-Content-Type-Options"), "nosniff");
      assert.equal(
        (
          await callbackApi.POST(
            new Request(
              "https://fixture.example.invalid/api/webhooks/partner-contracts/dropbox-sign",
              { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
            ),
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await callbackApi.POST(
            new Request(
              "https://fixture.example.invalid/api/webhooks/partner-contracts/dropbox-sign",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "x".repeat(262145),
              },
            ),
          )
        ).status,
        502,
      );
      assert.equal(
        (
          await workerApi.POST(
            new Request("https://fixture.example.invalid/api/internal/partner-contracts/run", {
              method: "POST",
            }),
          )
        ).status,
        401,
      );
      const event = callback();
      const form = new FormData();
      form.set("json", event.json);
      const response = await callbackApi.POST(
        new Request("https://fixture.example.invalid/api/webhooks/partner-contracts/dropbox-sign", {
          method: "POST",
          headers: { "Content-Sha256": event.header },
          body: form,
        }),
      );
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "Hello API Event Received");
    },
  );
  await check("uncertain email outside provider idempotency window requires review", async () => {
    const d = (
      await db.query.partnerContractDeliveries.findMany({
        where: eq(schema.partnerContractDeliveries.contractId, liveId),
      })
    ).find((d) => d.status === "pending")!;
    await db
      .update(schema.partnerContractDeliveries)
      .set({
        status: "pending",
        lastErrorCode: "email_response_uncertain",
        idempotencyExpiresAt: new Date(Date.now() - 1000),
      })
      .where(eq(schema.partnerContractDeliveries.id, d.id));
    const count = emailCalls;
    await deliverContractEmail(d.id);
    assert.equal(
      (await db.query.partnerContractDeliveries.findFirst({
        where: eq(schema.partnerContractDeliveries.id, d.id),
      }))!.status,
      "uncertain",
    );
    await assert.rejects(retryContractDelivery(d.id, "test-owner"));
    assert.equal(emailCalls, count);
  });
  await check("worker preserves retry backoff and bounds concurrent claims", async () => {
    const { enqueueJob } = await import("../../src/lib/partners/contracts/records");
    await enqueueJob(db, "reconcile", "bounded-fixture", { contractId: mockId });
    await db
      .update(schema.partnerContractJobs)
      .set({ nextAttemptAt: new Date(Date.now() + 3600000), lastErrorCode: "fixture_backoff" })
      .where(eq(schema.partnerContractJobs.key, "bounded-fixture"));
    await enqueueJob(db, "reconcile", "bounded-fixture", { contractId: mockId });
    assert.equal(
      (await db.query.partnerContractJobs.findFirst({
        where: eq(schema.partnerContractJobs.key, "bounded-fixture"),
      }))!.lastErrorCode,
      "fixture_backoff",
    );
    const results = await Promise.all([runContractWorker(1, false), runContractWorker(1, false)]);
    assert.ok(results.every((r) => r.processed <= 1));
  });
  await check(
    "revoked provider approval generates non-binding drafts and cannot authorize activation",
    async () => {
      const inflight = await fixture();
      const inflightId = (await prepareContract(inflight.id)).contractId!;
      await sendContract(inflightId);
      await approveRuntime(
        "test-owner",
        hashObject(runtimePolicy()),
        "Synthetic owner revokes provider authorization",
        true,
        true,
      );
      raw.signatures.forEach((signature: any) => {
        signature.status_code = "signed";
        signature.signed_at = Math.floor(Date.now() / 1000);
      });
      raw.is_complete = true;
      await reconcileContract(inflightId);
      assert.equal(
        (await db.query.partnerContracts.findFirst({
          where: eq(schema.partnerContracts.id, inflightId),
        }))!.status,
        "fully_executed",
      );
      await assert.rejects(
        activateExecutedContract(
          inflightId,
          "test-owner",
          "Revocation blocks commercial activation",
          true,
        ),
      );
      const f = await fixture();
      const id = (await prepareContract(f.id)).contractId!;
      assert.equal(
        (await db.query.partnerContracts.findFirst({ where: eq(schema.partnerContracts.id, id) }))!
          .mode,
        "draft",
      );
      await assert.rejects(sendContract(id));
      await cancelContract(id, "test-owner", "Synthetic draft cancellation");
      assert.equal(
        (
          await db.query.partnerContractDeliveries.findMany({
            where: eq(schema.partnerContractDeliveries.contractId, id),
          })
        ).length,
        0,
      );
      assert.equal(
        (await db.query.partnerAccounts.findFirst({
          where: eq(schema.partnerAccounts.id, livePartner),
        }))!.status,
        "active",
      );
    },
  );
  await check(
    "migration rollback keeps evidence; repeat migration keeps executed agreements and financial policy intact",
    async () => {
      const contracts = await db.query.partnerContracts.findMany();
      await pool.query(migration);
      assert.deepEqual(await db.query.partnerContracts.findMany(), contracts);
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(migration);
        await client.query("rollback");
      } finally {
        client.release();
      }
      assert.equal(hashObject((await db.query.partnerConfigs.findFirst())!.config), originalConfig);
      assert.equal((await db.query.partnerCommissions.findMany()).length, 0);
      assert.equal((await db.query.partnerPayouts.findMany()).length, 0);
      assert.equal(
        (await db.query.partnerAccounts.findFirst({
          where: eq(schema.partnerAccounts.id, "legacy"),
        }))!.status,
        "active",
      );
    },
  );
  console.log(
    `${passed} contract integration groups passed; external calls intercepted; no production data used.`,
  );
  await pool.end();
  process.exit(0);
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack, cause: error.cause }
      : "Contract fixture failed",
  );
  process.exit(1);
});
