"use client"

import { AppPageHeader } from "@/components/layout/app-page-header"
import { DatasetModal } from "@/components/modals/dataset-modal"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { BarChart3, Database, FileSpreadsheet, Upload } from "lucide-react"
import Link from "next/link"
import * as React from "react"

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

  const totalRows = datasets.reduce((sum, d) => sum + (d.rowCount || 0), 0)
  const totalColumns = datasets.reduce((sum, d) => sum + (d.columnCount || 0), 0)

  const datasetColumns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <FileSpreadsheet className="h-4 w-4 text-white" />
          </div>
          <Link href={`/app/datasets/${row.id}/analyze`} className="font-medium text-foreground hover:text-primary transition-colors">
            {String(row.name)}
          </Link>
        </div>
      ),
    },
    {
      key: "fileName",
      header: "File",
      render: (row) => (
        <span className="text-sm text-muted-foreground">{String(row.fileName)}</span>
      ),
    },
    {
      key: "rowCount",
      header: "Rows",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {(row.rowCount as number)?.toLocaleString() || 0}
        </span>
      ),
    },
    {
      key: "columnCount",
      header: "Columns",
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.columnCount as number || 0}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(new Date(row.createdAt as string))}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => getStatusBadge(row.status as string),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Link href={`/app/datasets/${row.id}/analyze`}>
            <Button variant="outline" size="sm" className="bg-transparent">
              View
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => setSelectedDataset(row as unknown as Dataset)}
            className="bg-gradient-primary hover:opacity-90"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Analyze
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Datasets"
        description="Manage uploaded files and analysis-ready data."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Datasets" },
        ]}
        actions={
          <Link href="/app/upload">
            <Button size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </Link>
        }
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
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-5 bg-card border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Database className="h-6 w-6 text-cyan-800 dark:text-cyan-100" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{datasets.length}</p>
                      <p className="text-sm text-muted-foreground">Datasets</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-card border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-primary dark:text-cyan-100" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{totalRows.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Total rows</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-card border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-emerald-800 dark:text-emerald-100" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{totalColumns}</p>
                      <p className="text-sm text-muted-foreground">Total columns</p>
                    </div>
                  </div>
                </Card>
              </div>

              <DataTable
                rows={datasets as unknown as Record<string, unknown>[]}
                columns={datasetColumns}
                rowKey={(row) => String(row.id)}
                minWidth="min-w-[900px]"
              />
            </>
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
