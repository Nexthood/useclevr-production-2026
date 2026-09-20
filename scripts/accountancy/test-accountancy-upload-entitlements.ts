import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveAccountancyUploadEntitlement } from "../../src/lib/accountancy/upload-entitlements";

function run() {
  testAccountancyRequiresNormalUploadCredits();
  testAccountancyProcessorUsesCentralizedCreditEngine();
  testNormalDatasetUploadStillUsesCredits();
  testSuperadminCreditBehaviorStaysInCreditEngine();
  testPrebookkeepingDatasetStaysTenantOwned();
  console.log("Accountancy upload entitlement regression tests passed.");
}

function testAccountancyRequiresNormalUploadCredits() {
  const csv = resolveAccountancyUploadEntitlement({ datasetType: "prebookkeeping", uploadType: "csv" });
  const excel = resolveAccountancyUploadEntitlement({ datasetType: "prebookkeeping", uploadType: "excel" });
  const pdf = resolveAccountancyUploadEntitlement({ datasetType: "prebookkeeping", uploadType: "pdf" });
  const accountancy = resolveAccountancyUploadEntitlement({ datasetType: "accountancy", uploadType: "csv" });

  for (const entitlement of [csv, excel, pdf, accountancy]) {
    assert.equal(entitlement.normalUploadCreditsRequired, true, "Accountancy uploads no longer carry a credit exemption");
    assert.equal(entitlement.source, "accountancy_workflow");
    assert.equal(entitlement.feature, "standard_upload_analysis", "Accountancy uploads use the authoritative standard upload+analysis feature cost");
  }
}

function testAccountancyProcessorUsesCentralizedCreditEngine() {
  const processor = readFileSync("src/lib/accountancy/upload-processing.ts", "utf8");
  const ui = readFileSync("src/components/accountancy/accountancy-upload.tsx", "utf8");

  assert.ok(processor.includes("resolveAccountancyUploadEntitlement"), "Accountancy upload resolves the dedicated entitlement");
  assert.ok(processor.includes("uploadEntitlement"), "Accountancy datasets store the entitlement decision in analysis metadata");
  assert.ok(processor.includes("reserveAccountancyUploadCredits"), "Accountancy upload reserves credits through the centralized engine");
  assert.ok(processor.includes("finalizeAccountancyUploadCredits"), "Accountancy upload finalizes the reserved credits once");
  assert.ok(processor.includes("releaseAccountancyUploadCredits"), "Accountancy upload releases the reservation when processing fails");
  assert.ok(!processor.includes("RETAIL_CREDIT_COST") && !processor.includes("ACCOUNTANCY_CREDIT_COST"), "no accountancy-specific credit constant exists");
  assert.ok(processor.includes("UPLOAD_CREDITS_EXHAUSTED"), "Accountancy upload produces structured credit exhaustion when the balance is insufficient");
  assert.ok(ui.includes('fetch("/api/accountancy/upload"'), "Accountancy UI submits to the accountancy upload path");
  assert.ok(ui.includes("const isUploadBlocked = isPlanLimitReached"), "Accountancy UI leaves entitlement enforcement to the server path");
}

function testNormalDatasetUploadStillUsesCredits() {
  const uploadAction = readFileSync("src/app/actions/upload.ts", "utf8");
  const uploadRoute = readFileSync("src/app/api/upload/route.ts", "utf8");

  assert.ok(uploadAction.includes("reserveCredits"), "normal dataset upload still reserves credits");
  assert.ok(uploadAction.includes('feature: "standard_upload_analysis"'), "normal dataset upload still uses the unified standard upload analysis feature");
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
