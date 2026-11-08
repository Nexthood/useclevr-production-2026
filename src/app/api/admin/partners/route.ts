import { PartnerRuleError } from "@/lib/partners/errors";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/require-session";
import {
  partnerAccounts,
  partnerAttributions,
  partnerConfigs,
  partnerEvents,
  partnerFxRates,
  users,
} from "@/lib/db/schema";
import { validWriteOrigin, partnerApiError } from "@/lib/partners/api";
import { configSchema, defaultConfig, levels } from "@/lib/partners/rules";
import {
  approveCommission,
  audit,
  database,
  id,
  latestConfig,
  lockPartner,
  partnerSummary,
  recordPayout,
  replayPartnerEvent,
  reviewPartnerEvent,
  writeProgramConfig,
} from "@/lib/partners/store";
import { getAccountReferralCode } from "@/lib/referrals/owner-code";
import { financialReport } from "@/lib/partners/export";

const identity = z.string().min(1).max(100);
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    userId: identity,
    name: z.string().min(1).max(200),
    country: z.string().regex(/^[A-Z]{2}$/),
    market: z.string().max(200).nullable(),
    agreement: z.string().min(1).max(4000),
  }),
  z.object({
    action: z.literal("partner"),
    partnerId: identity,
    status: z.enum(["active", "rejected", "suspended", "terminated"]),
    notes: z.string().max(4000),
    country: z.string().regex(/^[A-Z]{2}$/),
    market: z.string().max(200).nullable(),
    agreement: z.string().min(1).max(4000),
  }),
  z.object({
    action: z.literal("config"),
    config: configSchema,
    effectiveAt: z.iso.datetime().optional(),
  }),
  z.object({
    action: z.literal("review_event"),
    eventId: identity,
    configId: identity,
    level: z.enum(levels),
    evidence: z.string().trim().min(1).max(4000),
  }),
  z.object({
    action: z.literal("payout_review"),
    partnerId: identity,
    release: z.boolean(),
    evidence: z.string().trim().min(1).max(4000),
  }),
  z.object({
    action: z.literal("fx"),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .refine((v) => v !== "USD"),
    day: z.iso.date(),
    numerator: z.string().regex(/^[1-9]\d{0,23}$/),
    denominator: z.string().regex(/^[1-9]\d{0,23}$/),
    source: z.url().max(1000),
  }),
  z.object({
    action: z.literal("related"),
    attributionId: identity,
    classification: z.enum(["unrelated", "related"]),
    evidence: z.string().trim().min(1).max(4000),
  }),
  z.object({ action: z.literal("approve"), commissionId: identity }),
  z.object({
    action: z.literal("payout"),
    partnerId: identity,
    currency: z.string().regex(/^[A-Z]{3}$/),
    reference: z.string().min(3).max(200),
    amountMinor: z.string().regex(/^[1-9]\d{0,17}$/),
  }),
  z.object({ action: z.literal("replay"), eventId: z.string().min(1).max(200) }),
]);

