"use client"

import * as React from "react"
import { GrokChatPanel } from "@/components/grok-chat-panel"
import { AppPageHeader } from "@/components/layout/app-page-header"

export default function AssistantPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Clevr AI Analyst"
        description="Ask questions about your data."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "AI Analyst" },
        ]}
      />

      <main className="h-[calc(100vh-136px)]">
        <GrokChatPanel />
      </main>
    </div>
  )
}
