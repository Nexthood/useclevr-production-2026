"use client"

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function BatchDeleteButton({
  datasetIds,
  onDeleted,
}: {
  datasetIds: string[]
  onDeleted?: () => void
}) {
  const router = useRouter()

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${datasetIds.length} selected dataset(s)?`)) return

    try {
      await fetch("/api/datasets/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: datasetIds }),
      })
      onDeleted?.()
      router.refresh()
    } catch {
      alert("Failed to delete datasets")
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleBulkDelete}
      className="border-destructive text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Delete {datasetIds.length}
    </Button>
  )
}