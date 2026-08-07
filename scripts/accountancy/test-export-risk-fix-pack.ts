import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  categorizePrebookkeepingRows,
  normalizePrebookkeepingCategorization,
} from "../../src/lib/accountancy/prebookkeeping-categorization";
import { buildPrebookkeepingExport, PrebookkeepingExportError } from "../../src/lib/accountancy/prebookkeeping-export";
import { buildBusinessTaxProfile } from "../../src/lib/accountancy/prebookkeeping-vat";
import { emptyCompanySetupPayload } from "../../src/lib/business/company-setup";
import { calculateRiskIntelligence } from "../../src/lib/risk-intelligence/risk-engine";

function run() {
  testReviewedExportValidationMessage();
  testPrebookkeepingPageDoesNotLinkDirectlyToExportApi();
  testReviewWorkspaceHasPrimaryAccountantExportWorkflow();
  testPrebookkeepingRiskIntelligenceUsesCategorization();
  testRiskPageHasGracefulProblemState();
  console.log("Pre-bookkeeping export and risk fix pack regression tests passed.");
}

function testReviewedExportValidationMessage() {
  const categorization = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Office expense", supplier: "Office Shop", amount: -100 },
  ], [], { taxProfile: taxProfile() });

  assert.throws(
    () => buildPrebookkeepingExport({ datasetName: "ledger", categorization, format: "csv", scope: "reviewed" }),
    (error) => error instanceof PrebookkeepingExportError &&
      error.message === "No reviewed transactions are available yet. Please review and approve transactions before exporting.",
  );
}

function testPrebookkeepingPageDoesNotLinkDirectlyToExportApi() {
  const source = readFileSync("src/app/(auth)/app/prebookkeeping/page.tsx", "utf8");
  assert.doesNotMatch(source, /href=.\{`\/api\/prebookkeeping\/export/);
  assert.match(source, /href="#accountant-export"/);
}

function testReviewWorkspaceHasPrimaryAccountantExportWorkflow() {
  const source = readFileSync("src/components/accountancy/prebookkeeping-review-workspace.tsx", "utf8");
  assert.match(source, /Export for Accountant/);
  assert.match(source, /Review Transactions/);
  assert.match(source, /No reviewed transactions are available yet/);
}

function testPrebookkeepingRiskIntelligenceUsesCategorization() {
  const categorization = normalizePrebookkeepingCategorization(categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Customer payment", supplier: "Customer A", amount: 100, currency: "EUR" },
    { date: "2026-01-02", description: "Large rent", supplier: "Main Landlord", amount: -180, currency: "EUR" },
    { date: "2026-01-02", description: "Large rent", supplier: "Main Landlord", amount: -180, currency: "EUR" },
    { date: "2026-01-03", description: "", amount: -20, currency: "EUR" },
  ], [], { taxProfile: taxProfile() }));
  const risk = calculateRiskIntelligence({
    id: "dataset_prebookkeeping_1",
    name: "10_accountancy_ledger",
    fileName: "ledger.csv",
    datasetType: "prebookkeeping",
    businessModel: "bookkeeping",
    rowCount: categorization.transactions.length,
    analysis: { prebookkeepingCategorization: categorization },
  }, []);

  assert.ok(risk, "Pre-bookkeeping categorization should produce risk intelligence.");
  assert.equal(risk?.dataset.datasetType, "prebookkeeping");
  assert.match(risk?.findings.map((finding) => finding.title).join(" "), /VAT review required|Possible duplicate payments|Large expense transactions/);
}

function testRiskPageHasGracefulProblemState() {
  const source = readFileSync("src/app/(auth)/app/risk-intelligence/page.tsx", "utf8");
  assert.match(source, /Problem detected/);
  assert.match(source, /Return to Dashboard/);
  assert.match(source, /safeRiskPageReason/);
}

function taxProfile() {
  const setup = emptyCompanySetupPayload();
  setup.companyInfo.taxResidenceCountry = "Netherlands";
  setup.currencySettings.primaryCurrency = "EUR";
  setup.taxSettings.taxRegistered = "yes";
  setup.taxSettings.taxType = "vat";
  setup.taxSettings.standardTaxRate = "21";
  return buildBusinessTaxProfile(setup);
}

run();
