import { z } from "zod";

export const partnerPrivacyVersion = "2026-11-08";
export const applicationSchema = z
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
export type PartnerApplicationInput = z.infer<typeof applicationSchema>;
export type ApplicationReceipt = {
  status: string;
  name: string;
  createdAt: string;
};
export const applicationStatusText: Record<string, string> = {
  pending:
    "Application received. Your application is pending administrator review. Return here to check the decision. Referral tools become available after approval.",
  rejected:
    "Your application was not approved. Contact UseClevr through support if you have questions about the decision.",
  suspended:
    "Your partnership is suspended. Referrals and commission approval are on hold. Contact UseClevr through support for review.",
  terminated:
    "Your partnership has ended. Contact UseClevr through support about any eligible outstanding settlement.",
};
