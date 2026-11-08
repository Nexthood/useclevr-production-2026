import { z } from "zod";

export const levels = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export type PartnerLevel = (typeof levels)[number];
export const configSchema = z
  .object({
    enabled: z.boolean(),
    standardBps: z.number().int().min(0).max(10000),
    premiumBps: z.number().int().min(0).max(10000),
    silverCustomers: z.number().int().positive(),
    goldCustomers: z.number().int().positive(),
    platinumUsdMinor: z.string().regex(/^[1-9]\d{0,17}$/),
    diamondUsdMinor: z.string().regex(/^[1-9]\d{0,17}$/),
    eligibilityAnchor: z.enum(["signup", "first_payment"]).nullable(),
    suspendedAccrual: z.enum(["hold", "continue", "stop"]).nullable(),
    terminatedAccrual: z.enum(["hold", "continue", "stop"]).nullable(),
    downgradeGraceDays: z.number().int().min(0).max(365).nullable(),
    relatedParty: z.enum(["hold", "exclude", "allow"]).nullable(),
    waitingDays: z.number().int().min(0).max(365).nullable(),
    minimumPayoutMinor: z
      .record(z.string().regex(/^[A-Z]{3}$/), z.string().regex(/^\d{1,18}$/))
      .nullable(),
    postPayoutRefund: z.enum(["hold", "offset"]).nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.silverCustomers >= v.goldCustomers ||
      BigInt(v.platinumUsdMinor) >= BigInt(v.diamondUsdMinor)
    ) {
      ctx.addIssue({ code: "custom", message: "Level thresholds must increase." });
    }
  });
export type ProgramConfig = z.infer<typeof configSchema>;
export const defaultConfig: ProgramConfig = {
  enabled: false,
  standardBps: 1500,
  premiumBps: 2000,
  silverCustomers: 25,
  goldCustomers: 100,
  platinumUsdMinor: "10000000",
  diamondUsdMinor: "30000000",
  eligibilityAnchor: "first_payment",
  suspendedAccrual: "hold",
  terminatedAccrual: "stop",
  downgradeGraceDays: 30,
  relatedParty: "exclude",
  waitingDays: 30,
  minimumPayoutMinor: { USD: "5000", EUR: "5000" },
  postPayoutRefund: "offset",
};

// All amounts are integer currency minor units. BigInt arithmetic avoids binary floats.
export function minor(value: string | number): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value))
    throw new Error("Unsafe monetary integer.");
  if (!/^\d{1,18}$/.test(String(value))) throw new Error("Invalid monetary minor units.");
  return BigInt(value);
}
export function roundRatio(amount: bigint, numerator: bigint, denominator: bigint): bigint {
  if (amount < BigInt(0) || numerator < BigInt(0) || denominator <= BigInt(0))
    throw new Error("Invalid ratio.");
  return (amount * numerator + denominator / BigInt(2)) / denominator;
}
export function commission(netMinor: bigint, bps: number) {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new Error("Invalid commission rate.");
  return roundRatio(netMinor, BigInt(bps), BigInt(10000));
}
export function refundTarget(original: bigint, refundedGross: bigint, gross: bigint) {
  if (gross <= BigInt(0)) throw new Error("Missing original payment amount.");
  return roundRatio(original, refundedGross > gross ? gross : refundedGross, gross);
}
export function addMonthsUtc(date: Date, months: number) {
  const end = new Date(date);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(date.getUTCDate(), last));
  return end;
}
export function eligibleAt(paidAt: Date, anchor: Date) {
  return paidAt >= anchor && paidAt < addMonthsUtc(anchor, 12);
}
export function computeLevel(
  customers: number,
  usdMinor: bigint,
  config: ProgramConfig,
): PartnerLevel {
  if (usdMinor >= BigInt(config.diamondUsdMinor)) return "diamond";
  if (usdMinor >= BigInt(config.platinumUsdMinor)) return "platinum";
  if (customers >= config.goldCustomers) return "gold";
  if (customers >= config.silverCustomers) return "silver";
  return "bronze";
}
export function resolveLevel(
  current: PartnerLevel,
  candidate: PartnerLevel,
  candidateSince: Date,
  now: Date,
  graceDays: number | null,
) {
  if (levels.indexOf(candidate) >= levels.indexOf(current)) return candidate;
  if (graceDays === null || now.getTime() - candidateSince.getTime() < graceDays * 86400000)
    return current;
  return candidate;
}
// Preserve the start of a continuous shortfall even if the lower candidate changes.
export function downgradeSince(
  current: PartnerLevel,
  candidate: PartnerLevel,
  since: Date | null,
  at: Date,
) {
  return levels.indexOf(candidate) < levels.indexOf(current) ? since || at : null;
}

// Historical configurations retain the broad schema; new v1 versions require approved terms.
export function approvedV1(config: ProgramConfig) {
  return (
    config.standardBps === 1500 &&
    config.premiumBps === 2000 &&
    config.silverCustomers === 25 &&
    config.goldCustomers === 100 &&
    config.platinumUsdMinor === "10000000" &&
    config.diamondUsdMinor === "30000000" &&
    config.eligibilityAnchor === "first_payment" &&
    config.suspendedAccrual === "hold" &&
    config.terminatedAccrual === "stop" &&
    config.downgradeGraceDays === 30 &&
    config.relatedParty === "exclude" &&
    config.waitingDays === 30 &&
    config.minimumPayoutMinor?.USD === "5000" &&
    config.minimumPayoutMinor?.EUR === "5000" &&
    config.postPayoutRefund === "offset"
  );
}
export function rateForLevel(level: PartnerLevel, config: ProgramConfig) {
  return levels.indexOf(level) >= 2 ? config.premiumBps : config.standardBps;
}
export function accrualHold(config: ProgramConfig, status: string, related: string) {
  if (!config.enabled) return "program_disabled";
  if (
    !config.eligibilityAnchor ||
    config.downgradeGraceDays === null ||
    !config.relatedParty ||
    !config.suspendedAccrual ||
    !config.terminatedAccrual
  )
    return "policy_review";
  if (status === "rejected") return "partner_rejected";
  if (status === "pending") return "partner_not_approved";
  if (status !== "active") {
    const policy = status === "suspended" ? config.suspendedAccrual : config.terminatedAccrual;
    if (policy !== "continue") return `${status}_${policy}`;
  }
  if (related === "unknown" && config.relatedParty !== "allow") return "related_party_review";
  if (related === "related" && config.relatedParty !== "allow")
    return `related_party_${config.relatedParty}`;
  return null;
}
export function nextLevelProgress(
  level: PartnerLevel,
  customers: number,
  usd: bigint,
  config: ProgramConfig,
) {
  const next = levels[levels.indexOf(level) + 1];
  if (!next) return null;
  const revenue = next === "platinum" || next === "diamond";
  const target =
    next === "diamond"
      ? BigInt(config.diamondUsdMinor)
      : next === "platinum"
        ? BigInt(config.platinumUsdMinor)
        : BigInt(next === "gold" ? config.goldCustomers : config.silverCustomers);
  const value = revenue ? usd : BigInt(customers);
  return {
    level: next,
    unit: revenue ? "USD minor" : "customers",
    current: value.toString(),
    target: target.toString(),
    remaining: (target > value ? target - value : BigInt(0)).toString(),
    percent: Number((value * BigInt(10000)) / target) / 100,
  };
}
