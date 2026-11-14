import { deliverApplicationEmail } from "@/lib/partners/public-applications";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { partnerAccounts, partnerApplications, partnerApplicationEmails } from "@/lib/db/schema";
import { audit, database, lockPartner } from "@/lib/partners/store";
import { partnerApiError, validWriteOrigin } from "@/lib/partners/api";
import { text } from "@/lib/partners/contracts/domain";
import { requestBody } from "@/lib/partners/contracts/http";
const schema = z
  .object({
    name: text(2, 200),
    companyName: text(0, 200),
    companyWebsite: z.union([
      z.literal(""),
      z
        .url()
        .max(500)
        .refine((v) => ["http:", "https:"].includes(new URL(v).protocol)),
    ]),
    communications: z.boolean(),
  })
  .strict();
export async function GET() {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  try {
    const p = await database().query.partnerAccounts.findFirst({
      where: eq(partnerAccounts.userId, auth.userId),
    });
    if (!p) return NextResponse.json({ error: "Partner account required." }, { status: 403 });
    return NextResponse.json(
      {
        name: p.name,
        email: p.application?.email || "",
        companyName: p.application?.companyName || "",
        companyWebsite: p.application?.companyWebsite || "",
        communications: p.application?.communications ?? true,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return partnerApiError(e);
  }
}
export async function PATCH(request: Request) {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  if (!validWriteOrigin(request))
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const b = schema.parse(await requestBody(request));
    const db = database();
    const p = await db.query.partnerAccounts.findFirst({
      where: eq(partnerAccounts.userId, auth.userId),
    });
    if (!p) return NextResponse.json({ error: "Partner account required." }, { status: 403 });
    let notificationId: string | undefined;
    await db.transaction(async (tx) => {
      await lockPartner(tx, p.id);
      const current = await tx.query.partnerAccounts.findFirst({
        where: eq(partnerAccounts.id, p.id),
      });
      if (!current?.application) throw new Error("profile_review_required");
      await tx
        .update(partnerAccounts)
        .set({
          name: b.name,
          application: {
            ...current.application,
            companyName: b.companyName,
            companyWebsite: b.companyWebsite,
            communications: b.communications,
          },
        })
        .where(eq(partnerAccounts.id, p.id));
      const app = await tx.query.partnerApplications.findFirst({
        where: eq(partnerApplications.partnerAccountId, p.id),
      });
      if (app) {
        notificationId = crypto.randomUUID();
        await tx
          .insert(partnerApplicationEmails)
          .values({
            id: notificationId,
            applicationId: app.id,
            kind: "account_update",
            recipient: app.email,
          });
      }
      await audit(
        tx,
        p.id,
        auth.userId,
        "contact_profile_updated",
        "Partner updates contact details and communication preferences; signed legal identity requires separate contract review",
        { fields: Object.keys(b) },
      );
    });
    if (notificationId) await Promise.allSettled([deliverApplicationEmail(notificationId)]);
    return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { error: "Check your contact name and company website." },
        { status: 400 },
      );
    return partnerApiError(e);
  }
}