export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.error;
  try {
    const url = new URL(request.url),
      partnerId = url.searchParams.get("partnerId");
    if (partnerId) {
      if (url.searchParams.get("export") === "csv") {
        return new Response(financialReport(partnerId), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": "attachment; filename=partner-financial-report.csv",
            "Cache-Control": "private, no-store",
          },
        });
      }
      const summary = await partnerSummary(
        partnerId,
        true,
        Math.max(0, Number(url.searchParams.get("offset")) || 0),
      );
      return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
    }
    const q = (url.searchParams.get("q") || "").slice(0, 100);
    const offset = Math.max(0, Math.min(100000, Number(url.searchParams.get("offset")) || 0));
    const db = database();
    const partners = await db.query.partnerAccounts.findMany({
      where: q
        ? or(
            ilike(partnerAccounts.name, `%${q}%`),
            ilike(partnerAccounts.country, `%${q}%`),
            ilike(partnerAccounts.market, `%${q}%`),
          )
        : undefined,
      orderBy: desc(partnerAccounts.createdAt),
      limit: 50,
      offset,
    });
    const configurations = await db.query.partnerConfigs.findMany({
      orderBy: [desc(partnerConfigs.effectiveAt), desc(partnerConfigs.createdAt)],
      limit: 50,
    });
    const config = await db.transaction((tx) => latestConfig(tx));
    const heldEvents = await db.query.partnerEvents.findMany({
      where: eq(partnerEvents.status, "held"),
      orderBy: desc(partnerEvents.createdAt),
      limit: 50,
    });
    const totals = await db.execute(
      sql`select count(*)::int as total,count(*) filter(where status='active')::int as active from "PartnerAccount"`,
    );
    const liabilities = await db.execute(sql`select c.currency,
      sum(c."amountMinor"-coalesce((select sum(a."commissionDeltaMinor") from "PartnerAdjustment" a where a."paymentId"=c."paymentId"),0)-coalesce((select sum(i."amountMinor") from "PartnerPayoutItem" i where i."commissionId"=c.id),0))::text as "amountMinor"
      from "PartnerCommission" c group by c.currency`);
    return NextResponse.json(
      {
        partners,
        totals: totals.rows[0],
        config: config?.config || defaultConfig,
        configId: config?.id || null,
        configurations,
        heldEvents,
        liabilities: (liabilities as { rows: unknown[] }).rows,
        offset,
        nextOffset: partners.length === 50 ? offset + 50 : null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return partnerApiError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.error;
  if (!validWriteOrigin(request))
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const raw = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(
    raw && Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "reason")),
  );
  const reason = typeof raw?.reason === "string" ? raw.reason.trim() : "";
  if (!parsed.success || !reason || reason.length > 1000)
    return NextResponse.json(
      { error: "Valid action fields and an audit reason are required." },
      { status: 400 },
    );
  const body = parsed.data;
  try {
    if (body.action === "review_event") {
      return NextResponse.json(await reviewPartnerEvent({ ...body, actor: auth.userId, reason }));
    }
    if (body.action === "replay") {
      const result = await replayPartnerEvent(body.eventId);
      await database().transaction((tx) =>
        audit(tx, null, auth.userId, "event_replay", reason, { eventId: body.eventId, result }),
      );
      return NextResponse.json(result);
    }
    let code: string | undefined;
    if (body.action === "create") {
      const user = await database().query.users.findFirst({ where: eq(users.id, body.userId) });
      if (!user?.emailVerified) throw new PartnerRuleError("Verified partner account required.");
      code = await getAccountReferralCode(user.id, user.email);
    }
    const result = await database().transaction(async (tx) => {
      if (body.action === "create") {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`referral-owner:${body.userId}`},0))`,
        );
        const partnerId = id();
        await tx.insert(partnerAccounts).values({
          id: partnerId,
          userId: body.userId,
          code: code!,
          name: body.name,
          country: body.country,
          market: body.market,
          agreement: body.agreement,
        });
        await audit(tx, partnerId, auth.userId, "partner_registered", reason, {
          userId: body.userId,
          agreement: body.agreement,
        });
        return { partnerId };
      }
      if (body.action === "partner") {
        await lockPartner(tx, body.partnerId);
        const before = await tx.query.partnerAccounts.findFirst({
          where: eq(partnerAccounts.id, body.partnerId),
        });
        if (!before) throw new PartnerRuleError("Partner not found.");
        if (before.status === "terminated" && body.status !== "terminated")
          throw new PartnerRuleError("Termination requires a new reviewed agreement.");
        if (before.status === "rejected" && body.status !== "rejected")
          throw new PartnerRuleError("A rejected application cannot be reactivated.");
        if (body.status === "rejected" && !["pending", "rejected"].includes(before.status))
          throw new PartnerRuleError(
            "Only pending applications can be rejected; suspend or terminate approved partners.",
          );
        if (
          body.status === "active" &&
          before.status === "pending" &&
          body.agreement.startsWith("Application terms ")
        )
          throw new PartnerRuleError(
            "Record a reviewed participation agreement before approving this application.",
          );
        if (body.status === "active" && before.status === "pending") {
          const applicant = await tx.query.users.findFirst({ where: eq(users.id, before.userId) });
          if (!applicant?.emailVerified)
            throw new PartnerRuleError("Verified partner account required for approval.");
        }
        const terminating = body.status === "terminated" && before.status !== "terminated";
        await tx
          .update(partnerAccounts)
          .set({
            status: body.status,
            ...(terminating ? { terminatedAt: new Date(), payoutHold: true } : {}),
            notes: body.notes,
            country: body.country,
            market: body.market,
            agreement: body.agreement,
            approvedAt: before.approvedAt || (body.status === "active" ? new Date() : null),
          })
          .where(eq(partnerAccounts.id, body.partnerId));
        await audit(tx, body.partnerId, auth.userId, "partner_changed", reason, {
          before,
          after: body,
        });
      }
      if (body.action === "payout_review") {
        await lockPartner(tx, body.partnerId);
        const partner = await tx.query.partnerAccounts.findFirst({
          where: eq(partnerAccounts.id, body.partnerId),
        });
        if (
          !partner ||
          partner.status === "pending" ||
          partner.status === "rejected" ||
          partner.status === "suspended" ||
          (partner.status === "terminated" && !partner.terminatedAt)
        )
          throw new PartnerRuleError(
            "Payout review requires an approved active partner or a dated termination.",
          );
        await tx
          .update(partnerAccounts)
          .set({ payoutHold: !body.release })
          .where(eq(partnerAccounts.id, partner.id));
        await audit(tx, partner.id, auth.userId, "payout_review", reason, {
          beforeHold: partner.payoutHold,
          afterHold: !body.release,
          status: partner.status,
          terminatedAt: partner.terminatedAt,
          evidence: body.evidence,
        });
      }
      if (body.action === "config") {
        const configId = await writeProgramConfig(
          tx,
          body.config,
          auth.userId,
          reason,
          body.effectiveAt ? new Date(body.effectiveAt) : undefined,
        );
        return { configId };
      }
      if (body.action === "fx") {
        await tx.insert(partnerFxRates).values({
          id: id(),
          currency: body.currency,
          day: body.day,
          numerator: body.numerator,
          denominator: body.denominator,
          source: body.source,
          actor: auth.userId,
        });
        await audit(tx, null, auth.userId, "fx_rate_recorded", reason, { ...body });
      }
      if (body.action === "related") {
        let attr = await tx.query.partnerAttributions.findFirst({
          where: eq(partnerAttributions.id, body.attributionId),
        });
        if (!attr) throw new PartnerRuleError("Attribution not found.");
        await lockPartner(tx, attr.partnerId);
        attr = (await tx.query.partnerAttributions.findFirst({
          where: eq(partnerAttributions.id, attr.id),
        }))!;
        await tx
          .update(partnerAttributions)
          .set({ relatedParty: body.classification })
          .where(eq(partnerAttributions.id, attr.id));
        await audit(tx, attr.partnerId, auth.userId, "related_party_review", reason, {
          attributionId: attr.id,
          before: attr.relatedParty,
          after: body.classification,
          evidence: body.evidence,
        });
      }
      if (body.action === "approve")
        await approveCommission(tx, body.commissionId, auth.userId, reason);
      if (body.action === "payout")
        return {
          payoutId: await recordPayout(
            tx,
            body.partnerId,
            body.currency,
            body.reference,
            body.amountMinor,
            auth.userId,
            reason,
          ),
        };
      return { success: true };
    });
    return NextResponse.json(result);
  } catch (error) {
    return partnerApiError(error);
  }
}
