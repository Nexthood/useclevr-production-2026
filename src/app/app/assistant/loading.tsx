"use client"

import { Bot } from "lucide-react"

export default function AssistantLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Bot className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading assistant...</p>
      </div>
    </div>
  )
}
