"use client"

import { ErrorScreen } from "@/components/ui/error-screen"
import { Shield } from "lucide-react"

export default function AdminError({
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
      icon={Shield}
      title="Admin panel unavailable"
      message="Could not load the admin panel. Please try again."
    />
  )
}
