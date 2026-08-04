import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const schemaSource = read("src/lib/db/schema.ts");
const migrationSource = read("src/lib/db/migrations/0018_business_profile_ssot.sql");
const setupStoreSource = read("src/lib/business/company-setup-store.ts");
const currentProfileSource = read("src/lib/business/current-business-profile.ts");
const businessStoreSource = read("src/lib/business/business-store.ts");
const setupApiSource = read("src/app/api/business/setup/route.ts");
const wizardSource = read("src/components/business/business-profile-question-wizard.tsx");
const accountancySource = read("src/app/(auth)/app/accountancy/page.tsx");
const taxSource = read("src/app/(auth)/app/accountancy/tax/page.tsx");
const complianceSource = read("src/app/(auth)/app/accountancy/compliance/page.tsx");
const analyzeSource = read("src/app/api/analyze/route.ts");
const datasetAnalyzeSource = read("src/app/api/datasets/[id]/analyze/route.ts");

assert.match(schemaSource, /businessProfiles = pgTable\(\s*"business_profile"/, "schema defines one business_profile table");
assert.match(schemaSource, /organizationId: text\("organization_id"\)\.notNull\(\)/, "business_profile uses organization_id as lookup key");
assert.match(schemaSource, /uniqueIndex\("business_profile_organization_id_key"\)/, "business_profile enforces one profile per organization");
assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS "business_profile"/, "migration creates business_profile table");
assert.match(migrationSource, /ON CONFLICT \("organization_id"\) DO UPDATE/, "migration backfills existing Business.companySetup by organization_id");

assert.match(setupStoreSource, /\.insert\(businessProfiles\)[\s\S]*\.onConflictDoUpdate\(/, "wizard save upserts business_profile");
assert.doesNotMatch(setupStoreSource, /companySetup: fullPayload/, "wizard does not write setup payload back into Business.companySetup");
assert.match(setupStoreSource, /\.from\(businessProfiles\)[\s\S]*businessProfiles\.organizationId/, "wizard load reads business_profile by organization_id");
assert.match(setupStoreSource, /getCompanySetupRecord/, "repository exposes the canonical setup record with organization context");
assert.match(currentProfileSource, /getBusinessProfileForCurrentTenant/, "current tenant loader is the shared Business Profile entry point");
assert.match(currentProfileSource, /requireBuiltinUserRecord\(userId\)/, "shared loader uses the same authenticated user bootstrap as the Business API");
assert.match(currentProfileSource, /getCompanySetupRecord\(userId\)/, "shared loader reads the authoritative repository once");
assert.match(currentProfileSource, /normalizeSharedBusinessProfile/, "shared loader normalizes Accountancy profile fields once");

assert.match(businessStoreSource, /getBusinessProfilePayload/, "Business detail readers load the shared business_profile payload");
assert.match(businessStoreSource, /upsertBusinessProfilePayload/, "Business detail saves update the shared business_profile payload");
assert.match(businessStoreSource, /setupToDetails/, "Business details derive from the same setup payload as Accountancy");

assert.match(setupApiSource, /revalidateBusinessProfileDependents/, "Business setup API revalidates dependent modules");
for (const path of ["/app/business", "/app/accountancy", "/app/accountancy/tax", "/app/accountancy/compliance", "/app/accountancy/reporting"]) {
  assert.match(read("src/lib/business/business-profile-revalidation.ts"), new RegExp(path.replaceAll("/", "\\/")), `revalidation includes ${path}`);
}

assert.match(wizardSource, /router\.refresh\(\)/, "wizard refreshes the current route after save");
assert.match(wizardSource, /cache: "no-store"/, "wizard avoids stale client cache for setup load/save");

assert.match(read("src/app/(auth)/app/business/page.tsx"), /getBusinessProfileForCurrentTenant\(\)/, "Business page uses the shared current-tenant loader");
assert.match(accountancySource, /getBusinessProfileForCurrentTenant\(\)/, "Accountancy reads the shared current-tenant loader");
assert.doesNotMatch(accountancySource, /Not set/, "Accountancy context no longer displays Not set");
assert.match(currentProfileSource, /Not configured/, "Shared Business Profile formatter displays Not configured for missing values");
assert.doesNotMatch(read("src/app/(auth)/app/prebookkeeping/page.tsx"), /Not set/, "Pre-bookkeeping context no longer displays Not set");
assert.doesNotMatch(read("src/app/(auth)/app/profitability/page.tsx"), /Not set/, "Profitability context no longer displays Not set");
assert.match(taxSource, /getBusinessProfileForCurrentTenant\(\)/, "Tax page reads the shared current-tenant loader");
assert.match(taxSource, /Not configured/, "Tax page displays Not configured for missing values");
assert.match(complianceSource, /getBusinessProfileForCurrentTenant\(\)/, "Compliance page reads the shared current-tenant loader");
assert.match(read("src/app/(auth)/app/accountancy/reporting/page.tsx"), /getBusinessProfileForCurrentTenant\(\)/, "Reporting reads the shared current-tenant loader");

assert.match(analyzeSource, /getCompanySetup\(effectiveUserId\)/, "AI analysis reads the shared company setup");
assert.match(datasetAnalyzeSource, /getCompanySetup\(userId\)/, "Dataset analysis reads the shared company setup");

process.stdout.write("ok - business profile single source of truth\n");

function read(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}
