"use client"

import { AiAssistantWorkspace } from "@/components/chat/ai-assistant-workspace"
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

      <main>
        <AiAssistantWorkspace />
      </main>
    </div>
  )
}
