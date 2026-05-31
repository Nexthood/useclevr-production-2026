"use client"

import { AppPageHeader } from "@/components/layout/app-page-header"
import { BatchDeleteButton } from "@/components/dataset/batch-delete-button"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { PageActionRow } from "@/components/ui/page-action-row"
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
  industry?: string | null
  monthRevenue?: number | null
}

interface DatasetsClientProps {
  initialDatasets: Dataset[]
}

export function DatasetsClient({ initialDatasets }: DatasetsClientProps) {
  const [datasets] = React.useState<Dataset[]>(initialDatasets)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

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

  // Business-related stats
  const totalRevenue = datasets.reduce((sum, d) => sum + (d.monthRevenue || 0), 0)
  const averageRevenue = datasets.length > 0 ? totalRevenue / datasets.length : 0
  const readyCount = datasets.filter((d) => d.status === "ready").length

  const datasetColumns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: "select",
      header: "Select",
      align: "center",
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(String(row.id))}
          onChange={(e) => {
            const newSelected = new Set(selectedIds)
            if (e.target.checked) {
              newSelected.add(String(row.id))
            } else {
              newSelected.delete(String(row.id))
            }
            setSelectedIds(newSelected)
          }}
          className="h-4 w-4 rounded border border-input"
        />
      ),
    },
    {
      key: "id",
      header: "ID",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{String(row.id).slice(-8)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => getStatusBadge(row.status as string),
    },
    {
      key: "name",
      header: "Title",
      render: (row) => (
        <span className="font-medium text-foreground">{String(row.name)}</span>
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
      key: "viewTable",
      header: "View table",
      render: (row) => (
        <Link href={`/app/datasets/${row.id}`} className="text-sm font-medium text-primary hover:underline">
          View
        </Link>
      ),
    },
    {
      key: "analyze",
      header: "Analyze",
      render: (row) => (
        <Link href={`/app/datasets/${row.id}/analyze`} className="text-sm font-medium text-primary hover:underline">
          Analyze
        </Link>
      ),
    },
    {
      key: "report",
      header: "Report",
      render: (row) => (
        <Link href={`/app/datasets/${row.id}/analyze?panel=report`} className="text-sm font-medium text-primary hover:underline">
          Report
        </Link>
      ),
    },
  ]

  const handleBulkDelete = () => {
    setSelectedIds(new Set())
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
        icon={Database}
      />

      <PageActionRow description="Upload CSV files before analysis, reports, or assistant questions.">
        <Link href="/app/upload">
          <Button size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Upload dataset
          </Button>
        </Link>
        {selectedIds.size > 0 && (
          <BatchDeleteButton
            datasetIds={Array.from(selectedIds)}
            onDeleted={handleBulkDelete}
          />
        )}
      </PageActionRow>

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
                      <p className="text-sm text-muted-foreground">Total datasets</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-card border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-primary dark:text-cyan-100" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">€{Math.round(averageRevenue).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Avg monthly revenue</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-card border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-emerald-800 dark:text-emerald-100" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{readyCount} / {datasets.length}</p>
                      <p className="text-sm text-muted-foreground">Ready for analysis</p>
                    </div>
                  </div>
                </Card>
              </div>

              <DataTable
                title="Dataset library"
                description="All uploaded data files with processing status and actions."
                rows={datasets as unknown as Record<string, unknown>[]}
                columns={datasetColumns}
                rowKey={(row) => String(row.id)}
                minWidth="min-w-[800px]"
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
