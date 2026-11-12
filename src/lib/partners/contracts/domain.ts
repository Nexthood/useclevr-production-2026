import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export class ContractError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}
export const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value as object)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}
export const hashObject = (value: unknown) => sha256(canonical(value));
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export const text = (min = 1, max = 500) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !/[<>\u0000-\u001f\u007f]/u.test(v), "Use plain text.");
export const agreementTypes = ["independent_sales", "authorized_reseller"] as const;
export type AgreementType = (typeof agreementTypes)[number];
export type ContractMode = "draft" | "mock" | "dropbox_test" | "dropbox_live";
export const terminalStates = ["fully_executed", "rejected", "cancelled", "expired"];
export const companySchema = z
  .object({
    legalName: z.literal("Atlas Mega Ventures LLC"),
    registrationId: text(),
    registrationJurisdiction: text(),
    address: text(10, 1000),
    country: z.string().regex(/^[A-Z]{2}$/),
    noticeEmail: z.email(),
  })
  .strict();
export const signerSchema = z
  .object({ reference: text(2, 100), name: text(2, 200), email: z.email(), title: text(2, 200) })
  .strict();
export const identitySchema = z
  .object({
    legalName: text(2, 200),
    entityType: z.enum(["individual", "company"]),
    address: text(10, 1000),
    country: z.string().regex(/^[A-Z]{2}$/),
    registrationId: text(1, 200).optional(),
    signerName: text(2, 200),
    signerTitle: text(1, 200),
    authorityConfirmed: z.literal(true),
    electronicRecordsConsent: z.literal(true),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.entityType === "company" && !v.registrationId)
      c.addIssue({
        code: "custom",
        path: ["registrationId"],
        message: "Company registration is required.",
      });
  });
export type ContractIdentity = z.infer<typeof identitySchema>;
export const commercialFieldNames = [
  "scope",
  "commissionRates",
  "commissionCalculation",
  "qualifyingReceivedRevenue",
  "eligibilityPeriod",
  "exclusions",
  "paymentTerms",
  "taxAndInvoicing",
  "refundsAndChargebacks",
  "territory",
  "exclusivity",
  "termAndRenewal",
  "terminationNotice",
  "liabilityAndIndemnity",
  "governingLaw",
  "disputeResolution",
  "dataProtectionSchedule",
] as const;
const commercialShape = Object.fromEntries(
  commercialFieldNames.map((k) => [k, text(5, 4000)]),
) as Record<(typeof commercialFieldNames)[number], ReturnType<typeof text>>;
export const scheduleSchema = z
  .object({
    version: text(1, 80),
    agreementType: z.enum(agreementTypes),
    company: companySchema,
    companySigner: signerSchema,
    terms: z.object(commercialShape).strict(),
    financialConfigId: text(1, 100),
    financialAlignmentConfirmed: z.literal(true),
    effectiveUntil: z.iso.datetime().optional(),
  })
  .strict();
