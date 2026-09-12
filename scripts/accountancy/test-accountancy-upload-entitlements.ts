import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveAccountancyUploadEntitlement } from "../../src/lib/accountancy/upload-entitlements";

function run() {
  testAccountancyPrebookkeepingIsCreditExempt();
  testAccountancyProcessorDoesNotDebitNormalCredits();
  testNormalDatasetUploadStillUsesCredits();
  testSuperadminCreditBehaviorStaysInCreditEngine();
  testPrebookkeepingDatasetStaysTenantOwned();
  console.log("Accountancy upload entitlement regression tests passed.");
}

function testAccountancyPrebookkeepingIsCreditExempt() {
  const csv = resolveAccountancyUploadEntitlement({ datasetType: "prebookkeeping", uploadType: "csv" });
  const excel = resolveAccountancyUploadEntitlement({ datasetType: "prebookkeeping", uploadType: "excel" });
  const pdf = resolveAccountancyUploadEntitlement({ datasetType: "prebookkeeping", uploadType: "pdf" });
  const accountancy = resolveAccountancyUploadEntitlement({ datasetType: "accountancy", uploadType: "csv" });

  for (const entitlement of [csv, excel, pdf, accountancy]) {
    assert.equal(entitlement.normalUploadCreditsRequired, false);
    assert.equal(entitlement.source, "accountancy_workflow");
    assert.equal(entitlement.reason, "accountancy_prebookkeeping_credit_exempt");
  }
}

function testAccountancyProcessorDoesNotDebitNormalCredits() {
  const processor = readFileSync("src/lib/accountancy/upload-processing.ts", "utf8");
  const ui = readFileSync("src/components/accountancy/accountancy-upload.tsx", "utf8");

  assert.ok(processor.includes("resolveAccountancyUploadEntitlement"), "Accountancy upload resolves the dedicated entitlement");
  assert.ok(processor.includes("uploadEntitlement"), "Accountancy datasets store the entitlement decision in analysis metadata");
  assert.ok(!processor.includes('feature: "dataset_upload"'), "Accountancy upload does not reserve normal dataset upload credits");
  assert.ok(!processor.includes("reserveCredits"), "Accountancy upload does not reserve normal credits");
  assert.ok(!processor.includes("finalizeCredits"), "Accountancy upload does not finalize normal credits");
  assert.ok(!processor.includes("checkSpendingLimits"), "Accountancy upload does not enter the normal spending-limit check");
  assert.ok(!processor.includes("UPLOAD_CREDITS_EXHAUSTED"), "Accountancy upload does not produce normal upload-credit exhaustion");
  assert.ok(!ui.includes('fetch("/api/usage/credits"'), "Accountancy UI does not pre-block on normal credit balance");
  assert.ok(ui.includes("const isUploadBlocked = isPlanLimitReached"), "Accountancy UI leaves entitlement enforcement to the server path");
}

function testNormalDatasetUploadStillUsesCredits() {
  const uploadAction = readFileSync("src/app/actions/upload.ts", "utf8");
  const uploadRoute = readFileSync("src/app/api/upload/route.ts", "utf8");

  assert.ok(uploadAction.includes("reserveCredits"), "normal dataset upload still reserves credits");
  assert.ok(uploadAction.includes('feature: "dataset_upload"'), "normal dataset upload still uses dataset_upload credits");
  assert.ok(uploadAction.includes("finalizeCredits"), "normal dataset upload still finalizes credits");
  assert.ok(uploadAction.includes("UPLOAD_CREDITS_EXHAUSTED"), "normal dataset upload still blocks exhausted credits");
  assert.ok(uploadRoute.includes("buildUploadCreditLimitInlineMessage"), "normal upload API still maps exhausted credits to upgrade copy");
}

function testSuperadminCreditBehaviorStaysInCreditEngine() {
  const creditEngine = readFileSync("src/lib/billing/credit-engine.ts", "utf8");
  const uploadAction = readFileSync("src/app/actions/upload.ts", "utf8");

  assert.ok(creditEngine.includes("hasUnlimitedCreditAccess"), "credit engine still owns unlimited-role behavior");
  assert.ok(creditEngine.includes("Unlimited account reservation records internal usage without blocking."), "superadmin reservation behavior remains in the credit engine");
  assert.ok(creditEngine.includes("Unlimited account usage recorded without customer credit debit."), "superadmin finalization behavior remains in the credit engine");
  assert.ok(uploadAction.includes("if (uploadUsage.unlimited)"), "normal upload still bypasses reservation for unlimited users");
}

function testPrebookkeepingDatasetStaysTenantOwned() {
  const processor = readFileSync("src/lib/accountancy/upload-processing.ts", "utf8");
  const route = readFileSync("src/app/api/accountancy/upload/route.ts", "utf8");

  assert.ok(route.includes("const userId = session?.user?.id"), "Accountancy route uses the authenticated session user");
  assert.ok(route.includes("requireBuiltinUserRecord(userId)"), "Accountancy route resolves the authenticated app user");
  assert.ok(route.includes("userId,"), "Accountancy route passes the authenticated user to the processor");
  assert.ok(processor.includes("userId: input.userId"), "created Accountancy dataset remains tenant-owned by the authenticated user");
  assert.ok(processor.includes("datasetType: input.datasetType"), "created Accountancy dataset preserves prebookkeeping/accountancy dataset type");
  assert.ok(!route.includes('formData.get("organizationId")'), "Accountancy route does not trust a client organization id");
  assert.ok(!processor.includes("organizationId: input"), "Accountancy processor does not use client-provided organization ids");
}

run();
