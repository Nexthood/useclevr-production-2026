import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  buildBusinessProfileContext,
  emptyCompanySetupPayload,
  normalizeCompanySetupPayload,
} from "../../src/lib/business/company-setup"

const wizardSource = read("src/components/business/business-profile-question-wizard.tsx")
const setupApiSource = read("src/app/api/business/setup/route.ts")
const setupStoreSource = read("src/lib/business/company-setup-store.ts")
const currentProfileSource = read("src/lib/business/current-business-profile.ts")
const reportGeneratorSource = read("src/lib/reports/report-generator.ts")
const analyzeSource = read("src/app/api/analyze/route.ts")
const datasetAnalyzeSource = read("src/app/api/datasets/[id]/analyze/route.ts")

const savedProfile = normalizeCompanySetupPayload({
  ...emptyCompanySetupPayload(),
  companyInfo: {
    ...emptyCompanySetupPayload().companyInfo,
    companyName: "Original Co",
    country: "Netherlands",
    countryOfRegistration: "Netherlands",
    taxResidenceCountry: "Netherlands",
    industry: "SaaS",
    businessType: "SaaS",
    legalStructure: "limited_liability",
    employeeCount: "8",
    fiscalYearStart: "January 1",
    fiscalYearEnd: "December 31",
  },
  currencySettings: {
    primaryCurrency: "EUR",
    reportingCurrency: "EUR",
    otherCurrenciesUsed: [],
  },
  revenueModel: {
    ...emptyCompanySetupPayload().revenueModel,
    businessModels: ["SaaS"],
  },
  businessGoals: {
    ...emptyCompanySetupPayload().businessGoals,
    growthTarget: "20% annual recurring revenue growth",
  },
})

const editedProfile = normalizeCompanySetupPayload({
  ...savedProfile,
  companyInfo: {
    ...savedProfile.companyInfo,
    companyName: "Updated Co",
    industry: "Professional services",
    businessType: "Consulting",
  },
  revenueModel: {
    ...savedProfile.revenueModel,
    businessModels: ["Consulting"],
  },
})

assert.equal(savedProfile.companyInfo.companyName, "Original Co", "existing profile loads saved company name")
assert.equal(savedProfile.currencySettings.primaryCurrency, "EUR", "existing profile loads saved currency")
assert.equal(editedProfile.companyInfo.companyName, "Updated Co", "changed profile values normalize before save")
assert.match(buildBusinessProfileContext(editedProfile), /Updated Co/, "new context consumers receive updated profile values")
assert.doesNotMatch(buildBusinessProfileContext(editedProfile), /Original Co/, "updated profile context does not keep stale profile values")

assert.match(wizardSource, /Edit Business Profile/, "completed Business Profile exposes an edit action")
assert.match(wizardSource, /const \[savedPayload, setSavedPayload\]/, "wizard keeps the last persisted profile for cancel rollback")
assert.match(wizardSource, /setActiveIndex\(hasSavedProfile \? reviewIndex : 0\)/, "existing profile opens on the review step with saved values")
assert.match(wizardSource, /function closeProfileEditor\(\)[\s\S]*setPayload\(savedPayload\)/, "cancel restores the last persisted profile")
assert.match(wizardSource, /Save Changes/, "wizard exposes the requested save command")
assert.doesNotMatch(wizardSource, /completed \? \(/, "completed profile state does not replace the editor with a non-editable success panel")

assert.match(wizardSource, /fetch\("\/api\/business\/setup"[\s\S]*method: "PUT"/, "profile edits save through the existing setup API")
assert.match(wizardSource, /setSavedPayload\(savedPayload\)/, "successful save updates the displayed saved profile immediately")
assert.match(wizardSource, /router\.refresh\(\)/, "saved profile changes refresh server-rendered consumers")
assert.match(setupApiSource, /const payload = await getCompanySetup\(sessionUserId, body\.businessId\)/, "save response reloads persisted profile")
assert.match(setupApiSource, /headers: \{ "Cache-Control": "no-store" \}/, "save response avoids stale profile cache")

assert.match(setupApiSource, /if \(!sessionUserId\)[\s\S]*status: 401/, "setup API rejects unauthenticated profile changes")
assert.match(setupApiSource, /await requireBuiltinUserRecord\(sessionUserId\)/, "setup API verifies the authenticated user record")
assert.match(setupStoreSource, /conditions = \[eq\(businesses\.userId, userId\)\]/, "profile writes are scoped to the authenticated user's businesses")
assert.match(setupStoreSource, /conditions\.push\(eq\(businesses\.id, businessId\)\)/, "requested business profile writes also require a matching owned business id")
assert.match(setupStoreSource, /\.onConflictDoUpdate\(\{[\s\S]*target: businessProfiles\.organizationId/, "profile saves update the existing organization profile instead of creating duplicates")

assert.doesNotMatch(setupApiSource, /from\(datasets\)|datasetType|businessModel/, "profile save API does not modify dataset semantics")
assert.doesNotMatch(setupStoreSource, /from\(datasets\)|datasetType|businessModel/, "profile repository does not reclassify datasets")

assert.doesNotMatch(reportGeneratorSource, /getCompanySetup/, "stored reports do not dynamically reload the live Business Profile")
assert.match(reportGeneratorSource, /semanticContext: analysisData\.semanticContext/, "generated reports persist the analysis context they receive")
assert.match(datasetAnalyzeSource, /businessProfileContext/, "dataset analysis stores the profile-adjusted context with analysis results")

assert.match(analyzeSource, /getCompanySetup\(effectiveUserId\)/, "future AI Assistant requests load the current saved Business Profile")
assert.match(analyzeSource, /buildBusinessProfileContext\(businessProfile\)/, "future AI prompts use the current normalized profile context")
assert.match(datasetAnalyzeSource, /getCompanySetup\(userId\)/, "future dataset analysis loads the current saved Business Profile")
assert.match(currentProfileSource, /getCompanySetupRecord\(userId\)/, "profile display reloads the authoritative saved profile")

process.stdout.write("ok - business profile editability\n")

function read(path: string) {
  return readFileSync(path, "utf8")
}
