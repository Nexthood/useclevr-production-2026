"use client"

import { ErrorScreen } from "@/components/ui/error-screen"
import { Database } from "lucide-react"

export default function DatasetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      icon={Database}
      title="Datasets unavailable"
      message="Could not load your datasets. This might be a database connection issue."
    />
  )
}
