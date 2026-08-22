import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { canAccessAllDatasets } from "../../src/lib/data/dataset-access"

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

function assertOwnerScopedDatasetRead(source: string, message: string) {
  assertIncludes(source, "and(eq(datasets.id", `${message}: dataset id is part of the read predicate`)
  assertIncludes(source, "eq(datasets.userId", `${message}: authenticated user id is part of the read predicate`)
}

function main() {
  assert.equal(canAccessAllDatasets("user"), false, "ordinary users do not bypass dataset ownership")
  assert.equal(canAccessAllDatasets("admin"), false, "admin role does not bypass ordinary dataset ownership")
  assert.equal(canAccessAllDatasets("superadmin"), false, "superadmin role does not bypass ordinary dataset ownership")

  const datasetAccess = readProjectFile("src/lib/data/dataset-access.ts")
  assertIncludes(datasetAccess, "customerDatasetAccessWhere(datasetId: string, userId: string)", "shared dataset access exposes one owner-scoped predicate")
  assertIncludes(datasetAccess, "where: customerDatasetAccessWhere(datasetId, userId)", "shared dataset helper uses the owner-scoped predicate")
  assertNotIncludes(datasetAccess, 'role === "superadmin"', "shared dataset helper does not grant superadmin role dataset access")
  assertNotIncludes(datasetAccess, 'role === "admin"', "shared dataset helper does not grant admin role dataset access")

  const deleteDatasets = readProjectFile("src/lib/data/delete-datasets.ts")
  assertIncludes(deleteDatasets, "where: and(eq(datasets.userId, userId), inArray(datasets.id, requestedIds))", "dataset deletion stays owner-scoped")
  assertNotIncludes(deleteDatasets, "canDeleteAcrossUsers", "dataset deletion has no role-based cross-user branch")

  const reportsRoute = readProjectFile("src/app/api/reports/route.ts")
  assertIncludes(reportsRoute, "const result = await findAccessibleDataset(datasetId, userId, role)", "report generation/list/delete use the shared access helper")
  assertNotIncludes(reportsRoute, "if (hasSuperAdminRole) return true", "ordinary report routes do not bypass ownership for admin roles")

  const reportDownload = readProjectFile("src/app/api/reports/download/route.ts")
  assertOwnerScopedDatasetRead(reportDownload, "private report download")
  assertNotIncludes(reportDownload, "hasSuperAdminRole", "private report download does not grant role-based customer data access")
  assertNotIncludes(reportDownload, "isSuperAdminUserId", "private report download does not grant built-in id customer data access")

  const profitabilityPage = readProjectFile("src/app/(auth)/app/profitability/page.tsx")
  assertOwnerScopedDatasetRead(profitabilityPage, "Profitability page focused dataset")
  assertNotIncludes(profitabilityPage, 'role === "superadmin"', "Profitability page does not bypass ownership by role")

  for (const path of [
    "src/app/(auth)/app/prebookkeeping/page.tsx",
    "src/app/api/prebookkeeping/categorize/route.ts",
    "src/app/api/prebookkeeping/review/route.ts",
    "src/app/api/prebookkeeping/export/route.ts",
    "src/app/api/hybrid-ai/dataset-chat/route.ts",
    "src/app/api/chat/route.ts",
    "src/lib/chat/validation.ts",
    "src/lib/chat/sql-executor.ts",
    "src/lib/chat/fallback.ts",
  ]) {
    const source = readProjectFile(path)
    assertOwnerScopedDatasetRead(source, path)
    assertNotIncludes(source, 'role === "superadmin"', `${path} does not bypass ownership for superadmin role`)
    assertNotIncludes(source, 'role === "admin"', `${path} does not bypass ownership for admin role`)
  }

  const builtinUsers = readProjectFile("src/lib/auth/builtin-users.ts")
  const adminLayout = readProjectFile("src/app/(auth)/app/admin/layout.tsx")
  assertIncludes(builtinUsers, "export function isSuperAdminUserId", "explicit Superadmin identity helper remains available")
  assertIncludes(builtinUsers, "export function isSuperadmin", "explicit Superadmin access helper remains available")
  assertIncludes(adminLayout, 'session?.user?.role !== "superadmin"', "explicit admin shell still has its separate Superadmin gate")
}

main()
