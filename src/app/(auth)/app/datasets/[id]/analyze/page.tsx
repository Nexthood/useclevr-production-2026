import { debugLog } from "@/lib/utils/debug";

import { DatasetAnalyzer } from "@/components/dataset/dataset-analyzer";
import { AppPageHeader } from "@/components/layout/app-page-header";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/auth";
import { findAccessibleDataset, loadDatasetData } from "@/lib/data/dataset-access";
import { resolveBusinessModel } from "@/lib/data/business-model";
import { getDatasetCategoryRedirect, resolveDatasetType } from "@/lib/data/dataset-category";
import { getSetupStatus } from "@/lib/business/company-setup-store";
import {
  AlertTriangle,
  Sparkles,
  BriefcaseBusiness,
  LayoutDashboard,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

// Type for analysis result (simplified for props)
type DatasetAnalyzerInitialAnalysis = Parameters<typeof DatasetAnalyzer>[0]["initialAnalysis"];

const realAnalysisKeys = [
  "business_analysis",
  "business_intelligence",
  "executive_analysis",
  "kpi_summary",
  "ai_summary",
  "total_rows",
  "total_columns",
];

const pendingAnalysisStatuses = new Set(["uploading", "processing", "pending"]);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return { title: "Dataset Details" };

  try {
    const { dataset } = await findAccessibleDataset(id, session.user.id, session.user.role);
    return { title: dataset ? `Dataset: ${dataset.name}` : "Dataset Details" };
  } catch {
    return { title: "Dataset Details" };
  }
}

export default async function AnalyzePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const userRole = session?.user?.role;

  if (!userId) {
    notFound();
  }

  // Get business profile status
  const setupStatus = await getSetupStatus(userId);
  const profileCompletion = setupStatus?.setupAccuracy ?? 0;
  const hasIncompleteProfile = profileCompletion < 80;

  // Get dataset using Drizzle - read data directly from dataset.data column
  const { dataset } = await findAccessibleDataset(id, userId, userRole);

  if (!dataset) {
    notFound();
  }

  // Read rows from the data column in Dataset table (full dataset)
  let data: Record<string, unknown>[] = [];
  let dataLoadError = false;
  try {
    data = await loadDatasetData(id, dataset);
  } catch (error) {
    dataLoadError = true;
    debugLog("[DEBUG-PAGE] Dataset rows are not available yet:", {
      id: dataset.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const columns = getDatasetColumns(dataset.columns);
  // Use dataset.rowCount for total
  const rowCount = dataset.rowCount || data.length;
  const datasetType = resolveDatasetType(
    (dataset as { datasetType?: string | null }).datasetType,
    dataset.analysis,
  );
  const businessModel = resolveBusinessModel({
    explicit: (dataset as { businessModel?: string | null }).businessModel,
    uploadSource:
      dataset.analysis && typeof dataset.analysis === "object"
        ? String((dataset.analysis as Record<string, unknown>).uploadSource || "")
        : "",
    datasetType,
    columns,
    datasetName: dataset.name,
    analysis: dataset.analysis,
  });

  if (datasetType !== "standard") {
    redirect(getDatasetCategoryRedirect(datasetType, id, businessModel));
  }

  // Get column types from dataset record (stored during upload)
  const columnTypes = (dataset as { columnTypes?: Record<string, string> }).columnTypes || {};

  // Log for debugging
  debugLog("[DEBUG-PAGE] Dataset from DB:", {
    id: dataset.id,
    name: dataset.name,
    totalRowCount: rowCount,
    columnCount: columns.length,
  });
  debugLog("[DEBUG-PAGE] Column types from database:", JSON.stringify(columnTypes));

  // Check if dataset already has analysis results (for state persistence)
  const hasAnalysis = hasRealAnalysis(dataset.analysis);
  const initialAnalysis = hasAnalysis
    ? (dataset.analysis as DatasetAnalyzerInitialAnalysis)
    : undefined;
  const analysisStatus = String(
    (dataset as { analysisStatus?: string | null }).analysisStatus || "",
  );
  const isAnalysisPending =
    dataLoadError || (!hasAnalysis && pendingAnalysisStatuses.has(analysisStatus));

  debugLog("[DEBUG-PAGE] Dataset analysis status:", {
    id: dataset.id,
    name: dataset.name,
    hasAnalysis,
  });

  return (
    <div className="flex flex-col flex-1">
      <AppPageHeader
        title={`Dataset: ${dataset.name}`}
        description="Data preview, columns, and management"
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Datasets", href: "/app/datasets" },
          { label: dataset.name },
        ]}
        icon={Sparkles}
        actions={
          <Link href={`/app?datasetId=${id}`}>
            <Button className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Open in Dashboard
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        }
      />

      {hasIncompleteProfile && (
        <div className="mb-4 px-4 sm:px-6">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold text-amber-950 dark:text-amber-100">
                    Business Profile Incomplete
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Complete your Business Profile for accurate insights.
                  </p>
                </div>
              </div>
              <Link href="/app/business">
                <Button size="sm" variant="outline" className="border-amber-500/40">
                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                  Complete ({profileCompletion}%)
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {isAnalysisPending && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="font-semibold text-amber-950 dark:text-amber-100">
              Analysis is still being prepared...
            </p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              The dataset is saved. This page updates once preparation finishes.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Dataset Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Rows</p>
              <p className="text-2xl font-semibold text-foreground">{rowCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Columns</p>
              <p className="text-2xl font-semibold text-foreground">{columns.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uploaded</p>
              <p className="text-lg font-medium text-foreground">
                {dataset.createdAt ? new Date(dataset.createdAt).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-lg font-medium text-emerald-500">
                {hasAnalysis ? "Analyzed" : "Pending"}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">Columns: {columns.join(", ")}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href={`/app?datasetId=${id}`}>
              <Button className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                View Full Dashboard
              </Button>
            </Link>
            <Link href="/app/datasets">
              <Button variant="outline">Back to Datasets</Button>
            </Link>
          </div>
        </div>

        <DatasetAnalyzer
          datasetId={id}
          datasetName={dataset.name}
          columns={columns}
          data={data}
          rowCount={rowCount}
          businessModel={businessModel}
          isAnalyzed={hasAnalysis}
          initialAnalysis={initialAnalysis}
        />
      </main>
    </div>
  );
}

function getDatasetColumns(value: unknown) {
  return Array.isArray(value)
    ? value.filter((column): column is string => typeof column === "string")
    : [];
}

function hasRealAnalysis(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const analysis = value as Record<string, unknown>;
  return realAnalysisKeys.some((key) => analysis[key] !== undefined && analysis[key] !== null);
}
