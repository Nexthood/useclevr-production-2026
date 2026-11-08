import { PartnerRuleError } from "@/lib/partners/errors";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import {
  partnerAccounts,
  partnerAdjustments,
  partnerAttributions,
  partnerAudit,
  partnerCommissions,
  partnerConfigs,
  partnerEvents,
  partnerEventReviews,
  partnerFxRates,
  partnerPayments,
  partnerPayoutItems,
  partnerPayouts,
  partnerSubscriptions,
  type PartnerPaymentEvidence,
} from "@/lib/db/schema";
import {
  accrualHold,
  addMonthsUtc,
  commission,
  computeLevel,
  defaultConfig,
  downgradeSince,
  type levels,
  approvedV1,
  eligibleAt,
  minor,
  nextLevelProgress,
  rateForLevel,
  refundTarget,
  resolveLevel,
  roundRatio,
  type ProgramConfig,
} from "./rules";

export type PartnerTx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export function database() {
  const db = getDb();
  if (!db) throw new PartnerRuleError("Partner database unavailable.");
  return db;
}
export const id = () => randomUUID();
export async function lockPartner(tx: PartnerTx, partnerId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`partner:${partnerId}`},0))`,
  );
}
export async function audit(
  tx: PartnerTx,
  partnerId: string | null,
  actor: string,
  action: string,
  reason: string,
  data: Record<string, unknown>,
) {
  await tx.insert(partnerAudit).values({ id: id(), partnerId, actor, action, reason, data });
}
export async function latestConfig(tx: PartnerTx, at = new Date()) {
  return tx.query.partnerConfigs.findFirst({
    where: lte(partnerConfigs.effectiveAt, at),
    orderBy: [
      desc(partnerConfigs.effectiveAt),
      desc(partnerConfigs.createdAt),
      desc(partnerConfigs.id),
    ],
  });
}
async function activeCustomers(tx: PartnerTx, partnerId: string, at: Date) {
  const result = await tx.execute(sql`
    select count(distinct a."userId")::int as count from "PartnerAttribution" a
    join "PartnerSubscription" s on s."userId"=a."userId"
    where a."partnerId"=${partnerId} and s.status='active' and s."periodEnd">${at}
      and exists (select 1 from "PartnerPayment" p where p."attributionId"=a.id
        and p."subscriptionId"=s.id and p."netMinor">0
        and p."netMinor">coalesce((select sum(x."netDeltaMinor") from "PartnerAdjustment" x where x."paymentId"=p.id),0))`);
  return Number(result.rows[0]?.count || 0);
}
async function revenueUsd(tx: PartnerTx, partnerId: string, at: Date) {
  const result = await tx.execute(sql`
    select coalesce(sum(p."usdMinor"-coalesce((select sum(x."usdDeltaMinor") from "PartnerAdjustment" x where x."paymentId"=p.id),0)),0)::text as total
    from "PartnerPayment" p where p."partnerId"=${partnerId} and p."paidAt">${addMonthsUtc(at, -12)} and p."paidAt"<=${at}`);
  return BigInt(String(result.rows[0]?.total || "0"));
}
export async function refreshLevel(
  tx: PartnerTx,
  partnerId: string,
  config: ProgramConfig,
  at = new Date(),
) {
  const partner = await tx.query.partnerAccounts.findFirst({
    where: eq(partnerAccounts.id, partnerId),
  });
  if (!partner) throw new PartnerRuleError("Partner not found.");
  const customers = await activeCustomers(tx, partnerId, at);
  const revenue = await revenueUsd(tx, partnerId, at);
  const candidate = computeLevel(customers, revenue, config);
  const since = downgradeSince(partner.level, candidate, partner.candidateSince, at);
  if (
    (since?.getTime() ?? null) !== (partner.candidateSince?.getTime() ?? null) ||
    partner.candidateLevel !== candidate
  )
    await audit(
      tx,
      partnerId,
      "system",
      "qualification_shortfall",
      "Continuous qualification evaluation",
      {
        at: at.toISOString(),
        since: since?.toISOString() || null,
        level: partner.level,
        candidate,
      },
    );
  const level = resolveLevel(partner.level, candidate, since || at, at, config.downgradeGraceDays);
  await tx
    .update(partnerAccounts)
    .set({
      level,
      candidateLevel: candidate,
      candidateSince: level !== partner.level ? null : since,
    })
    .where(eq(partnerAccounts.id, partnerId));
  if (level !== partner.level)
    await audit(
      tx,
      partnerId,
      "system",
      "level_change",
      "Verified customer count and rolling collected revenue",
      {
        from: partner.level,
        to: level,
        rateBps: rateForLevel(level, config),
        at: at.toISOString(),
      },
    );
  return { level, customers, revenue };
}

export type FinancialEvidence =
  | { kind: "payment"; payment: PartnerPaymentEvidence }
  | {
      kind: "adjustment";
      chargeId: string;
      refundedGrossMinor: string;
      disputedGrossMinor: string;
      observedAt: string;
    }
  | { kind: "unsupported"; reason: string };

export async function ingestPartnerEvent(
  eventId: string,
  type: string,
  objectId: string,
  evidence: FinancialEvidence,
) {
  const db = database();
  await db
    .insert(partnerEvents)
    .values({
      id: eventId,
      type,
      objectId,
      evidence: evidence as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing();
  return replayPartnerEvent(eventId);
}

export async function replayPartnerEvent(eventId: string) {
  return database().transaction((tx) => replayInTransaction(tx, eventId));
}
async function replayInTransaction(tx: PartnerTx, eventId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`partner-event:${eventId}`},0))`,
  );
  const event = await tx.query.partnerEvents.findFirst({ where: eq(partnerEvents.id, eventId) });
  if (!event) throw new PartnerRuleError("Event not found.");
  if (event.status === "processed" || event.status === "excluded")
    return { status: event.status, duplicate: true };
  const evidence = event.evidence as unknown as FinancialEvidence;
  let reason: string | null;
  if (evidence.kind === "payment") reason = await processPayment(tx, eventId, evidence.payment);
  else if (evidence.kind === "adjustment") reason = await processAdjustment(tx, eventId, evidence);
  else reason = evidence.reason;
  const status = reason ? (reason.startsWith("excluded:") ? "excluded" : "held") : "processed";
  await tx.update(partnerEvents).set({ status, reason }).where(eq(partnerEvents.id, eventId));
  return { status, reason };
}

