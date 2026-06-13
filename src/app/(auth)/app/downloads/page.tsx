"use client"

import { debugError, debugLog, debugWarn } from "@/lib/utils/debug"



import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { AlertCircle, Download, Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

interface DownloadItem {
  id: string
  name: string
  type: "pdf" | "csv" | "png" | "pptx" | "xlsx"
  date: string
  source: string
  status: "ready" | "generating" | "failed" | "unavailable"
  url?: string
  size?: string
  error?: string
  timezone?: string | null
  createdAt?: string
}

interface ReportListItem {
  id: string
  datasetName?: string | null
  localTime?: string | null
  createdAt: string
  timezone?: string | null
}

export default function DownloadsPage() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPro, setIsPro] = useState(false)
  const [creditsUsed, setCreditsUsed] = useState(0)
  const [creditsLimit] = useState(2)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadCount, setDownloadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, _setFilterStatus] = useState<'all' | 'ready'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Fetch user data and downloads in parallel
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch usage and reports - handle each separately to not fail the whole thing
      let usageData = { analysisCount: 0, subscriptionTier: 'free' }
      let reportsData: { reports: ReportListItem[] } = { reports: [] }
      
      // Fetch usage
      try {
        const usageRes = await fetch("/api/usage")
        if (usageRes.ok) {
          usageData = await usageRes.json()
        }
      } catch (usageErr) {
        debugWarn('Failed to fetch usage:', usageErr)
      }
      
      // Update usage state
      setCreditsUsed(usageData.analysisCount || 0)
      setIsPro(["pro", "business", "superadmin"].includes(usageData.subscriptionTier))
      
      // Fetch reports
      try {
        const reportsRes = await fetch("/api/reports?list=true")
        debugLog('[Downloads] Fetch reports response status:', reportsRes.status)
        if (reportsRes.ok) {
          reportsData = await reportsRes.json()
          debugLog('[Downloads] Reports data received:', reportsData)
        } else {
          const errorText = await reportsRes.text()
          debugError('[Downloads] Reports fetch failed:', reportsRes.status, errorText)
        }
      } catch (reportsErr) {
        debugError('[Downloads] Reports fetch exception:', reportsErr)
      }
      
      // Transform reports to download items
      if (reportsData.reports && reportsData.reports.length > 0) {
        const items: DownloadItem[] = reportsData.reports.map((report) => ({
          id: report.id,
          name: report.datasetName || "Analysis Report",
          type: "pdf", // PDF reports are now generated
          date: report.localTime || new Date(report.createdAt).toISOString().split('T')[0],
          source: report.datasetName || "Dataset",
          status: "ready", // Reports are generated synchronously
          url: `/api/reports/download?id=${report.id}&format=pdf`,
          timezone: report.timezone || null,
          createdAt: report.createdAt,
        }))
        setDownloads(items)
      } else {
        setDownloads([])
      }
    } catch (err) {
      debugError("Error fetching downloads:", err)
      setError("Failed to load downloads")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle download button click
  const handleDownload = async (item: DownloadItem) => {
    if (item.status !== "ready") {
      return // Don't download if not ready
    }

    // Check download limit for non-pro users
    if (!isPro && downloadCount >= 2) {
      setShowUpgradeModal(true)
      return
    }

    setDownloadingId(item.id)
    try {
      // For reports, use the GET endpoint with report ID
      if (item.type === "pdf" || item.type === "csv") {
        // Use the format from the item type
        const downloadFormat = item.type === "pdf" ? "pdf" : "csv"
        const downloadUrl = `/api/reports/download?id=${item.id}&format=${downloadFormat}`
        
        const response = await fetch(downloadUrl, {
          method: 'GET',
        })

        if (response.ok) {
          // Handle blob response for download
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `${sanitizeFilename(item.name)}.${downloadFormat}`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
          
          // Increment download count for non-pro
          setDownloadCount(prev => prev + 1)
        } else {
          const data = await response.json()
          throw new Error(data.error || "Download failed")
        }
      } else if (item.url) {
        // For direct URLs, open/download directly
        window.open(item.url, "_blank")
        setDownloadCount(prev => prev + 1)
      }
    } catch (err) {
      debugError("Download error:", err)
      setError(err instanceof Error ? err.message : "Download failed")
    } finally {
      setDownloadingId(null)
    }
  }

  // Handle delete button click
  const handleDelete = async (item: DownloadItem) => {
    try {
      const confirmed = window.confirm(`Remove "${item.name}" from Downloads?`)
      if (!confirmed) return
      const res = await fetch(`/api/reports?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete report')
      }
      // Remove from list locally
      setDownloads(prev => prev.filter(d => d.id !== item.id))
    } catch (err) {
      debugError('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // Determine status display
  const getStatusDisplay = (status: DownloadItem["status"]) => {
    switch (status) {
      case "ready":
        return { label: "Ready", className: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100" }
      case "generating":
        return { label: "Generating", className: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" }
      case "failed":
        return { label: "Failed", className: "bg-red-500/10 text-red-400" }
      case "unavailable":
        return { label: "Unavailable", className: "bg-neutral-500/10 text-neutral-400" }
      default:
        return { label: "Unknown", className: "bg-neutral-500/10 text-neutral-400" }
    }
  }

  // Calculate usage percentage
  const creditPercent = Math.min((creditsUsed / creditsLimit) * 100, 100)

  // Client-side search over existing rendered data
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredDownloads = (normalizedQuery
    ? downloads.filter((d) => {
        const nameMatch = d.name?.toLowerCase().includes(normalizedQuery)
        const sourceMatch = d.source?.toLowerCase().includes(normalizedQuery)
        return !!(nameMatch || sourceMatch)
      })
    : downloads
  ).filter((d) => (filterStatus === 'all' ? true : d.status === filterStatus))

  const downloadColumns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: "id",
      header: "ID",
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{String(row.id).slice(-8)}</span>,
    },
    {
      key: "name",
      header: "Title",
      render: (row) => <span className="font-medium text-foreground">{String(row.name)}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (row) => <span className="uppercase text-muted-foreground">{String(row.type)}</span>,
    },
    {
      key: "source",
      header: "Source",
      render: (row) => <span className="text-muted-foreground">{String(row.source)}</span>,
    },
    {
      key: "date",
      header: "Created",
      render: (row) => (
        <span className="text-muted-foreground">
          {String(row.date)}
          {row.timezone ? ` (${String(row.timezone)})` : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const statusDisplay = getStatusDisplay(row.status as DownloadItem["status"])

        return (
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusDisplay.className}`}>
            {statusDisplay.label}
          </span>
        )
      },
    },
    {
      key: "download",
      header: "Download",
      render: (row) => {
        const item = row as unknown as DownloadItem
        const isDownloading = downloadingId === item.id

        return (
          <Button
            variant="outline"
            size="sm"
            className="border-border"
            disabled={item.status !== "ready" || isDownloading}
            onClick={() => handleDownload(item)}
          >
            {isDownloading ? "Downloading..." : "Download"}
          </Button>
        )
      },
    },
    {
      key: "delete",
      header: "Delete",
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          className="border-red-900/40 text-red-400 hover:bg-red-900/10"
          onClick={() => handleDelete(row as unknown as DownloadItem)}
        >
          Delete
        </Button>
      ),
    },
  ]

  const rightSidebar = (
    <aside className="hidden w-80 flex-shrink-0 border-l border-border bg-card lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="space-y-4">
          <Card className="p-4 bg-card border-border">
            <div className="flex flex-col gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Analysis Credits</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isPro 
                    ? "Unlimited analyses and downloads" 
                    : `${creditsUsed} / ${creditsLimit} analyses used this month`
                  }
                </p>
              </div>
              {!isPro && creditsUsed >= creditsLimit && (
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  Upgrade Now
                </Button>
              )}
            </div>
            {!isPro && (
              <div className="mt-3">
                <div className="h-2 rounded-full bg-border overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${creditPercent}%` }}
                  />
                </div>
                {creditsUsed >= creditsLimit && (
                  <p className="text-xs text-amber-500 mt-2">
                    You've reached your analysis limit. Upgrade for unlimited analyses and downloads.
                  </p>
                )}
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              Downloads are counted against your analysis quota. Each file download uses one analysis credit.
            </div>
          </Card>

          {!isPro && (
            <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">Unlock Unlimited Downloads</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Get unlimited PDF, CSV, and data exports with Pro
                  </p>
                </div>
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  Upgrade to Pro
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </aside>
  )

  return (
    <DashboardSubpageLayout
      title="Downloads"
      description="Manage your exported files."
      breadcrumbs={[
        { label: "Dashboard", href: "/app" },
        { label: "Downloads" },
      ]}
      icon={Download}
      rightSidebar={rightSidebar}
      actions={(
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
      )}
    >
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6 pt-6">
          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setError(null)}
                className="ml-auto"
              >
                Dismiss
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Your Downloads</h2>
                <p className="text-sm text-muted-foreground">Generated reports and export files.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-auto">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-full pl-9 sm:w-56"
                  />
                </div>
              </div>
            </div>

            {isLoading ? (
              <Card className="flex items-center justify-center border-border bg-card py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </Card>
            ) : (
              <DataTable
                title="Downloads"
                description="Reports are listed with separated download and delete actions."
                emptyMessage={downloads.length === 0 ? "No downloads yet. Analyze a dataset and generate reports to see them here." : "No downloads found."}
                rows={filteredDownloads as unknown as Record<string, unknown>[]}
                columns={downloadColumns}
                rowKey={(row) => String(row.id)}
                minWidth="min-w-[900px]"
                selectable
                selectedRows={selectedIds}
                onSelectedRowsChange={setSelectedIds}
                bulkActions={
                  selectedIds.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-900/40 text-red-400 hover:bg-red-900/10"
                      onClick={() => {
                        const confirmed = window.confirm(`Remove ${selectedIds.size} downloads?`)
                        if (!confirmed) return
                        void Promise.all(Array.from(selectedIds).map((id) => fetch(`/api/reports?id=${encodeURIComponent(id)}`, { method: 'DELETE' })))
                          .then(() => {
                            setDownloads((prev) => prev.filter((d) => !selectedIds.has(d.id)))
                            setSelectedIds(new Set())
                          })
                          .catch((err) => debugError('Bulk delete error:', err))
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )
                }
              />
            )}
          </div>
        </div>
      </main>

      <Modal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        title="Upgrade to continue downloading"
        description={`You've used ${creditsUsed} of your ${creditsLimit} free analyses. Upgrade to Pro for unlimited analyses and downloads.`}
      >
        <p className="text-sm text-muted-foreground">Your cart and discount are ready.</p>
      </Modal>
    </DashboardSubpageLayout>
  )
}

function sanitizeFilename(value: string) {
  const safe = value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120)

  return safe || "analysis-report"
}
