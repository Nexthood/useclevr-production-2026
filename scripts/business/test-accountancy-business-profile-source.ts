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

const accountancyPage = readFileSync("src/app/(auth)/app/accountancy/page.tsx", "utf8")
assert.ok(accountancyPage.includes("await getCompanySetup(userId)"), "Accountancy Overview loads the exact Business Profile source")
assert.ok(accountancyPage.includes("setup.companyInfo.taxResidenceCountry"), "Accountancy maps taxCountry from the shared Business Profile payload")
assert.ok(accountancyPage.includes("setup.currencySettings.primaryCurrency"), "Accountancy maps currency from the shared Business Profile payload")
assert.ok(accountancyPage.includes("setup.companyInfo.fiscalYearStart"), "Accountancy maps fiscalYear from the shared Business Profile payload")
assert.ok(accountancyPage.includes("setup.taxSettings.taxEntries"), "Accountancy maps vatSalesTax from the shared Business Profile payload")
assert.ok(accountancyPage.includes("setup.employerContributions"), "Accountancy maps payroll from the shared Business Profile payload")
assert.ok(accountancyPage.includes("setup.fixedCosts"), "Accountancy maps fixedCosts from the shared Business Profile payload")
assert.ok(accountancyPage.includes("value === null || value === undefined"), "Accountancy treats only null and undefined as not configured")
assert.ok(!accountancyPage.includes("getBusinessProfileContext"), "Accountancy Overview does not use a separate profile context query")
assert.ok(!accountancyPage.includes("value || MISSING_PROFILE_VALUE"), "Accountancy Overview does not hide valid falsy values")

const accountancyTaxPage = readFileSync("src/app/(auth)/app/accountancy/tax/page.tsx", "utf8")
assert.ok(accountancyTaxPage.includes("await getCompanySetup(session.user.id)"), "Accountancy Tax uses the same Business Profile source")
assert.ok(!accountancyTaxPage.includes("getBusinessProfileContext"), "Accountancy Tax does not use a separate profile query")

const accountancyReportingPage = readFileSync("src/app/(auth)/app/accountancy/reporting/page.tsx", "utf8")
assert.ok(accountancyReportingPage.includes("await getCompanySetup(userId)"), "Accountancy Reporting uses the same Business Profile source")
assert.ok(!accountancyReportingPage.includes("getBusinessProfileContext"), "Accountancy Reporting does not use a separate profile query")

const accountancyErrorPage = readFileSync("src/app/(auth)/app/accountancy/error.tsx", "utf8")
assert.ok(accountancyErrorPage.includes("Could not load Business Profile"), "Accountancy error boundary shows a load failure state")
assert.ok(!accountancyErrorPage.includes(">Not configured</span>"), "Accountancy error boundary does not hardcode profile fields as not configured")

console.log("Accountancy Business Profile source tests passed.")
