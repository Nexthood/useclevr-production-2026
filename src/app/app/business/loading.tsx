"use client"

import { Building2 } from "lucide-react"

export default function BusinessLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Building2 className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading business data...</p>
      </div>
    </div>
  )
}
