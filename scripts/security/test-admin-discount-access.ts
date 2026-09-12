import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "../..")

const checkoutPage = readProjectFile("src/app/(auth)/app/settings/checkout/page.tsx")
const noticeBar = readProjectFile("src/components/ui/notice-bar.tsx")
const adminDiscountsPage = readProjectFile("src/app/(auth)/app/admin/discounts/page.tsx")
const adminEditPage = readProjectFile("src/app/(auth)/app/admin/edit/page.tsx")
const adminDiscountsRoute = readProjectFile("src/app/api/admin/discounts/route.ts")
const requireSession = readProjectFile("src/lib/auth/require-session.ts")

assert.ok(checkoutPage.includes('import { useSettings } from "@/components/settings/settings-context";'), "checkout reads the settings session role")
assert.ok(
  checkoutPage.includes('const canLoadAdminDiscounts = session?.user?.role === "superadmin";'),
  "checkout allows only superadmin sessions to load admin discount rules",
)
assertBefore(
  checkoutPage,
  "if (!canLoadAdminDiscounts)",
  'fetch("/api/admin/discounts"',
  "normal users return before checkout can request admin discount rules",
)
assertBefore(
  checkoutPage,
  "setAvailableDiscounts([])",
  'fetch("/api/admin/discounts"',
  "normal users keep checkout discount state empty without exposing admin data",
)

assert.ok(
  adminDiscountsPage.includes('fetch("/api/admin/discounts"'),
  "admin discount management still requests admin discount rules",
)
assert.ok(
  adminEditPage.includes('fetch("/api/admin/discounts"'),
  "admin discount editing still requests admin discount rules",
)

assert.ok(
  noticeBar.includes("if (status === 401)") && noticeBar.includes("Your session may have expired. Sign in again and retry."),
  "401 responses keep session-expired guidance",
)
assert.ok(
  noticeBar.includes("if (status === 403)") && noticeBar.includes("You do not have access to complete this action."),
  "403 responses use forbidden-access guidance",
)
assert.equal(
  /status === 401 \|\| status === 403[\s\S]*Your session may have expired/.test(noticeBar),
  false,
  "403 responses never reuse the session-expired message",
)
assert.ok(
  noticeBar.includes('response.status === 403'),
  "global notices still surface 403 failures instead of suppressing all forbidden errors",
)

assert.ok(adminDiscountsRoute.includes("requireSuperAdmin()"), "admin discounts API keeps superadmin authorization")
assert.ok(requireSession.includes('NextResponse.json({ error: "Forbidden" }, { status: 403 })'), "unauthorized direct access keeps a 403 response")
assert.ok(requireSession.includes('NextResponse.json({ error: "Unauthorized" }, { status: 401 })'), "unauthenticated direct access keeps a 401 response")

console.warn("Admin discount access tests passed")

function assertBefore(source: string, earlierText: string, laterText: string, message: string) {
  const earlierIndex = source.indexOf(earlierText)
  const laterIndex = source.indexOf(laterText)
  assert.notEqual(earlierIndex, -1, `${message}: expected guard exists`)
  assert.notEqual(laterIndex, -1, `${message}: expected fetch exists`)
  assert.ok(earlierIndex < laterIndex, message)
}

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}
