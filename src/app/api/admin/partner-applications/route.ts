import {
  authorizeManualActivation,
  executedAgreementReference,
  recordManualActivation,
} from "@/lib/partners/contracts/activation";
import { contractError } from "@/lib/partners/contracts/http";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-session";
import { getDb } from "@/lib/db";
import {
  partnerApplicationAudit,
  partnerApplicationEmails,
  partnerApplications,
  partnerAccounts,
} from "@/lib/db/schema";
import { validWriteOrigin } from "@/lib/partners/api";
import {
  createInvitation,
  encryptEmailPayload,
  retryApplicationEmails,
} from "@/lib/partners/public-applications";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const admin = await requireSuperAdmin();
  if (!admin.success) return admin.error;
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  await retryApplicationEmails();
  const status = new URL(request.url).searchParams.get("status");
  const rows = await db.query.partnerApplications.findMany({
    where:
      status && ["pending", "under_review", "approved", "rejected", "active"].includes(status)
        ? eq(partnerApplications.status, status)
        : undefined,
    orderBy: desc(partnerApplications.createdAt),
    limit: 500,
  });
  const history = rows.length
    ? await db
        .select()
        .from(partnerApplicationAudit)
        .where(
          inArray(
            partnerApplicationAudit.applicationId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(asc(partnerApplicationAudit.createdAt))
    : [];
  const deliveries = rows.length
    ? await db
        .select({
          id: partnerApplicationEmails.id,
          applicationId: partnerApplicationEmails.applicationId,
          kind: partnerApplicationEmails.kind,
          status: partnerApplicationEmails.status,
          attempts: partnerApplicationEmails.attempts,
          sentAt: partnerApplicationEmails.sentAt,
          lastErrorCode: partnerApplicationEmails.lastErrorCode,
        })
        .from(partnerApplicationEmails)
        .where(
          inArray(
            partnerApplicationEmails.applicationId,
            rows.map((row) => row.id),
          ),
        )
    : [];
  return NextResponse.json(
    {
      applications: rows.map((row) => ({
        ...row,
        audit: history.filter((entry) => entry.applicationId === row.id),
        deliveries: deliveries.filter((entry) => entry.applicationId === row.id),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const admin = await requireSuperAdmin();
  if (!admin.success) return admin.error;
  if (!validWriteOrigin(request))
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string" || typeof body.action !== "string")
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (body.action === "retry_email") {
    const due = await db.query.partnerApplicationEmails.findMany({
      where: and(
        eq(partnerApplicationEmails.applicationId, body.id),
        eq(partnerApplicationEmails.status, "failed"),
      ),
    });
    await Promise.all(
      due.map((row) =>
        db
          .update(partnerApplicationEmails)
          .set({
            status: "pending",
            attempts: 0,
            recipient:
              row.kind === "admin_notice"
                ? process.env.PARTNER_ADMIN_EMAIL ||
                  process.env.RESEND_STATUS_TO ||
                  process.env.ADMIN_AUTH_BYPASS_EMAIL ||
                  "superadmin@useclevr.com"
                : row.recipient,
            nextAttemptAt: new Date(),
            lastErrorCode: null,
          })
          .where(eq(partnerApplicationEmails.id, row.id)),
      ),
    );
    await retryApplicationEmails();
    return NextResponse.json({ ok: true });
  }
  const allowedActions = ["under_review", "approve", "reject", "activate"];
  if (
    !allowedActions.includes(body.action) ||
    (body.action !== "under_review" && body.confirm !== true)
  )
    return NextResponse.json({ error: "Administrator confirmation is required." }, { status: 400 });
  const current = await db.query.partnerApplications.findFirst({
    where: eq(partnerApplications.id, body.id),
  });
  if (!current) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (
    ["under_review", "approve", "reject"].includes(body.action) &&
    !["pending", "under_review"].includes(current.status)
  )
    return NextResponse.json(
      { error: "This application can no longer be reviewed." },
      { status: 409 },
    );
  const now = new Date();
  if (body.action === "activate") {
    if (current.status !== "approved" || !current.onboardedAt || !current.partnerAccountId)
      return NextResponse.json(
        {
          error: "Completed onboarding and an approved application are required before activation.",
        },
        { status: 409 },
      );
    if (
      typeof body.agreement !== "string" ||
      body.agreement.trim().length < 10 ||
      typeof body.commercialEvidence !== "string" ||
      body.commercialEvidence.trim().length < 10
    )
      return NextResponse.json(
        { error: "Reviewed commercial agreement and evidence are required." },
        { status: 400 },
      );
    try {
      await db.transaction(async (tx) => {
        const c = await authorizeManualActivation(
          tx,
          current.partnerAccountId!,
          admin.userId,
          body.commercialEvidence,
          current.id,
        );
        await tx
          .update(partnerAccounts)
          .set({
            status: "active",
            approvedAt: now,
            agreement: executedAgreementReference(c),
            commercialReview: { status: "approved", evidence: executedAgreementReference(c) },
          })
          .where(eq(partnerAccounts.id, current.partnerAccountId!));
        await recordManualActivation(tx, c, admin.userId, body.commercialEvidence);
      });
      return NextResponse.json({ ok: true, status: "approved", partnerStatus: "active" });
    } catch (error) {
      return contractError(error);
    }
  }
  let token: string | undefined;
  const changed = await db.transaction(async (tx) => {
    if (body.action === "under_review") {
      const rows = await tx
        .update(partnerApplications)
        .set({ status: "under_review", updatedAt: now, reviewedBy: admin.userId, reviewedAt: now })
        .where(
          and(
            eq(partnerApplications.id, current.id),
            inArray(partnerApplications.status, ["pending", "under_review"]),
          ),
        )
        .returning();
      if (!rows.length) return false;
      await tx
        .insert(partnerApplicationAudit)
        .values({
          id: randomUUID(),
          applicationId: current.id,
          actor: admin.userId,
          action: "under_review",
        });
    } else if (body.action === "approve") {
      const invitation = createInvitation();
      token = invitation.token;
      const rows = await tx
        .update(partnerApplications)
        .set({
          status: "approved",
          updatedAt: now,
          reviewedBy: admin.userId,
          reviewedAt: now,
          invitationHash: invitation.hash,
          invitationExpiresAt: new Date(now.getTime() + 7 * 86400000),
          invitationUsedAt: null,
        })
        .where(
          and(
            eq(partnerApplications.id, current.id),
            inArray(partnerApplications.status, ["pending", "under_review"]),
          ),
        )
        .returning();
      if (!rows.length) return false;
      await tx
        .insert(partnerApplicationEmails)
        .values({
          id: randomUUID(),
          applicationId: current.id,
          kind: "approved",
          recipient: current.email,
          payload: encryptEmailPayload({ invite: token }),
        });
      await tx
        .insert(partnerApplicationAudit)
        .values({
          id: randomUUID(),
          applicationId: current.id,
          actor: admin.userId,
          action: "approved",
        });
    } else {
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
      const rows = await tx
        .update(partnerApplications)
        .set({
          status: "rejected",
          updatedAt: now,
          reviewedBy: admin.userId,
          reviewedAt: now,
          rejectionReason: reason || null,
        })
        .where(
          and(
            eq(partnerApplications.id, current.id),
            inArray(partnerApplications.status, ["pending", "under_review"]),
          ),
        )
        .returning();
      if (!rows.length) return false;
      await tx
        .insert(partnerApplicationEmails)
        .values({
          id: randomUUID(),
          applicationId: current.id,
          kind: "rejected",
          recipient: current.email,
        });
      await tx
        .insert(partnerApplicationAudit)
        .values({
          id: randomUUID(),
          applicationId: current.id,
          actor: admin.userId,
          action: "rejected",
          reason: reason || null,
        });
    }
    return true;
  });
  if (!changed)
    return NextResponse.json(
      { error: "The application state changed. Refresh and review it again." },
      { status: 409 },
    );
  const email = await db.query.partnerApplicationEmails.findMany({
    where: eq(partnerApplicationEmails.applicationId, current.id),
    orderBy: asc(partnerApplicationEmails.createdAt),
  });
  for (const row of email.slice(-1))
    await (await import("@/lib/partners/public-applications")).deliverApplicationEmail(row.id);
  return NextResponse.json(
    {
      ok: true,
      status:
        body.action === "under_review"
          ? "under_review"
          : body.action === "approve"
            ? "approved"
            : "rejected",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