export async function reviewPartnerEvent(input: {
  eventId: string;
  configId: string;
  level: (typeof levels)[number];
  evidence: string;
  actor: string;
  reason: string;
}) {
  return database().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`partner-event:${input.eventId}`},0))`,
    );
    const event = await tx.query.partnerEvents.findFirst({
      where: eq(partnerEvents.id, input.eventId),
    });
    const evidence = event?.evidence as unknown as FinancialEvidence | undefined;
    if (!event || event.status !== "held" || evidence?.kind !== "payment")
      throw new PartnerRuleError("Review requires a held verified payment event.");
    let attribution = await tx.query.partnerAttributions.findFirst({
      where: eq(partnerAttributions.userId, evidence.payment.userId),
    });
    if (!attribution) throw new PartnerRuleError("Verified commercial attribution required.");
    await lockPartner(tx, attribution.partnerId);
    attribution = (await tx.query.partnerAttributions.findFirst({
      where: eq(partnerAttributions.id, attribution.id),
    }))!;
    const partner = await tx.query.partnerAccounts.findFirst({
      where: eq(partnerAccounts.id, attribution.partnerId),
    });
    const config = await tx.query.partnerConfigs.findFirst({
      where: eq(partnerConfigs.id, input.configId),
    });
    const current = await latestConfig(tx);
    if (
      partner?.status !== "active" ||
      partner.payoutHold ||
      attribution.relatedParty !== "unrelated" ||
      !current?.config.enabled ||
      !config?.config.enabled ||
      !approvedV1(config.config) ||
      config.effectiveAt > new Date()
    )
      throw new PartnerRuleError(
        "Recovery requires reinstatement, cleared holds, unrelated attribution, and an effective approved policy.",
      );
    if (!input.evidence.trim() || !input.reason.trim() || !input.actor)
      throw new PartnerRuleError("Recovery evidence, reason, and actor are required.");
    const original = await latestConfig(tx, new Date(evidence.payment.paidAt));
    // The reviewed version and level authorize this one historical accrual, never a recalculation.
    await tx.insert(partnerEventReviews).values({
      eventId: input.eventId,
      partnerId: partner.id,
      configId: config.id,
      level: input.level,
      actor: input.actor,
      reason: input.reason,
      evidence: input.evidence,
    });
    const result = await replayInTransaction(tx, input.eventId);
    await audit(tx, partner.id, input.actor, "held_payment_review", input.reason, {
      eventId: input.eventId,
      originalConfigId: original?.id || null,
      configId: config.id,
      level: input.level,
      rateBps: rateForLevel(input.level, config.config),
      evidence: input.evidence,
      result,
    });
    return result;
  });
}

export async function writeProgramConfig(
  tx: PartnerTx,
  config: ProgramConfig,
  actor: string,
  reason: string,
  requestedEffectiveAt?: Date,
) {
  if (!approvedV1(config))
    throw new PartnerRuleError(
      "Global Partner Program v1 requires the owner-approved rates, thresholds, and policies.",
    );
  const effectiveAt = requestedEffectiveAt || new Date();
  if (
    !Number.isFinite(effectiveAt.getTime()) ||
    (requestedEffectiveAt && effectiveAt.getTime() < Date.now())
  )
    throw new PartnerRuleError("Configuration effective dates cannot be backdated.");
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('partner-config',0))`);
  const before = await latestConfig(tx);
  const configId = id();
  await tx.insert(partnerConfigs).values({ id: configId, config, effectiveAt, actor, reason });
  await audit(tx, null, actor, "program_configuration", reason, {
    beforeConfigId: before?.id || null,
    configId,
    config,
    effectiveAt: effectiveAt.toISOString(),
  });
  return configId;
}

