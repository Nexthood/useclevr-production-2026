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

export function DeleteDatasetButton({ datasetId, label }: { datasetId: string; label?: string }) {
  const router = useRouter()
  const { showNotice } = useNotice()
  const [open, setOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const handleDelete = async () => {
    if (isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/datasets/${encodeURIComponent(datasetId)}`, {
        method: "DELETE",
      })
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string; deletedIds?: unknown }

      if (!response.ok) {
        throw new Error(result.error || "The dataset could not be deleted.")
      }

      const deletedIds = Array.isArray(result.deletedIds) ? result.deletedIds : []
      if (!deletedIds.includes(datasetId)) {
        throw new Error("The server did not confirm that this dataset was deleted.")
      }

      setOpen(false)
      window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
      router.refresh()
      showNotice({
        type: "success",
        title: "Dataset deleted.",
        message: result.message || "The selected dataset was removed.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "The dataset could not be deleted."
      setDeleteError(message)
      showNotice({
        type: "error",
        title: "Dataset was not deleted.",
        message,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const closeDialog = () => {
    if (isDeleting) return
    setOpen(false)
    setDeleteError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeDialog())}>
      <Button
        variant="ghost"
        size={label ? "sm" : "icon"}
        disabled={isDeleting}
        onClick={() => {
          setDeleteError(null)
          setOpen(true)
        }}
        className={label ? "text-muted-foreground hover:text-destructive" : "h-8 w-8 text-muted-foreground hover:text-destructive"}
        aria-label="Delete dataset"
      >
        {label ? (
          <>
            <Trash2 className="mr-2 h-4 w-4" />
            {label}
          </>
        ) : (
          "Delete"
        )}
      </Button>
      <DialogContent className="max-w-[560px]">
        <DialogHeader className="pr-8">
          <DialogTitle>Delete dataset?</DialogTitle>
          <DialogDescription>
            1 selected dataset will be permanently removed, including rows, generated insights, linked reports, activity references, retrieval documents, and stored upload files where available.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          This action cannot be undone. Only this selected dataset will be deleted.
        </div>
        {deleteError && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {deleteError}
          </div>
        )}
        <DialogFooter className="pt-5">
          <Button type="button" variant="outline" disabled={isDeleting} onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDelete}
            className="min-w-36"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : "Delete dataset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
