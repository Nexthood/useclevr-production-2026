"use client"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn } from "@/components/ui/data-table"
import { debugError } from "@/lib/utils/debug"
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Info,
  Download,
  Repeat,
  X,
} from "lucide-react"
import * as React from "react"

type DatasetOption = {
  id: string
  name: string
  createdAt?: string | null
}

type AssistantMessage = {
  id: string
  traceId?: string
  role: "user" | "assistant"
  content: string
  insight?: string
  explanation?: string
  recommendation?: string
  data?: Record<string, unknown>[]
  chartType?: string
  providerName?: string
  modelName?: string
  providerStatus?: ProviderStatus
  privacyWarning?: string | null
  error?: string
  errorCode?: string
}

type ProviderStatus = {
  label: string
  state: "connection_healthy" | "fallback_active" | "provider_unavailable" | "offline_active" | "local_unavailable"
  message: string
  fallbackActive: boolean
  route?: "local" | "cloud" | "direct" | "none"
}

type HistoryEntry = {
  id: string
  prompt: string
  response: string
  providerName: string
  modelName: string
  createdAt: string
  feedback: string | null
}

const ACTIVE_DATASET_ID_KEY = "useclevr_active_dataset_id"

const FALLBACK_SUGGESTIONS = [
  "What are the key insights in this dataset?",
  "What are the top 10 records by value?",
  "Which categories perform best?",
  "What trends appear over time?",
  "Where are values unusually high or low?",
  "What data quality issues should be reviewed?",
  "Which segments need attention?",
  "What risks does this data reveal?",
  "What actions should I take next?",
  "What should I compare against the previous period?",
]

function responseText(data: Record<string, unknown>) {
  const text = data.answer || data.response || data.content
  if (typeof text === "string" && text.trim()) {
    return text.trim()
  }
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim()
  }
  return "I could not generate an answer for that question."
}

async function readAssistantResponse(response: Response): Promise<Record<string, unknown>> {
  const rawBody = await response.text()
  if (!rawBody) return {}

  try {
    const parsed = JSON.parse(rawBody)
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
  } catch {
    debugError("[AI_ASSISTANT] Failed to parse response as JSON", {
      status: response.status,
      text: rawBody.slice(0, 500),
    })
    throw new Error("I received an incomplete AI response. Please try again.")
  }
}

type SavedSuggestion = {
  id: string
  text: string
  createdAt: string
}

type RightTab = "suggestions" | "history" | "search"

function displayProviderName(providerName?: string | null) {
  if (!providerName) return "UseClevr Cloud Analysis"
  const normalized = providerName.toLowerCase()
  if (normalized.includes("direct data")) return "Direct data analysis"
  if (normalized.includes("failed before provider")) return "Failed before provider execution"
  if (normalized.includes("local") || normalized.includes("ollama")) return "UseClevr Hybrid AI"
  if (normalized.includes("gemini") || normalized.includes("google")) return "UseClevr Cloud Analysis"
  if (normalized.includes("mock")) return "UseClevr Test Analysis"
  return providerName
}

function providerStatusClassName(state?: ProviderStatus["state"]) {
  if (state === "connection_healthy") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (state === "fallback_active") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (state === "offline_active") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
  if (state === "local_unavailable") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
  if (state === "provider_unavailable") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
  return "border-border bg-muted text-muted-foreground"
}

