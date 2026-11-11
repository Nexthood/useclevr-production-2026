import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { partnerApplicationAudit, partnerApplicationEmails, partnerApplications } from "@/lib/db/schema";
import { validWriteOrigin } from "@/lib/partners/api";
import { checkApplicationRateLimit, deliverApplicationEmail, publicApplicationSchema } from "@/lib/partners/public-applications";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!validWriteOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12000) return NextResponse.json({ error: "Application is too large." }, { status: 413 });
  const forwarded = request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await checkApplicationRateLimit(forwarded)))
    return NextResponse.json({ error: "Too many applications. Please try again later." }, { status: 429, headers: { "Retry-After": "3600" } });
  let raw: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Enter valid application details." }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 12000) { await reader.cancel(); return NextResponse.json({ error: "Application is too large." }, { status: 413 }); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return NextResponse.json({ error: "Enter valid application details." }, { status: 400 }); }
  const parsed = publicApplicationSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the required application fields and try again." }, { status: 400 });
  const data = parsed.data;
  if (data.website) return NextResponse.json({ error: "Please leave the website field empty." }, { status: 400 });
  if (Date.now() - data.formStartedAt < 1800 || Date.now() - data.formStartedAt > 24 * 60 * 60 * 1000)
    return NextResponse.json({ error: "Please review the form and submit again." }, { status: 400 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Applications are temporarily unavailable. Please try again." }, { status: 503 });
  const id = randomUUID(), emailId = randomUUID(), adminEmailId = randomUUID(), adminId = process.env.PARTNER_ADMIN_EMAIL || process.env.RESEND_STATUS_TO || process.env.ADMIN_AUTH_BYPASS_EMAIL || "superadmin@useclevr.com";
  try {
    await db.transaction(async (tx) => {
      await tx.insert(partnerApplications).values({
        id, program: data.program, category: data.category, fullName: data.fullName,
        email: data.email, country: data.country, companyName: data.companyName,
        experience: data.experience, privacyAcceptedAt: new Date(), privacyVersion: "2026-11-08",
      });
      await tx.insert(partnerApplicationAudit).values({ id: randomUUID(), applicationId: id, actor: "public_applicant", action: "submitted" });
      await tx.insert(partnerApplicationEmails).values({ id: emailId, applicationId: id, kind: "receipt", recipient: data.email });
      await tx.insert(partnerApplicationEmails).values({ id: adminEmailId, applicationId: id, kind: "admin_notice", recipient: adminId, ...(adminId ? {} : { status: "failed", attempts: 1, lastErrorCode: "missing_admin_recipient" }) });
    });
  } catch (error) {
    // The partial unique index prevents duplicate active applications without revealing which email matched.
    const code = (error as { code?: string; cause?: { code?: string } })?.code || (error as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") return NextResponse.json({ error: "An application for this email is already being reviewed. Contact the partner team if you need to update it." }, { status: 409 });
    console.error("[partner-applications] persist failed", { type: error instanceof Error ? error.name : "unknown", code: (error as { code?: string; cause?: { code?: string } })?.code || (error as { cause?: { code?: string } })?.cause?.code || "unknown" });
    return NextResponse.json({ error: "We could not save your application. Please try again." }, { status: 503 });
  }
  // Delivery happens only after commit. Failures stay in the outbox and never erase the accepted application.
  await Promise.all([deliverApplicationEmail(emailId), deliverApplicationEmail(adminEmailId)]);
  return NextResponse.json({ received: true, status: "pending" }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
