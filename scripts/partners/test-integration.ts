import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL, eq } from "drizzle-orm";

async function main() {
  // This runner has no configurable production target. Use only the documented disposable container.
  const base = "postgresql://postgres@127.0.0.1:55438/partner_tests";
  const namespace = `partner_test_${Date.now()}`;
  const adminPool = new Pool({ connectionString: base });
  await adminPool.query(`create schema "${namespace}"`);
  await adminPool.end();
  const target = `${base}?options=-csearch_path%3D${namespace}`;
  process.env.DATABASE_URL = target;
  process.env.DIRECT_URL = "";
  process.env.NEON_USE_SERVERLESS = "false";
  process.env.NEON_USE_WS_POOL = "false";
  Object.assign(process.env, { NODE_ENV: "test", PARTNER_PROGRAM_ENABLED: "true" });
  const pool = new Pool({ connectionString: target });
  const existing = await pool.query(
    "select tablename from pg_tables where schemaname=current_schema()",
  );
  assert.equal(
    existing.rows.length,
    0,
    "Integration database must be empty; runner never clears existing databases.",
  );
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
  const migration = await readFile(
    new URL("../../src/lib/db/migrations/0038_global_partner_program.sql", import.meta.url),
    "utf8",
  );
  await pool.query(migration);
  await pool.query(migration);
  const controls = await readFile(
    new URL("../../src/lib/db/migrations/0039_partner_policy_controls.sql", import.meta.url),
    "utf8",
  );
  await pool.query(controls);
  await pool.query(controls);
  console.log("PASS additive migrations 0038/0039 and repeat application");
  const {
    database,
    ingestPartnerEvent,
    partnerSummary,
    recordPayout,
    approveCommission,
    replayPartnerEvent,
    reviewPartnerEvent,
    refreshLevel,
    writeProgramConfig,
  } = await import("../../src/lib/partners/store");
  const { defaultConfig } = await import("../../src/lib/partners/rules");
  const { getAccountReferralCode } = await import("../../src/lib/referrals/owner-code");
  const { confirmReferralSignup, confirmReferralPaidConversion } =
    await import("../../src/lib/referrals/referral-lifecycle");
  const { invoiceEvidence, handlePartnerStripeEvent } =
    await import("../../src/services/stripe/partner-webhook");
  const { setSession } = await import("./mock-auth.mjs");
  const admin = await import("../../src/app/api/admin/partners/route");
  const owner = await import("../../src/app/api/partners/route");
  const db = database();
  let passed = 1;
  async function check(name: string, fn: () => Promise<void>) {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  }
  await db.insert(schema.users).values([
    { id: "partner-user", email: "partner@example.invalid", emailVerified: new Date() },
    { id: "customer", email: "customer@example.invalid", emailVerified: new Date() },
    { id: "other", email: "other@example.invalid", emailVerified: new Date() },
  ]);
  await db.insert(schema.profiles).values({
    id: "customer-profile",
    userId: "customer",
    email: "customer@example.invalid",
    stripeCustomerId: "cus_local",
  });
  let code = "";
  await check(
    "concurrent referral code resolution returns a stable account-owned identity",
    async () => {
      const codes = await Promise.all(
        Array.from({ length: 10 }, () =>
          getAccountReferralCode("partner-user", "partner@example.invalid"),
        ),
      );
      assert.equal(new Set(codes).size, 1);
      code = codes[0];
      assert.equal((await db.query.referralCodeOwners.findMany()).length, 1);
    },
  );
  const config = {
    ...defaultConfig,
    enabled: true,
    eligibilityAnchor: "first_payment" as const,
    suspendedAccrual: "hold" as const,
    terminatedAccrual: "stop" as const,
    downgradeGraceDays: 0,
    relatedParty: "exclude" as const,
    waitingDays: 0,
    minimumPayoutMinor: { USD: "1", EUR: "1" },
    postPayoutRefund: "offset" as const,
  };
  await db.insert(schema.partnerConfigs).values({
    id: "config-1",
    config,
    actor: "admin",
    reason: "Local test policy",
    createdAt: new Date("2020-01-01Z"),
    effectiveAt: new Date("2020-01-01Z"),
  });
  await db.insert(schema.partnerAccounts).values({
    id: "partner",
    userId: "partner-user",
    code,
    name: "Local partner",
    country: "MA",
    agreement: "local agreement",
    status: "active",
    approvedAt: new Date("2020-01-01Z"),
  });
  await check(
    "concurrent verified signup locks one commercial attribution and grants no customer reward",
    async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          confirmReferralSignup({
            referredUserId: "customer",
            referredEmail: "customer@example.invalid",
            attributionCode: code,
          }),
        ),
      );
      assert.equal(results.filter((r) => r.confirmed).length, 1);
      assert.equal((await db.query.partnerAttributions.findMany()).length, 1);
      assert.equal((await db.query.creditLedger.findMany()).length, 0);
      const shared = await db.query.referralAttributions.findFirst();
      assert.equal(shared?.signupRewardStatus, "none");
      const attr = await db.query.partnerAttributions.findFirst();
      await db
        .update(schema.partnerAttributions)
        .set({ relatedParty: "unrelated" })
        .where(eq(schema.partnerAttributions.id, attr!.id));
    },
  );
  await check("self-referral is rejected", async () => {
    const result = await confirmReferralSignup({
      referredUserId: "partner-user",
      referredEmail: "partner@example.invalid",
      attributionCode: code,
    });
    assert.equal(result.confirmed, false);
  });
  const now = new Date(),
    paidAt = new Date(now.getTime() - 1000).toISOString();
  const payment = {
    invoiceId: "in_one",
    chargeId: "ch_one",
    subscriptionId: "sub_one",
    customerId: "cus_local",
    userId: "customer",
    currency: "USD",
    grossMinor: "12000",
    netMinor: "10000",
    paidAt,
    subscriptionStatus: "active",
    subscriptionPeriodEnd: new Date(now.getTime() + 86400000 * 30).toISOString(),
  };
  await check(
    "concurrent and distinct Stripe event IDs create one payment and one 15% commission",
    async () => {
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          ingestPartnerEvent(`evt_${i}`, "invoice.payment_succeeded", "in_one", {
            kind: "payment",
            payment,
          }),
        ),
      );
      const rows = await db.query.partnerCommissions.findMany();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].amountMinor, "1500");
      assert.equal(rows[0].rateBps, 1500);
      const summary = await partnerSummary("partner");
      assert.equal(summary.activeCustomers, 1);
      assert.equal(summary.rateBps, 1500);
    },
  );
  await check("database blocks financial snapshot modifications and audit deletion", async () => {
    await assert.rejects(pool.query('update "PartnerPayment" set "netMinor"=1'));
    await assert.rejects(pool.query('update "PartnerCommission" set "rateBps"=2000'));
    await assert.rejects(pool.query('delete from "PartnerAudit"'));
  });
  await check(
    "approval and manual payout record settlement without transferring funds",
    async () => {
      const c = (await db.query.partnerCommissions.findMany())[0];
      await db.transaction((tx) => approveCommission(tx, c.id, "admin", "Local approval"));
      await db.transaction((tx) =>
        recordPayout(tx, "partner", "USD", "local-payment-1", "1500", "admin", "Local settlement"),
      );
      assert.equal((await db.query.partnerPayouts.findMany())[0].amountMinor, "1500");
    },
  );
  await check(
    "partial post-payout refund adjusts the original earned commission proportionally",
    async () => {
      await ingestPartnerEvent("evt_refund", "charge.refunded", "ch_one", {
        kind: "adjustment",
        chargeId: "ch_one",
        refundedGrossMinor: "3000",
        disputedGrossMinor: "0",
        observedAt: new Date().toISOString(),
      });
      await ingestPartnerEvent("evt_refund", "charge.refunded", "ch_one", {
        kind: "adjustment",
        chargeId: "ch_one",
        refundedGrossMinor: "3000",
        disputedGrossMinor: "0",
        observedAt: new Date().toISOString(),
      });
      const summary = await partnerSummary("partner");
      assert.equal(summary.balances.USD.liability, "-375");
      assert.equal(summary.adjustments.length, 1);
    },
  );
  await check("settled commissions cannot be paid twice or mixed across currencies", async () => {
    const count = (await db.query.partnerPayouts.findMany()).length;
    await assert.rejects(
      db.transaction((tx) =>
        recordPayout(
          tx,
          "partner",
          "USD",
          "duplicate-local-payment",
          "1500",
          "admin",
          "Duplicate check",
        ),
      ),
    );
    await assert.rejects(
      db.transaction((tx) =>
        recordPayout(
          tx,
          "partner",
          "EUR",
          "wrong-currency-payment",
          "1500",
          "admin",
          "Currency check",
        ),
      ),
    );
    assert.equal((await db.query.partnerPayouts.findMany()).length, count);
  });
  await check(
    "full chargeback, won dispute, and refund overlap reconcile without duplicate loss",
    async () => {
      await ingestPartnerEvent("evt_dispute", "charge.dispute.created", "ch_one", {
        kind: "adjustment",
        chargeId: "ch_one",
        refundedGrossMinor: "3000",
        disputedGrossMinor: "12000",
        observedAt: new Date(Date.now() + 1000).toISOString(),
      });
      assert.equal((await partnerSummary("partner")).balances.USD.earned, "0");
      await ingestPartnerEvent("evt_won", "charge.dispute.closed", "ch_one", {
        kind: "adjustment",
        chargeId: "ch_one",
        refundedGrossMinor: "3000",
        disputedGrossMinor: "0",
        observedAt: new Date(Date.now() + 2000).toISOString(),
      });
      assert.equal((await partnerSummary("partner")).balances.USD.earned, "1125");
    },
  );
  await check("missing FX evidence holds payment and stores no invented conversion", async () => {
    const result = await ingestPartnerEvent("evt_eur", "invoice.payment_succeeded", "in_eur", {
      kind: "payment",
      payment: {
        ...payment,
        invoiceId: "in_eur",
        chargeId: "ch_eur",
        currency: "EUR",
        paidAt: new Date().toISOString(),
      },
    });
    assert.equal(result.reason, "fx_rate_missing");
  });
  await db.insert(schema.partnerFxRates).values({
    id: "local-fx",
    currency: "EUR",
    day: new Date().toISOString().slice(0, 10),
    numerator: "11",
    denominator: "10",
    source: "https://example.invalid/local-test-fixture",
    actor: "test",
  });
  await check(
    "FX-backed recurring payment uses actual payment currency and traceable USD conversion",
    async () => {
      const replay = await replayPartnerEvent("evt_eur");
      assert.equal(replay.status, "processed");
      await ingestPartnerEvent("evt_eur_again", "invoice.payment_succeeded", "in_eur", {
        kind: "payment",
        payment: {
          ...payment,
          invoiceId: "in_eur",
          chargeId: "ch_eur",
          currency: "EUR",
          paidAt: new Date().toISOString(),
        },
      });
      const p = await db.query.partnerPayments.findFirst({
        where: eq(schema.partnerPayments.chargeId, "ch_eur"),
      });
      assert.equal(p?.currency, "EUR");
      assert.equal(p?.usdMinor, "11000");
      assert.equal(p?.fxRateId, "local-fx");
      assert.equal(
        (
          await db.query.partnerPayments.findMany({
            where: eq(schema.partnerPayments.chargeId, "ch_eur"),
          })
        ).length,
        1,
      );
    },
  );
  await check(
    "transaction failure rolls back payment and commission together; event remains retryable",
    async () => {
      await pool.query(
        `CREATE FUNCTION local_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'local rollback test'; END $$; CREATE TRIGGER local_test_failure BEFORE INSERT ON "PartnerCommission" FOR EACH ROW EXECUTE FUNCTION local_test_failure()`,
      );
      await assert.rejects(
        ingestPartnerEvent("evt_rollback", "invoice.payment_succeeded", "in_rollback", {
          kind: "payment",
          payment: {
            ...payment,
            invoiceId: "in_rollback",
            chargeId: "ch_rollback",
            paidAt: new Date().toISOString(),
          },
        }),
      );
      assert.equal(
        await db.query.partnerPayments.findFirst({
          where: eq(schema.partnerPayments.chargeId, "ch_rollback"),
        }),
        undefined,
      );
      assert.equal(
        (
          await db.query.partnerEvents.findFirst({
            where: eq(schema.partnerEvents.id, "evt_rollback"),
          })
        )?.status,
        "held",
      );
      await pool.query(
        'DROP TRIGGER local_test_failure ON "PartnerCommission"; DROP FUNCTION local_test_failure()',
      );
    },
  );
  await check(
    "cancellation removes the active customer without fabricating a reversal",
    async () => {
      await pool.query("update \"PartnerSubscription\" set status='canceled'");
      assert.equal((await partnerSummary("partner")).activeCustomers, 0);
      assert.equal((await db.query.partnerCommissions.findMany()).length, 2);
    },
  );
  await check("failed and out-of-band invoices do not qualify from active status", async () => {
    const fake = {
      id: "in_fail",
      status: "open",
      paid: false,
      paid_out_of_band: false,
      amount_paid: 0,
    } as never;
    assert.equal((await invoiceEvidence(fake, {} as never)).kind, "unsupported");
    const external = {
      id: "in_external",
      status: "paid",
      paid: true,
      paid_out_of_band: true,
      amount_paid: 10000,
    } as never;
    assert.equal((await invoiceEvidence(external, {} as never)).kind, "unsupported");
  });
  await check(
    "partner and admin endpoints enforce real session and superadmin guards",
    async () => {
      setSession(null);
      assert.equal((await owner.GET(new Request("http://localhost/api/partners"))).status, 401);
      setSession({ user: { id: "other", role: "user" } });
      assert.equal(
        (await admin.GET(new Request("http://localhost/api/admin/partners"))).status,
        403,
      );
      assert.equal(
        (await admin.POST(new Request("http://localhost/api/admin/partners", { method: "POST" })))
          .status,
        403,
      );
      assert.equal(
        (await owner.GET(new Request("http://localhost/api/partners?partnerId=partner"))).status,
        404,
      );
      setSession({ user: { id: "partner-user", role: "user" } });
      const r = await owner.GET(new Request("http://localhost/api/partners?partnerId=other"));
      assert.equal(r.status, 200);
      const data = await r.json();
      assert.equal(data.partner.id, "partner");
      assert.equal(data.attributions, undefined);
      assert.equal(data.audit, undefined);
      setSession({ user: { id: "local-admin", role: "superadmin" } });
      assert.equal(
        (await admin.GET(new Request("http://localhost/api/admin/partners"))).status,
        200,
      );
      assert.equal(
        (
          await admin.POST(
            new Request("http://localhost/api/admin/partners", {
              method: "POST",
              headers: { origin: "https://attacker.invalid" },
            }),
          )
        ).status,
        403,
      );
    },
  );
  await check(
    "successful invoice normalization verifies charge, ownership, taxes, and discounts",
    async () => {
      const fake = {
        charges: {
          retrieve: async () => ({
            id: "ch_verified",
            invoice: "in_verified",
            customer: "cus_local",
            paid: true,
            captured: true,
            status: "succeeded",
            amount: 12000,
            currency: "usd",
          }),
        },
        subscriptions: {
          retrieve: async () => ({
            id: "sub_one",
            customer: "cus_local",
            metadata: { userId: "customer" },
            status: "active",
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
          }),
        },
      };
      const invoice = {
        id: "in_verified",
        status: "paid",
        paid: true,
        paid_out_of_band: false,
        amount_paid: 12000,
        total: 12000,
        total_excluding_tax: 10000,
        currency: "usd",
        charge: "ch_verified",
        subscription: "sub_one",
        customer: "cus_local",
        status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
      };
      const evidence = await invoiceEvidence(invoice as never, fake as never);
      assert.equal(evidence.kind, "payment");
      if (evidence.kind === "payment") {
        assert.equal(evidence.payment.netMinor, "10000");
        assert.equal(evidence.payment.grossMinor, "12000");
      }
      assert.equal(
        (await invoiceEvidence({ ...invoice, amount_paid: 11000 } as never, fake as never)).kind,
        "unsupported",
      );
    },
  );
  await check(
    "active subscription and failed-payment events cannot create a commission",
    async () => {
      const before = (await db.query.partnerCommissions.findMany()).length;
      await handlePartnerStripeEvent(
        {
          type: "invoice.payment_failed",
          id: "evt_failed",
          data: { object: { id: "in_failed" } },
        } as never,
        {} as never,
      );
      assert.equal((await db.query.partnerCommissions.findMany()).length, before);
    },
  );
  async function customerFixture(userId: string, expiry?: Date) {
    await db
      .insert(schema.users)
      .values({ id: userId, email: `${userId}@example.invalid`, emailVerified: new Date() });
    const referralId = `ref-${userId}`;
    await db.insert(schema.referralAttributions).values({
      id: referralId,
      code,
      referrerUserId: "partner-user",
      referredUserId: userId,
      status: "signed_up",
      signupRewardStatus: "none",
      signupConfirmedAt: new Date("2020-01-01Z"),
    });
    await db.insert(schema.partnerAttributions).values({
      id: `attr-${userId}`,
      referralId,
      partnerId: "partner",
      userId,
      relatedParty: "unrelated",
      signedUpAt: new Date("2020-01-01Z"),
      ...(expiry ? { eligibilityStart: new Date("2020-01-01Z"), eligibilityEnd: expiry } : {}),
    });
  }
  await check(
    "100 verified active paying customers upgrade to Gold and earn a 20% snapshot",
    async () => {
      for (let i = 0; i < 99; i++) {
        const userId = `seed-${i}`;
        await customerFixture(userId);
        await db.insert(schema.partnerSubscriptions).values({
          id: `sub-${i}`,
          userId,
          status: "active",
          periodEnd: new Date(Date.now() + 86400000),
          eventCreated: 1,
        });
        await db.insert(schema.partnerPayments).values({
          id: `seed-payment-${i}`,
          invoiceId: `seed-invoice-${i}`,
          chargeId: `seed-charge-${i}`,
          subscriptionId: `sub-${i}`,
          attributionId: `attr-${userId}`,
          partnerId: "partner",
          currency: "USD",
          grossMinor: "100",
          netMinor: "100",
          usdMinor: "100",
          paidAt: new Date(Date.now() - 20000),
        });
      }
      await customerFixture("gold-customer");
      await ingestPartnerEvent("evt_gold", "invoice.payment_succeeded", "in_gold", {
        kind: "payment",
        payment: {
          ...payment,
          userId: "gold-customer",
          subscriptionId: "sub_gold",
          invoiceId: "in_gold",
          chargeId: "ch_gold",
          paidAt: new Date().toISOString(),
        },
      });
      const summary = await partnerSummary("partner");
      assert.equal(summary.activeCustomers, 100);
      assert.equal(summary.partner.level, "gold");
      const row = await db.query.partnerCommissions.findFirst({
        where: eq(
          schema.partnerCommissions.paymentId,
          (await db.query.partnerPayments.findFirst({
            where: eq(schema.partnerPayments.chargeId, "ch_gold"),
          }))!.id,
        ),
      });
      assert.equal(row?.rateBps, 2000);
      assert.equal(row?.amountMinor, "2000");
    },
  );
  await check(
    "full refund downgrades Gold to Silver without changing the historical rate",
    async () => {
      await ingestPartnerEvent("evt_gold_refund", "charge.refunded", "ch_gold", {
        kind: "adjustment",
        chargeId: "ch_gold",
        refundedGrossMinor: "12000",
        disputedGrossMinor: "0",
        observedAt: new Date().toISOString(),
      });
      const summary = await partnerSummary("partner");
      assert.equal(summary.activeCustomers, 99);
      assert.equal(summary.partner.level, "silver");
      assert.equal(summary.rateBps, 1500);
      const row = summary.commissions.find((c) => c.amountMinor === "2000");
      assert.equal(row?.rateBps, 2000);
      assert.equal(row?.state, "reversed");
    },
  );
  await check(
    "collected rolling USD revenue upgrades to Platinum and Diamond above customer levels",
    async () => {
      for (const [suffix, net, expected] of [
        ["platinum", "10000000", "platinum"],
        ["diamond", "20000000", "diamond"],
      ]) {
        await ingestPartnerEvent(`evt_${suffix}`, "invoice.payment_succeeded", `in_${suffix}`, {
          kind: "payment",
          payment: {
            ...payment,
            userId: "gold-customer",
            subscriptionId: "sub_gold",
            invoiceId: `in_${suffix}`,
            chargeId: `ch_${suffix}`,
            grossMinor: net,
            netMinor: net,
            paidAt: new Date().toISOString(),
          },
        });
        const summary = await partnerSummary("partner");
        assert.equal(summary.partner.level, expected);
        assert.equal(summary.rateBps, 2000);
      }
    },
  );
  await check(
    "twelve-month expiration records collected revenue without earning a commission",
    async () => {
      await customerFixture("expired-customer", new Date("2021-01-01Z"));
      const count = (await db.query.partnerCommissions.findMany()).length;
      await ingestPartnerEvent("evt_expired", "invoice.payment_succeeded", "in_expired", {
        kind: "payment",
        payment: {
          ...payment,
          userId: "expired-customer",
          subscriptionId: "sub_expired",
          invoiceId: "in_expired",
          chargeId: "ch_expired",
          paidAt: new Date().toISOString(),
        },
      });
      assert.equal((await db.query.partnerCommissions.findMany()).length, count);
      assert.ok(
        await db.query.partnerPayments.findFirst({
          where: eq(schema.partnerPayments.chargeId, "ch_expired"),
        }),
      );
    },
  );
  await check(
    "complete financial CSV and private data remain restricted to superadmins",
    async () => {
      setSession({ user: { id: "local-admin", role: "superadmin" } });
      const response = await admin.GET(
        new Request("http://localhost/api/admin/partners?partnerId=partner&export=csv"),
      );
      assert.equal(response.status, 200);
      const csv = await response.text();
      assert.ok(csv.includes('"rate_bps"'));
      assert.ok(csv.includes('"2000"'));
      assert.ok(!csv.includes("customer@example.invalid"));
      setSession({ user: { id: "partner-user", role: "user" } });
      assert.equal(
        (
          await admin.GET(
            new Request("http://localhost/api/admin/partners?partnerId=partner&export=csv"),
          )
        ).status,
        403,
      );
    },
  );
  await check(
    "ordinary customer signup and paid credit rewards remain separate and idempotent",
    async () => {
      const ordinaryCode = await getAccountReferralCode("other", "other@example.invalid");
      await db.insert(schema.users).values({
        id: "ordinary-customer",
        email: "ordinary@example.invalid",
        emailVerified: new Date(),
      });
      await db.insert(schema.userCredits).values({
        id: "ordinary-credits",
        userId: "other",
        planId: "local-free",
        totalCredits: 0,
        remainingCredits: 0,
        creditsResetAt: new Date(Date.now() + 86400000),
      });
      await confirmReferralSignup({
        referredUserId: "ordinary-customer",
        referredEmail: "ordinary@example.invalid",
        attributionCode: ordinaryCode,
      });
      assert.equal(
        (await db.query.userCredits.findFirst({ where: eq(schema.userCredits.userId, "other") }))
          ?.purchasedBalance,
        5,
      );
      await confirmReferralPaidConversion({
        referredUserId: "ordinary-customer",
        tier: "pro",
        evidence: { eventId: "local_customer_paid", subscriptionId: "local-sub" },
      });
      await confirmReferralPaidConversion({
        referredUserId: "ordinary-customer",
        tier: "pro",
        evidence: { eventId: "local_customer_duplicate", subscriptionId: "local-sub" },
      });
      assert.equal(
        (await db.query.userCredits.findFirst({ where: eq(schema.userCredits.userId, "other") }))
          ?.purchasedBalance,
        30,
      );
      assert.equal(
        (
          await db.query.partnerAttributions.findMany({
            where: eq(schema.partnerAttributions.userId, "ordinary-customer"),
          })
        ).length,
        0,
      );
    },
  );
  await check(
    "commercial reward exclusion and attribution ownership are database enforced",
    async () => {
      const attr = await db.query.partnerAttributions.findFirst();
      await assert.rejects(
        pool.query(
          'update "ReferralAttribution" set "signupRewardStatus"=\'pending\' where id=$1',
          [attr!.referralId],
        ),
      );
      await assert.rejects(
        pool.query('update "PartnerAttribution" set "userId"=\'other\' where id=$1', [attr!.id]),
      );
    },
  );
  const approved = { ...defaultConfig, enabled: true };
  await db.insert(schema.partnerConfigs).values({
    id: "approved-v1",
    config: approved,
    actor: "owner-fixture",
    reason: "Approved local policy fixture",
    effectiveAt: new Date("2021-01-01Z"),
  });
  const day = 86400000;
  async function fixture(label: string, related = "unrelated") {
    const ownerId = `owner-${label}`,
      userId = `customer-${label}`,
      partnerId = `partner-${label}`;
    await db.insert(schema.users).values([
      { id: ownerId, email: `${ownerId}@example.invalid`, emailVerified: new Date() },
      { id: userId, email: `${userId}@example.invalid`, emailVerified: new Date() },
    ]);
    const fixtureCode = await getAccountReferralCode(ownerId);
    await db.insert(schema.partnerAccounts).values({
      id: partnerId,
      userId: ownerId,
      code: fixtureCode,
      name: label,
      country: "NL",
      agreement: "Synthetic reviewed agreement",
      status: "active",
      approvedAt: new Date("2020-01-01Z"),
    });
    await db.insert(schema.referralAttributions).values({
      id: `ref-${label}`,
      code: fixtureCode,
      referrerUserId: ownerId,
      referredUserId: userId,
      signupRewardStatus: "none",
      signupConfirmedAt: new Date("2020-01-01Z"),
    });
    await db.insert(schema.partnerAttributions).values({
      id: `attr-${label}`,
      referralId: `ref-${label}`,
      partnerId,
      userId,
      relatedParty: related,
      signedUpAt: new Date("2020-01-01Z"),
    });
    return { partnerId, userId, ownerId, fixtureCode, label };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  async function paid(f: Fixture, suffix: string, ageDays = 45, net = "40000", currency = "USD") {
    const evidence = {
      ...payment,
      userId: f.userId,
      subscriptionId: `sub-${f.label}`,
      invoiceId: `in-${f.label}-${suffix}`,
      chargeId: `ch-${f.label}-${suffix}`,
      currency,
      netMinor: net,
      grossMinor: ((BigInt(net) * BigInt(12)) / BigInt(10)).toString(),
      paidAt: new Date(Date.now() - ageDays * day).toISOString(),
    };
    const eventId = `evt-${f.label}-${suffix}`;
    const result = await ingestPartnerEvent(
      eventId,
      "invoice.payment_succeeded",
      evidence.invoiceId,
      { kind: "payment", payment: evidence },
    );
    return { evidence, eventId, result };
  }
  async function commissionFor(chargeId: string) {
    const p = await db.query.partnerPayments.findFirst({
      where: eq(schema.partnerPayments.chargeId, chargeId),
    });
    return (
      p &&
      (await db.query.partnerCommissions.findFirst({
        where: eq(schema.partnerCommissions.paymentId, p.id),
      }))
    );
  }
  async function adminAction(
    body: Record<string, unknown>,
    reason = "Synthetic owner-authorized review",
  ) {
    setSession({ user: { id: "local-admin", role: "superadmin" } });
    return admin.POST(
      new Request("http://localhost/api/admin/partners", {
        method: "POST",
        headers: { origin: "http://localhost", "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, reason }),
      }),
    );
  }
  async function status(f: Fixture, value: string) {
    const response = await adminAction({
      action: "partner",
      partnerId: f.partnerId,
      status: value,
      country: "NL",
      market: null,
      agreement: "Synthetic agreement",
      notes: "Local case reference",
    });
    assert.equal(response.status, 200, await response.text());
  }
  await check(
    "approved configuration fixes eight policies without enabling the default",
    async () => {
      assert.equal(defaultConfig.enabled, false);
      assert.equal(defaultConfig.waitingDays, 30);
      assert.equal(defaultConfig.downgradeGraceDays, 30);
      assert.deepEqual(defaultConfig.minimumPayoutMinor, { USD: "5000", EUR: "5000" });
      assert.equal(
        (
          await db.query.partnerCommissions.findMany({
            where: eq(schema.partnerCommissions.configId, "config-1"),
          })
        ).length > 0,
        true,
      );
    },
  );
  await check(
    "first successful payment anchors immutable eligibility despite an old signup",
    async () => {
      const f = await fixture("anchor");
      const first = await paid(f, "first", 60);
      assert.equal(first.result.status, "processed");
      const attr = await db.query.partnerAttributions.findFirst({
        where: eq(schema.partnerAttributions.userId, f.userId),
      });
      assert.equal(attr?.eligibilityStart?.toISOString(), first.evidence.paidAt);
      assert.equal(
        attr?.eligibilityEnd?.toISOString(),
        (await import("../../src/lib/partners/rules"))
          .addMonthsUtc(new Date(first.evidence.paidAt), 12)
          .toISOString(),
      );
      await assert.rejects(
        pool.query('update "PartnerAttribution" set "eligibilityStart"=now() where id=$1', [
          attr!.id,
        ]),
      );
    },
  );
  await check(
    "suspension retains evidence, reinstatement requires explicit recovery, and replay is idempotent",
    async () => {
      const f = await fixture("suspended");
      await status(f, "suspended");
      const held = await paid(f, "held", 0);
      assert.equal(held.result.reason, "suspended_hold");
      assert.equal(await commissionFor(held.evidence.chargeId), undefined);
      await assert.rejects(
        reviewPartnerEvent({
          eventId: held.eventId,
          configId: "approved-v1",
          level: "bronze",
          evidence: "Local receipt and level review",
          actor: "admin",
          reason: "Recovery review",
        }),
      );
      await status(f, "active");
      assert.equal((await replayPartnerEvent(held.eventId)).reason, "suspended_hold");
      const recovered = await adminAction({
        action: "review_event",
        eventId: held.eventId,
        configId: "approved-v1",
        level: "bronze",
        evidence: "Verified first receipt, eligibility and Bronze level; no fraud finding",
      });
      assert.equal(recovered.status, 200, await recovered.text());
      const c = await commissionFor(held.evidence.chargeId);
      assert.equal(c?.state, "pending");
      assert.equal(c?.amountMinor, "6000");
      await assert.rejects(
        db.transaction((tx) => approveCommission(tx, c!.id, "admin", "Too early")),
      );
      await Promise.all(Array.from({ length: 8 }, () => replayPartnerEvent(held.eventId)));
      assert.equal(
        (
          await db.query.partnerCommissions.findMany({
            where: eq(schema.partnerCommissions.partnerId, f.partnerId),
          })
        ).length,
        1,
      );
      assert.equal(
        (
          await db.query.partnerEventReviews.findMany({
            where: eq(schema.partnerEventReviews.eventId, held.eventId),
          })
        ).length,
        1,
      );
      await assert.rejects(
        pool.query('delete from "PartnerEventReview" where "eventId"=$1', [held.eventId]),
      );
    },
  );
  await check(
    "termination stops accrual and referrals; reviewed pre-termination earnings can settle",
    async () => {
      const f = await fixture("terminated");
      const first = await paid(f, "before");
      const c = await commissionFor(first.evidence.chargeId);
      await status(f, "terminated");
      await assert.rejects(
        db.transaction((tx) => approveCommission(tx, c!.id, "admin", "Held termination")),
      );
      const after = await paid(f, "after", -0.00001);
      assert.equal(after.result.reason, "excluded:terminated_stop");
      assert.equal(await commissionFor(after.evidence.chargeId), undefined);
      await db.insert(schema.users).values({
        id: "new-terminated-referral",
        email: "new-terminated@example.invalid",
        emailVerified: new Date(),
      });
      assert.equal(
        (
          await confirmReferralSignup({
            referredUserId: "new-terminated-referral",
            referredEmail: "new-terminated@example.invalid",
            attributionCode: f.fixtureCode,
          })
        ).confirmed,
        false,
      );
      const release = await adminAction({
        action: "payout_review",
        partnerId: f.partnerId,
        release: true,
        evidence: "Ordinary termination; pre-termination earnings reviewed, no fraud or dispute",
      });
      assert.equal(release.status, 200, await release.text());
      await db.transaction((tx) =>
        approveCommission(tx, c!.id, "admin", "Approve pre-termination receipt"),
      );
      await db.transaction((tx) =>
        recordPayout(
          tx,
          f.partnerId,
          "USD",
          "terminated-local-settlement",
          "6000",
          "admin",
          "Record local manual settlement",
        ),
      );
      const p = await db.query.partnerAccounts.findFirst({
        where: eq(schema.partnerAccounts.id, f.partnerId),
      });
      assert.equal(p?.status, "terminated");
      const reactivate = await adminAction({
        action: "partner",
        partnerId: f.partnerId,
        status: "active",
        country: "NL",
        market: null,
        agreement: "No reactivation",
        notes: "",
      });
      assert.equal(reactivate.status, 409);
    },
  );
  await check(
    "fraud payout holds and unresolved disputes block both approval and settlement",
    async () => {
      const f = await fixture("fraud");
      const first = await paid(f, "first");
      const c = await commissionFor(first.evidence.chargeId);
      assert.equal(
        (
          await adminAction({
            action: "payout_review",
            partnerId: f.partnerId,
            release: false,
            evidence: "Synthetic fraud investigation",
          })
        ).status,
        200,
      );
      await assert.rejects(
        db.transaction((tx) => approveCommission(tx, c!.id, "admin", "Fraud hold")),
      );
      await assert.rejects(
        db.transaction((tx) =>
          recordPayout(tx, f.partnerId, "USD", "fraud-block", "6000", "admin", "Fraud hold"),
        ),
      );
      assert.equal(
        (
          await adminAction({
            action: "payout_review",
            partnerId: f.partnerId,
            release: true,
            evidence: "Synthetic investigation cleared",
          })
        ).status,
        200,
      );
      await ingestPartnerEvent("held-dispute", "charge.dispute.created", first.evidence.chargeId, {
        kind: "unsupported",
        reason: "dispute_evidence_review",
      });
      await assert.rejects(
        db.transaction((tx) => approveCommission(tx, c!.id, "admin", "Dispute remains held")),
      );
    },
  );
  await check(
    "continuous 30-day downgrade state survives candidate changes and repeated evaluation",
    async () => {
      const f = await fixture("grace");
      await db
        .update(schema.partnerAccounts)
        .set({
          level: "gold",
          candidateLevel: "silver",
          candidateSince: new Date(Date.now() - 29 * day),
        })
        .where(eq(schema.partnerAccounts.id, f.partnerId));
      const before = await db.query.partnerAccounts.findFirst({
        where: eq(schema.partnerAccounts.id, f.partnerId),
      });
      for (let i = 0; i < 4; i++)
        await db.transaction((tx) => refreshLevel(tx, f.partnerId, approved));
      const middle = await db.query.partnerAccounts.findFirst({
        where: eq(schema.partnerAccounts.id, f.partnerId),
      });
      assert.equal(middle?.level, "gold");
      assert.equal(middle?.candidateLevel, "bronze");
      assert.equal(middle?.candidateSince?.getTime(), before?.candidateSince?.getTime());
      const later = await db.transaction((tx) =>
        refreshLevel(tx, f.partnerId, approved, new Date(Date.now() + 2 * day)),
      );
      assert.equal(later.level, "bronze");
      assert.ok(
        (
          await db.query.partnerAudit.findMany({
            where: eq(schema.partnerAudit.partnerId, f.partnerId),
          })
        ).some((a) => a.action === "level_change"),
      );
    },
  );
  await check(
    "unknown relationships require evidenced classification; confirmed related purchases are excluded",
    async () => {
      const f = await fixture("unknown", "unknown");
      const held = await paid(f, "first");
      assert.equal(held.result.reason, "related_party_review");
      assert.equal(
        (
          await adminAction({
            action: "related",
            attributionId: `attr-${f.label}`,
            classification: "unrelated",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await adminAction({
            action: "related",
            attributionId: `attr-${f.label}`,
            classification: "unrelated",
            evidence: "Synthetic relationship case reviewed",
          })
        ).status,
        200,
      );
      assert.equal((await replayPartnerEvent(held.eventId)).status, "processed");
      const related = await fixture("related", "related");
      assert.equal(
        (await paid(related, "excluded")).result.reason,
        "excluded:related_party_exclude",
      );
    },
  );
  await check(
    "30-day waiting period blocks early approvals and suspended settlement bypasses",
    async () => {
      const f = await fixture("waiting");
      const early = await paid(f, "early", 29);
      const c = await commissionFor(early.evidence.chargeId);
      await assert.rejects(db.transaction((tx) => approveCommission(tx, c!.id, "admin", "Day 29")));
      await status(f, "suspended");
      assert.equal(
        (
          await adminAction({
            action: "payout_review",
            partnerId: f.partnerId,
            release: true,
            evidence: "Cannot bypass suspension",
          })
        ).status,
        409,
      );
      await assert.rejects(
        db.transaction((tx) =>
          recordPayout(
            tx,
            f.partnerId,
            "USD",
            "suspended-block",
            "6000",
            "admin",
            "Cannot bypass suspension",
          ),
        ),
      );
    },
  );
  for (const currency of ["USD", "EUR"]) {
    await check(
      `${currency} 50 minimum applies to its own currency and unsupported currencies stay blocked`,
      async () => {
        for (const [suffix, net, due, succeeds] of [
          ["below", "33326", "4999", false],
          ["exact", "33333", "5000", true],
        ] as const) {
          const f = await fixture(`minimum-${currency}-${suffix}`);
          if (currency === "EUR")
            await db
              .insert(schema.partnerFxRates)
              .values({
                id: `fx-${f.label}`,
                currency,
                day: new Date(Date.now() - 45 * day).toISOString().slice(0, 10),
                numerator: "1",
                denominator: "1",
                source: "https://example.invalid/evidence",
                actor: "test",
              })
              .onConflictDoNothing();
          const first = await paid(f, "first", 45, net, currency);
          const c = await commissionFor(first.evidence.chargeId);
          assert.equal(c?.amountMinor, due);
          await db.transaction((tx) => approveCommission(tx, c!.id, "admin", "Wait elapsed"));
          await assert.rejects(
            db.transaction((tx) =>
              recordPayout(
                tx,
                f.partnerId,
                "GBP",
                `unsupported-${f.label}`,
                due,
                "admin",
                "Unsupported currency",
              ),
            ),
          );
          const payout = () =>
            db.transaction((tx) =>
              recordPayout(
                tx,
                f.partnerId,
                currency,
                `minimum-${f.label}`,
                due,
                "admin",
                "Exact local statement",
              ),
            );
          if (succeeds) await payout();
          else await assert.rejects(payout());
        }
      },
    );
  }
  await check(
    "post-payout refunds remain negative and offset only same-currency future earnings under concurrency",
    async () => {
      const f = await fixture("offset");
      const first = await paid(f, "first", 60);
      const c = await commissionFor(first.evidence.chargeId);
      await db.transaction((tx) => approveCommission(tx, c!.id, "admin", "Approve original"));
      await db.transaction((tx) =>
        recordPayout(tx, f.partnerId, "USD", "offset-first", "6000", "admin", "Record original"),
      );
      await ingestPartnerEvent("offset-refund", "charge.refunded", first.evidence.chargeId, {
        kind: "adjustment",
        chargeId: first.evidence.chargeId,
        refundedGrossMinor: "24000",
        disputedGrossMinor: "0",
        observedAt: new Date().toISOString(),
      });
      assert.equal((await partnerSummary(f.partnerId)).balances.USD.liability, "-3000");
      const next = await paid(f, "next", 31, "60000");
      const nextCommission = await commissionFor(next.evidence.chargeId);
      await db.transaction((tx) =>
        approveCommission(tx, nextCommission!.id, "admin", "Approve future"),
      );
      assert.equal((await partnerSummary(f.partnerId)).balances.USD.settlement, "6000");
      await assert.rejects(
        db.transaction((tx) =>
          recordPayout(
            tx,
            f.partnerId,
            "EUR",
            "offset-cross-currency",
            "6000",
            "admin",
            "Currency isolation",
          ),
        ),
      );
      const outcomes = await Promise.allSettled(
        [1, 2].map((i) =>
          db.transaction((tx) =>
            recordPayout(
              tx,
              f.partnerId,
              "USD",
              `offset-next-${i}`,
              "6000",
              "admin",
              "Concurrent exact statement",
            ),
          ),
        ),
      );
      assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
      assert.equal((await partnerSummary(f.partnerId)).balances.USD.liability, "0");
      assert.equal(
        (
          await db.query.partnerPayouts.findMany({
            where: eq(schema.partnerPayouts.partnerId, f.partnerId),
          })
        ).length,
        2,
      );
    },
  );
  await check(
    "historical unresolved policy requires explicit version/level review without modifying earned snapshots",
    async () => {
      await db.insert(schema.partnerConfigs).values({
        id: "historical-unresolved",
        config: { ...defaultConfig, enabled: true, eligibilityAnchor: null },
        effectiveAt: new Date("2020-06-01Z"),
        actor: "legacy-fixture",
        reason: "Legacy unresolved fixture",
      });
      const f = await fixture("historical");
      const age = (Date.now() - new Date("2020-07-01Z").getTime()) / day;
      const held = await paid(f, "legacy", age);
      assert.equal(held.result.reason, "policy_review");
      assert.equal((await replayPartnerEvent(held.eventId)).reason, "policy_review");
      const review = await reviewPartnerEvent({
        eventId: held.eventId,
        configId: "approved-v1",
        level: "bronze",
        evidence:
          "Explicit authorization for this historical receipt, first payment and Bronze qualification",
        actor: "admin",
        reason: "Historical accrual authorization",
      });
      assert.equal(review.status, "processed");
      const c = await commissionFor(held.evidence.chargeId);
      assert.equal(c?.configId, "approved-v1");
      assert.equal(c?.rateBps, 1500);
      assert.equal(c?.state, "pending");
      assert.equal(
        (
          await db.query.partnerConfigs.findFirst({
            where: eq(schema.partnerConfigs.id, "historical-unresolved"),
          })
        )?.config.eligibilityAnchor,
        null,
      );
      await assert.rejects(
        pool.query('update "PartnerCommission" set "amountMinor"=1 where id=$1', [c!.id]),
      );
      const badVersion = await adminAction({
        action: "config",
        config: { ...defaultConfig, standardBps: 1400 },
      });
      assert.equal(badVersion.status, 409);
      await assert.rejects(
        db.transaction((tx) =>
          writeProgramConfig(tx, defaultConfig, "admin", "No backdating", new Date("2020-01-01Z")),
        ),
      );
    },
  );
  await check(
    "new disabled policy version is audited, prospective, and preserves historical commissions",
    async () => {
      const before = await db.query.partnerCommissions.findMany();
      const response = await adminAction({ action: "config", config: defaultConfig });
      assert.equal(response.status, 200, await response.text());
      const after = await db.query.partnerCommissions.findMany();
      assert.deepEqual(after, before);
      const configs = await db.query.partnerConfigs.findMany();
      const current = configs.find((c) => c.reason === "Synthetic owner-authorized review");
      assert.equal(current?.config.enabled, false);
      assert.equal(current?.config.waitingDays, 30);
      const future = new Date(Date.now() + day);
      await db.transaction((tx) =>
        writeProgramConfig(tx, approved, "owner", "Future synthetic version", future),
      );
      const { latestConfig } = await import("../../src/lib/partners/store");
      assert.equal((await db.transaction((tx) => latestConfig(tx)))?.config.enabled, false);
      assert.equal(
        (await db.transaction((tx) => latestConfig(tx, new Date(future.getTime() + 1))))?.config
          .enabled,
        true,
      );
    },
  );
  console.log(
    `${passed} PostgreSQL integration checks passed. All Stripe objects are local fixtures.`,
  );
  await pool.end();
  process.exit(0);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