async function processPayment(
  tx: PartnerTx,
  eventId: string,
  payment: PartnerPaymentEvidence,
): Promise<string | null> {
  let attribution = await tx.query.partnerAttributions.findFirst({
    where: eq(partnerAttributions.userId, payment.userId),
  });
  // Hold missing attribution: signup verification and payment delivery can race.
  if (!attribution) return "attribution_missing";
  await lockPartner(tx, attribution.partnerId);
  attribution = (await tx.query.partnerAttributions.findFirst({
    where: eq(partnerAttributions.id, attribution.id),
  }))!;
  if (
    await tx.query.partnerPayments.findFirst({
      where: eq(partnerPayments.chargeId, payment.chargeId),
    })
  )
    return null;
  const partner = await tx.query.partnerAccounts.findFirst({
    where: eq(partnerAccounts.id, attribution.partnerId),
  });
  if (!partner || partner.userId === payment.userId) return "excluded:self_referral";
  const paidAt = new Date(payment.paidAt);
  const futureLevel = await tx.query.partnerAudit.findFirst({
    where: and(
      eq(partnerAudit.partnerId, partner.id),
      eq(partnerAudit.action, "level_change"),
      sql`${partnerAudit.data}->>'at' > ${payment.paidAt}`,
    ),
  });
  const review = await tx.query.partnerEventReviews.findFirst({
    where: eq(partnerEventReviews.eventId, eventId),
  });
  if (futureLevel && !review) return "historical_level_review";
  const configRow = review
    ? await tx.query.partnerConfigs.findFirst({ where: eq(partnerConfigs.id, review.configId) })
    : await latestConfig(tx, paidAt);
  if (!configRow) return "historical_config_missing";
  const config = configRow.config;
  if (!(await latestConfig(tx))?.config.enabled) return "program_disabled";
  if (partner.status === "suspended") return "suspended_hold";
  if (partner.status === "terminated" && !partner.terminatedAt) return "termination_date_review";
  if (partner.terminatedAt && paidAt >= partner.terminatedAt) return "excluded:terminated_stop";
  if (review && (partner.status !== "active" || partner.payoutHold)) return "partner_review_hold";
  const statusChanges = await tx.query.partnerAudit.findMany({
    where: and(
      eq(partnerAudit.partnerId, partner.id),
      eq(partnerAudit.action, "partner_changed"),
      lte(partnerAudit.createdAt, paidAt),
    ),
    orderBy: desc(partnerAudit.createdAt),
    limit: 1,
  });
  const historicalStatus =
    (statusChanges[0]?.data.after as { status?: string } | undefined)?.status ||
    (partner.approvedAt && paidAt >= partner.approvedAt ? "active" : "pending");
  const hold = accrualHold(config, review ? "active" : historicalStatus, attribution.relatedParty);
  if (hold)
    return hold.endsWith("_stop") || hold === "related_party_exclude" ? `excluded:${hold}` : hold;
  if (!partner.approvedAt || paidAt < partner.approvedAt) return "excluded:before_approval";
  const laterPayment = await tx.query.partnerPayments.findFirst({
    where: and(
      eq(partnerPayments.partnerId, partner.id),
      gte(partnerPayments.paidAt, new Date(paidAt.getTime() + 1)),
    ),
  });
  if (laterPayment && !review) return "out_of_order_payment_review";
  const currency = payment.currency.toUpperCase();
  const gross = minor(payment.grossMinor),
    net = minor(payment.netMinor);
  if (gross <= BigInt(0) || net > gross) return "invalid_payment_amounts";
  const fx =
    currency === "USD"
      ? null
      : await tx.query.partnerFxRates.findFirst({
          where: and(
            eq(partnerFxRates.currency, currency),
            eq(partnerFxRates.day, payment.paidAt.slice(0, 10)),
          ),
        });
  if (currency !== "USD" && !fx) return "fx_rate_missing";
  const usd = fx ? roundRatio(net, BigInt(fx.numerator), BigInt(fx.denominator)) : net;
  const paymentId = id();
  await tx
    .insert(partnerSubscriptions)
    .values({
      id: payment.subscriptionId,
      userId: payment.userId,
      status: payment.subscriptionStatus,
      periodEnd: new Date(payment.subscriptionPeriodEnd),
      eventCreated: Math.floor(Date.now() / 1000),
      canceled: payment.subscriptionStatus === "canceled",
    })
    .onConflictDoNothing({ target: partnerSubscriptions.id });
  await tx.insert(partnerPayments).values({
    id: paymentId,
    invoiceId: payment.invoiceId,
    chargeId: payment.chargeId,
    subscriptionId: payment.subscriptionId,
    attributionId: attribution.id,
    partnerId: partner.id,
    currency,
    grossMinor: gross.toString(),
    netMinor: net.toString(),
    usdMinor: usd.toString(),
    fxRateId: fx?.id,
    paidAt,
  });
  const firstEvidence = await tx.execute(sql`select min(e.evidence->'payment'->>'paidAt') as first
    from "PartnerEvent" e where e.evidence->>'kind'='payment'
      and e.evidence->'payment'->>'userId'=${payment.userId}`);
  const firstPaidAt = new Date(String(firstEvidence.rows[0]?.first || payment.paidAt));
  const anchor =
    attribution.eligibilityStart ||
    (config.eligibilityAnchor === "signup" ? attribution.signedUpAt : firstPaidAt);
  if (
    attribution.eligibilityStart &&
    firstPaidAt < attribution.eligibilityStart &&
    config.eligibilityAnchor === "first_payment"
  )
    throw new PartnerRuleError(
      "Earlier payment evidence conflicts with immutable eligibility; owner investigation required.",
    );
  if (!attribution.eligibilityStart)
    await tx
      .update(partnerAttributions)
      .set({ eligibilityStart: anchor, eligibilityEnd: addMonthsUtc(anchor, 12) })
      .where(eq(partnerAttributions.id, attribution.id));
  const level = review
    ? { level: review.level }
    : await refreshLevel(tx, partner.id, config, paidAt);
  if (eligibleAt(paidAt, anchor) && net > BigInt(0)) {
    const bps = rateForLevel(level.level, config);
    await tx.insert(partnerCommissions).values({
      id: id(),
      paymentId,
      partnerId: partner.id,
      configId: configRow.id,
      level: level.level,
      rateBps: bps,
      amountMinor: commission(net, bps).toString(),
      currency,
      earnedAt: paidAt,
    });
    await audit(
      tx,
      partner.id,
      "stripe",
      "commission_earned",
      "Successful collected subscription payment",
      { paymentId, eventId, configId: configRow.id, rateBps: bps },
    );
  } else
    await audit(
      tx,
      partner.id,
      "stripe",
      "payment_recorded",
      "Outside commission window or zero net revenue",
      { paymentId, eventId },
    );
  return null;
}

