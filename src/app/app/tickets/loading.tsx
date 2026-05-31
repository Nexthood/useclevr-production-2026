"use client"

import { Ticket } from "lucide-react"

export default function TicketsLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Ticket className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading tickets...</p>
      </div>
    </div>
  )
}