export function AiAssistantWorkspace() {
  const [datasets, setDatasets] = React.useState<DatasetOption[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(ACTIVE_DATASET_ID_KEY) || ""
    }
    return ""
  })
  const [messages, setMessages] = React.useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ask a general business question, or select a dataset from the sidebar for dataset-aware analysis.",
      insight: "AI assistant ready",
      explanation: "UseClevr routes answers through your AI Providers settings and Hybrid AI mode.",
      recommendation: "Select a dataset for questions about risks, best performers, and next actions.",
    },
  ])
  const [inputValue, setInputValue] = React.useState("")
  const [loadingDatasets, setLoadingDatasets] = React.useState(true)
  const [isAsking, setIsAsking] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const [savedSuggestions, setSavedSuggestions] = React.useState<SavedSuggestion[]>([])
  const [suggestionsByDataset, setSuggestionsByDataset] = React.useState<Record<string, SavedSuggestion[]>>({})
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = React.useState(false)
  const [leftSidebarOpen, setLeftSidebarOpen] = React.useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = React.useState(true)
  const [rightTab, setRightTab] = React.useState<RightTab>("suggestions")
  const [historyEntries, setHistoryEntries] = React.useState<HistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<HistoryEntry[]>([])
  const [searching, setSearching] = React.useState(false)
  const [showDataNotice, setShowDataNotice] = React.useState(true)
  const [feedbackMap, setFeedbackMap] = React.useState<Record<string, "positive" | "negative">>({})

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isAsking])

  React.useEffect(() => {
    let cancelled = false
    async function loadDatasets() {
      setLoadingDatasets(true)
      try {
        const response = await fetch("/api/datasets")
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Datasets could not be loaded.")
        if (cancelled) return
        const nextDatasets = Array.isArray(body.datasets) ? body.datasets : []
        setDatasets(nextDatasets)
        if (nextDatasets.length === 0) sessionStorage.removeItem(ACTIVE_DATASET_ID_KEY)
        setSelectedDatasetId((current) => {
          if (!current || nextDatasets.some((dataset: DatasetOption) => dataset.id === current)) return current
          sessionStorage.removeItem(ACTIVE_DATASET_ID_KEY)
          return ""
        })
      } catch {
        if (!cancelled) setDatasets([])
      } finally {
        if (!cancelled) setLoadingDatasets(false)
      }
    }
    loadDatasets()
    return () => { cancelled = true }
  }, [])

  React.useEffect(() => {
    if (rightTab !== "history" || !rightSidebarOpen) return
    let cancelled = false
    async function loadHistory() {
      setLoadingHistory(true)
      try {
        const response = await fetch("/api/assistant/history?limit=20")
        if (response.ok) {
          const body = await response.json()
          if (!cancelled) setHistoryEntries(Array.isArray(body.traces) ? body.traces : [])
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoadingHistory(false) }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [rightTab, rightSidebarOpen])

  async function performSearch() {
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    try {
      const response = await fetch(`/api/assistant/search?q=${encodeURIComponent(q)}&limit=20`)
      if (response.ok) {
        const body = await response.json()
        setSearchResults(Array.isArray(body.traces) ? body.traces : [])
      }
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }

  async function askAssistant(question: string) {
    const trimmed = question.trim()
    if (!trimmed || isAsking) return

    setInputValue("")
    setIsAsking(true)

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    }

    setMessages((current) => [...current, userMessage])

    try {
      const response = await fetch(selectedDatasetId ? "/api/hybrid-ai/dataset-chat" : "/api/hybrid-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: selectedDatasetId || undefined,
          messages: [...messages, userMessage]
            .filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({ role: message.role, content: message.content })),
        }),
      })
      
      const body = await readAssistantResponse(response)

      if (!response.ok || body.success === false) {
        const errorMessage = String(body.message || body.error || "The assistant could not answer that question.")
        const assistantMessage: AssistantMessage = {
          id: `assistant-error-${Date.now()}`,
          traceId: typeof body.traceId === "string" ? body.traceId : undefined,
          role: "assistant",
          content: errorMessage,
          error: errorMessage,
          errorCode: typeof body.code === "string" ? body.code : undefined,
          providerName: isProviderStatus(body.providerStatus) && typeof body.providerStatus.label === "string"
            ? body.providerStatus.label
            : displayProviderName(typeof body.providerName === "string" ? body.providerName : undefined),
          modelName: typeof body.modelName === "string" ? body.modelName : undefined,
          providerStatus: isProviderStatus(body.providerStatus) ? body.providerStatus : undefined,
          privacyWarning: typeof body.privacyWarning === "string" ? body.privacyWarning : null,
        }
        setMessages((current) => [...current, assistantMessage])
        return
      }

      const assistantMessage: AssistantMessage = {
        id: `assistant-${Date.now()}`,
        traceId: typeof body.traceId === "string" ? body.traceId : undefined,
        role: "assistant",
        content: responseText(body),
        insight: typeof body.insight === "string" ? body.insight : undefined,
        explanation: typeof body.explanation === "string" ? body.explanation : (selectedDatasetId ? "The response used summarized dataset context, backend KPI extracts, column profiles, and bounded sample rows." : undefined),
        recommendation: typeof body.recommendation === "string" ? body.recommendation : undefined,
        data: Array.isArray(body.data) ? body.data : [],
        chartType: typeof body.chartType === "string" ? body.chartType : undefined,
        providerName: isProviderStatus(body.providerStatus) && typeof body.providerStatus.label === "string"
          ? body.providerStatus.label
          : displayProviderName(typeof body.providerName === "string" ? body.providerName : undefined),
        modelName: typeof body.modelName === "string" ? body.modelName : undefined,
        providerStatus: isProviderStatus(body.providerStatus) ? body.providerStatus : undefined,
        privacyWarning: typeof body.privacyWarning === "string" ? body.privacyWarning : null,
      }

      setMessages((current) => [...current, assistantMessage])
    } catch (askError) {
      const message = askError instanceof Error ? askError.message : "The assistant could not answer that question."
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: message,
          error: message,
          providerName: "System",
        },
      ])
    } finally {
      setIsAsking(false)
    }
  }

  async function sendFeedback(traceId: string | undefined, feedback: "positive" | "negative") {
    if (!traceId) return
    setFeedbackMap((prev) => ({ ...prev, [traceId]: feedback }))
    try {
      await fetch("/api/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traceId, feedback }),
      })
    } catch { /* ignore */ }
  }

  async function reRunQuestion(prompt: string) {
    setInputValue(prompt)
    await askAssistant(prompt)
    setRightTab("suggestions")
  }

  async function generateSuggestions(force = false) {
    if (!selectedDatasetId || isGeneratingSuggestions) return
    if (!force && suggestionsByDataset[selectedDatasetId]?.length) {
      setSavedSuggestions(suggestionsByDataset[selectedDatasetId])
      return
    }
    setIsGeneratingSuggestions(true)
    try {
      const response = await fetch("/api/suggestions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDatasetId }),
      })
      if (response.ok) {
        const body = await response.json()
        const nextSuggestions = Array.isArray(body.suggestions) ? body.suggestions : []
        const usableSuggestions = nextSuggestions.length > 0
          ? nextSuggestions
          : FALLBACK_SUGGESTIONS.map((text, index) => ({
              id: `fallback-${selectedDatasetId}-${index}`,
              text,
              createdAt: new Date().toISOString(),
            }))
        setSavedSuggestions(usableSuggestions)
        setSuggestionsByDataset((current) => ({
          ...current,
          [selectedDatasetId]: usableSuggestions,
        }))
      } else {
        throw new Error("Suggestion generation failed")
      }
    } catch {
      const fallbackSuggestions = FALLBACK_SUGGESTIONS.map((text, index) => ({
        id: `fallback-${selectedDatasetId}-${index}`,
        text,
        createdAt: new Date().toISOString(),
      }))
      setSavedSuggestions(fallbackSuggestions)
      setSuggestionsByDataset((current) => ({
        ...current,
        [selectedDatasetId]: fallbackSuggestions,
      }))
    }
    finally { setIsGeneratingSuggestions(false) }
  }

  React.useEffect(() => {
    if (!selectedDatasetId) {
      setSavedSuggestions([])
      return
    }

    const cached = suggestionsByDataset[selectedDatasetId]
    if (cached?.length) {
      setSavedSuggestions(cached)
      return
    }

    setSavedSuggestions([])
    setRightTab("suggestions")
    void generateSuggestions()
  }, [selectedDatasetId])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    askAssistant(inputValue)
  }

  function handleSuggestedQuestion(question: string) {
    setInputValue(question)
    void askAssistant(question)
  }

  const INITIAL_SUGGESTIONS = [
    "What is the total revenue?",
    "Which segment generates the most revenue?",
    "What are the trends over time?",
    "Show me the top 5 values by amount.",
  ]
  const allSuggestionsCombined = selectedDatasetId
    ? [...new Set([...savedSuggestions.map((s) => s.text), ...messages.map((m) => m.content).filter((c) => c.startsWith("?"))])]
    : INITIAL_SUGGESTIONS
  const canAsk = !isAsking
  const latestProviderMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.providerStatus)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      {/* Left Sidebar - Datasets */}
      <aside
        className={`flex-shrink-0 border-r border-border bg-card transition-all duration-200 ${
          leftSidebarOpen ? "w-64" : "w-12"
        } hidden lg:block`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-border p-3">
            <h2 className={`text-sm font-semibold text-foreground ${leftSidebarOpen ? "" : "hidden"}`}>Datasets</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              aria-label={leftSidebarOpen ? "Collapse datasets sidebar" : "Expand datasets sidebar"}
            >
              {leftSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
          {leftSidebarOpen && (
            <div className="flex-1 overflow-y-auto p-2">
              {loadingDatasets ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : datasets.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No datasets uploaded</p>
              ) : (
                <div className="space-y-1">
                  {datasets.map((dataset) => (
                    <button
                      key={dataset.id}
                      type="button"
                      onClick={() => {
                        setSelectedDatasetId(dataset.id)
                        sessionStorage.setItem(ACTIVE_DATASET_ID_KEY, dataset.id)
                      }}
                      className={`w-full truncate rounded-md px-3 py-2 text-left text-sm transition ${
                        selectedDatasetId === dataset.id
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      {dataset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex flex-1 flex-col min-h-0">
        {/* Data usage transparency notice */}
        {showDataNotice && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
            <Info className="h-3 w-3 flex-shrink-0" />
            <span>
              AI analysis uses summarized dataset context, backend KPI extracts, column profiles, and bounded samples. Local only mode never sends dataset context to cloud AI.
            </span>
            <button
              type="button"
              onClick={() => setShowDataNotice(false)}
              className="ml-auto text-muted-foreground hover:text-foreground"
              aria-label="Dismiss notice"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <AiPrivacyStatusPanel latestMessage={latestProviderMessage} />

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg border p-4 shadow-sm ${
                    message.role === "user"
                      ? "border-primary bg-primary text-primary-foreground"
                      : message.error
                      ? "border-destructive/50 bg-destructive/5 text-card-foreground"
                      : "border-border bg-card text-card-foreground"
                  }`}
                >
                  {message.role === "assistant" && !message.error && (
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Analyst
                      <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                        {message.providerName && (
                          <span className="text-[10px] font-normal text-muted-foreground">
                            Using: {message.providerName}
                          </span>
                        )}
                        {message.providerStatus && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${providerStatusClassName(message.providerStatus.state)}`}>
                            {message.providerStatus.message}
                          </span>
                        )}
                        {message.modelName && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {message.modelName}
                          </span>
                        )}
                        {message.providerStatus?.route && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {message.providerStatus.route === "local" ? "Local" : message.providerStatus.route === "cloud" ? "Cloud" : message.providerStatus.route === "direct" ? "Direct" : "Unavailable"}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {message.role === "assistant" && message.error && (
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                      <Info className="h-4 w-4" />
                      Analysis error
                    </div>
                  )}

                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>

                  {message.privacyWarning && (
                    <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                      {message.privacyWarning}
                    </div>
                  )}

                  {/* Error transparency */}
                  {message.error && (
                    <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                      <p className="font-medium">What happened:</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {errorExplanation(message)}
                      </p>
                      <p className="mt-1 font-medium">Next steps:</p>
                      <p className="mt-0.5 text-muted-foreground">{errorNextStep(message)}</p>
                    </div>
                  )}

                  {message.role === "assistant" && !message.error && (message.insight || message.explanation || message.recommendation) && (
                    <div className="mt-4 grid gap-3 border-t border-border pt-3 md:grid-cols-3">
                      {message.insight && <ResponseSection title="Insight" text={message.insight} />}
                      {message.explanation && <ResponseSection title="Takeaway" text={message.explanation} />}
                      {message.recommendation && <ResponseSection title="Next move" text={message.recommendation} />}
                    </div>
                  )}

                  {message.role === "assistant" && message.data && message.data.length > 0 && (
                    <ResultPreview data={message.data} chartType={message.chartType} />
                  )}

                  {/* Feedback buttons */}
                  {message.role === "assistant" && !message.error && (
                    <div className="mt-3 flex items-center gap-2 border-t border-border/30 pt-2">
                      <button
                        type="button"
                        onClick={() => sendFeedback(message.traceId, "positive")}
                        className={`rounded p-1 transition ${
                          feedbackMap[message.traceId || ""] === "positive"
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                        aria-label="Mark as helpful"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => sendFeedback(message.traceId, "negative")}
                        className={`rounded p-1 transition ${
                          feedbackMap[message.traceId || ""] === "negative"
                            ? "text-destructive bg-destructive/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                        aria-label="Mark as not helpful"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isAsking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing selected dataset
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="sticky bottom-0 border-t border-border bg-background p-4">
          <div className="mx-auto flex max-w-3xl gap-2">
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  askAssistant(inputValue)
                }
              }}
              placeholder={selectedDatasetId ? "Ask a question about the selected dataset..." : "Ask a general question or select a dataset..."}
              disabled={isAsking}
              className="min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              rows={1}
            />
            <Button type="submit" size="icon" disabled={!inputValue.trim() || !canAsk} aria-label="Send question">
              {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </main>

      {/* Right Sidebar - Tabs: Suggestions / History / Search */}
      <aside
        className={`flex-shrink-0 border-l border-border bg-card transition-all duration-200 ${
          rightSidebarOpen ? "w-72" : "w-12"
        } hidden lg:block`}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Tab bar */}
          <div className="flex items-center border-b border-border">
            {rightSidebarOpen ? (
              <div className="flex flex-1">
                {(["suggestions", "history", "search"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRightTab(tab)}
                    className={`flex flex-1 items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition ${
                      rightTab === tab
                        ? "border-b-2 border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "suggestions" && <Sparkles className="h-3 w-3" />}
                    {tab === "history" && <History className="h-3 w-3" />}
                    {tab === "search" && <Search className="h-3 w-3" />}
                    {tab === "suggestions" && "Suggestions"}
                    {tab === "history" && "History"}
                    {tab === "search" && "Search"}
                  </button>
                ))}
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              aria-label={rightSidebarOpen ? "Collapse right sidebar" : "Expand right sidebar"}
              className="flex-shrink-0"
            >
              {rightSidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {rightSidebarOpen && (
            <div className="flex-1 overflow-y-auto p-2">
              {/* Suggestions tab */}
              {rightTab === "suggestions" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-foreground">Suggested questions</h3>
                    {selectedDatasetId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => generateSuggestions(true)}
                        disabled={isGeneratingSuggestions}
                        className="gap-1 text-xs"
                      >
                        {isGeneratingSuggestions ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Refresh
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {isGeneratingSuggestions && allSuggestionsCombined.length === 0 ? (
                      <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Analyzing dataset columns...
                      </div>
                    ) : allSuggestionsCombined.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-muted-foreground">
                        {selectedDatasetId ? "Preparing fallback suggestions..." : "Select a dataset to see suggestions"}
                      </p>
                    ) : (
                      allSuggestionsCombined.map((question, index) => (
                        <button
                          key={`${question}-${index}`}
                          type="button"
                          onClick={() => handleSuggestedQuestion(question)}
                          disabled={!canAsk}
                          className="flex w-full items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
                          <span className="line-clamp-2">{question}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* History tab */}
              {rightTab === "history" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-foreground">Past conversations</h3>
                    <a
                      href="/api/assistant/export?format=json"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      <Download className="h-3 w-3" />
                      Export
                    </a>
                  </div>
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : historyEntries.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">
                      No past conversations yet. Ask a question to get started.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {historyEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-border bg-background px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-xs text-foreground">{entry.prompt}</p>
                            <button
                              type="button"
                              onClick={() => reRunQuestion(entry.prompt)}
                              className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                              aria-label="Re-run this question"
                            >
                              <Repeat className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {displayProviderName(entry.providerName)}
                            </span>
                            {entry.feedback === "positive" && (
                              <ThumbsUp className="h-2.5 w-2.5 text-primary" />
                            )}
                            {entry.feedback === "negative" && (
                              <ThumbsDown className="h-2.5 w-2.5 text-destructive" />
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Search tab */}
              {rightTab === "search" && (
                <div>
                  <div className="mb-2">
                    <h3 className="mb-1.5 text-xs font-semibold text-foreground">Search conversations</h3>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") performSearch() }}
                        placeholder="Search prompts and responses..."
                        className="min-h-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none ring-offset-background transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={performSearch}
                        disabled={searching || !searchQuery.trim()}
                        className="flex-shrink-0"
                      >
                        {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="space-y-1.5">
                      {searchResults.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => reRunQuestion(entry.prompt)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left transition hover:border-primary/60"
                        >
                          <p className="line-clamp-2 text-xs text-foreground">{entry.prompt}</p>
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                            {entry.response.slice(0, 120)}...
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : searchQuery && !searching ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">No matching conversations found.</p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function isProviderStatus(value: unknown): value is ProviderStatus {
  if (!value || typeof value !== "object") return false
  const status = value as Partial<ProviderStatus>
  return (
    typeof status.label === "string" &&
    typeof status.message === "string" &&
    (status.state === "connection_healthy" ||
      status.state === "fallback_active" ||
      status.state === "provider_unavailable" ||
      status.state === "offline_active" ||
      status.state === "local_unavailable")
  )
}

function AiPrivacyStatusPanel({ latestMessage }: { latestMessage?: AssistantMessage }) {
  const status = latestMessage?.providerStatus
  const message = status?.message || "Provider routing appears after the next AI response."
  const providerName = latestMessage?.providerName || "Not used yet"
  const modelName = latestMessage?.modelName || "Pending"
  const route = status?.route === "local" ? "Local" : status?.route === "cloud" ? "Cloud" : status?.route === "direct" ? "Direct" : status?.route === "none" ? "Unavailable" : "Pending"

  return (
    <div className="border-b border-border bg-background px-4 py-2">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">AI Privacy Status</p>
          <p className="mt-0.5 text-muted-foreground">
            {status?.state === "offline_active"
              ? "Offline mode active"
              : status?.state === "fallback_active"
                ? "Cloud fallback active"
                : status?.route === "local"
                  ? "Local AI active"
                  : status?.route === "direct"
                    ? "Direct data analysis"
                  : message}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 font-medium ${providerStatusClassName(status?.state)}`}>
            {route}
          </span>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground">
            Last provider: {providerName}
          </span>
          {latestMessage?.modelName && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground">
              {modelName}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function errorExplanation(message: AssistantMessage) {
  if (message.providerStatus?.label === "Failed before provider execution") {
    return "The request stopped during dataset validation or deterministic analysis before any AI provider was selected."
  }
  if (message.errorCode?.startsWith("missing_") || message.errorCode === "insufficient_periods") {
    return "The selected dataset does not contain enough validated fields for this analysis."
  }
  return "The assistant could not complete this request. The provider status above shows whether the failure happened before or during provider routing."
}

function errorNextStep(message: AssistantMessage) {
  if (message.errorCode === "missing_time_dimension") return "Use a dataset with a date, month, or period column and at least two complete periods."
  if (message.errorCode === "missing_sales_metric") return "Use a dataset with a numeric revenue, sales, amount, or order value column."
  if (message.errorCode === "missing_segment_dimension") return "Use a dataset with a segment, plan, channel, region, country, or category column."
  if (message.errorCode === "insufficient_periods") return "Add enough rows for two complete comparable periods."
  return "Check the selected dataset and try the question again."
}

function ResponseSection({ title, text }: { title: string; text: string }) {
  const normalizedTitle = title.toLowerCase()
  const displayTitle = normalizedTitle === "takeaway" ? "Takeaway" : normalizedTitle === "next move" ? "Next" : "Insight"
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{displayTitle}</p>
      <p className="mt-1 text-sm leading-5 text-foreground">{text}</p>
    </div>
  )
}

function ResultPreview({ data, chartType }: { data: Record<string, unknown>[]; chartType?: string }) {
  const rows = data.slice(0, 5)
  const columns = Object.keys(rows[0] || {}).slice(0, 5)
  if (rows.length === 0 || columns.length === 0) return null

  const tableColumns: DataTableColumn<Record<string, unknown>>[] = columns.map((col) => ({
    key: col,
    header: col,
  }))

  return (
    <div className="mt-4 rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-primary" />
          Result preview
        </div>
        {chartType && <span className="text-xs text-muted-foreground">{chartType}</span>}
      </div>
      <DataTable columns={tableColumns} rows={rows} />
    </div>
  )
}
