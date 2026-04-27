import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BarChart3, Sparkles } from "lucide-react"
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
  const data = allData.slice(0, 100)

  // Get column types from dataset record (stored during upload)
  const columnTypes = (dataset as { columnTypes?: Record<string, string> }).columnTypes || {}

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border/40 bg-background pl-10">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/app/datasets">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">{(dataset as { name: string }).name}</h1>
              <p className="text-sm text-muted-foreground">
                {rowCount.toLocaleString()} rows • {columns.length} columns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/app/datasets/${id}/analyze`}>
              <Button size="sm" variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                View Analysis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 pl-10">
        <div className="max-w-full mx-auto">
          <Card className="overflow-hidden">
            {data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      {columns.map((col: string) => (
                        <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.map((row: Record<string, unknown>, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/20 transition-colors">
                        {columns.map((col: string) => (
                          <td key={col} className="px-3 py-1.5 align-middle whitespace-nowrap">
                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No data available
              </div>
            )}
          </Card>
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
