import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  displayBusinessProfileValue,
  normalizeBusinessProfileContext,
} from "../../src/lib/business/business-profile-context"
import { emptyCompanySetupPayload } from "../../src/lib/business/company-setup"

const nested = emptyCompanySetupPayload()
nested.companyInfo.taxResidenceCountry = "Netherlands"
nested.companyInfo.fiscalYearStart = "January 1"
nested.companyInfo.fiscalYearEnd = "December 31"
nested.currencySettings.primaryCurrency = "EUR"
nested.taxSettings.taxEntries = [
  {
    id: "tax_1",
    taxType: "vat",
    percentage: "21",
    fixedAmount: "",
    frequency: "quarterly",
    notes: "",
    confirmed: true,
  },
]
nested.employerContributions = [
  {
    id: "payroll_1",
    contributionType: "social_security",
    percentage: "18",
    monthlyCost: "0",
    annualCost: "",
  },
]
nested.fixedCosts = [
  {
    id: "fixed_1",
    costCategory: "Software",
    monthlyCost: "2500",
    annualCost: "",
  },
]

const nestedContext = normalizeBusinessProfileContext(nested)
assert.equal(nestedContext.taxCountry, "Netherlands")
assert.equal(nestedContext.currency, "EUR")
assert.equal(nestedContext.fiscalYear, "January 1 to December 31")
assert.equal(nestedContext.vatSalesTax, "Vat 21% quarterly")
assert.equal(nestedContext.payroll, "Social Security 18% 0 monthly")
assert.equal(nestedContext.fixedCosts, "Software 2,500 monthly")

const legacyContext = normalizeBusinessProfileContext({
  taxCountry: "Germany",
  currency: "USD",
  fiscalYear: "April 1 to March 31",
  vatSalesTax: 0,
  payroll: false,
  fixedCosts: 0,
})
assert.equal(legacyContext.taxCountry, "Germany")
assert.equal(legacyContext.currency, "USD")
assert.equal(legacyContext.fiscalYear, "April 1 to March 31")
assert.equal(legacyContext.vatSalesTax, 0)
assert.equal(legacyContext.payroll, "No")
assert.equal(legacyContext.fixedCosts, 0)

assert.equal(displayBusinessProfileValue(0), "0")
assert.equal(displayBusinessProfileValue(false), "No")
assert.equal(displayBusinessProfileValue(null), "Not configured")
assert.equal(displayBusinessProfileValue(undefined), "Not configured")

const accountancyPage = readFileSync("src/app/(auth)/app/accountancy/page.tsx", "utf8")
assert.ok(accountancyPage.includes("getBusinessProfileContext"), "Accountancy Overview reads the shared context service")
assert.ok(accountancyPage.includes("displayBusinessProfileValue"), "Accountancy Overview formats context through the shared display helper")
assert.ok(!accountancyPage.includes("value || MISSING_PROFILE_VALUE"), "Accountancy rows do not hide valid zero or false values")

const businessSetupRoute = readFileSync("src/app/api/business/setup/route.ts", "utf8")
assert.ok(businessSetupRoute.includes("saveCompanySetup"), "Business setup route uses the shared save repository")
assert.ok(businessSetupRoute.includes("getCompanySetup"), "Business setup route reloads the persisted profile")

const setupStore = readFileSync("src/lib/business/company-setup-store.ts", "utf8")
assert.ok(setupStore.includes("businessProfiles.organizationId"), "Business Profile reads by organization_id")
assert.ok(setupStore.includes(".onConflictDoUpdate"), "Business Profile save upserts one row")

console.log("Business Profile context integration tests passed.")
