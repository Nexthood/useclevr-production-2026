import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import type { Database } from "../../src/lib/db";
import * as schema from "../../src/lib/db/schema";
import { setSession } from "./mock-auth.mjs";

export async function runPartnerAccountDeletionTests({
  db,
  pool,
  check,
}: {
  db: Database;
  pool: Pool;
  check: (name: string, run: () => Promise<void>) => Promise<void>;
}) {
  const admin = await import("../../src/app/api/admin/partners/route");
  const applications = await import("../../src/app/api/partner-applications/route");
  const origin = "https://fixture.example.invalid";
  const adminUrl = origin + "/api/admin/partners";
  const owner = { user: { id: "test-owner", role: "superadmin" } };
  const remove = (body: Record<string, unknown>, requestOrigin = origin) =>
    admin.DELETE(
      new Request(adminUrl, {
        method: "DELETE",
        headers: { origin: requestOrigin, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const preview = (id: string) => admin.GET(new Request(`${adminUrl}?deletionPartnerId=${id}`));
  const confirmed = async (partnerId: string) => ({
    partnerId,
    confirm: true,
    reason: "test_registration",
    scope: (await (await preview(partnerId)).json()).scope ?? "a".repeat(64),
  });
  const account = (id: string) =>
    db.query.partnerAccounts.findFirst({
      where: eq(schema.partnerAccounts.id, id),
    });
  const audit = (id: string) =>
    db.query.partnerAudit.findFirst({
      where: eq(schema.partnerAudit.id, `account-deletion:${id}`),
    });
  const addAccount = async (userId: string) => {
    const response = await admin.POST(
      new Request(adminUrl, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          userId,
          name: "Synthetic Commercial Partner",
          country: "NL",
          market: null,
          agreement: "Synthetic pending registration",
          reason: "Synthetic local account fixture",
        }),
      }),
    );
    assert.equal(response.status, 200);
    const { partnerId } = await response.json();
    const result = await account(partnerId);
    assert.ok(result);
    return result;
  };
  const fixture = async (label: string) => {
    const userId = `commercial-delete-${label}`;
    const email = `${userId}@example.invalid`;
    await db.insert(schema.users).values({ id: userId, email, emailVerified: new Date() });
    return { ...(await addAccount(userId)), email };
  };
  let submitCount = 0;
  const submit = async (email: string) => {
    const response = await applications.POST(
      new Request(origin + "/api/partner-applications", {
        method: "POST",
        headers: { origin, "content-type": "application/json", "x-real-ip": "203.0.113.80" },
        body: JSON.stringify({
          program: "work_with_us",
          category: "Referral Partner",
          fullName: "Synthetic Commercial Applicant",
          email,
          country: "NL",
          companyName: "Synthetic Company",
          experience: "I support businesses with training and reporting.",
          privacyAccepted: true,
          website: "",
          formStartedAt: Date.now() - 5000,
        }),
      }),
    );
    assert.equal(response.status, 201, await response.text());
    submitCount++;
    const application = await db.query.partnerApplications.findFirst({
      where: eq(schema.partnerApplications.email, email),
    });
    assert.ok(application);
    return application;
  };

  const previousFetch = globalThis.fetch;
  const receipts: { to: string[]; key: string | null }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    const { to, subject } = JSON.parse(String(init?.body));
    if (subject === "We received your UseClevr partner application")
      receipts.push({ to, key: new Headers(init?.headers).get("Idempotency-Key") });
    return Response.json({ id: `commercial-deletion-email-${receipts.length}-${submitCount}` });
  }) as typeof fetch;

  try {
    setSession(owner);
    const reusable = await fixture("reuse");
    await check(
      "commercial account preview and deletion enforce superadmin, same origin and confirmation",
      async () => {
        for (const [session, status] of [
          [null, 401],
          [{ user: { id: reusable.userId, role: "user" } }, 403],
        ] as const) {
          setSession(session);
          assert.equal((await preview(reusable.id)).status, status);
          assert.equal((await remove(await confirmed(reusable.id))).status, status);
        }
        setSession(owner);
        assert.equal(
          (await remove(await confirmed(reusable.id), "https://untrusted.example.invalid")).status,
          403,
        );
        assert.equal(
          (await remove({ ...(await confirmed(reusable.id)), confirm: false })).status,
          400,
        );
        assert.equal((await remove({ confirm: true, reason: "test_registration" })).status, 400);
        await assert.rejects(
          pool.query('DELETE FROM "PartnerAccount" WHERE id = $1', [reusable.id]),
          /administrative audit event/,
        );
        await assert.rejects(
          pool.query('UPDATE "PartnerAccount" SET id = $2 WHERE id = $1', [
            reusable.id,
            "changed-audit-subject-fixture",
          ]),
          /identifiers are immutable/,
        );
        assert.ok(await account(reusable.id));
        assert.equal(await audit(reusable.id), undefined);
      },
    );

    await check(
      "delete an eligible commercial account and linked registration while preserving identity and audit",
      async () => {
        const originalConfirmation = await confirmed(reusable.id);
        const registration = await submit(reusable.email);
        await db
          .update(schema.partnerApplications)
          .set({ partnerAccountId: reusable.id, linkedUserId: reusable.userId })
          .where(eq(schema.partnerApplications.id, registration.id));
        const result = await preview(reusable.id);
        assert.equal(result.status, 200);
        const { scope, ...decision } = await result.json();
        assert.match(scope, /^[a-f0-9]{64}$/);
        assert.deepEqual(decision, {
          id: reusable.id,
          name: reusable.name,
          email: reusable.email,
          status: "pending",
          permitted: true,
          explanation: null,
          applicationCount: 1,
        });
        const stale = await remove(originalConfirmation);
        assert.equal(stale.status, 409);
        assert.match((await stale.json()).error, /linked applications changed/);
        assert.ok(await account(reusable.id));
        assert.equal(await audit(reusable.id), undefined);
        const before = await db.query.partnerAudit.findMany({
          where: eq(schema.partnerAudit.partnerId, reusable.id),
        });
        assert.ok(before.some((row) => row.action === "partner_registered"));
        const confirmation = { ...originalConfirmation, scope };
        const responses = await Promise.all([remove(confirmation), remove(confirmation)]);
        assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 404]);
        assert.equal(await account(reusable.id), undefined);
        assert.equal(
          await db.query.partnerApplications.findFirst({
            where: eq(schema.partnerApplications.id, registration.id),
          }),
          undefined,
        );
        assert.deepEqual(
          await db.query.partnerAudit.findMany({
            where: eq(schema.partnerAudit.partnerId, reusable.id),
          }),
          before,
        );
        const event = await audit(reusable.id);
        assert.ok(event?.createdAt instanceof Date);
        assert.equal(event.actor, "test-owner");
        assert.equal(event.action, "partner_account_deleted");
        assert.equal(event.reason, "test_registration");
        assert.equal(event.partnerId, null);
        assert.deepEqual(event.data, { partnerId: reusable.id });
        await assert.rejects(db.insert(schema.partnerAccounts).values(reusable), (error) =>
          /identifiers cannot be reused/.test(String((error as Error).cause)),
        );
        assert.ok(
          await db.query.partnerAudit.findFirst({
            where: eq(schema.partnerAudit.id, `application-deletion:${registration.id}`),
          }),
        );
        assert.ok(await db.query.users.findFirst({ where: eq(schema.users.id, reusable.userId) }));
        await assert.rejects(
          pool.query('DELETE FROM "PartnerAudit" WHERE id = $1', [before[0].id]),
          /append-only/,
        );
        await assert.rejects(
          pool.query(
            'INSERT INTO "PartnerAudit" (id, "partnerId", actor, action, reason, data) VALUES ($1,$2,$3,$4,$5,$6)',
            [
              "late-audit-fixture",
              reusable.id,
              "test-owner",
              "partner_registered",
              "Synthetic late write",
              {},
            ],
          ),
          /subject does not exist/,
        );
        const recreated = await addAccount(reusable.userId);
        assert.notEqual(recreated.id, reusable.id);
        assert.equal(recreated.code, reusable.code);
        const fresh = await submit(reusable.email);
        assert.notEqual(fresh.id, registration.id);
        const delivered = receipts.filter(({ to }) => to.includes(reusable.email));
        assert.equal(delivered.length, 2);
        assert.notEqual(delivered[0].key, delivered[1].key);
      },
    );

    await check(
      "a separately filed application or linked invitation protects the commercial account",
      async () => {
        const partner = await fixture("invitation");
        const registration = await submit(partner.email);
        const separate = await preview(partner.id);
        assert.equal((await separate.json()).permitted, false);
        assert.match(
          (await (await remove(await confirmed(partner.id))).json()).error,
          /separate application/,
        );
        await db
          .update(schema.partnerApplications)
          .set({ partnerAccountId: partner.id, invitationExpiresAt: new Date() })
          .where(eq(schema.partnerApplications.id, registration.id));
        const protectedResponse = await remove(await confirmed(partner.id));
        assert.equal(protectedResponse.status, 409);
        assert.match((await protectedResponse.json()).error, /invitation/);
        assert.ok(await account(partner.id));
        assert.ok(
          await db.query.partnerApplications.findFirst({
            where: eq(schema.partnerApplications.id, registration.id),
          }),
        );
        assert.equal(await audit(partner.id), undefined);
      },
    );

    await check(
      "late foreign-key failure restores the account, linked application and audit state",
      async () => {
        const partner = await fixture("rollback");
        const registration = await submit(partner.email);
        await db
          .update(schema.partnerApplications)
          .set({ partnerAccountId: partner.id, linkedUserId: partner.userId })
          .where(eq(schema.partnerApplications.id, registration.id));
        await pool.query(
          'CREATE TABLE "AccountDeletionRollbackFixture" ("partnerId" text REFERENCES "PartnerAccount"(id))',
        );
        await pool.query('INSERT INTO "AccountDeletionRollbackFixture" VALUES ($1)', [partner.id]);
        assert.equal((await remove(await confirmed(partner.id))).status, 409);
        assert.ok(await account(partner.id));
        const original = await db.query.partnerApplications.findFirst({
          where: eq(schema.partnerApplications.id, registration.id),
        });
        assert.equal(original?.partnerAccountId, partner.id);
        assert.equal(original?.linkedUserId, partner.userId);
        assert.equal(await audit(partner.id), undefined);
        assert.equal(
          await db.query.partnerAudit.findFirst({
            where: eq(schema.partnerAudit.id, `application-deletion:${registration.id}`),
          }),
          undefined,
        );
        assert.ok(
          await db.query.partnerApplicationEmails.findFirst({
            where: eq(schema.partnerApplicationEmails.applicationId, registration.id),
          }),
        );
      },
    );

    await check("signed agreements and active partners remain protected", async () => {
      const signature = await db.query.partnerContractNativeSignatures.findFirst();
      assert.ok(signature);
      const contract = await db.query.partnerContracts.findFirst({
        where: eq(schema.partnerContracts.id, signature.contractId),
      });
      const active = await db.query.partnerAccounts.findFirst({
        where: eq(schema.partnerAccounts.status, "active"),
      });
      assert.ok(contract && active);
      for (const id of new Set([contract.partnerId, active.id])) {
        const response = await remove(await confirmed(id));
        assert.equal(response.status, 409);
        assert.ok(await account(id));
        assert.equal(await audit(id), undefined);
      }
      assert.deepEqual(
        await db.query.partnerContracts.findFirst({
          where: eq(schema.partnerContracts.id, contract.id),
        }),
        contract,
      );
      assert.deepEqual(
        await db.query.partnerContractNativeSignatures.findFirst({
          where: eq(schema.partnerContractNativeSignatures.id, signature.id),
        }),
        signature,
      );
    });

    await check("inactive accounts with payment and payout history remain protected", async () => {
      const partner = await fixture("financial");
      const customer = "commercial-deletion-financial-customer";
      await db
        .insert(schema.users)
        .values({ id: customer, email: "commercial-financial-customer@example.invalid" });
      await db.insert(schema.referralAttributions).values({
        id: "commercial-deletion-referral",
        code: partner.code,
        referrerUserId: partner.userId,
        referredUserId: customer,
        signupRewardStatus: "none",
      });
      await db.insert(schema.partnerAttributions).values({
        id: "commercial-deletion-attribution",
        referralId: "commercial-deletion-referral",
        partnerId: partner.id,
        userId: customer,
        signedUpAt: new Date(),
      });
      await db.insert(schema.partnerPayments).values({
        id: "commercial-deletion-payment",
        invoiceId: "commercial-deletion-invoice",
        chargeId: "commercial-deletion-charge",
        subscriptionId: "commercial-deletion-subscription",
        attributionId: "commercial-deletion-attribution",
        partnerId: partner.id,
        currency: "USD",
        grossMinor: "10000",
        netMinor: "8000",
        usdMinor: "8000",
        paidAt: new Date(),
      });
      await db.insert(schema.partnerCommissions).values({
        id: "commercial-deletion-commission",
        paymentId: "commercial-deletion-payment",
        partnerId: partner.id,
        configId: "fixture-policy",
        level: "bronze",
        rateBps: 1500,
        amountMinor: "1200",
        currency: "USD",
        earnedAt: new Date(),
      });
      await db.insert(schema.partnerPayouts).values({
        id: "commercial-deletion-payout",
        partnerId: partner.id,
        currency: "USD",
        amountMinor: "1200",
        reference: "commercial-deletion-settlement",
        actor: "test-owner",
      });
      const response = await remove(await confirmed(partner.id));
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /financial transactions/);
      assert.ok(await account(partner.id));
      assert.ok(
        await db.query.partnerPayments.findFirst({
          where: eq(schema.partnerPayments.partnerId, partner.id),
        }),
      );
      assert.ok(
        await db.query.partnerCommissions.findFirst({
          where: eq(schema.partnerCommissions.partnerId, partner.id),
        }),
      );
      assert.ok(
        await db.query.partnerPayouts.findFirst({
          where: eq(schema.partnerPayouts.partnerId, partner.id),
        }),
      );
      assert.equal(await audit(partner.id), undefined);
    });

    await check(
      "a never-approved rejected account with routine review history can be deleted",
      async () => {
        const partner = await fixture("rejected");
        const response = await admin.POST(
          new Request(adminUrl, {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body: JSON.stringify({
              action: "partner",
              partnerId: partner.id,
              status: "rejected",
              notes: "",
              country: "NL",
              market: null,
              agreement: partner.agreement,
              reason: "Synthetic rejection fixture",
            }),
          }),
        );
        assert.equal(response.status, 200);
        assert.equal((await account(partner.id))?.status, "rejected");
        assert.equal((await remove(await confirmed(partner.id))).status, 200);
        assert.equal(await account(partner.id), undefined);
        assert.ok(await audit(partner.id));
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
    setSession(null);
  }
}