async function processAdjustment(
  tx: PartnerTx,
  eventId: string,
  evidence: Extract<FinancialEvidence, { kind: "adjustment" }>,
) {
  const payment = await tx.query.partnerPayments.findFirst({
    where: eq(partnerPayments.chargeId, evidence.chargeId),
  });
  if (!payment) return "original_payment_missing";
  await lockPartner(tx, payment.partnerId);
  if (
    await tx.query.partnerAdjustments.findFirst({
      where: and(
        eq(partnerAdjustments.eventId, eventId),
        eq(partnerAdjustments.paymentId, payment.id),
      ),
    })
  )
    return null;
  const earned = await tx.query.partnerCommissions.findFirst({
    where: eq(partnerCommissions.paymentId, payment.id),
  });
  const adjustments = await tx.query.partnerAdjustments.findMany({
    where: eq(partnerAdjustments.paymentId, payment.id),
  });
  if (adjustments.length) {
    const events = await tx.query.partnerEvents.findMany({
      where: inArray(
        partnerEvents.id,
        adjustments.map((a) => a.eventId),
      ),
    });
    if (events.some((e) => String(e.evidence.observedAt || "") > evidence.observedAt))
      return "excluded:stale_adjustment";
  }
  const sum = (field: "commissionDeltaMinor" | "netDeltaMinor" | "usdDeltaMinor") =>
    adjustments.reduce((s, a) => s + BigInt(a[field]), BigInt(0));
  const refunded = minor(evidence.refundedGrossMinor),
    disputed = minor(evidence.disputedGrossMinor);
  // Reconcile current authoritative cumulative loss, cap overlap at the payment amount.
  const gross = BigInt(payment.grossMinor);
  const target = refunded + disputed > gross ? gross : refunded + disputed;
  const previousTarget = adjustments.reduce(
    (total, a) => total + BigInt(a.grossDeltaMinor),
    BigInt(0),
  );
  if (target === previousTarget) return null;
  const commissionTarget = refundTarget(BigInt(earned?.amountMinor || "0"), target, gross);
  await tx.insert(partnerAdjustments).values({
    id: id(),
    paymentId: payment.id,
    eventId,
    kind: disputed > BigInt(0) ? "dispute" : "refund_reconciliation",
    grossTargetMinor: target.toString(),
    grossDeltaMinor: (target - previousTarget).toString(),
    commissionDeltaMinor: (commissionTarget - sum("commissionDeltaMinor")).toString(),
    netDeltaMinor: (
      refundTarget(BigInt(payment.netMinor), target, gross) - sum("netDeltaMinor")
    ).toString(),
    usdDeltaMinor: (
      refundTarget(BigInt(payment.usdMinor), target, gross) - sum("usdDeltaMinor")
    ).toString(),
  });
  if (earned && earned.state !== "paid")
    await tx
      .update(partnerCommissions)
      .set({ state: commissionTarget >= BigInt(earned.amountMinor) ? "reversed" : "pending" })
      .where(eq(partnerCommissions.id, earned.id));
  await audit(
    tx,
    payment.partnerId,
    "stripe",
    "payment_adjusted",
    "Authoritative cumulative refund/dispute reconciliation",
    {
      eventId,
      paymentId: payment.id,
      grossTargetMinor: target.toString(),
      afterPayout: earned?.state === "paid",
    },
  );
  const config = (await latestConfig(tx))?.config || defaultConfig;
  await refreshLevel(tx, payment.partnerId, config);
  return null;
}

