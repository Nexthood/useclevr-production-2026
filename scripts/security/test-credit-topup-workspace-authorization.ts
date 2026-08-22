import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

function assertIncludes(source: string, expected: string, message: string) {
  assert.ok(source.includes(expected), message)
}

function assertNotIncludes(source: string, forbidden: string, message: string) {
  assert.equal(source.includes(forbidden), false, message)
}

function assertBefore(source: string, first: string, second: string, message: string) {
  const firstIndex = source.indexOf(first)
  const secondIndex = source.indexOf(second)
  assert.notEqual(firstIndex, -1, `${message}: first marker exists`)
  assert.notEqual(secondIndex, -1, `${message}: second marker exists`)
  assert.ok(firstIndex < secondIndex, message)
}

function main() {
  const route = readProjectFile("src/app/api/checkout/credit-topup/route.ts")

  assertIncludes(route, "const session = await auth()", "route resolves the authenticated session")
  assertBefore(route, "const session = await auth()", "const body = await request.json()", "unauthenticated requests fail before trusting request body")
  assertIncludes(route, 'return NextResponse.json({ error: "Unauthorized" }, { status: 401 })', "unauthenticated requests return 401")

  assertIncludes(route, 'import { hasWorkspacePermission } from "@/lib/utils/workspace-permissions"', "route reuses the existing workspace permission helper")
  assertIncludes(route, "const metadataWorkspaceId = await resolveCheckoutWorkspaceId(user.id, requestedWorkspaceId)", "route resolves checkout workspace metadata server-side")
  assertIncludes(route, 'hasWorkspacePermission(userId, requestedWorkspaceId, "viewer")', "route verifies user membership with the existing viewer-or-higher workspace model")
  assertIncludes(route, "return hasAccess ? requestedWorkspaceId : null", "authorized workspaces are preserved")
  assertIncludes(route, "if (!requestedWorkspaceId) return userId", "missing workspaceId keeps the existing user-id default")
  assertIncludes(route, '{ error: "Forbidden" }', "unauthorized workspace requests return a 403 response")
  assertBefore(route, "const metadataWorkspaceId = await resolveCheckoutWorkspaceId", "createCreditTopUpCheckoutSession({", "workspace authorization happens before Stripe checkout session creation")
  assertBefore(route, '{ error: "Forbidden" }', "createCreditTopUpCheckoutSession({", "BOLA and nonexistent workspace attempts fail before Stripe checkout session creation")

  assertIncludes(route, "workspaceId: metadataWorkspaceId", "Stripe metadata uses the authorized workspace id only")
  assertNotIncludes(route, "workspaceId: workspaceId || user.id", "route no longer falls back from an untrusted workspaceId directly into metadata")
  assertNotIncludes(route, "workspaceId: requestedWorkspaceId || user.id", "route does not silently replace unauthorized workspace ids")

  assertIncludes(route, "userId: user.id", "metadata user id comes from the authenticated session")
  assertNotIncludes(route, "body.userId", "manipulated userId request body values are ignored")
  assertIncludes(route, "creditsGranted: String(creditPackage.creditsGranted)", "credits granted come from the selected package")
  assertNotIncludes(route, "body.creditsGranted", "manipulated creditsGranted request body values are ignored")
  assertIncludes(route, "monetaryAmountCents: String(creditPackage.monetaryAmountCents)", "monetary amount comes from the selected package")
  assertNotIncludes(route, "body.monetaryAmount", "manipulated monetaryAmount request body values are ignored")
  assertIncludes(route, "currency: creditPackage.currency", "metadata currency comes from the selected package")
  assertIncludes(route, "Currency does not match the selected package", "manipulated currency still triggers existing rejection")

  assertIncludes(route, 'if (provider === "stripe")', "normal Stripe checkout flow remains available")
  assertIncludes(route, 'status: "pending_webhook"', "valid normal Stripe credit top-up still returns the existing pending-webhook status")
}

main()
