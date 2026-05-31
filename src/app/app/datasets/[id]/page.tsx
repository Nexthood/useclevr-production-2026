import { AppPageHeader } from "@/components/layout/app-page-header"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { PageActionRow } from "@/components/ui/page-action-row"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Sparkles } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

export default async function DatasetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  const userId = (session?.user as { id?: string })?.id

  if (!userId) {
    notFound()
  }

  // Get dataset using Drizzle - single source of truth
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, id),
  })

  if (!dataset) {
    notFound()
  }

  // Check if dataset has been analyzed - if not, redirect to analysis page
  // This creates a unified flow: upload → auto-analyze
  const hasAnalysis = dataset.analysis && typeof dataset.analysis === 'object' && Object.keys(dataset.analysis as object).length > 0
  
  // If not analyzed, redirect to analysis page for unified workflow
  if (!hasAnalysis) {
    redirect(`/app/datasets/${id}/analyze`)
  }

  // Read data directly from dataset.data column (single source of truth)
  const allData = (dataset as any).data || []
  const columns = (dataset as any).columns || []
  const rowCount = dataset.rowCount || 0
  
  // Preview first 100 rows
  const data = allData.slice(0, 100) as Record<string, unknown>[]
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

  // Get column types from dataset record (stored during upload)
  const _columnTypes = (dataset as { columnTypes?: Record<string, string> }).columnTypes || {}

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
      />

      <PageActionRow description="Review the uploaded rows and continue to analysis when the dataset is ready.">
        <Link href={`/app/datasets/${id}/analyze`}>
          <Button size="sm" variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            View analysis
          </Button>
        </Link>
      </PageActionRow>

      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-full mx-auto">
          <DataTable
            title="Dataset rows"
            description="Preview of the uploaded table using the shared dashboard table layout."
            emptyMessage="No data available."
            rows={data}
            columns={previewColumns}
            rowKey={(_row, index) => index}
            minWidth="min-w-[980px]"
          />
          {rowCount >= 100 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing first 100 rows of {rowCount.toLocaleString()} total
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
