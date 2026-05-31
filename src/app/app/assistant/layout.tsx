import { AssistantNav } from "@/components/assistant/assistant-nav"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { Sparkles } from "lucide-react"
import type React from "react"

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <AppPageHeader
        title="AI Analyst"
        description="Ask questions and get insights from your business data."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "AI Analyst" },
        ]}
        icon={Sparkles}
      />
      <AssistantNav />
      {children}
    </div>
  )
}