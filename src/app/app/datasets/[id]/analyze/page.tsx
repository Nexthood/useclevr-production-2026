import { debugLog, debugError, debugWarn } from "@/lib/debug"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DatasetAnalyzer } from "@/components/dataset-analyzer"
import { AppPageHeader } from "@/components/layout/app-page-header"

// Type for analysis result (simplified for props)
type AnalysisResult = Record<string, unknown>

export default async function AnalyzePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  const userId = (session?.user as { id?: string })?.id

  // Get dataset using Drizzle - read data directly from dataset.data column
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, id),
  })

  if (!dataset) {
    notFound()
  }

  // Read rows from the data column in Dataset table (full dataset)
  const data = (dataset as any).data || []
  const columns = (dataset as any).columns || []
  // Use dataset.rowCount for total
  const rowCount = (dataset as any).rowCount || data.length

  // Get column types from dataset record (stored during upload)
  const columnTypes = (dataset as { columnTypes?: Record<string, string> }).columnTypes || {}
  
  // Log for debugging
  debugLog('[DEBUG-PAGE] Dataset from DB:', { 
    id: dataset.id, 
    name: dataset.name,
    totalRowCount: rowCount,
    columnCount: columns.length
  })
  debugLog('[DEBUG-PAGE] Column types from database:', JSON.stringify(columnTypes))

  // Check if dataset already has analysis results (for state persistence)
  const hasAnalysis: boolean = Boolean(
    dataset.analysis && typeof dataset.analysis === 'object' && Object.keys(dataset.analysis as object).length > 0
  )
  const initialAnalysis = hasAnalysis ? (dataset.analysis as AnalysisResult) : undefined
  
  debugLog('[DEBUG-PAGE] Dataset analysis status:', { 
    id: dataset.id, 
    name: dataset.name,
    hasAnalysis 
  })

  return (
    <div className="flex flex-col min-h-screen">
      <AppPageHeader
        title={`Analyze: ${(dataset as { name: string }).name}`}
        description={hasAnalysis ? "View insights and ask questions" : "Analyze your dataset with AI"}
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Datasets", href: "/app/datasets" },
          { label: (dataset as { name: string }).name, href: `/app/datasets/${id}` },
          { label: "Analyze" },
        ]}
        actions={(
          <Link href={`/app/datasets/${id}`}>
            <Button size="sm" variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              Dataset
            </Button>
          </Link>
        )}
      />

      <main className="flex-1 overflow-y-auto p-6">
        <DatasetAnalyzer
          datasetId={id}
          datasetName={(dataset as { name: string }).name}
          columns={columns}
          data={data}
          rowCount={rowCount}
          isAnalyzed={hasAnalysis}
          initialAnalysis={undefined}
        />
      </main>
    </div>
  )
}
