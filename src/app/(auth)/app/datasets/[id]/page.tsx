import { AppPageHeader } from "@/components/layout/app-page-header"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { PageActionRow } from "@/components/ui/page-action-row"
import { auth } from "@/lib/auth/auth"
import { db } from "@/lib/db"
import { datasets, datasetRows } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { ChevronLeft, ChevronRight, Database, Sparkles } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

const PAGE_SIZE = 100

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return { title: "Dataset" }

  const dataset = await db.query.datasets.findFirst({
    where: and(eq(datasets.id, id), eq(datasets.userId, session.user.id)),
    columns: { name: true },
  })
  return { title: dataset?.name ?? "Dataset" }
}

export default async function DatasetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { id } = await params
  const { page: pageStr } = await searchParams
  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const session = await auth()
  const userId = (session?.user as { id?: string })?.id

  if (!userId) {
    notFound()
  }

  const dataset = await db.query.datasets.findFirst({
    where: and(eq(datasets.id, id), eq(datasets.userId, userId)),
  })

  if (!dataset) {
    notFound()
  }

  const hasAnalysis = dataset.analysis && typeof dataset.analysis === 'object' && Object.keys(dataset.analysis as object).length > 0
  if (!hasAnalysis) {
    redirect(`/app/datasets/${id}/analyze`)
  }

  const columns = (dataset as any).columns || []
  const rowCount = dataset.rowCount || 0
  const totalPages = Math.max(1, Math.ceil(rowCount / PAGE_SIZE))

  let data: Record<string, unknown>[] = []
  try {
    const resultRows = await db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, id),
      orderBy: (tbl, { asc }) => [asc(tbl.rowIndex)],
      offset,
      limit: PAGE_SIZE,
    })
    data = resultRows.map((r) => r.data) as Record<string, unknown>[]
  } catch {
    data = []
  }

  const previewColumns: DataTableColumn<Record<string, unknown>>[] = columns.map((column: string) => ({
    key: column,
    header: column,
    render: (row: Record<string, unknown>) => {
      const value = row[column]
      return (
        <span className="whitespace-nowrap">
          {value !== null && value !== undefined && value !== "" ? String(value) : "-"}
        </span>
      )
    },
  }))

  function Pagination() {
    if (totalPages <= 1) return null

    const pages: React.ReactNode[] = []
    const startPage = Math.max(1, currentPage - 2)
    const endPage = Math.min(totalPages, currentPage + 2)

    if (currentPage > 1) {
      pages.push(
        <Link
          key="prev"
          href={`/app/datasets/${id}?page=${currentPage - 1}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Link>
      )
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Link
          key={i}
          href={`/app/datasets/${id}?page=${i}`}
          className={`inline-flex items-center px-3 py-1.5 text-xs rounded-md border ${
            i === currentPage
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-border hover:bg-muted"
          }`}
        >
          {i}
        </Link>
      )
    }

    if (currentPage < totalPages) {
      pages.push(
        <Link
          key="next"
          href={`/app/datasets/${id}?page=${currentPage + 1}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )
    }

    return <div className="flex items-center justify-center gap-1.5 mt-4">{pages}</div>
  }

  return (
    <div className="flex flex-col flex-1">
      <AppPageHeader
        title={(dataset as { name: string }).name}
        description={`${rowCount.toLocaleString()} rows - ${columns.length} columns`}
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Datasets", href: "/app/datasets" },
          { label: (dataset as { name: string }).name },
        ]}
        icon={Database}
      />

      <PageActionRow description="Review the uploaded rows and continue to analysis when the dataset is ready.">
        <Link href={`/app/datasets/${id}/analyze`} className="shrink-0">
          <Button size="sm" variant="outline" className="whitespace-nowrap">
            <Sparkles className="mr-2 h-4 w-4" />
            View analysis
          </Button>
        </Link>
      </PageActionRow>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-full min-w-0">
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
  )
}
