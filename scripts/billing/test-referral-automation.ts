import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

import { normalizeReferralCode, createReferralCode, buildReferralLink } from "@/lib/referrals/referral-store"
import { clientClickFingerprint } from "@/lib/referrals/referral-lifecycle"
import { REFERRAL_REWARD_CONFIG } from "@/lib/referrals/referral-config"

type TestCase = {
  name: string
  run: () => Promise<void> | void
}

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function assertNoReference(source: string, patterns: Array<[string, RegExp]>) {
  for (const [label, pattern] of patterns) {
    assert.ok(!pattern.test(source), `must not contain ${label}`)
  }
}

const tests: TestCase[] = [
  // ── Authorization: no user-accessible referral mutation capability ────────
  {
    name: "user mutation endpoints are removed (no signup/paid/track routes)",
    run() {
      assert.equal(existsSync("src/app/api/referral/signup/route.ts"), false, "signup mutation route must not exist")
      assert.equal(existsSync("src/app/api/referral/paid/route.ts"), false, "paid mutation route must not exist")
      assert.equal(existsSync("src/app/api/referral/track/route.ts"), false, "track mutation route must not exist")
      assert.equal(existsSync("src/app/api/referral/visit/route.ts"), true, "automated visit route exists")
    },
  },
  {
    name: "Referral Center UI has no manual record buttons and no event recording calls",
    run() {
      const page = readProjectFile("src/app/(auth)/app/referral/page.tsx")
      assert.ok(!page.includes("Record signup"), "UI must not offer Record signup")
      assert.ok(!page.includes("Record paid"), "UI must not offer Record paid")
      assert.ok(!page.includes("/api/referral/signup"), "UI must not call a signup mutation endpoint")
      assert.ok(!page.includes("/api/referral/paid"), "UI must not call a paid mutation endpoint")
      assert.ok(!page.includes("/api/referral/track"), "UI must not call a click mutation endpoint")
      assert.ok(!page.includes("recordEvent"), "UI must not have any event recording helper")
    },
  },
  {
    name: "referral summary endpoint requires an authenticated session",
    run() {
      const route = readProjectFile("src/app/api/referral/route.ts")
      assert.ok(route.includes("requireSession"), "/api/referral must require a session")
      assert.ok(route.includes('if (!authResult.success) return authResult.error'), "GET must reject unauthenticated callers")
    },
  },
  {
    name: "referral-code ownership cannot be hijacked via cookies",
    run() {
      const route = readProjectFile("src/app/api/referral/route.ts")
      assert.ok(
        route.includes("existing.ownerUserId !== userId"),
        "a cookie code owned by another user must be replaced, not adopted",
      )
      assert.ok(
        route.includes("createReferralCode()"),
        "a foreign cookie code must be replaced with a fresh code",
      )
    },
  },
  {
    name: "admin referral corrections are superadmin-authorized and reason-gated",
    run() {
      const route = readProjectFile("src/app/api/admin/referrals/route.ts")
      assert.ok(route.includes("requireSuperAdmin"), "admin corrections must require superadmin")
      assert.ok(route.includes('A reason is required for every referral correction'), "corrections must require a reason")
    },
  },
  {
    name: "visit tracking grants no rewards (clicks are informational only)",
    run() {
      const visit = readProjectFile("src/app/api/referral/visit/route.ts")
      assert.ok(!visit.includes("recordReferralEvent"), "visit route must not use the legacy event recorder")
      assert.ok(!visit.includes("grantReferralCredits") && !visit.includes("confirmReferralSignup") && !visit.includes("confirmReferralPaidConversion"), "visit route must not grant rewards or conversions")
      assert.ok(visit.includes("recordReferralClick"), "visit route must record an informational click")

      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(
        lifecycle.includes("grants credits or unlocks rewards"),
        "lifecycle must document that clicks never grant rewards",
      )
      assert.ok(
        !/click[\s\S]{0,400}REFERRAL_REWARD/.test(lifecycle),
        "click recording must stay decoupled from reward grants",
      )
    },
  },

  // ── Attribution persistence + signup authority ────────────────────────────
  {
    name: "referral attribution persists in an httpOnly cookie, never a client field",
    run() {
      const visit = readProjectFile("src/app/api/referral/visit/route.ts")
      assert.ok(visit.includes('httpOnly: true'), "attribution cookie must be httpOnly")
      const authAction = readProjectFile("src/app/actions/auth.ts")
      assert.ok(
        authAction.includes("referralAttributionCookieName"),
        "signup confirmation must read the attribution cookie server-side",
      )
      assert.ok(
        !authAction.includes("referrerUserId"),
        "signup must never accept a client-supplied referrerUserId",
      )
      assert.ok(
        authAction.includes("markEmailVerified(email)") && authAction.includes("confirmReferralAfterVerification(email)"),
        "signup confirmation must run only after server-side email verification",
      )
    },
  },
  {
    name: "signup confirmation is locked to the real created account and idempotent",
    run() {
      const schema = readProjectFile("src/lib/db/schema.ts")
      assert.ok(
        schema.includes('uniqueIndex("ReferralAttribution_referredUserId_key")'),
        "one referred account belongs to exactly one referrer (DB-level uniqueness)",
      )
      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(
        lifecycle.includes('onConflictDoNothing({ target: referralAttributions.referredUserId })'),
        "replayed confirmations must be DB-level no-ops",
      )
      assert.ok(
        lifecycle.includes('${owner.code}:signup:${input.referredUserId}'),
        "signup event key is deterministic per referred user (callback replays cannot double-count)",
      )
    },
  },
  {
    name: "self-referral can never be rewarded",
    run() {
      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(lifecycle.includes("owner.ownerUserId === input.referredUserId"), "userId self-referral is rejected")
      assert.ok(
        lifecycle.includes("owner.ownerEmail") && lifecycle.includes("referredEmail"),
        "email-based self-referral is rejected",
      )
      assert.ok(lifecycle.includes("reason: \"self_referral\""), "self-referral exits with an explicit reason")
      // The referrer's own visit also gets no attribution.
      const visit = readProjectFile("src/app/api/referral/visit/route.ts")
      assert.ok(visit.includes("self_visit"), "referrer self-visits receive no attribution cookie")
    },
  },

  // ── Signup reward (5 credits) ──────────────────────────────────────────────
  {
    name: "signup reward is 5 credits, granted once through the central credit engine",
    run() {
      assert.equal(REFERRAL_REWARD_CONFIG.signup.credits, 5, "signup referral reward stays 5 AI credits")
      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(
        lifecycle.includes("REFERRAL_REWARD"),
        "referral credits are written as REFERRAL_REWARD credit-ledger transactions",
      )
      assert.ok(lifecycle.includes('source: "referral"'), "ledger rows carry source referral")
      assert.ok(
        lifecycle.includes("referral:reward:signup:${attribution.referredUserId}"),
        "signup reward idempotency key is per referred account",
      )
      assert.ok(
        lifecycle.includes('purchasedBalance" = "purchasedBalance" + '),
        "referral credits use the central credit account (purchased/reward-compatible pool), not counters",
      )
      assert.ok(
        lifecycle.includes("onConflictDoNothing({ target: creditLedger.idempotencyKey })"),
        "ledger inserts are idempotency-key guarded",
      )
    },
  },

  // ── Paid conversion from Stripe ────────────────────────────────────────────
  {
    name: "paid conversion runs only inside Stripe webhook paths",
    run() {
      const webhook = readProjectFile("src/services/stripe/webhook.ts")
      assert.ok(
        webhook.includes("allowReferralConversion: true"),
        "webhook lifecycle explicitly enables referral conversion",
      )
      assert.ok(
        webhook.includes("subscriptionStatus !== ACTIVE_SUBSCRIPTION_STATUS") ||
          webhook.includes("params.subscriptionStatus !== ACTIVE_SUBSCRIPTION_STATUS"),
        "only active Stripe subscriptions qualify",
      )
      const actionsStripe = readProjectFile("src/app/actions/stripe.ts")
      assert.ok(
        !actionsStripe.includes("confirmReferralPaidConversion"),
        "checkout return path must not confirm paid referrals (no award on checkout redirect)",
      )
      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(
        lifecycle.includes("referral:reward:paid:${attribution.referredUserId}"),
        "paid reward idempotency key is per referred account",
      )
      assert.ok(
        lifecycle.includes("attribution.paidConfirmedAt") || lifecycle.includes("isNull(referralAttributions.paidConfirmedAt)"),
        "duplicate Stripe events cannot double-confirm a paid conversion",
      )
    },
  },
  {
    name: "paid reward values stay 25 credits + 1 month Pro in one central config",
    run() {
      assert.equal(REFERRAL_REWARD_CONFIG.paid.credits, 25)
      assert.equal(REFERRAL_REWARD_CONFIG.paid.pro.months, 1)
      const webhook = readProjectFile("src/services/stripe/webhook.ts")
      assert.ok(
        webhook.includes('PAID_REFERRAL_TIERS = new Set(["pro", "business"])'),
        "paid tiers resolve from the Stripe-synced tier, not client input",
      )
      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(
        lifecycle.includes('"pending_fulfillment"'),
        "the Pro month is recorded as pending_fulfillment instead of corrupting Stripe-backed tiers",
      )
      assert.ok(
        !lifecycle.includes('subscriptionTier = "pro"'),
        "referral logic never writes a Pro label into the subscription tier",
      )
    },
  },

  // ── Refunds / reversals ────────────────────────────────────────────────────
  {
    name: "refunds are detected but automatic reversal stays disabled and idempotent",
    run() {
      const route = readProjectFile("src/app/api/webhooks/stripe/route.ts")
      assert.ok(route.includes("recordReferralRefundForCustomer"), "charge.refunded triggers refund observation")
      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(
        lifecycle.includes("automaticReversal: \"disabled_pending_business_policy\""),
        "refund observation records that auto-reversal is disabled",
      )
      assert.ok(
        lifecycle.includes("referral:reverse:${kind}:${input.referredUserId}"),
        "reversals are idempotent per referred account and reward kind",
      )
      assert.ok(
        lifecycle.includes('GREATEST(0, "purchasedBalance" - ${credits})'),
        "reversal never drives a credit balance negative",
      )
      assert.ok(
        lifecycle.includes("refundObservedAt"),
        "refund observation is auditable on the attribution record",
      )
    },
  },

  // ── Statistics derived from canonical records ──────────────────────────────
  {
    name: "Clicks/Signups/Paid Users/Credits Earned derive from canonical records",
    run() {
      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(
        lifecycle.includes('eq(referralEvents.type, "click")'),
        "Clicks come from recorded click events",
      )
      assert.ok(
        lifecycle.includes("referralAttributions.signupConfirmedAt"),
        "Signups come from confirmed attributions",
      )
      assert.ok(
        lifecycle.includes("referralAttributions.paidConfirmedAt"),
        "Paid Users come from confirmed paid conversions",
      )
      assert.ok(
        lifecycle.includes("signupRewardStatus}' = 'granted'") ||
          lifecycle.includes("= 'granted' THEN"),
        "Credits Earned counts only finalized, non-reversed grants",
      )
      const route = readProjectFile("src/app/api/referral/route.ts")
      assert.ok(
        route.includes("getOwnerReferralSummary"),
        "the referral center reads derived stats, not mutable client counters",
      )
    },
  },

  // ── Click tracking hygiene ─────────────────────────────────────────────────
  {
    name: "clicks dedupe per code/client/day and raw IPs are never stored",
    run() {
      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(
        lifecycle.includes("${input.code}:click:${dayBucketUtc()}:${fingerprint}"),
        "click event keys dedupe per code, client fingerprint, and day",
      )
      assert.ok(
        lifecycle.includes("createHash(\"sha256\")"),
        "client fingerprints are one-way hashes",
      )
      assert.ok(
        !lifecycle.includes("x-forwarded-for") || lifecycle.includes("clientClickFingerprint(input.clientIp)"),
        "raw IP handling stays inside the fingerprint helper",
      )
    },
  },
  {
    name: "QR code route is unchanged and resolves the exact referral link builder",
    run() {
      const qrcode = readProjectFile("src/app/api/referral/qrcode/route.ts")
      assert.ok(qrcode.includes("buildReferralLink"), "QR codes use the same authoritative link builder")
      assert.ok(qrcode.includes("QRCode.toString"), "QR generation is untouched")
    },
  },
  {
    name: "signup page preserves the /signup?ref= URL format and routes through visit tracking",
    run() {
      const signup = readProjectFile("src/app/(public)/signup/page.tsx")
      assert.ok(signup.includes("normalizeReferralCode(getParam(params.ref))"), "the ref param is preserved")
      assert.ok(signup.includes("/api/referral/visit"), "attribution flows through the automated visit handler")
    },
  },

  // ── Database guarantees + migration ────────────────────────────────────────
  {
    name: "schema and predeploy create the attribution table with unique guarantees",
    run() {
      const schema = readProjectFile("src/lib/db/schema.ts")
      assert.ok(schema.includes("ReferralAttribution"), "schema defines ReferralAttribution")
      assert.ok(schema.includes('"REFERRAL_REWARD"'), "credit ledger supports the referral reward type")

      const migration = migration_content()
      assert.ok(
        migration.includes('CREATE UNIQUE INDEX IF NOT EXISTS "ReferralAttribution_referredUserId_key"'),
        "migration creates the per-user uniqueness index",
      )
      assert.ok(
        migration.includes("'REFERRAL_REWARD'"),
        "migration widens the ledger transactionType check",
      )

      const predeploy = readProjectFile("scripts/runtime/railway-predeploy.cjs")
      assert.ok(
        predeploy.includes('readMigrationStatement("src/lib/db/migrations/0035_referral_automation.sql")'),
        "predeploy runs the referral automation migration",
      )
      assert.ok(
        predeploy.includes('"ReferralAttribution"'),
        "predeploy creates ReferralAttribution idempotently",
      )
      assert.ok(
        predeploy.includes('"ReferralAttribution",') &&
          predeploy.indexOf('"ReferralAttribution",') > predeploy.indexOf('"ReferralStats",'),
        "ReferralAttribution gets the updatedAt trigger",
      )
    },
  },

  // ── Provenance for historical data ─────────────────────────────────────────
  {
    name: "historical referral events keep unknown provenance instead of being upgraded",
    run() {
      const migration = readProjectFile("src/lib/db/migrations/0035_referral_automation.sql")
      assert.ok(
        migration.includes("DEFAULT 'legacy'"),
        "existing ReferralEvent rows are marked legacy, never fabricated as verified",
      )
      const lifecycle = readProjectFile("src/lib/referrals/referral-lifecycle.ts")
      assert.ok(
        lifecycle.includes('source: input.source || "automated"'),
        "new lifecycle events carry automated provenance",
      )
      assert.ok(
        !/backfill|seed.*ReferralAttribution/i.test(readProjectFile("src/lib/db/migrations/0035_referral_automation.sql")),
        "no migration blindly promotes historical manual events into attributions",
      )
    },
  },

  // ── Pure-function behavior ─────────────────────────────────────────────────
  {
    name: "referral code normalization rejects malformed and hostile input",
    run() {
      assert.equal(normalizeReferralCode("UC-abc123_X"), "uc-abc123_x")
      assert.equal(normalizeReferralCode("../../etc/passwd"), "etcpasswd")
      assert.equal(normalizeReferralCode("a".repeat(64)).length, 32)
      assert.equal(normalizeReferralCode(undefined), "")
      assert.equal(normalizeReferralCode(12345), "")
      assert.equal(normalizeReferralCode({ code: "uc-x" } as unknown), "")
    },
  },
  {
    name: "referral links keep the existing public URL format",
    run() {
      process.env.NEXT_PUBLIC_APP_URL = ""
      process.env.AUTH_URL = ""
      const link = buildReferralLink("https://app.useclevr.com", "uc-test123")
      const url = new URL(link)
      assert.equal(url.origin, "https://app.useclevr.com")
      assert.equal(url.pathname, "/signup")
      assert.equal(url.searchParams.get("ref"), "uc-test123")
    },
  },
  {
    name: "new referral codes are normalized uc- identifiers",
    run() {
      for (let i = 0; i < 25; i++) {
        const code = createReferralCode()
        assert.match(code, /^uc-[a-f0-9]{10}$/, "codes stay within the existing format")
        assert.equal(normalizeReferralCode(code), code)
      }
    },
  },
  {
    name: "click fingerprints are deterministic, salted, and never store raw IPs",
    run() {
      const a = clientClickFingerprint("203.0.113.7")
      const b = clientClickFingerprint("203.0.113.7")
      assert.equal(a, b, "the same client IP dedupes deterministically")
      assert.notEqual(clientClickFingerprint("203.0.113.8"), a, "different clients differ")
      assert.equal(clientClickFingerprint("203.0.113.7, 10.0.0.1"), a, "proxy chains use the first hop")
      assert.equal(clientClickFingerprint(null), null)
      assert.equal(clientClickFingerprint(""), null)
      assert.ok(a && a.length === 32, "fingerprints are truncated hashes, not raw addresses")
      assert.ok(!a!.includes("203"), "the raw IP never appears in the fingerprint")
    },
  },
]

function migration_content() {
  return readProjectFile("src/lib/db/migrations/0035_referral_automation.sql")
}

async function main() {
  let failures = 0
  for (const test of tests) {
    try {
      await test.run()
      console.log(`ok - ${test.name}`)
    } catch (error) {
      failures++
      console.error(`FAIL - ${test.name}`)
      console.error(error instanceof Error ? error.message : error)
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} referral automation test(s) failed.`)
    process.exit(1)
  }

  console.log(`\nAll ${tests.length} referral automation tests passed.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
