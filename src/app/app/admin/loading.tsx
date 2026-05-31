"use client"

import { Shield } from "lucide-react"

export default function AdminLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Shield className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    </div>
  )
}
