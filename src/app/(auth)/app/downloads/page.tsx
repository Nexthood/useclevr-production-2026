"use client"

import { debugError, debugLog, debugWarn } from "@/lib/utils/debug"



import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { formatPlanPrice, getBillingPlan } from "@/lib/billing/plans"
import { AlertCircle, CreditCard, Download, Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
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

type UsageResponse = {
  analysisCount: number
  total: number
  subscriptionTier: string
  canAnalyze: boolean
  limitReached: boolean
  unlimited?: boolean
  unlimitedLabel?: string | null
}

export default function DownloadsPage() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPro, setIsPro] = useState(false)
  const [creditsUsed, setCreditsUsed] = useState(0)
  const [creditsLimit, setCreditsLimit] = useState(2)
  const [limitReached, setLimitReached] = useState(false)
  const [unlimitedLabel, setUnlimitedLabel] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, _setFilterStatus] = useState<'all' | 'ready'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const selectedPlan = getBillingPlan("pro_monthly")

  // Fetch user data and downloads in parallel
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch usage and reports - handle each separately to not fail the whole thing
      let usageData: UsageResponse = {
        analysisCount: 0,
        total: 2,
        subscriptionTier: "free",
        canAnalyze: true,
        limitReached: false,
      }
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
      setCreditsLimit(usageData.total || 2)
      setLimitReached(Boolean(usageData.limitReached))
      setUnlimitedLabel(usageData.unlimitedLabel || null)
      setIsPro(Boolean(usageData.unlimited) || ["pro", "business", "superadmin", "admin", "builtin"].includes(usageData.subscriptionTier))
      
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
    if (!isPro && limitReached) {
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
          
        } else {
          const data = await response.json()
          throw new Error(data.error || "Download failed")
        }
      } else if (item.url) {
        // For direct URLs, open/download directly
        window.open(item.url, "_blank")
      }
    } catch (err) {
      debugError("Download error:", err)
      setError(err instanceof Error ? err.message : "Download failed")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleUpgradeCheckout = async () => {
    setIsStartingCheckout(true)
    setCheckoutError(null)

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedPlan.id }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        setCheckoutError(result.error || result.message || "Checkout could not be started.")
        setIsStartingCheckout(false)
        return
      }

      const checkoutUrl = result.checkoutUrl || result.url
      if (!checkoutUrl) {
        setCheckoutError("Checkout could not be started because Stripe did not return a checkout URL.")
        setIsStartingCheckout(false)
        return
      }

      window.location.assign(checkoutUrl)
    } catch (error) {
      debugError("Checkout error:", error)
      setCheckoutError("Checkout could not be started. Please try again.")
      setIsStartingCheckout(false)
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
            className="shrink-0 whitespace-nowrap border-border"
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
          className="shrink-0 whitespace-nowrap border-red-900/40 text-red-400 hover:bg-red-900/10"
          onClick={() => handleDelete(row as unknown as DownloadItem)}
        >
          Delete
        </Button>
      ),
    },
  ]

  const rightSidebar = (
    <aside className="hidden w-80 shrink-0 border-l border-border bg-card lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="space-y-4">
          <Card className="p-4 bg-card border-border">
            <div className="flex flex-col gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Analysis Credits</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isPro
                    ? `${unlimitedLabel || "Unlimited"} analyses and downloads`
                    : `${creditsUsed} / ${creditsLimit} analyses used this month`
                  }
                </p>
              </div>
              {!isPro && limitReached && (
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
                {limitReached && (
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
            className="shrink-0 whitespace-nowrap"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
      )}
    >
      <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-4 pt-6 sm:px-6 sm:pb-6">
        <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6">
          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setError(null)}
                className="ml-auto shrink-0 whitespace-nowrap"
              >
                Dismiss
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">Your Downloads</h2>
                <p className="text-sm text-muted-foreground">Generated reports and export files.</p>
              </div>
              <div className="relative z-10 flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <div className="relative min-w-0 w-full sm:w-auto">
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
                      className="shrink-0 whitespace-nowrap border-red-900/40 text-red-400 hover:bg-red-900/10"
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
        onOpenChange={(open) => {
          setShowUpgradeModal(open)
          if (!open) {
            setCheckoutError(null)
            setIsStartingCheckout(false)
          }
        }}
        title="Upgrade to continue downloading"
        description={`You've used ${creditsUsed} of your ${creditsLimit} free analyses. Upgrade to Pro for unlimited analyses and downloads.`}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected plan</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{selectedPlan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{selectedPlan.description}</p>
              </div>
              <div className="rounded-lg bg-primary/10 px-3 py-2 text-left sm:text-right">
                <p className="text-xl font-semibold text-foreground">{formatPlanPrice(selectedPlan)}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedPlan.interval === "year" ? "Annual billing" : "Monthly billing"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {selectedPlan.features.map((feature) => (
                <div key={feature} className="rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                  {feature}
                </div>
              ))}
            </div>

            {checkoutError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={handleUpgradeCheckout}
            disabled={isStartingCheckout}
            className="w-full gap-2"
          >
            {isStartingCheckout ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening Stripe Checkout...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Continue to Secure Checkout
              </>
            )}
          </Button>
        </div>
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
