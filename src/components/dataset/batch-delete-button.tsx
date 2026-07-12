"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useNotice } from "@/components/ui/notice-bar"
import { USAGE_REFRESH_EVENT } from "@/components/ui/usage-monitor"
import { Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

export type BatchDeleteResult = {
  ok: boolean
  deletedIds: string[]
  failed: { datasetId: string; reason: string }[]
  deletedCount?: number
  message?: string
  storage?: {
    deleted: string[]
    missingOrFailed: { datasetId: string; storageKey: string; reason: string }[]
  }
}

export function BatchDeleteButton({
  datasetIds,
  onDeleted,
  onResetSelection,
}: {
  datasetIds: string[]
  onDeleted?: (result: BatchDeleteResult) => void
  onResetSelection?: () => void
}) {
  const router = useRouter()
  const { showNotice } = useNotice()
  const [open, setOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [pendingIds, setPendingIds] = React.useState<string[]>([])
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const selectedCount = datasetIds.length
  const pendingCount = pendingIds.length || selectedCount
  const pendingDeleteLabel = pendingCount === 1 ? "Delete dataset" : "Delete datasets"

  const handleBulkDelete = async () => {
    const idsToDelete = pendingIds.length > 0 ? pendingIds : datasetIds
    if (idsToDelete.length === 0 || isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch("/api/datasets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetIds: idsToDelete }),
      })
      const result = await response.json().catch(() => ({})) as Partial<BatchDeleteResult> & { error?: string }
      if (!response.ok) {
        throw new Error(result.error || "The selected datasets could not be deleted.")
      }
      const deleteResult: BatchDeleteResult = {
        ok: Boolean(result.ok),
        deletedIds: Array.isArray(result.deletedIds) ? result.deletedIds : [],
        failed: Array.isArray(result.failed) ? result.failed : [],
        deletedCount: result.deletedCount,
        message: result.message,
        storage: isStorageResult(result.storage) ? result.storage : undefined,
      }

      onDeleted?.(deleteResult)
      window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
      router.refresh()

      if (deleteResult.failed.length > 0) {
        setOpen(false)
        showNotice({
          type: "info",
          title: "Some datasets were not deleted.",
          message: `${deleteResult.deletedIds.length} deleted. ${deleteResult.failed.length} still need attention.`,
        })
      } else {
        setOpen(false)
        setPendingIds([])
        onResetSelection?.()
        showNotice({
          type: deleteResult.storage?.missingOrFailed?.length ? "info" : "success",
          title: idsToDelete.length === 1 ? "Dataset deleted." : "Datasets deleted.",
          message: deleteResult.message || `${deleteResult.deletedIds.length} selected dataset${deleteResult.deletedIds.length === 1 ? "" : "s"} removed.`,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The selected datasets could not be deleted."
      setDeleteError(message)
      showNotice({
        type: "error",
        title: "Datasets were not deleted.",
        message,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const openDialog = () => {
    if (selectedCount === 0 || isDeleting) return
    setPendingIds(datasetIds)
    setDeleteError(null)
    setOpen(true)
  }

  const closeDialog = () => {
    if (isDeleting) return
    setOpen(false)
    setPendingIds([])
    setDeleteError(null)
    onResetSelection?.()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? openDialog() : closeDialog())}>
      <Button
        variant="outline"
        size="sm"
        disabled={selectedCount === 0 || isDeleting}
        onClick={openDialog}
        className="border-destructive text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {isDeleting ? "Deleting..." : `Delete ${selectedCount}`}
      </Button>
      <DialogContent className="max-w-[560px]">
        <DialogHeader className="pr-8">
          <DialogTitle>{pendingCount === 1 ? "Delete dataset?" : "Delete datasets?"}</DialogTitle>
          <DialogDescription>
            {pendingCount} selected dataset{pendingCount === 1 ? "" : "s"} will be permanently removed, including rows, generated insights, linked reports, activity references, retrieval documents, and stored upload files where available.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          This action cannot be undone. Only the selected dataset{pendingCount === 1 ? "" : "s"} will be deleted.
        </div>
        {deleteError && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {deleteError}
          </div>
        )}
        <DialogFooter className="pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={closeDialog}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pendingCount === 0 || isDeleting}
            onClick={handleBulkDelete}
            className="min-w-36"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : pendingDeleteLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function isStorageResult(value: unknown): value is NonNullable<BatchDeleteResult["storage"]> {
  if (!value || typeof value !== "object") return false
  const storage = value as { deleted?: unknown; missingOrFailed?: unknown }
  return Array.isArray(storage.deleted) && Array.isArray(storage.missingOrFailed)
}
