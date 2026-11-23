import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import type { Database } from "../../src/lib/db";
import * as schema from "../../src/lib/db/schema";
import { setSession } from "./mock-auth.mjs";

const origin = "https://fixture.example.invalid";
const adminUrl = origin + "/api/admin/partner-applications";
const reason = "test_registration";

export async function runRegistrationDeletionTests({
  db,
  pool,
  check,
}: {
  db: Database;
  pool: Pool;
  check: (name: string, run: () => Promise<void>) => Promise<void>;
}) {
  const admin = await import("../../src/app/api/admin/partner-applications/route");
  const publicApi = await import("../../src/app/api/partner-applications/route");
  const adminSession = { user: { id: "test-owner", role: "superadmin" } };
  const remove = (payload: Record<string, unknown>, requestOrigin = origin) =>
    admin.DELETE(
      new Request(adminUrl, {
        method: "DELETE",
        headers: { origin: requestOrigin, "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  const confirmed = (id: string) => ({ id, confirm: true, reason });
  const getApplication = (id: string) =>
    db.query.partnerApplications.findFirst({ where: eq(schema.partnerApplications.id, id) });
  const getAudit = (id: string) =>
    db.query.partnerAudit.findFirst({
      where: eq(schema.partnerAudit.id, `application-deletion:${id}`),
    });

  const priorFetch = globalThis.fetch;
  const previousFeature = process.env.PARTNER_PROGRAM_ENABLED;
  process.env.PARTNER_PROGRAM_ENABLED = "true";
  const deliveries: { id: string; to: string[]; subject: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    const { to, subject } = JSON.parse(String(init?.body));
    const id = new Headers(init?.headers).get("Idempotency-Key")!;
    deliveries.push({ id, to, subject });
    return Response.json({ id: `deletion-receipt-${deliveries.length}` });
  }) as typeof fetch;

  const submit = async (email: string, address: string) => {
    const response = await publicApi.POST(
      new Request(origin + "/api/partner-applications", {
        method: "POST",
        headers: { origin, "content-type": "application/json", "x-real-ip": address },
        body: JSON.stringify({
          program: "work_with_us",
          category: "Referral Partner",
          fullName: "Synthetic Deletion Applicant",
          email,
          country: "NL",
          companyName: "Synthetic Deletion Company",
          experience: "I help businesses improve reporting and adopt analytics.",
          privacyAccepted: true,
          website: "",
          formStartedAt: Date.now() - 5000,
        }),
      }),
    );
    assert.equal(response.status, 201, await response.text());
    const application = await db.query.partnerApplications.findFirst({
      where: eq(schema.partnerApplications.email, email),
    });
    assert.ok(application);
    return application;
  };

  try {
    setSession(adminSession);
    const email = "deletion-reuse@example.invalid";
    await db.insert(schema.users).values({ id: "deletion-general-user", email });
    const pending = await submit(email, "203.0.113.40");
    await check(
      "registration deletion requires superadmin, same-origin JSON and explicit confirmation",
      async () => {
        setSession(null);
        assert.equal((await remove(confirmed(pending.id))).status, 401);
        setSession({ user: { id: "deletion-general-user", role: "user" } });
        assert.equal((await remove(confirmed(pending.id))).status, 403);
        setSession(adminSession);
        assert.equal(
          (await remove(confirmed(pending.id), "https://cross-origin.example.invalid")).status,
          403,
        );
        assert.equal((await remove({ reason, confirm: true })).status, 400);
        assert.equal((await remove({ ...confirmed(pending.id), confirm: false })).status, 400);
        assert.equal((await remove({ ...confirmed(pending.id), reason: "free text" })).status, 400);
        assert.ok(await getApplication(pending.id));
        assert.equal(await getAudit(pending.id), undefined);
        await assert.rejects(
          db
            .delete(schema.partnerApplicationAudit)
            .where(eq(schema.partnerApplicationAudit.applicationId, pending.id)),
          (error) => /audit history is immutable/.test(String((error as Error).cause)),
        );
        await assert.rejects(
          db
            .delete(schema.partnerApplications)
            .where(eq(schema.partnerApplications.id, pending.id)),
          (error) =>
            /requires an eligible registration and audit event/.test(
              String((error as Error).cause),
            ),
        );
      },
    );

    await check(
      "pending registration deletion updates the count and lets the same email receive a new receipt",
      async () => {
        const list = async () => {
          const response = await admin.GET(new Request(adminUrl + "?status=pending"));
          assert.equal(response.status, 200);
          return response.json() as Promise<{
            count: number;
            applications: { id: string; canRequestDeletion: boolean }[];
          }>;
        };
        const before = await list();
        assert.equal(
          before.applications.find(({ id }) => id === pending.id)?.canRequestDeletion,
          true,
        );
        const responses = await Promise.all([
          remove(confirmed(pending.id)),
          remove(confirmed(pending.id)),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [200, 404]);
        assert.equal((await remove(confirmed(pending.id))).status, 404);
        const after = await list();
        assert.equal(after.count, before.count - 1);
        assert.ok(after.applications.every(({ id }) => id !== pending.id));
        assert.equal(await getApplication(pending.id), undefined);
        assert.deepEqual(
          await db.query.partnerApplicationAudit.findMany({
            where: eq(schema.partnerApplicationAudit.applicationId, pending.id),
          }),
          [],
        );
        assert.deepEqual(
          await db.query.partnerApplicationEmails.findMany({
            where: eq(schema.partnerApplicationEmails.applicationId, pending.id),
          }),
          [],
        );
        const event = await getAudit(pending.id);
        assert.ok(event?.createdAt instanceof Date);
        assert.equal(event.actor, "test-owner");
        assert.equal(event.partnerId, null);
        assert.equal(event.action, "application_registration_deleted");
        assert.equal(event.reason, reason);
        assert.deepEqual(event.data, { applicationId: pending.id });
        await assert.rejects(
          db.delete(schema.partnerAudit).where(eq(schema.partnerAudit.id, event.id)),
        );
        assert.ok(
          await db.query.users.findFirst({ where: eq(schema.users.id, "deletion-general-user") }),
        );

        const resubmitted = await submit(email, "203.0.113.40");
        assert.notEqual(resubmitted.id, pending.id);
        const receipts = deliveries.filter(
          ({ to, subject }) =>
            to.includes(email) && subject === "We received your UseClevr partner application",
        );
        assert.equal(receipts.length, 2);
        assert.notEqual(receipts[0].id, receipts[1].id);
        const sent = await db.query.partnerApplicationEmails.findMany({
          where: eq(schema.partnerApplicationEmails.applicationId, resubmitted.id),
        });
        assert.ok(sent.some((entry) => entry.kind === "receipt" && entry.status === "sent"));
      },
    );

    await check(
      "rejected registrations can be removed along with their application and delivery history",
      async () => {
        const application = await submit("delete-rejected@example.invalid", "203.0.113.41");
        const rejected = await admin.POST(
          new Request(adminUrl, {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body: JSON.stringify({ id: application.id, action: "reject", confirm: true }),
          }),
        );
        assert.equal(rejected.status, 200);
        assert.equal((await getApplication(application.id))?.status, "rejected");
        assert.equal((await remove(confirmed(application.id))).status, 200);
        assert.equal(await getApplication(application.id), undefined);
        assert.ok(await getAudit(application.id));
      },
    );

    await check(
      "a linked legal record rolls back the application, email history and audit deletion",
      async () => {
        const application = await submit("deletion-legal@example.invalid", "203.0.113.42");
        await pool.query(
          'INSERT INTO "PartnerContractAudit" (id, "applicationId", actor, action, reason, evidence) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            "deletion-protected-legal",
            application.id,
            "test-owner",
            "fixture",
            "Synthetic retained evidence",
            {},
          ],
        );
        const response = await remove(confirmed(application.id));
        assert.equal(response.status, 409);
        assert.match((await response.json()).error, /protected/);
        assert.ok(await getApplication(application.id));
        assert.equal(await getAudit(application.id), undefined);
        assert.ok(
          await db.query.partnerApplicationAudit.findFirst({
            where: eq(schema.partnerApplicationAudit.applicationId, application.id),
          }),
        );
        assert.equal(
          (
            await db.query.partnerApplicationEmails.findMany({
              where: eq(schema.partnerApplicationEmails.applicationId, application.id),
            })
          ).length,
          2,
        );
        assert.ok(
          await db.query.partnerContractAudit.findFirst({
            where: eq(schema.partnerContractAudit.id, "deletion-protected-legal"),
          }),
        );
      },
    );

    await check(
      "active and signed registrations retain agreements, native evidence and partner accounts",
      async () => {
        const [active] = await db
          .select({ id: schema.partnerApplications.id, partnerId: schema.partnerAccounts.id })
          .from(schema.partnerApplications)
          .innerJoin(
            schema.partnerAccounts,
            eq(schema.partnerApplications.partnerAccountId, schema.partnerAccounts.id),
          )
          .where(eq(schema.partnerAccounts.status, "active"))
          .limit(1);
        const signature = await db.query.partnerContractNativeSignatures.findFirst();
        assert.ok(active && signature);
        const signed = await db.query.partnerContracts.findFirst({
          where: eq(schema.partnerContracts.id, signature.contractId),
        });
        assert.ok(signed);
        const contractsBefore = await db.query.partnerContracts.findMany();
        const signaturesBefore = await db.query.partnerContractNativeSignatures.findMany();
        for (const id of new Set([active.id, signed.applicationId])) {
          assert.equal((await remove(confirmed(id))).status, 409);
          assert.equal(await getAudit(id), undefined);
          assert.ok(await getApplication(id));
        }
        assert.deepEqual(await db.query.partnerContracts.findMany(), contractsBefore);
        assert.deepEqual(
          await db.query.partnerContractNativeSignatures.findMany(),
          signaturesBefore,
        );
        assert.equal(
          (
            await db.query.partnerAccounts.findFirst({
              where: eq(schema.partnerAccounts.id, active.partnerId),
            })
          )?.status,
          "active",
        );
      },
    );
  } finally {
    globalThis.fetch = priorFetch;
    setSession(null);
    if (previousFeature === undefined) delete process.env.PARTNER_PROGRAM_ENABLED;
    else process.env.PARTNER_PROGRAM_ENABLED = previousFeature;
  }
}
