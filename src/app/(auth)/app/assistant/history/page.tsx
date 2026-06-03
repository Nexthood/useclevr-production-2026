"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { History } from "lucide-react"
import Link from "next/link"

export default function AssistantHistoryPage() {
  return (
    <div className="p-6">
      <Card className="p-12">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-primary mx-auto flex items-center justify-center">
            <History className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">Question history</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Past conversations will appear here after you ask questions in the chat.
            </p>
          </div>
          <Link href="/app/assistant" className="inline-block">
            <Button size="sm">Go to chat</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}