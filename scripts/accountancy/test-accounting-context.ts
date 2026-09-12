import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getAccountingContext } from "../../src/lib/accountancy/accounting-context";
import { emptyCompanySetupPayload, type CompanySetupPayload } from "../../src/lib/business/company-setup";

function run() {
  testUkVatContext();
  testUsCurrencyContext();
  testNoDuplicateStorage();
  testTenantSafeSourceWiring();
  console.log("Accounting context regression tests passed.");
}

function testUkVatContext() {
  const setup = buildSetup({
    companyInfo: {
      countryOfRegistration: "United Kingdom",
      legalStructure: "limited_liability",
      fiscalYearStart: "2026-04-01",
      fiscalYearEnd: "2027-03-31",
      businessType: "Services",
      industry: "Professional services",
    },
    currencySettings: {
      primaryCurrency: "GBP",
      reportingCurrency: "GBP",
    },
    taxSettings: {
      taxRegistered: "yes",
      taxType: "vat",
      standardTaxRate: "20",
    },
  });

  const context = getAccountingContext(setup);

  assert.equal(context.source, "business_profile");
  assert.equal(context.country, "United Kingdom");
  assert.equal(context.currency, "GBP");
  assert.equal(context.legalStructure, "Limited liability company");
  assert.equal(context.taxSystem, "VAT");
  assert.equal(context.vatRegistered, true);
  assert.equal(context.defaultVatRate, 20);
  assert.equal(context.fiscalPeriod, "2026-04-01 to 2027-03-31");
  assert.equal(context.businessType, "Services");
  assert.equal(context.industry, "Professional services");
}

function testUsCurrencyContext() {
  const setup = buildSetup({
    companyInfo: {
      countryOfRegistration: "United States",
      legalStructure: "corporation",
      fiscalYearStart: "2026-01-01",
      fiscalYearEnd: "2026-12-31",
      businessType: "SaaS",
      industry: "Software",
    },
    currencySettings: {
      primaryCurrency: "USD",
      reportingCurrency: "USD",
    },
    taxSettings: {
      taxRegistered: "not_sure",
      taxType: "sales_tax",
      standardTaxRate: "",
    },
  });

  const context = getAccountingContext(setup);

  assert.equal(context.country, "United States");
  assert.equal(context.currency, "USD");
  assert.equal(context.legalStructure, "Corporation");
  assert.equal(context.taxSystem, "Sales Tax");
  assert.equal(context.vatRegistered, null);
  assert.equal(context.defaultVatRate, null);
}

function testNoDuplicateStorage() {
  const source = readFileSync("src/lib/accountancy/accounting-context.ts", "utf8");

  assert.ok(!source.includes("getDb"), "context layer does not read the database");
  assert.ok(!source.includes("@/lib/db"), "context layer does not import database schema");
  assert.ok(!/\binsert\b/.test(source), "context layer does not create duplicate storage");
  assert.ok(!/\bupdate\b/.test(source), "context layer does not mutate Business Profile data");
}

function testTenantSafeSourceWiring() {
  const page = readFileSync("src/app/(auth)/app/accountancy/page.tsx", "utf8");
  const processor = readFileSync("src/lib/accountancy/upload-processing.ts", "utf8");
  const uploadRoute = readFileSync("src/app/api/accountancy/upload/route.ts", "utf8");

  assert.ok(page.includes("getBusinessProfileForCurrentTenant"), "Accountancy page loads context from the authenticated tenant helper");
  assert.ok(processor.includes("loadAccountingContextForUpload(input.userId)"), "upload processor requests context with the authenticated user id");
  assert.ok(processor.includes("getCompanySetup(userId)"), "upload context helper loads Business Profile by server-side user id");
  assert.ok(uploadRoute.includes("requireBuiltinUserRecord(userId)"), "upload route resolves the authenticated application user");
  assert.ok(!processor.includes("organizationId: input"), "upload processor does not trust client-provided organization ids");
  assert.ok(!uploadRoute.includes('formData.get("organizationId")'), "upload route does not accept a client organization id");
}

function buildSetup(overrides: {
  companyInfo?: Partial<CompanySetupPayload["companyInfo"]>;
  currencySettings?: Partial<CompanySetupPayload["currencySettings"]>;
  taxSettings?: Partial<CompanySetupPayload["taxSettings"]>;
}): CompanySetupPayload {
  const base = emptyCompanySetupPayload();
  return {
    ...base,
    companyInfo: {
      ...base.companyInfo,
      ...overrides.companyInfo,
    },
    currencySettings: {
      ...base.currencySettings,
      ...overrides.currencySettings,
    },
    taxSettings: {
      ...base.taxSettings,
      ...overrides.taxSettings,
    },
  };
}

run();
