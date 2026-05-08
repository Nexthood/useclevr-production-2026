"use client"

import * as React from "react"
import { Loader2, Send, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { debugError } from "@/lib/debug"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

type GrokChatPanelProps = {
  isOpen: boolean
  onClose: () => void
  datasetId: string
  datasetName: string
  rowCount: number
  columnCount: number
  data?: unknown[]
  columns?: string[]
  analysis?: unknown
}

const quickActions = [
  "Summarize the key findings",
  "What should I investigate next?",
  "Explain the biggest risk",
  "Draft recommended actions",
]

export function GrokChatPanel({
  isOpen,
  onClose,
  datasetId,
  datasetName,
  rowCount,
  columnCount,
  columns = [],
  analysis,
}: GrokChatPanelProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [inputValue, setInputValue] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  if (!isOpen) return null

  const sendMessage = async (text?: string) => {
    const content = (text || inputValue).trim()
    if (!content || isLoading) return

    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-user`, role: "user", content },
    ])
    setInputValue("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          datasetId,
          context: { datasetName, rowCount, columnCount, columns, analysis },
        }),
      })

      if (!response.ok) {
        throw new Error("Chat request failed")
      }

      const data = await response.json()
      const assistantText = data.response || data.content || "I could not generate a response for that request."

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-assistant`, role: "assistant", content: assistantText },
      ])
    } catch (error) {
      debugError("[GrokChatPanel] Chat failed:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant-error`,
          role: "assistant",
          content: "I could not analyze that right now. Please try again in a moment.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="flex h-[min(760px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-primary">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-foreground">Clevr AI Analyst</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {datasetName} • {rowCount.toLocaleString()} rows • {columnCount} columns
                </p>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close chat">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center text-center">
              <Sparkles className="mb-4 h-10 w-10 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Ask about this dataset</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Use verified dataset context to explore findings, risks, and next actions.
              </p>
              <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => sendMessage(action)}
                    className="min-h-10 rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 sm:p-5">
          {messages.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {quickActions.slice(0, 3).map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {action}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this analysis..."
              className="h-11 pr-12"
              disabled={isLoading}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => sendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

