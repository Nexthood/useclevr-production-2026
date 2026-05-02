"use client"

import { debugLog, debugError, debugWarn } from "@/lib/debug"



import * as React from "react"
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Cloud, Wifi, WifiOff, Cpu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { uploadCSV } from "@/app/actions/upload"
import { DataProcessingFlow } from "@/components/data-processing-flow"
import { useToast } from "@/hooks/use-toast"
import { useConnectionStatus, getConnectionMessage, getConnectionDescription, ConnectionMode } from "@/hooks/use-connection-status"

interface CsvRow {
  [key: string]: string | number | boolean | null | undefined
}

export function CsvUpload() {
  const [uploading, setUploading] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [uploadStatus, setUploadStatus] = React.useState<"idle" | "uploading" | "success" | "error" | "offline">("idle")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [currentFileName, setCurrentFileName] = React.useState("")
  const [processingStep, setProcessingStep] = React.useState(0)
  const { toast } = useToast()
  
  // Cloud-first connection detection
  const connectionStatus = useConnectionStatus()
  const connectionMode = connectionStatus.mode as string as ConnectionMode
  const isCheckingConnection = connectionStatus.isChecking
  const checkConnection = connectionStatus.checkConnection
  const wasOffline = connectionStatus.wasOffline

  // Helper to check connection mode
  const isOffline = connectionMode === 'offline'
  const isHybrid = connectionMode === 'hybrid'
  const isOnline = connectionMode === 'online'

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

  // Process offline queue when back online
  async function processOfflineQueue() {
    const queue = JSON.parse(localStorage.getItem('useclever_upload_queue') || '[]')
    if (queue.length > 0) {
      toast({ title: 'Connection restored', description: `Processing ${queue.length} queued uploads...` })
      for (const item of queue) {
        try {
          // Create a minimal file-like object for retry
          await uploadFile(new File([], item.file.name, { type: 'text/csv' }))
        } catch (e) {
          debugError('Failed to process queued upload:', e)
        }
      }
      localStorage.setItem('useclever_upload_queue', '[]')
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0])
    }
  }

  const uploadFile = async (file: File) => {
    // Check if offline (API unreachable AND no local AI)
    if (isOffline) {
      // Store in local queue for offline mode
      setUploadStatus("offline")
      const queue = JSON.parse(localStorage.getItem('useclever_upload_queue') || '[]')
      queue.push({ file: { name: file.name, size: file.size }, timestamp: Date.now() })
      localStorage.setItem('useclever_upload_queue', JSON.stringify(queue))
      toast({ 
        title: "Offline mode active", 
        description: "No internet detected – Install UseClevr AI MEGA",
        variant: "default"
      })
      setUploading(false)
      return
    }

    if (!file.name.endsWith(".csv")) {
      setErrorMessage("Please upload a CSV file")
      return
    }

    // File tier detection
    const maxSize = 100 * 1024 * 1024 // 100MB for large datasets
    const isLargeFile = file.size > 10 * 1024 * 1024 // > 10MB
    const isMediumFile = file.size > 2 * 1024 * 1024 // > 2MB

    if (file.size > maxSize) {
      setErrorMessage("File size must be less than 100MB. For datasets over 100MB, please split into smaller files.")
      return
    }

    setCurrentFileName(file.name)
    setUploading(true)
    setUploadStatus("uploading")
    setUploadProgress(0)
    setErrorMessage("")

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

    const formData = new FormData()
    formData.append("file", file)

    try {
      debugLog('[CSV-UPLOAD] Starting upload for file:', file.name)
      const result = await uploadCSV(formData)
      debugLog('[CSV-UPLOAD] Result:', result)
      
      if (progressInterval) clearInterval(progressInterval)

      if (result.success) {
        debugLog('[CSV-UPLOAD] Success! Redirecting to:', result.redirectTo)
        setUploadProgress(100)
        setUploadStatus("success")
        setProcessingStep(5)
        setTimeout(() => {
          const redirectPath = result.redirectTo || `/app/datasets/${result.datasetId}/analyze`
          debugLog('[CSV-UPLOAD] Navigating to:', redirectPath)
          window.location.href = redirectPath
        }, 2000)
      } else {
        debugLog('[CSV-UPLOAD] Failed:', result.error)
        // Only queue if truly offline (API unreachable and no local AI)
        if (isOffline) {
          setUploadStatus("offline")
          const queue = JSON.parse(localStorage.getItem('useclever_upload_queue') || '[]')
          queue.push({ file: { name: file.name, size: file.size }, timestamp: Date.now() })
          localStorage.setItem('useclever_upload_queue', JSON.stringify(queue))
          toast({ 
            title: "Offline mode active", 
            description: "No internet detected – Install UseClevr AI MEGA",
            variant: "default"
          })
        } else {
          setUploadStatus("error")
          setErrorMessage(result.error || "Upload failed")
          setProcessingStep(0)
        }
      }
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval)
      debugError("Upload failed:", error)
      
      // Only queue if truly offline (API unreachable and no local AI)
      if (isOffline) {
        setUploadStatus("offline")
        const queue = JSON.parse(localStorage.getItem('useclever_upload_queue') || '[]')
        queue.push({ file: { name: file.name, size: file.size }, timestamp: Date.now() })
        localStorage.setItem('useclever_upload_queue', JSON.stringify(queue))
        toast({ 
          title: "Offline mode active", 
          description: "No internet detected – Install UseClevr AI MEGA",
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
    <Card
      className={`relative border-2 border-dashed transition-all duration-300 overflow-hidden ${
        dragActive ? "border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10" : "border-border hover:border-primary/30"
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
        accept=".csv"
        onChange={(e) => e.target.files && e.target.files[0] && uploadFile(e.target.files[0])}
        className="hidden"
        id="file-upload"
        disabled={uploading}
      />
      <label htmlFor="file-upload" className={`cursor-pointer block p-5 ${uploading ? "cursor-not-allowed" : ""}`}>
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
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getConnectionStatusColor(connectionMode)} shadow-sm`}>
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
                <p className="text-xs text-muted-foreground/60">
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
            "bg-gradient-primary"
          }`}>
            {uploadStatus === "uploading" ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : uploadStatus === "success" ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : uploadStatus === "offline" ? (
              <AlertCircle className="h-6 w-6 text-amber-500" />
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
                  {connectionMode === 'hybrid' ? 'Uploading (Hybrid Mode)...' : 'Processing CSV...'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {currentFileName}
                </p>
                {connectionMode === 'hybrid' && (
                  <p className="text-xs text-amber-500">
                    Using local AI for faster analysis
                  </p>
                )}
              </>
            ) : uploadStatus === "success" ? (
              <>
                <h3 className="text-base font-semibold text-green-500">
                  {connectionMode === 'hybrid' ? 'Upload complete!' : 'Upload complete!'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {connectionMode === 'hybrid' ? 'Using local AI for analysis' : 'Redirecting to your datasets...'}
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
            ) : uploadStatus === "offline" ? (
              <>
                <h3 className="text-base font-semibold text-amber-500">No internet detected</h3>
                <p className="text-xs text-muted-foreground">
                  Install UseClevr AI MEGA to analyze datasets offline
                </p>
                <Button 
                  onClick={() => window.open('/app/settings/preferences', '_blank')} 
                  variant="outline" 
                  className="mt-2"
                >
                  Install AI
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold">
                  Drop your CSV file here
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
                <div className="mt-3 pt-3 border-t border-border/40">
                  <p className="text-xs text-muted-foreground/80">
                    <span className="font-medium text-foreground">CSV</span> files up to 50MB • Larger datasets coming soon
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
  )
}
