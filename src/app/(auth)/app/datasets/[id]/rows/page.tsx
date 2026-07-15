import { AppPageHeader } from "@/components/layout/app-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageActionRow } from "@/components/ui/page-action-row";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";
import { datasetRows } from "@/lib/db/schema";
import { findAccessibleDataset, loadDatasetData } from "@/lib/data/dataset-access";
import {
  getDatasetCategoryDestinationLabel,
  getDatasetCategoryLabel,
  getDatasetCategoryRedirect,
  resolveDatasetType,
} from "@/lib/data/dataset-category";
import { eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Database, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const PAGE_SIZE = 100;
const pendingAnalysisStatuses = new Set(["uploading", "processing", "pending"]);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return { title: "Dataset" };

  try {
    const { dataset } = await findAccessibleDataset(id, session.user.id, session.user.role);
    return { title: dataset?.name ?? "Dataset" };
  } catch {
    return { title: "Dataset" };
  }
}

export default async function DatasetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageStr } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const userRole = session?.user?.role;

  if (!userId) {
    notFound();
  }

  let accessResult: Awaited<ReturnType<typeof findAccessibleDataset>>;
  try {
    accessResult = await findAccessibleDataset(id, userId, userRole);
  } catch {
    return <DatasetPreviewUnavailable datasetId={id} />;
  }

  const { dataset, dbUnavailable } = accessResult;

  if (dbUnavailable) {
    return <DatasetPreviewUnavailable datasetId={id} />;
  }

  if (!dataset) {
    notFound();
  }

  const columns = getDatasetColumns(dataset.columns);
  const rowCount = dataset.rowCount || 0;
  const totalPages = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  const datasetType = resolveDatasetType(
    (dataset as { datasetType?: string | null }).datasetType,
    dataset.analysis,
  );

  let data: Record<string, unknown>[] = [];
  let dataLoadError = false;
  const db = getDb();
  if (!db) {
    return <DatasetPreviewUnavailable datasetId={id} />;
  }

  try {
    const resultRows = await db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, id),
      orderBy: (tbl, { asc }) => [asc(tbl.rowIndex)],
      offset,
      limit: PAGE_SIZE,
    });
    data = resultRows.map((r) => r.data) as Record<string, unknown>[];
    if (data.length === 0) {
      const storedData = await loadDatasetData(id, dataset);
      data = storedData.slice(offset, offset + PAGE_SIZE);
    }
  } catch {
    try {
      const storedData = await loadDatasetData(id, dataset);
      data = storedData.slice(offset, offset + PAGE_SIZE);
    } catch {
      dataLoadError = true;
    }
  }

  const analysisStatus = String(
    (dataset as { analysisStatus?: string | null }).analysisStatus || "",
  );
  const isAnalysisPending = dataLoadError || pendingAnalysisStatuses.has(analysisStatus);

  const previewColumns: DataTableColumn<Record<string, unknown>>[] = columns.map(
    (column: string) => ({
      key: column,
      header: column,
      render: (row: Record<string, unknown>) => {
        const value = row[column];
        return (
          <span className="whitespace-nowrap">
            {value !== null && value !== undefined && value !== "" ? String(value) : "-"}
          </span>
        );
      },
    }),
  );

  function Pagination() {
    if (totalPages <= 1) return null;

    const pages: React.ReactNode[] = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (currentPage > 1) {
      pages.push(
        <Link
          key="prev"
          href={`/app/datasets/${id}/rows?page=${currentPage - 1}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Link>,
      );
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Link
          key={i}
          href={`/app/datasets/${id}/rows?page=${i}`}
          className={`inline-flex items-center px-3 py-1.5 text-xs rounded-md border ${
            i === currentPage
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-border hover:bg-muted"
          }`}
        >
          {i}
        </Link>,
      );
    }

    if (currentPage < totalPages) {
      pages.push(
        <Link
          key="next"
          href={`/app/datasets/${id}/rows?page=${currentPage + 1}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>,
      );
    }

    return <div className="flex items-center justify-center gap-1.5 mt-4">{pages}</div>;
  }

  return (
    <div className="flex flex-col flex-1">
      <AppPageHeader
        title={(dataset as { name: string }).name}
        description={`${getDatasetCategoryLabel(datasetType)} · ${rowCount.toLocaleString()} rows · ${columns.length} columns · uploaded ${formatDate((dataset as { createdAt?: Date | null }).createdAt)}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Datasets", href: "/app/datasets" },
          { label: (dataset as { name: string }).name },
        ]}
        icon={Database}
        actions={
          datasetType !== "standard" ? (
            <Link href={getDatasetCategoryRedirect(datasetType, id)}>
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open in {getDatasetCategoryDestinationLabel(datasetType)}
              </Button>
            </Link>
          ) : (
            <Link href={`/app/dashboard?datasetId=${encodeURIComponent(id)}`}>
              <Button className="gap-2">
                <Sparkles className="h-4 w-4" />
                Open Dashboard
              </Button>
            </Link>
          )
        }
      />

      {datasetType !== "standard" && (
        <div className="mb-4 px-4 sm:px-6">
          <Card className="border-cyan-400/30 bg-cyan-400/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">
                  This is a {getDatasetCategoryLabel(datasetType)} dataset
                </p>
                <p className="text-sm text-muted-foreground">
                  Open it in the {getDatasetCategoryDestinationLabel(datasetType)} module for
                  specialized analysis and reporting.
                </p>
              </div>
              <Link href={getDatasetCategoryRedirect(datasetType, id)}>
                <Button size="sm" variant="outline" className="border-cyan-400/40">
                  Open in {getDatasetCategoryDestinationLabel(datasetType)}
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      <PageActionRow description="Review the uploaded rows and continue to analysis when the dataset is ready.">
        <Link href={`/app/dashboard?datasetId=${encodeURIComponent(id)}`} className="shrink-0">
          <Button size="sm" variant="outline" className="whitespace-nowrap">
            <Sparkles className="mr-2 h-4 w-4" />
            Open dashboard
          </Button>
        </Link>
      </PageActionRow>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-full min-w-0">
          {isAnalysisPending && (
            <Card className="mb-6 border-amber-500/30 bg-amber-500/10 p-4">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Analysis is still being prepared...
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                The uploaded dataset is saved. Row preview and analysis appear once preparation
                finishes.
              </p>
            </Card>
          )}
          <DataTable
            title="Dataset rows"
            description={`Page ${currentPage} of ${totalPages} — ${rowCount.toLocaleString()} total rows`}
            emptyMessage="No data available."
            rows={data}
            columns={previewColumns}
            rowKey={(_row, index) => index}
            minWidth="min-w-[980px]"
          />
          <Pagination />
        </div>
      </main>
    </div>
  );
}

function getDatasetColumns(value: unknown) {
  return Array.isArray(value)
    ? value.filter((column): column is string => typeof column === "string")
    : [];
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "unknown date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}

function DatasetPreviewUnavailable({ datasetId }: { datasetId: string }) {
  return (
    <div className="flex flex-col flex-1">
      <AppPageHeader
        title="Dataset preview unavailable"
        description="The selected dataset rows could not be loaded."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Datasets", href: "/app/datasets" },
          { label: "Rows" },
        ]}
        icon={Database}
      />
      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <Card className="border-amber-500/30 bg-amber-500/10 p-5">
          <p className="font-semibold text-amber-950 dark:text-amber-100">Preview data is unavailable.</p>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            The dataset record is present, but the row preview query could not be completed for dataset {datasetId}.
          </p>
          <div className="mt-4">
            <Link href="/app/datasets">
              <Button variant="outline">Back to datasets</Button>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
