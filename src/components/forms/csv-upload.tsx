"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataProcessingFlow } from "@/components/ui/data-processing-flow"
import { useNotice } from "@/components/ui/notice-bar"
import { USAGE_REFRESH_EVENT } from "@/components/ui/usage-monitor"
import { UpgradeModal } from "@/components/shared/upgrade-modal"
import type { ConnectionMode } from "@/hooks/use-connection-status"
import { getConnectionDescription, getConnectionMessage, useConnectionStatus } from "@/hooks/use-connection-status"
import { useToast } from "@/hooks/use-toast"
import type { UploadDatasetResponse } from "@/lib/upload/upload-client"
import { debugError, debugLog } from "@/lib/utils/debug"
import { AlertCircle, CheckCircle2, Cloud, Cpu, CreditCard, FileSpreadsheet, Loader2, Sparkles, Wifi, WifiOff } from "lucide-react"
import * as React from "react"

const UPLOAD_QUEUE_KEY = "useclevr_upload_queue"

interface _CsvRow {
  [key: string]: string | number | boolean | null | undefined
}

type UploadResponse = UploadDatasetResponse

async function uploadStandardDatasetSimple(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("dataset_type", "standard")

  const response = await fetch("/api/upload/simple", {
    method: "POST",
    body: formData,
  })

  const result = (await response.json().catch(() => ({
    ok: false,
    success: false,
    stage: "response_sent",
    message: "Upload response could not be read.",
  }))) as UploadResponse

  return {
    ...result,
    ok: response.ok && (result.ok ?? result.success ?? false),
    success: response.ok && (result.success ?? result.ok ?? false),
  }
}

