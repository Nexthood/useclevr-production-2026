"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteDataset } from "@/app/actions/datasets"
import { useRouter } from "next/navigation"

export function DeleteDatasetButton({ datasetId }: { datasetId: string }) {
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this dataset?")) return

    const result = await deleteDataset(datasetId)

    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || "Failed to delete dataset")
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
