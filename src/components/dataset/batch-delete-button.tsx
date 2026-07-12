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
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

export type BatchDeleteResult = {
  ok: boolean
  deletedIds: string[]
  failed: { datasetId: string; reason: string }[]
  deletedCount?: number
  message?: string
}

export function BatchDeleteButton({
  datasetIds,
  onDeleted,
}: {
  datasetIds: string[]
  onDeleted?: (result: BatchDeleteResult) => void
}) {
  const router = useRouter()
  const { showNotice } = useNotice()
  const [open, setOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const selectedCount = datasetIds.length
  const deleteLabel = selectedCount === 1 ? "Delete dataset" : "Delete datasets"

  const handleBulkDelete = async () => {
    if (selectedCount === 0 || isDeleting) return

    setIsDeleting(true)
    try {
      const response = await fetch("/api/datasets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetIds }),
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
      }

      onDeleted?.(deleteResult)
      window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
      router.refresh()
      setOpen(false)

      if (deleteResult.failed.length > 0) {
        showNotice({
          type: "info",
          title: "Some datasets were not deleted.",
          message: `${deleteResult.deletedIds.length} deleted. ${deleteResult.failed.length} still need attention.`,
        })
      } else {
        showNotice({
          type: "success",
          title: selectedCount === 1 ? "Dataset deleted." : "Datasets deleted.",
          message: deleteResult.message || `${deleteResult.deletedIds.length} selected dataset${deleteResult.deletedIds.length === 1 ? "" : "s"} removed.`,
        })
      }
    } catch (error) {
      showNotice({
        type: "error",
        title: "Datasets were not deleted.",
        message: error instanceof Error ? error.message : "The selected datasets could not be deleted.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isDeleting && setOpen(nextOpen)}>
      <Button
        variant="outline"
        size="sm"
        disabled={selectedCount === 0 || isDeleting}
        onClick={() => setOpen(true)}
        className="border-destructive text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {isDeleting ? "Deleting..." : `Delete ${selectedCount}`}
      </Button>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle>{deleteLabel}?</DialogTitle>
          <DialogDescription>
            This will permanently remove {selectedCount} selected dataset{selectedCount === 1 ? "" : "s"}, including rows, generated insights, linked reports, activity references, and stored upload files where available.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          This action cannot be undone. Only the selected dataset{selectedCount === 1 ? "" : "s"} will be deleted.
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={selectedCount === 0 || isDeleting}
            onClick={handleBulkDelete}
          >
            {isDeleting ? "Deleting..." : deleteLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