export function CsvUpload() {
   const [uploading, setUploading] = React.useState(false)
   const [dragActive, setDragActive] = React.useState(false)
   const [uploadProgress, setUploadProgress] = React.useState(0)
   const [uploadStatus, setUploadStatus] = React.useState<"idle" | "uploading" | "success" | "error" | "offline" | "limit-reached">("idle")
   const [errorMessage, setErrorMessage] = React.useState("")
   const [limitReachedInfo, setLimitReachedInfo] = React.useState<{currentCount: number, limit: number, planName: string} | null>(null)
   const [currentFileName, setCurrentFileName] = React.useState("")
   const [processingStep, setProcessingStep] = React.useState(0)
   const [showUpgradeModal, setShowUpgradeModal] = React.useState(false)
   const [upgradeModalData, setUpgradeModalData] = React.useState<{currentCount: number, limit: number, planName: string} | null>(null)
   const [upgradeModalCopy, setUpgradeModalCopy] = React.useState<{title?: string, description?: string, usageLabel?: string}>({})
   const { toast } = useToast()
   const { showNotice } = useNotice()
  
  // Cloud-first connection detection
  const connectionStatus = useConnectionStatus()
  const connectionMode = connectionStatus.mode as string as ConnectionMode
  const isCheckingConnection = connectionStatus.isChecking
  const checkConnection = connectionStatus.checkConnection
  const wasOffline = connectionStatus.wasOffline

  // Helper to check connection mode
  const isOffline = connectionMode === 'offline'
  const isHybrid = connectionMode === 'hybrid'
  const _isOnline = connectionMode === 'online'
  const isPlanLimitReached = uploadStatus === "limit-reached"

  // Get connection status icon and color
  const getConnectionIcon = (mode: ConnectionMode) => {
    switch (mode) {
      case 'online':
        return <Cloud className="h-4 w-4 text-blue-500" />
      case 'hybrid':
        return <Cpu className="h-4 w-4 text-amber-500" />
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-500" />
    }
  }

  const getConnectionStatusColor = (mode: ConnectionMode) => {
    switch (mode) {
      case 'online':
        return 'bg-blue-500/10 border-blue-500/30'
      case 'hybrid':
        return 'bg-amber-500/10 border-amber-500/30'
      case 'offline':
        return 'bg-red-500/10 border-red-500/30'
    }
  }

  // Check online status (for backward compatibility)
  React.useEffect(() => {
    const handleOnline = () => processOfflineQueue()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Notify user about queued uploads when back online
  async function processOfflineQueue() {
    const queue = JSON.parse(localStorage.getItem(UPLOAD_QUEUE_KEY) || '[]')
    if (queue.length > 0) {
      toast({
        title: 'Connection restored',
        description: `${queue.length} queued upload(s) need to be re-uploaded – file contents were not saved offline.`,
      })
      localStorage.removeItem(UPLOAD_QUEUE_KEY)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isPlanLimitReached) {
      setDragActive(false)
      return
    }
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (isPlanLimitReached) return

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0])
    }
  }

  const uploadFile = async (file: File) => {
    const fileName = file.name.toLowerCase()
    const isCsv = fileName.endsWith(".csv")
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")
    
    if (!isCsv && !isExcel) {
      setErrorMessage("Please upload a CSV or Excel file (.csv, .xlsx, .xls)")
      return
    }

    // File tier detection
    const maxSize = 50 * 1024 * 1024 // 50MB for standard uploads
    const isLargeFile = file.size > 10 * 1024 * 1024 // > 10MB
    const isMediumFile = file.size > 2 * 1024 * 1024 // > 2MB

    if (file.size > maxSize) {
      setErrorMessage("File size must be less than 50MB. For larger datasets, please split the file before uploading.")
      return
    }

    setCurrentFileName(file.name)
    setUploading(true)
    setUploadStatus("uploading")
    setUploadProgress(0)
    setErrorMessage("")
    setLimitReachedInfo(null)

    // Show appropriate message based on file size tier
    if (isLargeFile) {
      toast({ 
        title: "Large file detected", 
        description: "This file will be processed in stages for optimal performance",
        variant: "default"
      })
    } else if (isMediumFile) {
      toast({ 
        title: "Medium file detected", 
        description: "Preparing enhanced analysis for your dataset",
        variant: "default"
      })
    } else if (isHybrid) {
      toast({ 
        title: "Hybrid mode", 
        description: "Connection unstable – switching to hybrid mode",
        variant: "default"
      })
    }

    // Progress steps for different file sizes
    let progressInterval: NodeJS.Timeout | undefined
    
    if (isLargeFile) {
      // Large file: More detailed progress
      setProcessingStep(1) // Uploading
      setTimeout(() => setProcessingStep(2), 1000)  // Parsing
      setTimeout(() => setProcessingStep(3), 2500)  // Detecting schema
      setTimeout(() => setProcessingStep(4), 4000)  // Building preview
      setTimeout(() => setProcessingStep(5), 5500)  // Ready
      
      progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 8, 90))
      }, 400)
    } else if (isMediumFile) {
      // Medium file: Standard progress
      setProcessingStep(1)
      setTimeout(() => setProcessingStep(2), 600)
      setTimeout(() => setProcessingStep(3), 1200)
      setTimeout(() => setProcessingStep(4), 2000)
      setTimeout(() => setProcessingStep(5), 2800)

      progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 12, 85))
      }, 300)
    } else {
      // Small file: Fast progress
      setProcessingStep(1)
      setTimeout(() => setProcessingStep(2), 400)
      setTimeout(() => setProcessingStep(3), 800)
      setTimeout(() => setProcessingStep(4), 1200)
      setTimeout(() => setProcessingStep(5), 1600)

      progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 15, 80))
      }, 200)
    }

    try {
      debugLog('[CSV-UPLOAD] Starting upload for file:', file.name)
      const result = await uploadStandardDatasetSimple(file)
      debugLog('[CSV-UPLOAD] Result:', result)
      
      if (progressInterval) clearInterval(progressInterval)

      if (result.ok && result.success) {
        debugLog('[CSV-UPLOAD] Success! Redirecting to:', result.redirectTo)
        setUploadProgress(100)
        setUploadStatus("success")
        setProcessingStep(5)
        window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
        if (result.usage?.limitReached) {
          showNotice({
            type: "info",
            title: "Included credits used.",
            message: "You have used all included AI credits for your plan. Upgrade to continue.",
          })
        } else if (result.usage) {
          showNotice({
            type: "success",
            title: "Dataset uploaded successfully.",
            message: result.message || "Dataset uploaded successfully. AI analysis can be started separately.",
          })
        } else {
          showNotice({
            type: "success",
            title: "Dataset uploaded successfully.",
            message: result.message || "Dataset uploaded successfully. AI analysis can be started separately.",
          })
        }
        setTimeout(() => {
          const redirectPath = result.redirectTo || "/app/datasets"
          debugLog('[CSV-UPLOAD] Navigating to:', redirectPath)
          window.location.href = redirectPath
        }, 2000)
      } else {
        const uploadError = result.error || result.message || "Upload failed"

        // Plan limits are an upgrade state, not an upload failure.
        if (result.datasetLimit?.limitReached) {
          const datasetLimit = {
            currentCount: result.datasetLimit.currentCount,
            limit: result.datasetLimit.limit,
            planName: result.datasetLimit.planName || "Free",
          }
          setUploadStatus("limit-reached")
          setLimitReachedInfo(datasetLimit)
          setUpgradeModalData(datasetLimit)
          setUpgradeModalCopy({
            title: "Free plan limit reached",
            description:
              "You have reached the maximum number of datasets included in your Free plan. Continue analyzing your business by upgrading your account.",
            usageLabel: "datasets included",
          })
          setShowUpgradeModal(true)
          setProcessingStep(0)
          showNotice({
            type: "info",
            title: "Free plan limit reached",
            message: "Upgrade to continue uploading and analyzing new datasets.",
          })
          return
        }

        debugLog('[CSV-UPLOAD] Failed:', uploadError)

        // Check for row limit exceeded error
        if (uploadError.startsWith('ROW_LIMIT_EXCEEDED|')) {
          const errorParts = uploadError.split('|')
          const userMessage = errorParts[1] || 'Your file exceeds the row limit for your plan.'
          setUploadStatus("error")
          setErrorMessage(userMessage)
          setProcessingStep(0)
          setUpgradeModalData({
            currentCount: 0,
            limit: 0,
            planName: result.usage?.subscriptionTier || "Free",
          })
          setUpgradeModalCopy({
            title: "Row Limit Exceeded",
            description: userMessage,
            usageLabel: "rows in file",
          })
          setShowUpgradeModal(true)
          showNotice({
            type: "info",
            title: "Row limit exceeded",
            message: userMessage,
          })
          return
        }

        // Only queue if truly offline (API unreachable and no UseClevr Helper)
        if (isOffline) {
          setUploadStatus("offline")
          const queue = JSON.parse(localStorage.getItem(UPLOAD_QUEUE_KEY) || '[]')
          queue.push({ file: { name: file.name, size: file.size }, timestamp: Date.now() })
          localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue))
          toast({
            title: "Offline mode active",
            description: "No internet detected - start UseClevr Helper for private analysis.",
            variant: "default"
          })
        } else {
          setUploadStatus("error")
          setErrorMessage(uploadError)
          setProcessingStep(0)
          if (result.usage?.limitReached) {
            setUpgradeModalData({
              currentCount: result.usage.analysisCount || 2,
              limit: result.usage.total || 2,
              planName: "Free",
            })
            setUpgradeModalCopy({
              title: "Included credits used",
              description: "You have used your included AI credits for this plan. Upgrade to continue uploading, analyzing, and generating reports.",
              usageLabel: "included credits used",
            })
            setShowUpgradeModal(true)
            showNotice({
              type: "info",
              title: "Included credits used.",
              message: "You have used all included AI credits for your plan. Upgrade to continue uploading another dataset.",
            })
          }
        }
      }
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval)
      debugError("Upload failed:", error)
      
      // Only queue if truly offline (API unreachable and no UseClevr Helper)
      if (isOffline) {
        setUploadStatus("offline")
        const queue = JSON.parse(localStorage.getItem(UPLOAD_QUEUE_KEY) || '[]')
        queue.push({ file: { name: file.name, size: file.size }, timestamp: Date.now() })
        localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue))
        toast({ 
          title: "Offline mode active", 
          description: "No internet detected - start UseClevr Helper for private analysis.",
          variant: "default"
        })
      } else {
        setErrorMessage("Upload failed. Please try again.")
        setUploadStatus("error")
        setProcessingStep(0)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Card
        className={`relative border-2 border-dashed transition-all duration-300 overflow-hidden ${
          isPlanLimitReached
            ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
            : dragActive
              ? "border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10"
              : "border-border hover:border-primary/30"
        } ${
          uploadStatus === "success" ? "border-green-500 bg-green-500/5" : ""
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none opacity-50" />
      
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => e.target.files && e.target.files[0] && uploadFile(e.target.files[0])}
        className="hidden"
        id="file-upload"
        disabled={uploading || isPlanLimitReached}
      />
      <label htmlFor="file-upload" className={`block p-5 sm:p-7 ${uploading || isPlanLimitReached ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <div className="flex flex-col items-center gap-3">
          {/* Processing Flow Animation */}
          {uploading && processingStep > 0 && (
            <div className="mb-4">
              <DataProcessingFlow currentStep={processingStep} />
            </div>
          )}

          {/* Connection status indicator */}
          {uploadStatus === "idle" && !uploading && (
            <div className="flex flex-col items-center gap-0.5">
              <div className={`flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 shadow-sm sm:px-4 ${getConnectionStatusColor(connectionMode)}`}>
                {isCheckingConnection ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  getConnectionIcon(connectionMode)
                )}
                <span className="text-xs font-medium">
                  {isCheckingConnection ? "Checking..." : getConnectionMessage(connectionMode)}
                </span>
              </div>
              {!isCheckingConnection && getConnectionDescription(connectionMode) && (
                  <p className="px-2 text-center text-xs text-muted-foreground/70">
                  {getConnectionDescription(connectionMode)}
                </p>
              )}
            </div>
          )}

          {/* Offline queue indicator */}
          {wasOffline && uploadStatus === "idle" && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-amber-500/10 border-amber-500/30 shadow-sm">
              <Wifi className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-500">
                Connection restored – processing queued uploads
              </span>
            </div>
          )}

          {/* Icon */}
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center transition-all ${
            uploadStatus === "uploading" ? "bg-primary/10" : 
            uploadStatus === "success" ? "bg-green-500/10" : 
            uploadStatus === "offline" ? "bg-amber-500/10" :
            uploadStatus === "limit-reached" ? "bg-primary/10" :
            "bg-gradient-primary"
          }`}>
            {uploadStatus === "uploading" ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : uploadStatus === "success" ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : uploadStatus === "offline" ? (
              <AlertCircle className="h-6 w-6 text-amber-500" />
            ) : uploadStatus === "limit-reached" ? (
              <Sparkles className="h-6 w-6 text-primary" />
            ) : uploadStatus === "error" ? (
              <AlertCircle className="h-6 w-6 text-destructive" />
            ) : (
              <FileSpreadsheet className="h-6 w-6 text-white" />
            )}
          </div>

          {/* Text */}
          <div className="text-center space-y-1.5">
            {uploadStatus === "uploading" ? (
              <>
<h3 className="text-base font-semibold">
                   {connectionMode === 'hybrid' ? 'Uploading (Hybrid Mode)...' : 'Processing CSV/Excel...'}
                 </h3>
                <p className="text-xs text-muted-foreground">
                  {currentFileName}
                </p>
                {connectionMode === 'hybrid' && (
                  <p className="text-xs text-amber-500">
                    Using UseClevr Hybrid AI for private analysis
                  </p>
                )}
              </>
            ) : uploadStatus === "success" ? (
              <>
                <h3 className="text-base font-semibold text-green-500">
                  {connectionMode === 'hybrid' ? 'Upload complete!' : 'Upload complete!'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {connectionMode === 'hybrid' ? 'Using UseClevr Hybrid AI for private analysis' : 'Redirecting to your datasets...'}
                </p>
              </>
            ) : uploadStatus === "error" ? (
              <>
                <h3 className="text-base font-semibold text-destructive">Upload failed</h3>
                <p className="text-xs text-muted-foreground">
                  {errorMessage || "Please try again"}
                </p>
                <Button 
                  onClick={() => {
                    setUploadStatus("idle")
                    setErrorMessage("")
                    setProcessingStep(0)
                    checkConnection()
                  }} 
                  variant="outline" 
                  className="mt-2"
                >
                  Retry
                </Button>
              </>
            ) : uploadStatus === "limit-reached" ? (
              <div className="mx-auto max-w-2xl space-y-5 text-left">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground">Free plan limit reached</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You have reached the maximum number of datasets included in your Free plan.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Continue analyzing your business by upgrading your account.
                  </p>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <PlanSummaryCard title="Free" items={["2 datasets", "Basic AI"]} muted />
                  <PlanSummaryCard title="Pro" items={["25 datasets", "Business analysis", "Reports"]} />
                  <PlanSummaryCard title="Business" items={["250 datasets", "Larger uploads", "Dedicated support"]} highlighted />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 font-bold text-white hover:opacity-95"
                    onClick={(event) => {
                      event.preventDefault()
                      setShowUpgradeModal(true)
                    }}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Upgrade to Pro
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-primary/40 bg-background/70 font-semibold hover:bg-primary/10"
                    onClick={(event) => {
                      event.preventDefault()
                      setShowUpgradeModal(true)
                    }}
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-primary" />
                    Upgrade to Business
                  </Button>
                </div>

                {limitReachedInfo && (
                  <p className="text-center text-xs text-muted-foreground">
                    Current usage: {limitReachedInfo.currentCount} of {limitReachedInfo.limit} datasets included in {limitReachedInfo.planName}.
                  </p>
                )}
              </div>
            ) : uploadStatus === "offline" ? (
              <>
                <h3 className="text-base font-semibold text-amber-500">No internet detected</h3>
                <p className="text-xs text-muted-foreground">
                  Start UseClevr Helper for private analysis
                </p>
                <Button 
                  onClick={() => window.open('/app/settings/preferences', '_blank')} 
                  variant="outline" 
                  className="mt-2"
                >
                  Open helper settings
                </Button>
              </>
            ) : (
              <>
<h3 className="text-base font-semibold">
                   Drop your CSV or Excel file here
                 </h3>
                <p className="text-xs text-muted-foreground">
                  or click to browse
                </p>
                {connectionMode === 'hybrid' && (
                  <p className="text-xs text-amber-500 mt-0.5">
                    Connection unstable – hybrid mode
                  </p>
                )}
                {/* File limit - refined */}
                <div className="mt-3 border-t border-border/40 pt-3">
<p className="text-xs text-muted-foreground/80">
                     <span className="font-medium text-foreground">CSV or Excel</span> files up to 50MB
                   </p>
                </div>
              </>
            )}
          </div>

          {/* Progress bar */}
          {uploadStatus === "uploading" && (
            <div className="w-full max-w-xs mt-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">
                {uploadProgress}% complete
              </p>
            </div>
          )}
        </div>
      </label>
      </Card>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        currentPlan={upgradeModalData?.planName || "Free"}
        currentCount={upgradeModalData?.currentCount || 0}
        limit={upgradeModalData?.limit || 0}
        title={upgradeModalCopy.title}
        description={upgradeModalCopy.description}
        usageLabel={upgradeModalCopy.usageLabel}
      />
    </>
  )
}

function PlanSummaryCard({
  title,
  items,
  muted = false,
  highlighted = false,
}: {
  title: string
  items: string[]
  muted?: boolean
  highlighted?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlighted
          ? "border-primary/40 bg-primary/10"
          : muted
            ? "border-border/70 bg-background/70"
            : "border-cyan-500/30 bg-cyan-500/10"
      }`}
    >
      <p className="font-semibold text-foreground">{title}</p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  )
}
