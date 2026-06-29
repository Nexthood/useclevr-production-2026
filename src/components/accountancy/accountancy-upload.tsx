"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataProcessingFlow } from "@/components/ui/data-processing-flow"
import { useNotice } from "@/components/ui/notice-bar"
import { UpgradeModal } from "@/components/shared/upgrade-modal"
import type { ConnectionMode } from "@/hooks/use-connection-status"
import { getConnectionDescription, getConnectionMessage, useConnectionStatus } from "@/hooks/use-connection-status"
import { useToast } from "@/hooks/use-toast"
import { debugError, debugLog } from "@/lib/utils/debug"
import { AlertCircle, CheckCircle2, Cloud, Cpu, FileText, Loader2, Receipt, Wifi, WifiOff } from "lucide-react"
import * as React from "react"

type UploadType = "csv" | "excel" | "pdf" | "receipt" | "bank"

interface UploadedFile {
  id: string
  name: string
  type: UploadType
  size: number
  status: "uploading" | "processing" | "extracted" | "categorized" | "error"
  extractedData?: Record<string, unknown>[]
  category?: string
}

export function AccountancyUpload({
  onFilesChange,
  packageReady,
}: {
  onFilesChange?: (files: UploadedFile[]) => void
  packageReady?: boolean
}) {
  const [uploading, setUploading] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [uploadStatus, setUploadStatus] = React.useState<"idle" | "uploading" | "success" | "error" | "offline">("idle")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [currentFileName, setCurrentFileName] = React.useState("")
  const [processingStep, setProcessingStep] = React.useState(0)
const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([])
   const [selectedType, setSelectedType] = React.useState<UploadType>("csv")
   const [showUpgradeModal, setShowUpgradeModal] = React.useState(false)
   const [upgradeModalData, setUpgradeModalData] = React.useState<{currentCount: number, limit: number, planName: string} | null>(null)
   const [upgradeModalCopy, setUpgradeModalCopy] = React.useState<{title?: string, description?: string, usageLabel?: string}>({})
   const { toast } = useToast()
   const { showNotice } = useNotice()

  const connectionStatus = useConnectionStatus()
  const connectionMode = connectionStatus.mode as string as ConnectionMode
  const isCheckingConnection = connectionStatus.isChecking
  const checkConnection = connectionStatus.checkConnection
  const wasOffline = connectionStatus.wasOffline

  const isOffline = connectionMode === "offline"
  const _isHybrid = connectionMode === "hybrid"

  const getConnectionIcon = (mode: ConnectionMode) => {
    switch (mode) {
      case "online":
        return <Cloud className="h-4 w-4 text-blue-500" />
      case "hybrid":
        return <Cpu className="h-4 w-4 text-amber-500" />
      case "offline":
        return <WifiOff className="h-4 w-4 text-red-500" />
    }
  }

  const getConnectionStatusColor = (mode: ConnectionMode) => {
    switch (mode) {
      case "online":
        return "bg-blue-500/10 border-blue-500/30"
      case "hybrid":
        return "bg-amber-500/10 border-amber-500/30"
      case "offline":
        return "bg-red-500/10 border-red-500/30"
    }
  }

  React.useEffect(() => {
    const handleOnline = () => processOfflineQueue()
    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [])

  async function processOfflineQueue() {
    const queue = JSON.parse(localStorage.getItem("useclevr_accountancy_queue") || "[]")
    if (queue.length > 0) {
      toast({
        title: "Connection restored",
        description: `${queue.length} queued file(s) need to be re-uploaded.`,
      })
      localStorage.removeItem("useclevr_accountancy_queue")
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

  const validateFile = (file: File): boolean => {
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      setErrorMessage("File size must be less than 50MB. For larger files, please split before uploading.")
      return false
    }

    const validExtensions: Record<UploadType, string[]> = {
      csv: [".csv"],
      excel: [".xlsx", ".xls"],
      pdf: [".pdf"],
      receipt: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
      bank: [".csv", ".xlsx", ".xls", ".ofx", ".qif"],
    }

    const extensions = validExtensions[selectedType]
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase()

    if (!extensions.includes(fileExt)) {
      setErrorMessage(`Please upload a valid ${selectedType} file (${extensions.join(", ")})`)
      return false
    }

    return true
  }

  const simulateExtraction = async (file: File, type: UploadType): Promise<Record<string, unknown>[]> => {
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const mockData: Record<string, unknown>[] = []
    const rowCount = Math.min(Math.max(3, Math.floor(file.size / 1024)), 15)

    for (let i = 0; i < rowCount; i++) {
      mockData.push({
        id: i + 1,
        date: new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
        description: `Sample transaction ${i + 1}`,
        amount: (Math.random() * 1000).toFixed(2),
        category: ["Office supplies", "Travel", "Software", "Marketing", "Payroll"][i % 5],
        tax: type === "receipt" || type === "bank" ? (Math.random() * 20).toFixed(2) : "0.00",
      })
    }

    return mockData
  }

  const categorizeTransactions = (data: Record<string, unknown>[]): Record<string, unknown>[] => {
    return data.map((row) => ({
      ...row,
      category: (row.category as string) || "Uncategorized",
      vatApplicable: parseFloat(row.amount as string) > 50 && parseFloat(row.tax as string) > 0,
    }))
  }

  const uploadFile = async (file: File) => {
    if (!validateFile(file)) {
      setUploadStatus("error")
      setProcessingStep(0)
      return
    }

    setCurrentFileName(file.name)
    setUploading(true)
    setUploadStatus("uploading")
    setUploadProgress(0)
    setErrorMessage("")

    let progressInterval: NodeJS.Timeout | undefined

    progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90))
    }, 200)

    const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", selectedType)

      debugLog("[ACCOUNTANCY-UPLOAD] Starting upload for file:", file.name)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (progressInterval) clearInterval(progressInterval)

      if (response.ok) {
        setUploadProgress(100)
        setUploadStatus("success")
        setProcessingStep(5)

        const extractedData = await simulateExtraction(file, selectedType)
        const categorizedData = categorizeTransactions(extractedData)

        const newFile: UploadedFile = {
          id: fileId,
          name: file.name,
          type: selectedType,
          size: file.size,
          status: "categorized",
          extractedData: categorizedData,
          category: selectedType === "receipt" ? "Receipts/Invoices" : selectedType === "bank" ? "Bank exports" : selectedType === "pdf" ? "Documents" : selectedType === "excel" ? "Spreadsheets" : "CSV data",
        }

        const updatedFiles = [...uploadedFiles, newFile]
        setUploadedFiles(updatedFiles)
        onFilesChange?.(updatedFiles)

        showNotice({
          type: "success",
          title: "File uploaded and processed",
          message: `${file.name}: ${categorizedData.length} transactions categorized`,
        })

        setTimeout(() => {
          setUploadStatus("idle")
          setProcessingStep(0)
          setUploadProgress(0)
        }, 2000)
      } else {
        const result = await response.json().catch(() => ({ error: "Upload failed" }))
        const uploadError = result.error || result.message || "Upload failed"

        // Check for dataset limit error and show upgrade modal
        if (result.datasetLimit?.limitReached) {
          setUpgradeModalData({
            currentCount: result.datasetLimit.currentCount,
            limit: result.datasetLimit.limit,
            planName: result.datasetLimit.planName || "Free",
          })
          setUpgradeModalCopy({})
          setShowUpgradeModal(true)
        } else if (result.usage?.limitReached) {
          setUpgradeModalData({
            currentCount: result.usage.analysisCount || 2,
            limit: result.usage.total || 2,
            planName: "Free",
          })
          setUpgradeModalCopy({
            title: "Analyst Credits Used",
            description: "You have used your 2 included analyst credits. Upgrade to continue uploading, analyzing, and generating reports.",
            usageLabel: "analyst credits used",
          })
          setShowUpgradeModal(true)
        }

        if (isOffline) {
          setUploadStatus("offline")
          const queue = JSON.parse(localStorage.getItem("useclevr_accountancy_queue") || "[]")
          queue.push({ file: { name: file.name, size: file.size }, timestamp: Date.now() })
          localStorage.setItem("useclevr_accountancy_queue", JSON.stringify(queue))
          toast({
            title: "Offline mode active",
            description: "No internet detected - start UseClevr Helper for private analysis.",
          })
        } else {
          setUploadStatus("error")
          setErrorMessage(uploadError)
          setProcessingStep(0)
        }
      }
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval)
      debugError("Upload failed:", error)

      if (isOffline) {
        setUploadStatus("offline")
        const queue = JSON.parse(localStorage.getItem("useclevr_accountancy_queue") || "[]")
        queue.push({ file: { name: file.name, size: file.size }, timestamp: Date.now() })
        localStorage.setItem("useclevr_accountancy_queue", JSON.stringify(queue))
        toast({
          title: "Offline mode active",
          description: "No internet detected - start UseClevr Helper for private analysis.",
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

  const fileTypeOptions: { type: UploadType; label: string; icon: React.ReactNode; accept: string }[] = [
    { type: "csv", label: "CSV", icon: <FileText className="h-4 w-4" />, accept: ".csv" },
    { type: "excel", label: "Excel", icon: <FileText className="h-4 w-4" />, accept: ".xlsx,.xls" },
    { type: "pdf", label: "PDF", icon: <FileText className="h-4 w-4" />, accept: ".pdf" },
    { type: "receipt", label: "Receipts/Invoices", icon: <Receipt className="h-4 w-4" />, accept: ".pdf,.jpg,.jpeg,.png,.webp" },
    { type: "bank", label: "Bank exports", icon: <FileText className="h-4 w-4" />, accept: ".csv,.xlsx,.xls,.ofx,.qif" },
  ]

  const selectedOption = fileTypeOptions.find((opt) => opt.type === selectedType)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {fileTypeOptions.map((option) => (
          <button
            key={option.type}
            onClick={() => setSelectedType(option.type)}
            className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-xs font-medium transition-all ${
              selectedType === option.type
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>

      <Card
        className={`relative border-2 border-dashed transition-all duration-300 overflow-hidden ${
          dragActive
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
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none opacity-50" />

        <input
          type="file"
          accept={selectedOption?.accept || "*"}
          onChange={(e) => e.target.files && e.target.files[0] && uploadFile(e.target.files[0])}
          className="hidden"
          id={`accountancy-upload-${selectedType}`}
          disabled={uploading}
        />
        <label
          htmlFor={`accountancy-upload-${selectedType}`}
          className={`cursor-pointer block p-5 sm:p-7 ${uploading ? "cursor-not-allowed" : ""}`}
        >
          <div className="flex flex-col items-center gap-3">
            {uploading && processingStep > 0 && (
              <div className="mb-4">
                <DataProcessingFlow currentStep={processingStep} />
              </div>
            )}

            {uploadStatus === "idle" && !uploading && (
              <div className="flex flex-col items-center gap-0.5">
                <div
                  className={`flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 shadow-sm sm:px-4 ${getConnectionStatusColor(connectionMode)}`}
                >
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
                  <p className="px-2 text-center text-xs text-muted-foreground/70">{getConnectionDescription(connectionMode)}</p>
                )}
              </div>
            )}

            {wasOffline && uploadStatus === "idle" && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-amber-500/10 border-amber-500/30 shadow-sm">
                <Wifi className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-500">Connection restored – processing queued uploads</span>
              </div>
            )}

            <div
              className={`h-12 w-12 rounded-lg flex items-center justify-center transition-all ${
                uploadStatus === "uploading"
                  ? "bg-primary/10"
                  : uploadStatus === "success"
                    ? "bg-green-500/10"
                    : uploadStatus === "offline"
                      ? "bg-amber-500/10"
                      : "bg-gradient-primary"
              }`}
            >
              {uploadStatus === "uploading" ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : uploadStatus === "success" ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : uploadStatus === "offline" ? (
                <AlertCircle className="h-6 w-6 text-amber-500" />
              ) : uploadStatus === "error" ? (
                <AlertCircle className="h-6 w-6 text-destructive" />
              ) : (
                <Receipt className="h-6 w-6 text-white" />
              )}
            </div>

            <div className="text-center space-y-1.5">
              {uploadStatus === "uploading" ? (
                <>
                  <h3 className="text-base font-semibold">Processing {selectedType.toUpperCase()}...</h3>
                  <p className="text-xs text-muted-foreground">{currentFileName}</p>
                </>
              ) : uploadStatus === "success" ? (
                <>
                  <h3 className="text-base font-semibold text-green-500">Upload complete!</h3>
                  <p className="text-xs text-muted-foreground">Extracting and categorizing transactions...</p>
                </>
              ) : uploadStatus === "error" ? (
                <>
                  <h3 className="text-base font-semibold text-destructive">Upload failed</h3>
                  <p className="text-xs text-muted-foreground">{errorMessage || "Please try again"}</p>
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
                  <p className="text-xs text-muted-foreground">Start UseClevr Helper for private analysis</p>
                  <Button
                    onClick={() => window.open("/app/settings/preferences", "_blank")}
                    variant="outline"
                    className="mt-2"
                  >
                    Open helper settings
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold">
                    Drop {selectedType === "receipt" ? "receipts/invoices" : selectedType === "bank" ? "bank exports" : selectedType.toUpperCase()} here
                  </h3>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                  <div className="mt-3 border-t border-border/40 pt-3">
                    <p className="text-xs text-muted-foreground/80">
                      <span className="font-medium text-foreground">{selectedOption?.label || selectedType.toUpperCase()}</span> files up to 50MB
                    </p>
                  </div>
                </>
              )}
            </div>

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

      {uploadedFiles.length > 0 && (
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3">Uploaded documents ({uploadedFiles.length})</h3>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.type.toUpperCase()} • {file.extractedData?.length || 0} transactions • {file.category}
                    </p>
                  </div>
                </div>
                <span className="inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                  Ready
                </span>
              </div>
            ))}
          </div>
          {packageReady && (
            <p className="text-xs text-muted-foreground mt-3">
              {uploadedFiles.length} document(s) ready for bookkeeping summary and export.
            </p>
          )}
        </Card>
      )}
      {showUpgradeModal && upgradeModalData && (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          currentPlan={upgradeModalData.planName}
          currentCount={upgradeModalData.currentCount}
          limit={upgradeModalData.limit}
          title={upgradeModalCopy.title}
          description={upgradeModalCopy.description}
          usageLabel={upgradeModalCopy.usageLabel}
        />
      )}
    </div>
  )
}
