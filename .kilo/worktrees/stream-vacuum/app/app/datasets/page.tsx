import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Database, FileSpreadsheet, Trash2, BarChart3, Calendar, Rows3 } from "lucide-react"
import Link from "next/link"
import { DeleteDatasetButton } from "@/components/delete-dataset-button"

export const metadata = {
  title: "Datasets - UseClevr",
  description: "Manage your datasets",
}

export default async function DatasetsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  let datasets: {
    id: string
    name: string
    file_name?: string
    row_count?: number
    column_count?: number
    created_at: string
    status?: string
  }[] = []
  
  if (user) {
    try {
      const { data, error } = await supabase
        .from("datasets")
        .select("id, name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      
      if (!error) {
        datasets = data || []
      }
    } catch (e) {
      // Table may not exist yet
      console.log("[v0] Datasets table not found or query failed")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="flex flex-col">
      <header className="border-b border-border/40 bg-background">
        <div className="flex h-16 items-center justify-between px-6">
          <h1 className="text-2xl font-bold">Datasets</h1>
          <Link href="/app/upload">
            <Button>Upload new</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {datasets.length === 0 ? (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center">
                  <Database className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">No datasets yet</h3>
                  <p className="text-muted-foreground">Upload your first dataset to get started</p>
                </div>
                <Link href="/app/upload">
                  <Button>Upload dataset</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {datasets.map((dataset) => (
                <Card key={dataset.id} className="p-5 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <DeleteDatasetButton datasetId={dataset.id} />
                  </div>
                  
                  <h3 className="font-semibold truncate mb-4">{dataset.name}</h3>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(dataset.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Link href={`/app/datasets/${dataset.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        View data
                      </Button>
                    </Link>
                    <Link href={`/app/datasets/${dataset.id}/analyze`} className="flex-1">
                      <Button size="sm" className="w-full">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Analyze
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
