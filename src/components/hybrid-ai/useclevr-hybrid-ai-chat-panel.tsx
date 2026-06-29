"use client"

import { Button } from "@/components/ui/button"
import {
  askUseClevrHelper,
  getUseClevrHelperStatus,
  type UseClevrHelperStatus,
} from "@/lib/hybrid-ai/helper-bridge"
import { ShieldCheck, Sparkles } from "lucide-react"
import * as React from "react"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

function statusClassName(state: UseClevrHelperStatus["state"]) {
  if (state === "connected") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (state === "setup") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
}

export function UseClevrHybridAiChatPanel({
  datasetContext,
  compact = false,
}: {
  datasetContext?: object
  compact?: boolean
}) {
  const [status, setStatus] = React.useState<UseClevrHelperStatus>({
    state: "offline",
    message: "UseClevr Helper is not running",
    connected: false,
    privateEngineReady: false,
  })
  const [inputValue, setInputValue] = React.useState("")
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isAsking, setIsAsking] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refreshStatus = React.useCallback(async () => {
    setStatus(await getUseClevrHelperStatus())
  }, [])

  React.useEffect(() => {
    void refreshStatus()
    const timer = window.setInterval(() => void refreshStatus(), 8000)
    return () => window.clearInterval(timer)
  }, [refreshStatus])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = inputValue.trim()
    if (!message || isAsking) return

    setError(null)
    setInputValue("")
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: message }])
    setIsAsking(true)

    try {
      const latestStatus = await getUseClevrHelperStatus()
      setStatus(latestStatus)
      if (latestStatus.state === "offline") {
        setError("UseClevr Helper is not running. Start the helper or download it again.")
        return
      }
      if (latestStatus.state === "setup") {
        setError("Private AI engine needs setup before private analysis can run.")
        return
      }

      const response = await askUseClevrHelper(message, datasetContext)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer || "Private analysis completed, but no answer was returned.",
        },
      ])
    } catch {
      setError("UseClevr Helper is not running. Start the helper or download it again.")
      setStatus({
        state: "offline",
        message: "UseClevr Helper is not running",
        connected: false,
        privateEngineReady: false,
      })
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">UseClevr Hybrid AI</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Private analysis on your device</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassName(status.state)}`}>
            {status.message}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Files stay on your device when Hybrid AI is active. UseClevr Helper processes private analysis locally.
        </p>
      </div>

      {!compact && messages.length > 0 && (
        <div className="max-h-72 space-y-3 overflow-y-auto p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-md border px-3 py-2 text-sm leading-6 ${
                message.role === "user"
                  ? "ml-auto max-w-[85%] border-primary/30 bg-primary/10"
                  : "border-border bg-background"
              }`}
            >
              {message.role === "assistant" && (
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Private AI Analysis
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 p-4">
        {error && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {error}
          </div>
        )}
        <div className="flex min-w-0 gap-2">
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask about your data privately..."
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <Button type="submit" disabled={!inputValue.trim() || isAsking} className="shrink-0">
            {isAsking ? "Asking..." : "Ask privately"}
          </Button>
        </div>
        {status.state === "offline" && (
          <p className="text-xs text-muted-foreground">Start the helper or download it again.</p>
        )}
      </form>
    </section>
  )
}
