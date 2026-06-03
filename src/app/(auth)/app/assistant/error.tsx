"use client"

import { ErrorScreen } from "@/components/ui/error-screen"
import { Bot } from "lucide-react"

export default function AssistantError({
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
      icon={Bot}
      title="Assistant unavailable"
      message="Could not load the AI assistant. Please try again."
    />
  )
}
