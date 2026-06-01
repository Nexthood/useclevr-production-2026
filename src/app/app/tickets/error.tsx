"use client"

import { ErrorScreen } from "@/components/ui/error-screen"
import { Ticket } from "lucide-react"

export default function TicketsError({
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
      icon={Ticket}
      title="Tickets unavailable"
      message="Could not load support tickets. Please try again."
    />
  )
}
