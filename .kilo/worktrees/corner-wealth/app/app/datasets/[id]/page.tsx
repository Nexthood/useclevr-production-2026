import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, BarChart3 } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DataTable } from "@/components/data-table"

export default async function DatasetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // Get dataset
  const { data: dataset, error: datasetError } = await supabase
    .from("datasets")
    .select("id, name, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (datasetError || !dataset) {
    notFound()
  }

  // Get rows (first 100 for preview)
  const { data: rows } = await supabase
    .from("dataset_rows")
    .select("data")
    .eq("dataset_id", id)
    .order("row_index", { ascending: true })
    .limit(100)

  const data = rows?.map((r) => r.data) || []
  // Derive columns from first row of data
  const columns = data.length > 0 ? Object.keys(data[0] as object) : []
  const rowCount = data.length

  return (
    <div className="flex flex-col">
      <header className="border-b border-border/40 bg-background">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/app/datasets">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">{dataset.name}</h1>
              <p className="text-sm text-muted-foreground">
                {rowCount} rows, {columns.length} columns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Link href={`/app/datasets/${id}/analyze`}>
              <Button size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analyze with AI
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-full mx-auto">
          <Card className="overflow-hidden">
            <DataTable columns={columns} data={data} />
          </Card>
          {rowCount >= 100 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing first 100 rows
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