export async function updatePartnerSubscription(input: {
  id: string;
  userId: string;
  status: string;
  periodEnd: Date;
  eventCreated: number;
  canceled: boolean;
}) {
  await database()
    .insert(partnerSubscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: partnerSubscriptions.id,
      set: input,
      setWhere: sql`${partnerSubscriptions.eventCreated} <= ${input.eventCreated}`,
    });
}

export async function partnerSummary(partnerId: string, admin = false, offset = 0) {
  return database().transaction(async (tx) => {
    await lockPartner(tx, partnerId);
    const partner = await tx.query.partnerAccounts.findFirst({
      where: eq(partnerAccounts.id, partnerId),
    });
    if (!partner) throw new PartnerRuleError("Partner not found.");
    const config = (await latestConfig(tx))?.config || defaultConfig;
    const level = await refreshLevel(tx, partnerId, config);
    const commissions = await tx.query.partnerCommissions.findMany({
      where: eq(partnerCommissions.partnerId, partnerId),
      orderBy: [desc(partnerCommissions.earnedAt), desc(partnerCommissions.id)],
      limit: 50,
      offset,
    });
    const payouts = await tx.query.partnerPayouts.findMany({
      where: eq(partnerPayouts.partnerId, partnerId),
      orderBy: desc(partnerPayouts.createdAt),
      limit: 50,
    });
    const countResult = await tx.execute(
      sql`select count(*)::int as total from "PartnerAttribution" where "partnerId"=${partnerId}`,
    );
    const attributes = admin
      ? await tx.query.partnerAttributions.findMany({
          where: eq(partnerAttributions.partnerId, partnerId),
          orderBy: desc(partnerAttributions.signedUpAt),
          limit: 50,
          offset,
        })
      : undefined;
    const paymentIds = commissions.map((c) => c.paymentId);
    const adjustments = paymentIds.length
      ? await tx.query.partnerAdjustments.findMany({
          where: inArray(partnerAdjustments.paymentId, paymentIds),
        })
      : [];
    const items = commissions.length
      ? await tx.query.partnerPayoutItems.findMany({
          where: inArray(
            partnerPayoutItems.commissionId,
            commissions.map((c) => c.id),
          ),
        })
      : [];
    const aggregate = await tx.execute(sql`
      with adjustments as (select "paymentId",sum("netDeltaMinor") as net,sum("commissionDeltaMinor") as amount from "PartnerAdjustment" group by "paymentId"),
      settled as (select "commissionId",sum("amountMinor") as amount from "PartnerPayoutItem" group by "commissionId"),
      revenue as (select p.currency,sum(p."netMinor"-coalesce(a.net,0)) as amount from "PartnerPayment" p left join adjustments a on a."paymentId"=p.id where p."partnerId"=${partnerId} group by p.currency),
      earned as (select c.currency,sum(c."amountMinor"-coalesce(a.amount,0)) as amount,sum(coalesce(a.amount,0)) as adjusted,sum(coalesce(s.amount,0)) as paid,
        sum(case when c.state='pending' then c."amountMinor"-coalesce(a.amount,0)-coalesce(s.amount,0) else 0 end) as pending,
        sum(case when c.state='approved' then c."amountMinor"-coalesce(a.amount,0)-coalesce(s.amount,0) else 0 end) as approved,
        sum(case when c.state in ('approved','paid') then c."amountMinor"-coalesce(a.amount,0)-coalesce(s.amount,0) else 0 end) as settlement
        from "PartnerCommission" c left join adjustments a on a."paymentId"=c."paymentId" left join settled s on s."commissionId"=c.id where c."partnerId"=${partnerId} group by c.currency)
      select coalesce(r.currency,e.currency) as currency,coalesce(r.amount,0)::text as revenue,coalesce(e.amount,0)::text as earned,
      coalesce(e.pending,0)::text as pending,coalesce(e.approved,0)::text as approved,coalesce(e.paid,0)::text as paid,coalesce(e.adjusted,0)::text as adjustments,
      (coalesce(e.amount,0)-coalesce(e.paid,0))::text as liability,coalesce(e.settlement,0)::text as settlement
      from revenue r full join earned e on e.currency=r.currency`);
    type Balance = {
      revenue: string;
      earned: string;
      pending: string;
      approved: string;
      paid: string;
      adjustments: string;
      liability: string;
      settlement: string;
    };
    const balances = Object.fromEntries(
      aggregate.rows.map((row) => [String(row.currency), row as unknown as Balance]),
    );
    const history = commissions.map((c) => {
      const adjusted = adjustments
        .filter((a) => a.paymentId === c.paymentId)
        .reduce((s, a) => s + BigInt(a.commissionDeltaMinor), BigInt(0));
      const settled = items
        .filter((i) => i.commissionId === c.id)
        .reduce((s, i) => s + BigInt(i.amountMinor), BigInt(0));
      return {
        ...c,
        adjustedMinor: adjusted.toString(),
        settledMinor: settled.toString(),
        dueMinor: (BigInt(c.amountMinor) - adjusted - settled).toString(),
      };
    });
    return {
      partner: {
        id: partner.id,
        name: partner.name,
        country: partner.country,
        market: partner.market,
        status: partner.status,
        code: partner.code,
        level: level.level,
        agreement: partner.agreement,
        payoutHold: partner.payoutHold,
        terminatedAt: partner.terminatedAt,
        ...(admin
          ? {
              userId: partner.userId,
              notes: partner.notes,
              application: partner.application,
              downgradeSince: partner.candidateSince,
            }
          : {}),
      },
      rateBps: rateForLevel(level.level, config),
      activeCustomers: level.customers,
      totalCustomers: Number(countResult.rows[0]?.total || 0),
      rollingUsdMinor: level.revenue.toString(),
      progress: nextLevelProgress(level.level, level.customers, level.revenue, config),
      balances,
      commissions: history,
      payouts: admin
        ? payouts
        : payouts.map(({ id, currency, amountMinor, reference, createdAt }) => ({
            id,
            currency,
            amountMinor,
            reference,
            createdAt,
          })),
      adjustments,
      offset,
      nextOffset: commissions.length === 50 ? offset + 50 : null,
      ...(admin
        ? {
            attributions: attributes,
            audit: await tx.query.partnerAudit.findMany({
              where: eq(partnerAudit.partnerId, partnerId),
              orderBy: desc(partnerAudit.createdAt),
              limit: 100,
            }),
          }
        : {}),
    };
  });
}

