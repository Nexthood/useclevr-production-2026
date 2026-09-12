import type { AccountancyDatasetType, AccountancyUploadType } from "@/lib/accountancy/upload-processing";

export type AccountancyUploadEntitlement = {
  normalUploadCreditsRequired: boolean;
  source: "accountancy_workflow";
  reason: "accountancy_prebookkeeping_credit_exempt";
  datasetType: AccountancyDatasetType;
  uploadType: AccountancyUploadType;
};

export function resolveAccountancyUploadEntitlement(input: {
  datasetType: AccountancyDatasetType;
  uploadType: AccountancyUploadType;
}): AccountancyUploadEntitlement {
  return {
    normalUploadCreditsRequired: false,
    source: "accountancy_workflow",
    reason: "accountancy_prebookkeeping_credit_exempt",
    datasetType: input.datasetType,
    uploadType: input.uploadType,
  };
}
