"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, FileText, Image, File, Presentation, FileSpreadsheet, FileInput, Search, AlertCircle, CheckCircle, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { MegaButton } from "@/components/mega-button"
import { UpgradeModal } from "@/components/upgrade-modal"

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

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  csv: FileSpreadsheet,
  png: Image,
  jpg: Image,
  pptx: Presentation,
  docx: FileInput,
  xlsx: FileSpreadsheet,
  default: File,
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready'>('all')

  // Fetch user data and downloads in parallel
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch usage and reports - handle each separately to not fail the whole thing
      let usageData = { analysisCount: 0, subscriptionTier: 'free' }
      let reportsData = { reports: [] }
      
      // Fetch usage
      try {
        const usageRes = await fetch("/api/usage")
        if (usageRes.ok) {
          usageData = await usageRes.json()
        }
      } catch (usageErr) {
        console.warn('Failed to fetch usage:', usageErr)
      }
      
      // Update usage state
      setCreditsUsed(usageData.analysisCount || 0)
      setIsPro(usageData.subscriptionTier === 'pro')
      
      // Fetch reports
      try {
        const reportsRes = await fetch("/api/reports?list=true")
        console.log('[Downloads] Fetch reports response status:', reportsRes.status)
        if (reportsRes.ok) {
          reportsData = await reportsRes.json()
          console.log('[Downloads] Reports data received:', reportsData)
        } else {
          const errorText = await reportsRes.text()
          console.error('[Downloads] Reports fetch failed:', reportsRes.status, errorText)
        }
      } catch (reportsErr) {
        console.error('[Downloads] Reports fetch exception:', reportsErr)
      }
      
      // Transform reports to download items
      if (reportsData.reports && reportsData.reports.length > 0) {
        const items: DownloadItem[] = reportsData.reports.map((report: any) => ({
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
      console.error("Error fetching downloads:", err)
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
          a.download = `${item.name}.${downloadFormat}`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
          
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
      console.error("Download error:", err)
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
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // Determine status display
  const getStatusDisplay = (status: DownloadItem["status"]) => {
    switch (status) {
      case "ready":
        return { label: "Ready", className: "bg-green-500/10 text-green-400" }
      case "generating":
        return { label: "Generating", className: "bg-yellow-500/10 text-yellow-400" }
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

  return (
    <div className="min-h-screen bg-background pl-10">
      {/* Header */}
      <header className="border-b border-border bg-card h-16">
        <div className="flex h-16 items-center justify-between px-8">
          <div className="pl-2">
            <h1 className="text-xl font-semibold text-foreground">Downloads</h1>
            <p className="text-sm text-muted-foreground">Manage your exported files</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <MegaButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-6xl mx-auto space-y-6 pt-6">
          {/* Usage Card - Unified with sidebar */}
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Analysis Credits</h2>
                <p className="text-sm text-muted-foreground mt-1">
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
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
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

          {/* Downloads List */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Your Downloads</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 w-56"
                  />
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : downloads.length === 0 ? (
              <div className="text-center py-12">
                <Download className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground mt-4">No downloads yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Analyze a dataset and generate reports to see them here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDownloads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No downloads found</p>
                ) : (
                filteredDownloads.map((file) => {
                  const Icon = typeIcons[file.type] || typeIcons.default
                  const statusDisplay = getStatusDisplay(file.status)
                  const isDownloading = downloadingId === file.id
                  
                  return (
                    <div 
                      key={file.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {file.type.toUpperCase()} • {file.source}
                          </p>
                          {file.timezone ? (
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              Generated on {file.date} ({file.timezone})
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {file.date}
                            </p>
                          )}
                          {file.error && (
                            <p className="text-xs text-red-400 mt-1">{file.error}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusDisplay.className}`}>
                          {statusDisplay.label === "Ready" && <CheckCircle className="h-3 w-3 inline mr-1" />}
                          {statusDisplay.label === "Generating" && <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />}
                          {statusDisplay.label === "Failed" && <AlertCircle className="h-3 w-3 inline mr-1" />}
                          {statusDisplay.label}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-border"
                          disabled={file.status !== "ready" || isDownloading}
                          onClick={() => handleDownload(file)}
                        >
                          {isDownloading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          {isDownloading ? "Downloading..." : "Download"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-900/40 text-red-400 hover:bg-red-900/10"
                          onClick={() => handleDelete(file)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )
                })
                )}
              </div>
            )}
          </Card>

          {/* Upgrade CTA for free users */}
          {!isPro && (
            <Card className="p-6 bg-gradient-to-br from-purple-950/30 to-cyan-950/30 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Unlock Unlimited Downloads</h3>
                  <p className="text-sm text-muted-foreground mt-1">
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
      </main>

      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal}
        title="Upgrade to continue downloading"
        message={`You've used ${creditsUsed} of your ${creditsLimit} free analyses. Upgrade to Pro for unlimited analyses and downloads.`}
      />
    </div>
  )
}
