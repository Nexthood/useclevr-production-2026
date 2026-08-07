import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  categorizePrebookkeepingRows,
  normalizePrebookkeepingCategorization,
} from "../../src/lib/accountancy/prebookkeeping-categorization";
import { buildBusinessTaxProfile } from "../../src/lib/accountancy/prebookkeeping-vat";
import { emptyCompanySetupPayload, type CompanySetupPayload } from "../../src/lib/business/company-setup";
import { buildPrebookkeepingExport } from "../../src/lib/accountancy/prebookkeeping-export";

function run() {
  testBusinessProfileDefaultVatPrediction();
  testReducedZeroAndReverseChargePredictions();
  testNonVatRegisteredBusiness();
  testUnknownRowsRequireReview();
  testScopedVatLearningRule();
  testUnitedKingdomProfileAndLargeFile();
  testExportCarriesVatAuditTrail();
  testReviewWorkspaceUsesConfiguredRates();
  console.log("Intelligent VAT workflow regression tests passed.");
}

function testBusinessProfileDefaultVatPrediction() {
  const taxProfile = buildBusinessTaxProfile(profile({ country: "Netherlands", defaultRate: "21", currency: "EUR" }));
  const categorization = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Office supplies", supplier: "Office Depot", amount: -100, currency: "EUR" },
  ], [], { taxProfile });

  const transaction = categorization.transactions[0];
  assert.equal(transaction.vatRate, 21);
  assert.equal(transaction.vatStatus, "present");
  assert.equal(transaction.vatTax, 21);
  assert.equal(transaction.vatNeedsReview, false);
  assert.equal(transaction.vatSource, "business_profile");
  assert.match(transaction.vatReason || "", /Business Profile default VAT rate/);
  assert.equal(categorization.reviewSummary.defaultVatRate, 21);
  assert.equal(categorization.reviewSummary.businessCountry, "Netherlands");
}

function testReducedZeroAndReverseChargePredictions() {
  const taxProfile = buildBusinessTaxProfile(profile({
    country: "Belgium",
    defaultRate: "21",
    reducedRate: "6",
    zeroRate: "0",
    reverseChargeEnabled: "yes",
  }));
  const categorization = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Team meal", supplier: "Lunch Bar", amount: -100 },
    { date: "2026-01-02", description: "Export consulting", supplier: "Global Client", amount: 1000 },
    { date: "2026-01-03", description: "Reverse charge cloud service", supplier: "Cloud Vendor", amount: -200 },
  ], [], { taxProfile });

  assert.equal(categorization.transactions[0].vatRate, 6);
  assert.equal(categorization.transactions[1].vatRate, 0);
  assert.equal(categorization.transactions[2].vatRate, 0);
}

function testNonVatRegisteredBusiness() {
  const setup = profile({ country: "United States", defaultRate: "", currency: "USD" });
  setup.taxSettings.taxRegistered = "no";
  setup.taxSettings.taxType = "none";
  const taxProfile = buildBusinessTaxProfile(setup);
  const categorization = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Software subscription", supplier: "SaaS Co", amount: -50, currency: "USD" },
  ], [], { taxProfile });

  assert.equal(categorization.transactions[0].vatRate, 0);
  assert.equal(categorization.transactions[0].vatConfidence, 0.99);
  assert.equal(categorization.transactions[0].vatStatus, "present");
}

function testUnknownRowsRequireReview() {
  const taxProfile = buildBusinessTaxProfile(profile({ country: "Germany", defaultRate: "19", currency: "EUR" }));
  const categorization = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "", amount: -50 },
  ], [], { taxProfile });

  assert.equal(categorization.transactions[0].vatStatus, "missing");
  assert.equal(categorization.transactions[0].vatNeedsReview, true);
  assert.match(categorization.transactions[0].vatReason || "", /Supplier\/customer is missing|Category is unknown/);
}