export type CommercialSchedule = z.infer<typeof scheduleSchema>;
export type Template = {
  id: string;
  agreementType: AgreementType;
  version: string;
  title: string;
  body: string;
};
export type Signer = {
  role: "partner" | "company";
  reference: string;
  name: string;
  email: string;
  order: number;
  signedAt: string | null;
  providerSignatureId: string;
};
export type ProviderSnapshot = {
  reference: string;
  contractId: string;
  sourceChecksum: string;
  testMode: boolean;
  complete: boolean;
  declined: boolean;
  cancelled: boolean;
  expired: boolean;
  hasError: boolean;
  signers: Signer[];
  observedAt: string;
};
export type ContractSnapshot = {
  applicationId: string;
  partnerId: string;
  userId: string;
  partnerEmail: string;
  identity: ContractIdentity;
  company: z.infer<typeof companySchema>;
  companySigner: z.infer<typeof signerSchema>;
  terms: CommercialSchedule["terms"];
  financialConfigId: string;
  financialConfigHash: string;
  effectiveUntil: string | null;
  templateHash: string;
  profileHash: string;
  scheduleHash: string;
  runtimeHash: string;
  documentTitle: string;
};
export function selectAgreement(category: string): AgreementType | null {
  if (
    [
      "Independent Sales Partner",
      "Referral Partner",
      "CPA / Accounting Firm",
      "Business Consultant",
      "Business Consultancy",
    ].includes(category)
  )
    return "independent_sales";
  if (
    ["Authorized Reseller", "MSP", "System Integrator", "Enterprise Solution Partner"].includes(
      category,
    )
  )
    return "authorized_reseller";
  return null;
}
export function featureEnabled() {
  return process.env.PARTNER_CONTRACTS_ENABLED === "true";
}
export function requireFeature() {
  if (!featureEnabled()) throw new ContractError("contract_management_disabled", 404);
}
export function signingMode(): ContractMode {
  const mode = process.env.PARTNER_CONTRACT_SIGNING_MODE;
  if (mode !== "mock" && mode !== "dropbox_test" && mode !== "dropbox_live") return "draft";
  if (mode === "mock" && process.env.NODE_ENV === "production")
    throw new ContractError("mock_signatures_forbidden_in_production");
  return mode;
}
export function requireOwner(userId: string) {
  if (
    !(process.env.PARTNER_CONTRACT_OWNER_USER_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .includes(userId)
  )
    throw new ContractError("owner_approval_required", 403);
}
export function runtimePolicy() {
  return {
    provider: "dropbox_sign",
    mode: process.env.PARTNER_CONTRACT_SIGNING_MODE || "disabled",
    accountId: process.env.DROPBOX_SIGN_ACCOUNT_ID || "",
    appId: process.env.DROPBOX_SIGN_CLIENT_ID || "",
    origin:
      process.env.PARTNER_CONTRACT_PUBLIC_ORIGIN ||
      process.env.AUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "",
    retentionDays: Number(process.env.PARTNER_CONTRACT_RETENTION_DAYS || 0),
    monthlySendLimit: Number(process.env.PARTNER_CONTRACT_MONTHLY_SEND_LIMIT || 0),
    signatureTtlDays: Number(process.env.PARTNER_CONTRACT_SIGNATURE_TTL_DAYS || 7),
    reminderHours: Number(process.env.PARTNER_CONTRACT_REMINDER_HOURS || 72),
    encryptionKeyId: process.env.PARTNER_CONTRACT_ENCRYPTION_KEY_ID || "",
    companySignerReferences: (process.env.PARTNER_CONTRACT_COMPANY_SIGNER_REFS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .sort(),
  };
}
export function validateLiveRuntime() {
  const p = runtimePolicy();
  if (
    p.mode !== "dropbox_live" ||
    process.env.PARTNER_CONTRACT_LIVE_ENABLED !== "true" ||
    !p.accountId ||
    !p.appId ||
    !process.env.DROPBOX_SIGN_API_KEY ||
    !p.origin.startsWith("https://") ||
    !Number.isInteger(p.retentionDays) ||
    p.retentionDays < 1 ||
    p.retentionDays > 36500 ||
    !p.encryptionKeyId ||
    !p.companySignerReferences.length ||
    !Number.isInteger(p.monthlySendLimit) ||
    p.monthlySendLimit < 1 ||
    !Number.isInteger(p.signatureTtlDays) ||
    p.signatureTtlDays < 2 ||
    p.signatureTtlDays > 90 ||
    !Number.isInteger(p.reminderHours) ||
    p.reminderHours < 24
  )
    throw new ContractError("live_provider_configuration_not_approved");
  return p;
}
export function verifySignatures(
  s: ProviderSnapshot,
  expected: ContractSnapshot,
  contractId: string,
  sourceChecksum: string,
  mode: ContractMode,
) {
  if (
    s.contractId !== contractId ||
    s.sourceChecksum !== sourceChecksum ||
    s.testMode !== (mode !== "dropbox_live") ||
    s.signers.length !== 2
  )
    throw new ContractError("provider_document_binding_mismatch");
  if (
    expected.partnerEmail.toLowerCase() === expected.companySigner.email.toLowerCase() ||
    expected.userId === expected.companySigner.reference
  )
    throw new ContractError("independent_company_countersigner_required");
  const partner = s.signers.find((x) => x.role === "partner"),
    company = s.signers.find((x) => x.role === "company");
  if (
    !partner ||
    !company ||
    partner.reference !== expected.userId ||
    company.reference !== expected.companySigner.reference ||
    partner.email.toLowerCase() !== expected.partnerEmail.toLowerCase() ||
    company.email.toLowerCase() !== expected.companySigner.email.toLowerCase() ||
    partner.name !== expected.identity.signerName ||
    company.name !== expected.companySigner.name ||
    partner.order !== 0 ||
    company.order !== 1 ||
    !partner.providerSignatureId ||
    !company.providerSignatureId ||
    partner.providerSignatureId === company.providerSignatureId
  )
    throw new ContractError("provider_signer_mismatch");
  if (
    company.signedAt &&
    (!partner.signedAt || new Date(company.signedAt) < new Date(partner.signedAt))
  )
    throw new ContractError("signature_order_invalid");
  const now = Date.now() + 120000;
  for (const signer of s.signers)
    if (
      signer.signedAt &&
      (!Number.isFinite(Date.parse(signer.signedAt)) || Date.parse(signer.signedAt) > now)
    )
      throw new ContractError("signature_timestamp_invalid");
  if (
    s.complete &&
    (!partner.signedAt || !company.signedAt || s.declined || s.cancelled || s.expired || s.hasError)
  )
    throw new ContractError("required_signatures_missing");
  return { partner, company };
}
