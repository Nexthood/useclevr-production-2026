"use client"

import { AiAssistantWorkspace } from "@/components/chat/ai-assistant-workspace"
import { UseClevrHybridAiChatPanel } from "@/components/hybrid-ai/useclevr-hybrid-ai-chat-panel"

export function AssistantPageClient({
  subscriptionTier,
  userRole,
}: {
  subscriptionTier: string
  userRole?: string | null
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <UseClevrHybridAiChatPanel compact subscriptionTier={subscriptionTier} userRole={userRole} />
      <div className="flex min-h-[560px] flex-1 overflow-hidden rounded-lg border border-border bg-background">
        <AiAssistantWorkspace />
      </div>
    </div>
  )
}
