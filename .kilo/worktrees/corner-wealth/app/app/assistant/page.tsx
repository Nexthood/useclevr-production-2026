import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, MessageSquare } from "lucide-react"

export const metadata = {
  title: "AI Assistant - UseClevr",
  description: "Ask questions about your data",
}

export default function AssistantPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="border-b border-border/40 bg-background">
        <div className="flex h-16 items-center px-6">
          <h1 className="text-2xl font-bold">AI Assistant</h1>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto h-full flex items-center justify-center">
          <Card className="p-12 max-w-md">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Start a conversation</h3>
                <p className="text-muted-foreground">Ask me anything about your datasets</p>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <div className="border-t border-border/40 bg-background p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input placeholder="Ask a question about your data..." className="flex-1" />
          <Button size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
