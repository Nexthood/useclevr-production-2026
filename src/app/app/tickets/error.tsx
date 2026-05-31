"use client"

import { Button } from "@/components/ui/button"
import { debugError } from "@/lib/utils/debug"
import { Ticket } from "lucide-react"
import { useEffect } from "react"

export default function TicketsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { debugError("Tickets error:", error) }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <Ticket className="h-12 w-12 mx-auto text-destructive" />
        <h1 className="text-3xl font-bold">Tickets unavailable</h1>
        <p className="text-muted-foreground">
          Could not load support tickets. Please try again.
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>Refresh page</Button>
        </div>
      </div>
    </div>
  )
}
