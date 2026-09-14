import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import {
  accountancyPackagePdfFilename,
  buildAccountancyPackagePdf,
  type AccountancyPackagePdfField,
} from "@/lib/accountancy/package-pdf";
import { debugError } from "@/lib/utils/debug";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Please sign in before exporting." }, { status: 401 });
    }

    await requireBuiltinUserRecord(userId);

    const { searchParams } = new URL(request.url);
    const disposition = searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
    const input = normalizePackagePayload(await request.json().catch(() => null));
    if (!input) {
      return NextResponse.json({ error: "Package fields are required before exporting." }, { status: 400 });
    }

    const pdf = buildAccountancyPackagePdf(input);
    if (pdf.byteLength === 0) {
      return NextResponse.json({ error: "PDF export generated an empty file." }, { status: 500 });
    }

    const filename = accountancyPackagePdfFilename(input.companyName);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    debugError("[ACCOUNTANCY_PACKAGE_PDF] export failed", error);
    return NextResponse.json({ error: "PDF report could not be generated." }, { status: 500 });
  }
}

function normalizePackagePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const fields = Array.isArray(payload.fields)
    ? payload.fields
        .map((field): AccountancyPackagePdfField | null => {
          if (!field || typeof field !== "object" || Array.isArray(field)) return null;
          const candidate = field as Record<string, unknown>;
          const label = safeString(candidate.label);
          if (!label) return null;
          return { label, value: safeString(candidate.value) || "Not provided" };
        })
        .filter((field): field is AccountancyPackagePdfField => Boolean(field))
    : [];

  if (fields.length === 0) return null;

  return {
    companyName: safeString(payload.companyName),
    taxPeriod: safeString(payload.taxPeriod),
    accountantEmail: safeString(payload.accountantEmail),
    message: safeString(payload.message),
    fields: fields.slice(0, 80),
  };
}

function safeString(value: unknown) {
  if (typeof value === "string") return value.slice(0, 2_000);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
