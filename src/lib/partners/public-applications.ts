import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { partnerApplicationEmails, partnerApplications } from "@/lib/db/schema";
import { z } from "zod";

export const publicApplicationSchema = z.object({
  program: z.enum(["work_with_us", "reseller_enterprise"]),
  category: z.enum([
    "Independent Sales Partner", "Referral Partner", "Authorized Reseller", "MSP",
    "System Integrator", "Business Consultancy", "Enterprise Solution Partner",
    "Strategic Distribution Partner", "White-Label Inquiry",
  ]),
  fullName: z.string().trim().min(2).max(200).refine((v) => !/[<>\u0000-\u001f\u007f]/.test(v)),
  email: z.email().max(254).transform((v) => v.trim().toLowerCase()),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  companyName: z.string().trim().max(200).refine((v) => !/[<>\u0000-\u001f\u007f]/.test(v)).optional().transform((v) => v || null),
  experience: z.string().trim().min(20).max(4000).refine((v) => !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)),
  privacyAccepted: z.literal(true),
  website: z.string().max(200).optional(),
  formStartedAt: z.number().int().positive(),
}).strict().superRefine((v, ctx) => {
  const sales = ["Independent Sales Partner", "Referral Partner"];
  if ((v.program === "work_with_us") !== sales.includes(v.category))
    ctx.addIssue({ code: "custom", path: ["category"], message: "Choose a category for the selected partner program." });
});

export const hashInvitation = (token: string) => createHash("sha256").update(token).digest("hex");
export const createInvitation = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitation(token) };
};
const encryptionKey = () => createHash("sha256").update(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "").digest();
export function encryptEmailPayload(payload: Record<string, string>) {
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) throw new Error("Authentication secret is required for protected email payloads.");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return { encrypted: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url") };
}
function decryptEmailPayload(value?: Record<string, string> | null) {
  if (!value?.encrypted) return {};
  try {
    const bytes = Buffer.from(value.encrypted, "base64url"), iv = bytes.subarray(0, 12), tag = bytes.subarray(12, 28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv); decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as Record<string, string>;
  } catch { return {}; }
}
export const applicationId = () => randomUUID();

export async function checkApplicationRateLimit(rawClientAddress: string) {
  const db = getDb();
  if (!db) return false;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return false;
  const fingerprint = createHash("sha256").update(`${secret}:${rawClientAddress}`).digest("hex");
  const result = await db.execute(sql`INSERT INTO "PartnerProgramApplicationRateLimit" ("fingerprint","windowStart","count")
    VALUES (${fingerprint}, date_trunc('hour',now()), 1)
    ON CONFLICT ("fingerprint","windowStart") DO UPDATE SET "count"="PartnerProgramApplicationRateLimit"."count"+1
    RETURNING "count"`);
  await db.execute(sql`DELETE FROM "PartnerProgramApplicationRateLimit" WHERE "windowStart" < now() - interval '48 hours'`);
  return Number(result.rows[0]?.count || 0) <= 5;
}

export async function deliverApplicationEmail(emailId: string) {
  const db = getDb();
  if (!db) return false;
  const row = await db.query.partnerApplicationEmails.findFirst({ where: eq(partnerApplicationEmails.id, emailId) });
  if (!row || row.status === "sent") return row?.status === "sent";
  const app = await db.query.partnerApplications.findFirst({ where: eq(partnerApplications.id, row.applicationId) });
  if (!app) return false;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "UseClevr <auth@useclevr.com>";
  const appUrl = (process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.useclevr.com").replace(/\/$/, "");
  const adminUrl = `${appUrl}/app/admin/partners`;
  const subject = row.kind === "admin_notice" ? "New UseClevr partner application" :
    row.kind === "approved" ? "Your UseClevr partner application is approved" :
    row.kind === "rejected" ? "Update on your UseClevr partner application" : "We received your UseClevr partner application";
  let text: string;
  if (row.kind === "admin_notice") text = `A new partner application is awaiting review.\nProgram: ${app.program}\nCategory: ${app.category}\nReview it in Partner Administration: ${adminUrl}`;
  else if (row.kind === "approved") {
    const invite = decryptEmailPayload(row.payload).invite || "";
    text = `Hello ${app.fullName},\n\nYour partner application has been approved. Approval does not activate commercial privileges or commissions. Sign in or create a UseClevr account using the same email address that received this message, then verify that email. Complete partner onboarding using this single-use link, which expires in 7 days:\n${appUrl}/partners/onboard?token=${encodeURIComponent(invite)}\n\nUseClevr Partner Team`;
  } else if (row.kind === "rejected") text = `Hello ${app.fullName},\n\nThank you for your interest in the UseClevr Partner Program. After review, we are unable to proceed with this application at this time.\n\nUseClevr Partner Team`;
  else text = `Hello ${app.fullName},\n\nWe received your partner application for ${app.category}. It is pending administrator review. We will contact you by email with an update. No customer account is required to apply.\n\nUseClevr Partner Team`;
  const recipient = row.recipient || (row.kind === "admin_notice" ? process.env.PARTNER_ADMIN_EMAIL || process.env.RESEND_STATUS_TO || process.env.ADMIN_AUTH_BYPASS_EMAIL || "superadmin@useclevr.com" : null);
  let providerId: string | null = null;
  let errorCode = "configuration";
  if (!recipient) errorCode = "missing_admin_recipient";
  else if (apiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [recipient], subject, text }), signal: AbortSignal.timeout(10000),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && typeof result.id === "string") providerId = result.id;
      else errorCode = `resend_${response.status}`;
    } catch { errorCode = "provider_unavailable"; }
  }
  const attempts = row.attempts + 1;
  if (providerId) await db.update(partnerApplicationEmails).set({ status: "sent", attempts, sentAt: new Date(), providerId, lastErrorCode: null }).where(eq(partnerApplicationEmails.id, emailId));
  else await db.update(partnerApplicationEmails).set({ status: attempts >= 5 ? "failed" : "pending", attempts, nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** attempts)), lastErrorCode: errorCode }).where(eq(partnerApplicationEmails.id, emailId));
  return Boolean(providerId);
}

export async function retryApplicationEmails() {
  const db = getDb();
  if (!db) return;
  const due = await db.query.partnerApplicationEmails.findMany({ where: and(eq(partnerApplicationEmails.status, "pending"), lte(partnerApplicationEmails.nextAttemptAt, new Date())), orderBy: asc(partnerApplicationEmails.createdAt), limit: 10 });
  await Promise.all(due.map((row) => deliverApplicationEmail(row.id)));
}