export async function approveCommission(
  tx: PartnerTx,
  commissionId: string,
  actor: string,
  reason: string,
) {
  const c = await tx.query.partnerCommissions.findFirst({
    where: eq(partnerCommissions.id, commissionId),
  });
  if (!c) throw new PartnerRuleError("Commission not found.");
  await lockPartner(tx, c.partnerId);
  const current = await tx.query.partnerCommissions.findFirst({
    where: eq(partnerCommissions.id, commissionId),
  });
  const config = (await latestConfig(tx))?.config || defaultConfig;
  const partner = await tx.query.partnerAccounts.findFirst({
    where: eq(partnerAccounts.id, c.partnerId),
  });
  const payment = await tx.query.partnerPayments.findFirst({
    where: eq(partnerPayments.id, c.paymentId),
  });
  if (payment) await assertSettlementAttribution(tx, payment.attributionId);
  const unresolved =
    payment &&
    (await tx.query.partnerEvents.findFirst({
      where: and(eq(partnerEvents.objectId, payment.chargeId), eq(partnerEvents.status, "held")),
    }));
  if (unresolved) throw new PartnerRuleError("Payment reconciliation is held for review.");
  if (
    !config.enabled ||
    config.waitingDays === null ||
    !partner ||
    !settlementStatusAllowed(partner, c.earnedAt)
  )
    throw new PartnerRuleError(
      "Approval requires an eligible partner, cleared payout review, and an approved waiting period.",
    );
  if (
    current?.state !== "pending" ||
    Date.now() < c.earnedAt.getTime() + config.waitingDays * 86400000
  )
    throw new PartnerRuleError("Commission is not eligible for approval.");
  await tx
    .update(partnerCommissions)
    .set({ state: "approved" })
    .where(eq(partnerCommissions.id, c.id));
  await audit(tx, c.partnerId, actor, "commission_approved", reason, { commissionId });
}

