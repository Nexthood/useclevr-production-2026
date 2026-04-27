import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Sparkles, MessageSquare } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DatasetAnalyzer } from "@/components/dataset-analyzer"

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
  console.log('[DEBUG-PAGE] Dataset from DB:', { 
    id: dataset.id, 
    name: dataset.name,
    totalRowCount: rowCount,
    columnCount: columns.length
  })
  console.log('[DEBUG-PAGE] Column types from database:', JSON.stringify(columnTypes))

  // Check if dataset already has analysis results (for state persistence)
  const hasAnalysis: boolean = Boolean(
    dataset.analysis && typeof dataset.analysis === 'object' && Object.keys(dataset.analysis as object).length > 0
  )
  const initialAnalysis = hasAnalysis ? (dataset.analysis as AnalysisResult) : undefined
  
  console.log('[DEBUG-PAGE] Dataset analysis status:', { 
    id: dataset.id, 
    name: dataset.name,
    hasAnalysis 
  })

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border/40 bg-background shrink-0">
        <div className="flex h-16 items-center px-6 gap-4 pl-10">
          <Link href={`/app/datasets/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Analyze: {(dataset as { name: string }).name}</h1>
            <p className="text-sm text-muted-foreground">
              {hasAnalysis ? 'View insights and ask questions' : 'Analyze your dataset with AI'}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 pl-10 overflow-y-auto">
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