function testScopedVatLearningRule() {
  const taxProfile = buildBusinessTaxProfile(profile({
    country: "France",
    defaultRate: "20",
    reducedRate: "5.5",
    currency: "EUR",
  }));
  const categorization = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Monthly office expense", supplier: "Stripe Ltd", amount: -100 },
  ], [{
    supplierKey: "stripe ltd",
    category: "operating_expenses",
    countryKey: "france",
    vatRate: 5.5,
  }], { taxProfile });

  assert.equal(categorization.transactions[0].vatRate, 5.5);
  assert.equal(categorization.transactions[0].vatSource, "learning_rule");
}

function testUnitedKingdomProfileAndLargeFile() {
  const taxProfile = buildBusinessTaxProfile(profile({ country: "United Kingdom", defaultRate: "20", zeroRate: "0", currency: "GBP" }));
  const rows = Array.from({ length: 200 }, (_, index) => ({
    date: "2026-01-01",
    description: index % 10 === 0 ? "Export service" : "Office subscription",
    supplier: index % 10 === 0 ? "Global Client" : "Subscription Vendor",
    amount: index % 2 === 0 ? -100 : 250,
    currency: "GBP",
  }));
  const categorization = categorizePrebookkeepingRows(rows, [], { taxProfile });
  assert.equal(categorization.transactions.length, 200);
  assert.equal(categorization.reviewSummary.businessCountry, "United Kingdom");
  assert.equal(categorization.transactions[0].vatRate, 0);
  assert.equal(categorization.transactions[1].vatRate, 20);
}

function testExportCarriesVatAuditTrail() {
  const taxProfile = buildBusinessTaxProfile(profile({ country: "Hungary", defaultRate: "27", currency: "HUF" }));
  const categorization = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Office supplies", supplier: "Office Shop", amount: -100, currency: "HUF" },
  ], [], { taxProfile });
  const normalized = normalizePrebookkeepingCategorization({
    ...categorization,
    transactions: categorization.transactions.map((transaction) => ({ ...transaction, reviewed: true, reviewStatus: "reviewed" })),
  });
  const csv = buildPrebookkeepingExport({
    datasetName: "vat-ledger",
    categorization: normalized,
    format: "csv",
    scope: "all",
  });

  assert.equal(csv.rowCount, 1);
  assert.match(String(csv.body), /VAT Confidence/);
  assert.match(String(csv.body), /VAT Reason/);
}

function testReviewWorkspaceUsesConfiguredRates() {
  const source = readFileSync("src/components/accountancy/prebookkeeping-review-workspace.tsx", "utf8");
  assert.match(source, /configuredVatRates/);
  assert.match(source, /Apply Business Default VAT/);
  assert.match(source, /Apply to matching/);
  assert.doesNotMatch(source, /\[0,\s*5,\s*10,\s*20\]/);
}

function profile(input: {
  country: string;
  defaultRate: string;
  currency?: string;
  reducedRate?: string;
  zeroRate?: string;
  reverseChargeEnabled?: "yes" | "no" | "not_sure" | "";
}): CompanySetupPayload {
  const setup = emptyCompanySetupPayload();
  setup.companyInfo.taxResidenceCountry = input.country;
  setup.companyInfo.country = input.country;
  setup.companyInfo.businessType = "Services";
  setup.companyInfo.fiscalYearStart = "January";
  setup.companyInfo.fiscalYearEnd = "December";
  setup.currencySettings.primaryCurrency = input.currency || "EUR";
  setup.taxSettings.taxRegistered = "yes";
  setup.taxSettings.taxType = "vat";
  setup.taxSettings.standardTaxRate = input.defaultRate;
  setup.taxSettings.reducedTaxRate = input.reducedRate || "";
  setup.taxSettings.zeroTaxRate = input.zeroRate || "";
  setup.taxSettings.reverseChargeEnabled = input.reverseChargeEnabled || "no";
  setup.taxSettings.taxEntries = [
    {
      id: "tax_standard",
      taxType: "VAT",
      percentage: input.defaultRate,
      fixedAmount: "",
      frequency: "quarterly" as const,
      notes: "",
      confirmed: true,
    },
  ].filter((entry) => entry.percentage);
  return setup;
}

run();
