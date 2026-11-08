import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accrualHold,
  addMonthsUtc,
  commission,
  computeLevel,
  configSchema,
  defaultConfig,
  approvedV1,
  downgradeSince,
  eligibleAt,
  minor,
  rateForLevel,
  refundTarget,
  resolveLevel,
  roundRatio,
} from "../../src/lib/partners/rules";
const ready = {
  ...defaultConfig,
  enabled: true,
  eligibilityAnchor: "first_payment" as const,
  suspendedAccrual: "hold" as const,
  terminatedAccrual: "stop" as const,
  downgradeGraceDays: 0,
  relatedParty: "exclude" as const,
};
for (const [customers, revenue, level] of [
  [0, "0", "bronze"],
  [1, "0", "bronze"],
  [24, "0", "bronze"],
  [25, "0", "silver"],
  [99, "0", "silver"],
  [100, "0", "gold"],
  [0, "10000000", "platinum"],
  [100, "30000000", "diamond"],
] as const) {
  test(`level ${level}: ${customers} customers, ${revenue} USD cents`, () =>
    assert.equal(computeLevel(customers, BigInt(revenue), ready), level));
}
test("standard and premium rates include zero-customer approved partners", () => {
  assert.equal(rateForLevel("bronze", ready), 1500);
  assert.equal(rateForLevel("silver", ready), 1500);
  for (const level of ["gold", "platinum", "diamond"] as const)
    assert.equal(rateForLevel(level, ready), 2000);
  assert.equal(commission(BigInt(10000), 1500), BigInt(1500));
  assert.equal(commission(BigInt(10000), 2000), BigInt(2000));
});
test("integer rounding and large amounts avoid floating point", () => {
  assert.equal(commission(BigInt(101), 1500), BigInt(15));
  assert.equal(commission(BigInt(10), 1500), BigInt(2));
  assert.equal(
    roundRatio(BigInt("99999999999999999"), BigInt(3), BigInt(2)),
    BigInt("149999999999999999"),
  );
  assert.throws(() => minor(Number.MAX_SAFE_INTEGER + 1));
  assert.throws(() => minor("1.23"));
  assert.throws(() => commission(BigInt(1), -1));
});
test("cumulative partial and full refunds use the original rate", () => {
  const earned = commission(BigInt(10000), 1500);
  assert.equal(refundTarget(earned, BigInt(2500), BigInt(10000)), BigInt(375));
  assert.equal(refundTarget(earned, BigInt(10000), BigInt(10000)), earned);
  assert.equal(refundTarget(earned, BigInt(15000), BigInt(10000)), earned);
});
test("calendar eligibility ends at twelve months exclusively", () => {
  const anchor = new Date("2024-02-29T12:00:00Z");
  assert.equal(addMonthsUtc(anchor, 12).toISOString(), "2025-02-28T12:00:00.000Z");
  assert.equal(eligibleAt(new Date("2025-02-28T11:59:59Z"), anchor), true);
  assert.equal(eligibleAt(new Date("2025-02-28T12:00:00Z"), anchor), false);
  assert.equal(eligibleAt(new Date("2024-02-28T12:00:00Z"), anchor), false);
});
test("downgrade policy holds until a configured grace period expires", () => {
  const since = new Date("2026-01-01Z");
  assert.equal(resolveLevel("gold", "silver", since, new Date("2026-01-02Z"), null), "gold");
  assert.equal(resolveLevel("gold", "silver", since, new Date("2026-01-02Z"), 7), "gold");
  assert.equal(resolveLevel("gold", "silver", since, new Date("2026-01-08Z"), 7), "silver");
  assert.equal(resolveLevel("gold", "silver", since, since, 0), "silver");
  assert.equal(resolveLevel("bronze", "gold", since, since, null), "gold");
});
test("unapproved policies, suspension, termination, and related parties hold or exclude", () => {
  assert.equal(accrualHold(defaultConfig, "active", "unrelated"), "program_disabled");
  assert.equal(
    accrualHold(
      { ...defaultConfig, enabled: true, eligibilityAnchor: null },
      "active",
      "unrelated",
    ),
    "policy_review",
  );
  assert.equal(accrualHold(ready, "active", "unrelated"), null);
  assert.equal(accrualHold(ready, "suspended", "unrelated"), "suspended_hold");
  assert.equal(accrualHold(ready, "terminated", "unrelated"), "terminated_stop");
  assert.equal(accrualHold(ready, "active", "unknown"), "related_party_review");
  assert.equal(accrualHold(ready, "active", "related"), "related_party_exclude");
});
test("configuration validates increasing thresholds and bounded rates", () => {
  assert.ok(configSchema.safeParse(defaultConfig).success);
  assert.ok(!configSchema.safeParse({ ...ready, standardBps: 10001 }).success);
  assert.ok(!configSchema.safeParse({ ...ready, goldCustomers: 25 }).success);
  assert.ok(!configSchema.safeParse({ ...ready, diamondUsdMinor: "100" }).success);
});

test("owner-approved v1 defaults remain disabled with all eight policies resolved", () => {
  assert.equal(defaultConfig.enabled, false);
  assert.equal(approvedV1(defaultConfig), true);
  assert.equal(defaultConfig.eligibilityAnchor, "first_payment");
  assert.equal(defaultConfig.waitingDays, 30);
  assert.equal(defaultConfig.downgradeGraceDays, 30);
  assert.deepEqual(defaultConfig.minimumPayoutMinor, { USD: "5000", EUR: "5000" });
  assert.equal(approvedV1({ ...defaultConfig, standardBps: 1400 }), false);
  assert.equal(approvedV1({ ...defaultConfig, eligibilityAnchor: "signup" }), false);
});
test("continuous downgrade grace survives candidate changes and clears on qualification", () => {
  const start = new Date("2026-01-01Z");
  const day29 = new Date("2026-01-30Z"),
    day30 = new Date("2026-01-31Z");
  assert.equal(downgradeSince("gold", "silver", start, day29), start);
  assert.equal(downgradeSince("gold", "bronze", start, day29), start);
  assert.equal(resolveLevel("gold", "bronze", start, day29, 30), "gold");
  assert.equal(resolveLevel("gold", "silver", start, day30, 30), "silver");
  assert.equal(downgradeSince("gold", "gold", start, day30), null);
  assert.equal(downgradeSince("gold", "platinum", start, day30), null);
});
