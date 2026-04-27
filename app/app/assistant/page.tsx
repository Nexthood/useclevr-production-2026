"use client"

import * as React from "react"
import { Sparkles, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GrokChatPanel } from "@/components/grok-chat-panel"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AssistantPage() {
  return (
    <div className="min-h-screen bg-background pl-10">
      {/* Header */}
      <header className="border-b border-border bg-card h-16">
        <div className="flex h-16 items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-4">
            <Link href="/app">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Clevr AI Analyst</h1>
                <p className="text-meta text-muted-foreground">Ask questions about your data</p>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="h-[calc(100vh-64px)]">
        <GrokChatPanel />
      </main>
    </div>
  )
}
