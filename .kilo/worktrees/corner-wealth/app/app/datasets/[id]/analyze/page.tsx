import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DatasetAnalyzer } from "@/components/dataset-analyzer"

export default async function AnalyzePage({
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

  // Get all rows for analysis
  const { data: rows } = await supabase
    .from("dataset_rows")
    .select("data")
    .eq("dataset_id", id)
    .order("row_index", { ascending: true })

  const data = rows?.map((r) => r.data) || []
  // Derive columns from first row of data
  const columns = data.length > 0 ? Object.keys(data[0] as object) : []
  const rowCount = data.length

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-border/40 bg-background">
        <div className="flex h-16 items-center px-6 gap-4">
          <Link href={`/app/datasets/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Analyze: {dataset.name}</h1>
            <p className="text-sm text-muted-foreground">
              Ask questions about your data
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-hidden">
        <DatasetAnalyzer
          datasetId={id}
          datasetName={dataset.name}
          columns={columns}
          data={data}
          rowCount={rowCount}
        />
      </main>
    </div>
  )
}
