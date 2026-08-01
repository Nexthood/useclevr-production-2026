import { auth } from "@/lib/auth/auth";
import { isPrebookkeepingCategorization } from "@/lib/accountancy/prebookkeeping-categorization";
import { resolveDatasetType } from "@/lib/data/dataset-category";
import { getDb } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const supportedFormats = ["csv", "excel", "datev", "quickbooks", "xero"] as const;

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in before exporting." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("datasetId") || "";
  const format = searchParams.get("format") || "csv";
  if (!datasetId || !supportedFormats.includes(format as typeof supportedFormats[number])) {
    return NextResponse.json({ error: "A supported export format and dataset ID are required." }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  const datasetWhere =
    session.user.role === "superadmin"
      ? eq(datasets.id, datasetId)
      : and(eq(datasets.id, datasetId), eq(datasets.userId, userId));
  const dataset = await db.query.datasets.findFirst({
    where: datasetWhere,
    columns: {
      id: true,
      name: true,
      datasetType: true,
      analysis: true,
    },
  });

  if (!dataset || resolveDatasetType(dataset.datasetType, dataset.analysis) !== "prebookkeeping") {
    return NextResponse.json({ error: "Pre-bookkeeping dataset was not found." }, { status: 404 });
  }

  const analysis = isRecord(dataset.analysis) ? dataset.analysis : {};
  const categorization = analysis.prebookkeepingCategorization;
  if (!isPrebookkeepingCategorization(categorization)) {
    return NextResponse.json({ error: "Categorization is required before export." }, { status: 409 });
  }

  const reviewedRows = categorization.transactions.filter((transaction) => transaction.reviewed && transaction.duplicateStatus !== "merged");
  if (reviewedRows.length === 0) {
    return NextResponse.json({ error: "Review at least one transaction before exporting." }, { status: 422 });
  }

  const exportRows = reviewedRows.map((transaction) => ({
    Date: transaction.transactionDate || "",
    Description: transaction.description || "",
    "Supplier/Customer": transaction.supplierCustomer || "",
    Amount: transaction.amount ?? "",
    Currency: transaction.currency || "",
    VAT: transaction.vatTax ?? "",
    "VAT Rate": transaction.vatRate ?? "",
    Category: transaction.category,
    Reference: transaction.invoiceReference || "",
  }));

  if (format === "excel") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), "Reviewed");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFileName(dataset.name)}-reviewed.xlsx"`,
      },
    });
  }

  const prefix = format === "datev" ? "DATEV" : format === "quickbooks" ? "QuickBooks" : format === "xero" ? "Xero" : "CSV";
  return new Response(toCsv(exportRows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFileName(dataset.name)}-${prefix.toLowerCase()}-reviewed.csv"`,
    },
  });
}

function toCsv(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] || {});
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "prebookkeeping";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
