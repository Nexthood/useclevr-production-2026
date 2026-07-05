"use client"

import { deleteDataset } from "@/app/actions/datasets"
import { Button } from "@/components/ui/button"
import { USAGE_REFRESH_EVENT } from "@/components/ui/usage-monitor"
import { useRouter } from "next/navigation"

export function DeleteDatasetButton({ datasetId, label }: { datasetId: string; label?: string }) {
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this dataset?")) return

    const result = await deleteDataset(datasetId)

    if (result.success) {
      window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
      router.refresh()
    } else {
      alert(result.error)
    }
  }

  return (
    <Button
      variant="ghost"
      size={label ? "sm" : "icon"}
      onClick={handleDelete}
      className={label ? "text-muted-foreground hover:text-destructive" : "h-8 w-8 text-muted-foreground hover:text-destructive"}
      aria-label="Delete dataset"
    >
      {label || "Delete"}
    </Button>
  )
}
