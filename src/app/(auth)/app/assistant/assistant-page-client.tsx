"use client"

import { AiAssistantWorkspace } from "@/components/chat/ai-assistant-workspace"
import { UseClevrHybridAiChatPanel } from "@/components/hybrid-ai/useclevr-hybrid-ai-chat-panel"
import { Button } from "@/components/ui/button"
import { getHybridAiEntitlement } from "@/lib/hybrid-ai/features"
import { LockKeyhole } from "lucide-react"
import Link from "next/link"

export function AssistantPageClient({
  subscriptionTier,
  userRole,
}: {
  subscriptionTier: string
  userRole?: string | null
}) {
  const entitlement = getHybridAiEntitlement(subscriptionTier, userRole)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <UseClevrHybridAiChatPanel compact subscriptionTier={subscriptionTier} userRole={userRole} />
      {entitlement.canUseLite ? (
        <div className="flex min-h-[560px] flex-1 overflow-hidden rounded-lg border border-border bg-background">
          <AiAssistantWorkspace />
        </div>
      ) : (
        <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-lg border border-border bg-card p-6">
          <div className="max-w-md text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">Hybrid AI Lite required</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The AI Assistant uses Hybrid AI provider routing, dataset context, and privacy controls. Upgrade to Pro or Business to start.
            </p>
            <Link href="/app/settings/checkout?plan=pro_monthly" className="mt-5 inline-block">
              <Button>Upgrade to Pro</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
