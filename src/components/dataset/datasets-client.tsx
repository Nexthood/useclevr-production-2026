"use client"

import * as React from "react"
import { Database, FileSpreadsheet, BarChart3, Calendar, Upload } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DatasetModal } from "@/components/dataset-modal"
import { AppPageHeader } from "@/components/layout/app-page-header"

interface Dataset {
  id: string
  name: string
  fileName: string
  rowCount: number
  columnCount: number
  status: string | null
  createdAt: Date | null
  columns: string[]
}

interface DatasetsClientProps {
  initialDatasets: Dataset[]
}

export function DatasetsClient({ initialDatasets }: DatasetsClientProps) {
  const [datasets] = React.useState<Dataset[]>(initialDatasets)
  const [selectedDataset, setSelectedDataset] = React.useState<Dataset | null>(null)

  const formatDate = (date: Date | null) => {
    if (!date) return "Unknown"
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: string | null) => {
    if (status === "ready") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
          Ready
        </span>
      )
    }
    if (status === "processing") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
          Processing
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        {status || "Unknown"}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Datasets"
        description="Manage uploaded files and analysis-ready data."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Datasets" },
        ]}
        actions={(
          <Link href="/app/upload">
            <Button size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </Link>
        )}
      />

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-6 pt-6">
          {datasets.length === 0 ? (
            <Card className="p-12 bg-card border-border">
              <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-primary mx-auto flex items-center justify-center">
                  <Database className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">No datasets yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Upload your first CSV file to start generating insights with AI.
                  </p>
                </div>
                <Link href="/app/upload">
                  <Button size="lg" className="bg-gradient-primary hover:opacity-90">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload your first dataset
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {datasets.map((dataset) => (
                <Card
                  key={dataset.id}
                  className="p-5 bg-card border-border hover:border-primary/50 transition-all duration-300 group cursor-pointer"
                  onClick={() => setSelectedDataset(dataset)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-white" />
                    </div>
                    {getStatusBadge(dataset.status)}
                  </div>

                  <h3 className="font-semibold text-lg text-foreground mb-2 truncate">{dataset.name}</h3>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(dataset.createdAt)}
                    </span>
                  </div>

                  <div className="flex gap-2 text-sm text-muted-foreground mb-4">
                    <span>{dataset.rowCount?.toLocaleString() || 0} rows</span>
                    <span>•</span>
                    <span>{dataset.columnCount || 0} columns</span>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/app/datasets/${dataset.id}/analyze`} className="flex-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full border-border text-foreground hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                      >
                        View
                      </Button>
                    </Link>
                    <Link href={`/app/datasets/${dataset.id}/analyze`} className="flex-1">
                      <Button 
                        size="sm" 
                        className="w-full bg-gradient-primary hover:opacity-90"
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                      >
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

      <DatasetModal
        isOpen={!!selectedDataset}
        onClose={() => setSelectedDataset(null)}
        dataset={selectedDataset}
      />
    </div>
  )
}
