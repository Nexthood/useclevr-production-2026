import { z } from "zod";

export const partnerPrivacyVersion = "2026-11-08";
export const salesApplicationSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    country: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/),
    market: z.string().trim().min(2).max(200),
    experience: z.string().trim().min(20).max(4000),
    privacyAccepted: z.literal(true),
    termsAccepted: z.literal(true),
  })
  .strict();
export const partnershipTypes = [
  "Independent Sales Partner",
  "Referral Partner",
  "Authorized Reseller",
  "MSP",
  "System Integrator",
  "Business Consultancy",
  "Enterprise Solution Partner",
  "Strategic Distribution Partner",
  "White-Label Inquiry",
] as const;
const resellerPartnershipTypes = [
  "Authorized Reseller", "MSP", "System Integrator", "Business Consultancy",
  "Enterprise Solution Partner", "Strategic Distribution Partner", "White-Label Inquiry",
] as const;
const plainText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), "Use plain text.");
export const resellerApplicationSchema = z
  .object({
    partnershipType: z.enum(resellerPartnershipTypes),
    companyName: plainText(2, 200),
    name: plainText(2, 200),
    businessEmail: z.email().max(254),
    companyWebsite: z
      .url()
      .max(500)
      .refine((v) => {
        if (!URL.canParse(v)) return false;
        const u = new URL(v);
        return (
          ["https:", "http:"].includes(u.protocol) &&
          !!u.hostname.includes(".") &&
          !u.username &&
          !u.password
        );
      }, "Enter a public HTTP or HTTPS company website."),
    country: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/),
    industry: plainText(2, 200),
    existingCustomers: z.number().int().min(0).max(100000000),
    experience: plainText(20, 4000),
    privacyAccepted: z.literal(true),
    termsAccepted: z.literal(true),
    websiteConfirmation: z.literal(""),
  })
  .strict();
export const applicationSchema = z.union([salesApplicationSchema, resellerApplicationSchema]);
export type BusinessApplication = z.infer<typeof resellerApplicationSchema>;
export type PartnerApplicationInput = z.infer<typeof applicationSchema>;
export type ApplicationReceipt = {
  partnershipType?: BusinessApplication["partnershipType"];
  status: string;
  name: string;
  createdAt: string;
};
export const applicationStatusText: Record<string, string> = {
  under_review:
    "Your company application is under administrator review. Commercial authorization and tools require separate onboarding.",
  approved:
    "Your company application is approved for commercial discussions. This does not authorize reselling or activate commissions. Contact support to complete commercial onboarding.",
  pending:
    "Application received. Your application is pending administrator review. Return here to check the decision. Company partnerships require separately reviewed commercial onboarding before activation.",
  rejected:
    "Your application was not approved. Contact UseClevr through support if you have questions about the decision.",
  suspended:
    "Your partnership is suspended. Referrals and commission approval are on hold. Contact UseClevr through support for review.",
  terminated:
    "Your partnership has ended. Contact UseClevr through support about any eligible outstanding settlement.",
};
