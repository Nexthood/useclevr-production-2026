"use client"

import { Settings2 } from "lucide-react"

export default function SettingsLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Settings2 className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    </div>
  )
}
