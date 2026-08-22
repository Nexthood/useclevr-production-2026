import { auth } from "@/lib/auth/auth";
import { isPrebookkeepingCategorization } from "@/lib/accountancy/prebookkeeping-categorization";
import {
  buildPrebookkeepingExport,
  isPrebookkeepingExportScope,
  isPrebookkeepingExportFormat,
  isSupportedPrebookkeepingExportFormat,
  PrebookkeepingExportError,
} from "@/lib/accountancy/prebookkeeping-export";
import { resolveDatasetType } from "@/lib/data/dataset-category";
import { getDb } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import { debugError, debugLog } from "@/lib/utils/debug";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in before exporting." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("datasetId") || "";
  const format = searchParams.get("format") || "csv";
  const scope = searchParams.get("scope") || "reviewed";
  const rowIndexes = parseRowIndexes(searchParams.get("rowIndexes"));
  if (!datasetId || !isPrebookkeepingExportFormat(format)) {
    return NextResponse.json({ error: "A supported export format and dataset ID are required." }, { status: 400 });
  }
  if (!isPrebookkeepingExportScope(scope)) {
    return NextResponse.json({ error: "A supported export scope is required." }, { status: 400 });
  }
  if (!isSupportedPrebookkeepingExportFormat(format)) {
    return NextResponse.json({ error: `${format.toUpperCase()} export is coming soon.`, stage: "setup" }, { status: 501 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  debugLog("[PREBOOKKEEPING_EXPORT] Request started", {
    requestId,
    datasetId,
    format,
    scope,
    requestedRowCount: rowIndexes.length,
    userId,
    route: "/api/prebookkeeping/export",
    stage: "load_dataset",
  });

  try {
    const dataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
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

    const exportResult = buildPrebookkeepingExport({
      datasetName: dataset.name,
      categorization,
      format,
      scope,
      rowIndexes,
    });

    await db.update(datasets).set({
      analysis: {
        ...analysis,
        prebookkeepingExportMetadata: [
          ...safeArray(analysis.prebookkeepingExportMetadata),
          {
            ...exportResult.metadata,
            requestId,
            filename: exportResult.filename,
            rowCount: exportResult.rowCount,
            requestedRowCount: scope === "filtered" ? rowIndexes.length : exportResult.rowCount,
          },
        ].slice(-20),
      },
      updatedAt: new Date(),
    }).where(eq(datasets.id, dataset.id));

    debugLog("[PREBOOKKEEPING_EXPORT] Export generated", {
      requestId,
      datasetId,
      format,
      scope,
      rowCount: exportResult.rowCount,
      requestedRowCount: scope === "filtered" ? rowIndexes.length : exportResult.rowCount,
      userId,
      stage: "generation",
    });

    let body: BodyInit;
    if (typeof exportResult.body === "string") {
      body = exportResult.body;
    } else {
      const bytes = new Uint8Array(exportResult.body.byteLength);
      bytes.set(exportResult.body);
      body = new Blob([bytes.buffer], { type: exportResult.contentType });
    }
    return new Response(body, {
      headers: {
        "Content-Type": exportResult.contentType,
        "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof PrebookkeepingExportError ? error.status : 500;
    const stage = error instanceof PrebookkeepingExportError ? error.stage : "generation";
    const message = error instanceof Error ? error.message : "Export generation failed.";
    debugError("[PREBOOKKEEPING_EXPORT] Request failed", {
      requestId,
      datasetId,
      format,
      userId,
      stage,
      error: message,
    });
    return NextResponse.json({ error: message, stage, requestId }, { status });
  }
}

function parseRowIndexes(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
