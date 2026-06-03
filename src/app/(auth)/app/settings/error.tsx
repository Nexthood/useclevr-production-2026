"use client"

import { ErrorScreen } from "@/components/ui/error-screen"
import { Settings2 } from "lucide-react"

export default function SettingsError({
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
      icon={Settings2}
      title="Settings unavailable"
      message="Could not load your settings. Please try again."
    />
  )
}
