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
      const response = await fetch("/api/datasets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetIds }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete datasets")
      }
      onDeleted?.()
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete datasets")
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
