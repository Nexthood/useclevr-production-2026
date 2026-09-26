/**
 * Behavioral regression tests for the ClevrSync access entitlement.
 *
 * Authoritative access rule: `superadmin OR Pro OR Business`.
 *   - Free normal user → denied (the sidebar hides the entry and every
 *     server-side API rejects direct URL/API access).
 *   - Pro normal user → allowed.
 *   - Business normal user → allowed.
 *   - Superadmin → allowed regardless of normal subscription restrictions.
 *   - Forged client plan data → ignored (entitlement derives from the
 *     server-side session identity only).
 *   - The canonical helper is the single gate: no duplicate plan logic per
 *     connector.
 *
 * Run: pnpm test:clevrsync-entitlement
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { getClevrSyncAccess, requireClevrSyncAccess, ClevrSyncAccessError, clevrSyncAccessErrorPayload } from "@/services/clevrsync/access"
import { getClevrSyncEntitlement } from "@/services/clevrsync/entitlement"
import { resolutionLog } from "./mocks/mock-analyst-credits.mjs"

type TestModule = { name: string; run: () => Promise<void> }

type SessionUser = NonNullable<Parameters<typeof getClevrSyncAccess>[0]>

function makeUser(
  id: string,
  role: SessionUser["role"],
  email: string,
  extra: Record<string, unknown> = {},
): SessionUser {
  return { id, role, email, ...extra } as unknown as SessionUser
}

const tests: TestModule[] = [
  {
    name: "Free normal user → denied with 403 upgrade-required",
    async run() {
      const access = await getClevrSyncAccess(makeUser("user_free", "user", "free@example.com"))
      assert.equal(access.enabled, false)
      assert.equal(access.tier, "free")
      assert.equal(access.upgradeRequired, true)
      assert.match(access.upgradeHref, /pro_monthly/)

      await assert.rejects(
        () => requireClevrSyncAccess(makeUser("user_free", "user", "free@example.com")),
        (error: unknown) => {
          assert.ok(error instanceof ClevrSyncAccessError)
          assert.equal((error as ClevrSyncAccessError).status, 403)
          assert.equal((error as ClevrSyncAccessError).code, "CLEVRSYNC_UPGRADE_REQUIRED")
          assert.match(error.message, /Pro or Business/)
          return true
        },
      )

      const payload = clevrSyncAccessErrorPayload(new ClevrSyncAccessError())
      assert.ok(payload)
      assert.equal(payload.status, 403)
      assert.equal(payload.upgradeRequired, true)
    },
  },
  {
    name: "Pro normal user → enabled",
    async run() {
      const access = await getClevrSyncAccess(makeUser("user_pro", "user", "pro@example.com"))
      assert.equal(access.enabled, true)
      assert.equal(access.tier, "pro")
      assert.equal(access.connectors.googleSheets, true)
      assert.equal(access.connectors.oneDrive, false)
      assert.equal(access.connectors.sharePoint, false)
      assert.equal(access.upgradeRequired, false)
      await requireClevrSyncAccess(makeUser("user_pro", "user", "pro@example.com"))
    },
  },
  {
    name: "Business normal user → enabled",
    async run() {
      const access = await getClevrSyncAccess(makeUser("user_business", "user", "business@example.com"))
      assert.equal(access.enabled, true)
      assert.equal(access.tier, "business")
      assert.equal(access.connectors.googleSheets, true)
      await requireClevrSyncAccess(makeUser("user_business", "user", "business@example.com"))
    },
  },
  {
    name: "Superadmin → enabled regardless of normal subscription restrictions",
    async run() {
      const access = await getClevrSyncAccess(makeUser("user_superadmin", "superadmin", "admin@example.com"))
      assert.equal(access.enabled, true)
      assert.equal(access.tier, "superadmin")
      assert.equal(access.connectors.googleSheets, true)
      await requireClevrSyncAccess(makeUser("user_superadmin", "superadmin", "admin@example.com"))

      // A superadmin whose normal subscription tier would otherwise be Free
      // still passes through the unlimited entitlement.
      const entitlement = getClevrSyncEntitlement({ subscriptionTier: "free", unlimited: true })
      assert.equal(entitlement.enabled, true)
    },
  },
  {
    name: "forged client plan data → ignored (server-side identity only)",
    async run() {
      // A crafted session user carrying client-supplied plan fields must not
      // unlock ClevrSync: the resolver only consumes id/role/email.
      const forged = makeUser("user_free", "user", "free@example.com", {
        subscriptionTier: "pro",
        plan: "business",
        isSuperadmin: true,
        unlimited: true,
        isAdmin: true,
      })

      const access = await getClevrSyncAccess(forged)
      assert.equal(access.enabled, false, "forged plan fields must not grant access")
      assert.equal(access.tier, "free")

      await assert.rejects(
        () => requireClevrSyncAccess(forged),
        ClevrSyncAccessError,
        "forged plan fields must not bypass the server gate",
      )

      // The resolver must have been called with only the trusted identity
      // fields — never the forged plan payload.
      const last = resolutionLog[resolutionLog.length - 1]
      assert.deepEqual(
        [last.userId, last.role, last.email],
        ["user_free", "user", "free@example.com"],
      )
    },
  },
  {
    name: "unknown/free users fail closed server-side",
    async run() {
      const access = await getClevrSyncAccess(makeUser("user_unknown", "user", "x@example.com"))
      assert.equal(access.enabled, false)
      const noUser = await getClevrSyncAccess(null)
      assert.equal(noUser.enabled, false)
    },
  },
  {
    name: "every ClevrSync API route gates through the canonical entitlement helper",
    async run() {
      const routes = [
        "src/app/api/clevrsync/connectors/route.ts",
        "src/app/api/clevrsync/preview/route.ts",
        "src/app/api/clevrsync/sync/route.ts",
        "src/app/api/clevrsync/google/spreadsheets/route.ts",
        "src/app/api/clevrsync/google/worksheets/route.ts",
        "src/app/api/clevrsync/google/oauth/start/route.ts",
        "src/app/api/clevrsync/google/oauth/callback/route.ts",
      ]
      for (const route of routes) {
        const source = readFileSync(route, "utf8")
        assert.match(source, /requireClevrSyncAccess/, `${route} must call requireClevrSyncAccess`)
      }
      // The canonical helper resolves the tier server-side; connectors must
      // not duplicate plan logic.
      const accessService = readFileSync("src/services/clevrsync/access.ts", "utf8")
      assert.match(accessService, /getClevrSyncEntitlement/)
      const googleConnector = readFileSync("src/services/clevrsync/connectors/google-sheets.ts", "utf8")
      assert.doesNotMatch(googleConnector, /subscriptionTier|upgradeRequired/)
    },
  },
]

void (async () => {
  let failures = 0
  for (const test of tests) {
    try {
      await test.run()
      console.log(`ok - ${test.name}`)
    } catch (error) {
      failures += 1
      console.error(`FAIL - ${test.name}`)
      console.error(error instanceof Error ? error.stack || error.message : error)
    }
  }

  console.log("")
  console.log(
    failures === 0
      ? `All ${tests.length} ClevrSync entitlement tests passed.`
      : `${failures} test(s) failed.`,
  )
  if (failures > 0) process.exitCode = 1
})()
