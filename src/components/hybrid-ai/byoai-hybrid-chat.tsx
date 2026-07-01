"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Cloud, Loader2, Send, ShieldCheck, Sparkles, Wifi } from "lucide-react"
import * as React from "react"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  providerName?: string
  modelName?: string
  providerStatus?: ProviderStatus
  error?: boolean
}

type ProviderStatus = {
  label: string
  state: "connection_healthy" | "fallback_active" | "provider_unavailable" | "offline_active" | "local_unavailable"
  message: string
  fallbackActive: boolean
  route?: "local" | "cloud" | "none"
}

function providerStatusClassName(state?: ProviderStatus["state"]) {
  if (state === "connection_healthy") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (state === "fallback_active") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (state === "offline_active") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
  if (state === "local_unavailable" || state === "provider_unavailable") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
  return "border-border bg-muted text-muted-foreground"
}

function routeLabel(route?: ProviderStatus["route"]) {
  if (route === "local") return "Local"
  if (route === "cloud") return "Cloud"
  return "Unavailable"
}

export function ByoaiHybridChat() {
  const [inputValue, setInputValue] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ask a question to test your configured Hybrid AI provider. UseClevr will route this through your AI Providers settings.",
      providerName: "UseClevr Hybrid AI",
      modelName: "Provider routing",
      providerStatus: {
        label: "Hybrid AI",
        state: "connection_healthy",
        message: "Ready",
        fallbackActive: false,
        route: "none",
      },
    },
  ])
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = inputValue.trim()
    if (!content || isSending) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    }

    setMessages((current) => [...current, userMessage])
    setInputValue("")
    setIsSending(true)

    try {
      const response = await fetch("/api/hybrid-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage]
            .filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({ role: message.role, content: message.content })),
        }),
      })
      const body = await response.json()
      const answer = String(body.answer || body.content || body.error || "Hybrid AI could not answer.")
      const providerStatus = isProviderStatus(body.providerStatus) ? body.providerStatus : undefined

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer,
          providerName: typeof body.providerName === "string" ? body.providerName : providerStatus?.label,
          modelName: typeof body.modelName === "string" ? body.modelName : undefined,
          providerStatus,
          error: !response.ok || body.success === false,
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Hybrid AI chat failed.",
          providerName: "Hybrid AI",
          modelName: "",
          providerStatus: {
            label: "Hybrid AI",
            state: "provider_unavailable",
            message: "Provider unavailable",
            fallbackActive: false,
            route: "none",
          },
          error: true,
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.providerStatus)

  return (
    <div className="flex min-h-[640px] flex-1 flex-col gap-5 p-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              UseClevr Hybrid AI
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Hybrid AI Chat</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Test your selected AI provider with a normal chat before running business analysis.
            </p>
          </div>
          <ProviderSummary message={latestAssistant} />
        </div>
      </section>

      <Card className="flex min-h-0 flex-1 flex-col border-border bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            Local AI Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-lg border px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-auto max-w-[82%] border-primary/30 bg-primary/10 text-foreground"
                    : message.error
                      ? "mr-auto max-w-[88%] border-red-500/30 bg-red-500/10 text-foreground"
                      : "mr-auto max-w-[88%] border-border bg-background text-foreground"
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {message.providerName || "Hybrid AI"}
                    </span>
                    {message.modelName ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {message.modelName}
                      </span>
                    ) : null}
                    {message.providerStatus ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${providerStatusClassName(message.providerStatus.state)}`}>
                        {message.providerStatus.message}
                      </span>
                    ) : null}
                    {message.providerStatus?.route ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {routeLabel(message.providerStatus.route)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </article>
            ))}
            {isSending ? (
              <div className="mr-auto flex max-w-[88%] items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Hybrid AI is thinking...
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-border p-4">
            <div className="flex min-w-0 gap-2">
              <input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask Hybrid AI..."
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              <Button type="submit" disabled={!inputValue.trim() || isSending} className="gap-2">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              API keys stay server-side. Hybrid AI mode and fallback behavior come from AI Providers settings.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function ProviderSummary({ message }: { message?: ChatMessage }) {
  const status = message?.providerStatus
  return (
    <div className="grid min-w-[280px] gap-2 rounded-lg border border-border bg-background/70 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Provider</span>
        <span className="font-medium text-foreground">{message?.providerName || status?.label || "Not tested"}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Model</span>
        <span className="max-w-[160px] truncate font-medium text-foreground">{message?.modelName || "Waiting for chat"}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Route</span>
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          {status?.route === "local" ? <Wifi className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
          {routeLabel(status?.route)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Status</span>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${providerStatusClassName(status?.state)}`}>
          {status?.message || "Ready"}
        </span>
      </div>
    </div>
  )
}

function isProviderStatus(value: unknown): value is ProviderStatus {
  if (!value || typeof value !== "object") return false
  const status = value as Partial<ProviderStatus>
  return typeof status.label === "string" && typeof status.message === "string" && typeof status.fallbackActive === "boolean"
}
