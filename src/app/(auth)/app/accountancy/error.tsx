"use client"

import { ErrorScreen } from "@/components/ui/error-screen"
import { Calculator } from "lucide-react"

export default function AccountancyError({
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
      icon={Calculator}
      title="Accountancy server issue"
      message="A server failure prevented accountancy data from loading. Please try again."
    />
  )
}
