"use client"

import { ErrorScreen } from "@/components/ui/error-screen"
import { Building2 } from "lucide-react"

export default function BusinessError({
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
      icon={Building2}
      title="Business data unavailable"
      message="Could not load business data. Please try again."
    />
  )
}