export async function recordPayout(
  tx: PartnerTx,
  partnerId: string,
  currency: string,
  reference: string,
  expectedMinor: string,
  actor: string,
  reason: string,
) {
  await lockPartner(tx, partnerId);
  const config = (await latestConfig(tx))?.config || defaultConfig;
  const partner = await tx.query.partnerAccounts.findFirst({
    where: eq(partnerAccounts.id, partnerId),
  });
  const minimum = config.minimumPayoutMinor?.[currency];
  if (
    !config.enabled ||
    minimum === undefined ||
    !config.postPayoutRefund ||
    config.waitingDays === null ||
    !partner ||
    !settlementStatusAllowed(partner)
  )
    throw new PartnerRuleError("Payout policy or active partner approval is missing.");
  const statement = await tx.execute(sql`
    select c.id,c.state,c."earnedAt",c."paymentId",(c."amountMinor"
      -coalesce((select sum(a."commissionDeltaMinor") from "PartnerAdjustment" a where a."paymentId"=c."paymentId"),0)
      -coalesce((select sum(i."amountMinor") from "PartnerPayoutItem" i where i."commissionId"=c.id),0))::text as due
    from "PartnerCommission" c where c."partnerId"=${partnerId} and c.currency=${currency} and c.state in ('approved','paid')`);
  if (await tx.query.partnerPayouts.findFirst({ where: eq(partnerPayouts.reference, reference) }))
    throw new PartnerRuleError(
      "Settlement reference is already recorded. Review the existing settlement.",
    );
  const allocations: { commissionId: string; amountMinor: string }[] = [];
  for (const c of statement.rows) {
    const due = BigInt(String(c.due));
    if (due === BigInt(0)) continue;
    if (due < BigInt(0) && config.postPayoutRefund !== "offset")
      throw new PartnerRuleError("Post-payout adjustment requires owner review.");
    if (!settlementStatusAllowed(partner, new Date(String(c.earnedAt))))
      throw new PartnerRuleError("Only pre-termination commissions may settle after termination.");
    if (due > BigInt(0) && c.state === "paid")
      throw new PartnerRuleError("Restored paid commission requires owner review.");
    if (
      due > BigInt(0) &&
      Date.now() < new Date(String(c.earnedAt)).getTime() + config.waitingDays * 86400000
    )
      throw new PartnerRuleError("The current payout waiting period has not elapsed.");
    const payment = await tx.query.partnerPayments.findFirst({
      where: eq(partnerPayments.id, String(c.paymentId)),
    });
    if (payment) await assertSettlementAttribution(tx, payment.attributionId);
    const held =
      payment &&
      (await tx.query.partnerEvents.findFirst({
        where: and(eq(partnerEvents.objectId, payment.chargeId), eq(partnerEvents.status, "held")),
      }));
    if (held)
      throw new PartnerRuleError("Resolve held payment adjustments before recording a payout.");
    allocations.push({ commissionId: String(c.id), amountMinor: due.toString() });
  }
  const total = allocations.reduce((s, a) => s + BigInt(a.amountMinor), BigInt(0));
  if (total <= BigInt(0) || total < BigInt(minimum) || total !== minor(expectedMinor))
    throw new PartnerRuleError(
      "Payout amount changed or minimum is not met. Refresh the statement.",
    );
  const payoutId = id();
  await tx
    .insert(partnerPayouts)
    .values({ id: payoutId, partnerId, currency, amountMinor: total.toString(), reference, actor });
  await tx
    .insert(partnerPayoutItems)
    .values(allocations.map((a) => ({ id: id(), payoutId, ...a })));
  await tx
    .update(partnerCommissions)
    .set({ state: "paid" })
    .where(
      inArray(
        partnerCommissions.id,
        allocations.map((a) => a.commissionId),
      ),
    );
  await audit(tx, partnerId, actor, "manual_payout_recorded", reason, {
    payoutId,
    reference,
    currency,
    amountMinor: total.toString(),
  });
  return payoutId;
}

function settlementStatusAllowed(partner: typeof partnerAccounts.$inferSelect, earnedAt?: Date) {
  if (partner.payoutHold) return false;
  if (partner.status === "active") return true;
  return (
    partner.status === "terminated" &&
    !!partner.terminatedAt &&
    (!earnedAt || earnedAt < partner.terminatedAt)
  );
}
async function assertSettlementAttribution(tx: PartnerTx, attributionId: string) {
  const attr = await tx.query.partnerAttributions.findFirst({
    where: eq(partnerAttributions.id, attributionId),
  });
  if (attr?.relatedParty !== "unrelated")
    throw new PartnerRuleError("Settlement requires an evidenced unrelated-party classification.");
}
