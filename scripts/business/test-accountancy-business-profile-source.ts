import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const businessSetupRoute = readFileSync("src/app/api/business/setup/route.ts", "utf8")
assert.ok(businessSetupRoute.includes("getCompanySetup(session.user.id"), "Business Profile API loads the saved profile through getCompanySetup")
assert.ok(businessSetupRoute.includes("sessionUserId = session?.user?.id ?? null"), "Business Profile API resolves the authenticated user before save")
assert.ok(businessSetupRoute.includes("saveCompanySetup(sessionUserId"), "Business Profile API saves the profile through saveCompanySetup")

const setupStore = readFileSync("src/lib/business/company-setup-store.ts", "utf8")
assert.ok(setupStore.includes("businessProfiles.organizationId"), "Business Profile repository reads by organization_id")
assert.ok(setupStore.includes("eq(businesses.userId, userId)"), "Business Profile repository uses the authenticated user tenant")
assert.ok(setupStore.includes(".onConflictDoUpdate"), "Business Profile repository upserts the single saved record")
assert.ok(setupStore.includes("getCompanySetupRecord"), "Business Profile repository exposes source and organization diagnostics")

const currentProfileLoader = readFileSync("src/lib/business/current-business-profile.ts", "utf8")
assert.ok(currentProfileLoader.includes("export async function getBusinessProfileForCurrentTenant"), "Shared current-tenant Business Profile loader exists")
assert.ok(currentProfileLoader.includes("await requireBuiltinUserRecord(userId)"), "Shared loader uses the same auth bootstrap as the Business API")
assert.ok(currentProfileLoader.includes("const record = await getCompanySetupRecord(userId)"), "Shared loader reuses the authoritative repository")
assert.ok(currentProfileLoader.includes("taxCountry: configuredString(setup.companyInfo.taxResidenceCountry)"), "Shared loader maps taxCountry")
assert.ok(currentProfileLoader.includes("currency: configuredString(setup.currencySettings.primaryCurrency)"), "Shared loader maps currency")
assert.ok(currentProfileLoader.includes("fiscalYear: formatFiscalYear(setup.companyInfo.fiscalYearStart, setup.companyInfo.fiscalYearEnd)"), "Shared loader maps fiscalYear")
assert.ok(currentProfileLoader.includes("vatSalesTax: formatTaxEntries(setup.taxSettings.taxEntries)"), "Shared loader maps vatSalesTax")
assert.ok(currentProfileLoader.includes("payroll: formatEmployerContributions(setup.employerContributions)"), "Shared loader maps payroll")
assert.ok(currentProfileLoader.includes("fixedCosts: formatFixedCosts(setup.fixedCosts)"), "Shared loader maps fixedCosts")
assert.ok(currentProfileLoader.includes("value === null || value === undefined"), "Shared display helper treats only null and undefined as missing")

const businessPage = readFileSync("src/app/(auth)/app/business/page.tsx", "utf8")
assert.ok(businessPage.includes("await getBusinessProfileForCurrentTenant()"), "Business page uses the shared loader")

const accountancyPage = readFileSync("src/app/(auth)/app/accountancy/page.tsx", "utf8")
assert.ok(accountancyPage.includes("await getBusinessProfileForCurrentTenant()"), "Accountancy Overview loads the exact shared Business Profile source")
assert.ok(accountancyPage.includes("businessProfileResult.profile"), "Accountancy consumes the normalized shared profile object")
assert.ok(accountancyPage.includes("profileLoadFailed"), "Accountancy distinguishes profile load failure from missing field values")
assert.ok(accountancyPage.includes("AccountancyPageContent"), "Accountancy renders through a guarded server content loader")
assert.ok(accountancyPage.includes("serializeAccountancyError"), "Accountancy logs server loader failures with stack details")
assert.ok(accountancyPage.includes("function AccountancyEmptyState"), "Accountancy returns an empty state when loader data is unavailable")
assert.ok(accountancyPage.includes("getSetupCompleted(companySetup)"), "Accountancy null-guards setupStatus before reading completion")
assert.ok(accountancyPage.includes("getCompanyName(companySetup)"), "Accountancy null-guards companyInfo before reading the company name")
assert.ok(accountancyPage.includes("formatAccountancyCount(focusedDataset.rowCount)"), "Accountancy null-guards focused dataset row counts")
assert.ok(accountancyPage.includes("formatAccountancyCount(focusedDataset.columnCount)"), "Accountancy null-guards focused dataset column counts")
assert.ok(!accountancyPage.includes("getBusinessProfileContext"), "Accountancy Overview does not use a separate profile context query")
assert.ok(!accountancyPage.includes("value || MISSING_PROFILE_VALUE"), "Accountancy Overview does not hide valid falsy values")

const accountancyTaxPage = readFileSync("src/app/(auth)/app/accountancy/tax/page.tsx", "utf8")
assert.ok(accountancyTaxPage.includes("await getBusinessProfileForCurrentTenant()"), "Accountancy Tax uses the same Business Profile source")
assert.ok(!accountancyTaxPage.includes("getBusinessProfileContext"), "Accountancy Tax does not use a separate profile query")

const accountancyReportingPage = readFileSync("src/app/(auth)/app/accountancy/reporting/page.tsx", "utf8")
assert.ok(accountancyReportingPage.includes("await getBusinessProfileForCurrentTenant()"), "Accountancy Reporting uses the same Business Profile source")
assert.ok(!accountancyReportingPage.includes("getBusinessProfileContext"), "Accountancy Reporting does not use a separate profile query")

const accountancyCompliancePage = readFileSync("src/app/(auth)/app/accountancy/compliance/page.tsx", "utf8")
assert.ok(accountancyCompliancePage.includes("await getBusinessProfileForCurrentTenant()"), "Accountancy Compliance uses the same Business Profile source")

const accountancyErrorPage = readFileSync("src/app/(auth)/app/accountancy/error.tsx", "utf8")
assert.ok(accountancyErrorPage.includes("Could not load Accountancy"), "Accountancy error boundary shows a neutral render failure state")
assert.ok(!accountancyErrorPage.includes(">Not configured</span>"), "Accountancy error boundary does not hardcode profile fields as not configured")
assert.ok(!accountancyErrorPage.includes("Complete Business Profile Setup"), "Accountancy error boundary does not claim the profile is incomplete after request failure")

console.log("Accountancy Business Profile source tests passed.")
