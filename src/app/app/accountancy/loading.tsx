"use client"

import { Calculator } from "lucide-react"

export default function AccountancyLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Calculator className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading accountancy...</p>
      </div>
    </div>
  )
}
