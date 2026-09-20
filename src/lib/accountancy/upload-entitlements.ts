import type { AccountancyDatasetType, AccountancyUploadType } from "@/lib/accountancy/upload-processing";

export type AccountancyUploadEntitlement = {
  normalUploadCreditsRequired: boolean;
  source: "accountancy_workflow";
  feature: "standard_upload_analysis";
  datasetType: AccountancyDatasetType;
  uploadType: AccountancyUploadType;
};

/**
 * Accountancy and Pre-bookkeeping uploads no longer carry a credit exemption.
 * Both upload areas (structured CSV/Excel/bank and document PDF/receipt) use
 * the same centralized credit engine and feature costs as every other upload.
 */
export function resolveAccountancyUploadEntitlement(input: {
  datasetType: AccountancyDatasetType;
  uploadType: AccountancyUploadType;
}): AccountancyUploadEntitlement {
  return {
    normalUploadCreditsRequired: true,
    source: "accountancy_workflow",
    feature: "standard_upload_analysis",
    datasetType: input.datasetType,
    uploadType: input.uploadType,
  };
}
