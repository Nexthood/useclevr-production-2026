import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { applyAutonomousReview, categorizePrebookkeepingRows } from "@/lib/accountancy/prebookkeeping-categorization";
import { buildBusinessTaxProfile } from "@/lib/accountancy/prebookkeeping-vat";
import { getCompanySetup } from "@/lib/business/company-setup-store";
import { resolveDatasetType } from "@/lib/data/dataset-category";
import { getDb } from "@/lib/db";
import { datasetRows, datasets, prebookkeepingLearningRules } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Please sign in before categorizing transactions." }, { status: 401 });
    }

    await requireBuiltinUserRecord(userId);

    const body = await request.json().catch(() => ({}));
    const datasetId = typeof body.datasetId === "string" ? body.datasetId : "";
    if (!datasetId) {
      return NextResponse.json({ ok: false, error: "Dataset ID is required." }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ ok: false, error: "Database is not configured." }, { status: 503 });
    }

    const dataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
      columns: {
        id: true,
        analysis: true,
        datasetType: true,
      },
    });

    if (!dataset || resolveDatasetType(dataset.datasetType, dataset.analysis) !== "prebookkeeping") {
      return NextResponse.json({ ok: false, error: "Pre-bookkeeping dataset was not found." }, { status: 404 });
    }

    const rows = await db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, dataset.id),
      orderBy: [asc(datasetRows.rowIndex)],
      columns: {
        data: true,
      },
    });

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No transaction rows are available for categorization." }, { status: 422 });
    }

    const learningRules = await db.query.prebookkeepingLearningRules.findMany({
      where: eq(prebookkeepingLearningRules.userId, userId),
      columns: {
        supplierKey: true,
        descriptionKeyword: true,
        merchantKey: true,
        category: true,
        countryKey: true,
        vatRate: true,
      },
    });
    const companySetup = await getCompanySetup(userId);
    const taxProfile = buildBusinessTaxProfile(companySetup);
    const categorization = categorizePrebookkeepingRows(rows.map((row) => row.data as Record<string, unknown>), learningRules, { taxProfile });
    const currentAnalysis = isRecord(dataset.analysis) ? dataset.analysis : {};

    const autonomousCategorization = applyAutonomousReview(categorization, learningRules, taxProfile);

    await db
      .update(datasets)
      .set({
        analysisStatus: "ready",
        analysisProgress: 100,
        analysisMessage: "Ready for review.",
        analysis: {
          ...currentAnalysis,
          categorizationStatus: "ready_for_review",
          prebookkeepingCategorization: autonomousCategorization,
        },
        updatedAt: new Date(),
      })
      .where(eq(datasets.id, dataset.id));

    revalidatePath("/app/prebookkeeping");

    return NextResponse.json({ ok: true, categorization: autonomousCategorization });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Categorization failed.",
      },
      { status: 500 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
