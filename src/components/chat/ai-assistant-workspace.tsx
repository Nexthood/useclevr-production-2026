"use client"

import { Button } from "@/components/ui/button"
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react"
import * as React from "react"

type DatasetOption = {
  id: string
  name: string
  createdAt?: string | null
}

type DatasetDetail = {
  dataset: {
    id: string
    name: string
    columns: string[]
    rowCount: number
  }
  columns: string[]
  totalRows: number
}

type AssistantMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  insight?: string
  explanation?: string
  recommendation?: string
  data?: Record<string, unknown>[]
  chartType?: string
}

const ACTIVE_DATASET_ID_KEY = "useclevr_active_dataset_id"

function responseText(data: Record<string, unknown>) {
  return String(data.answer || data.response || data.content || "I could not generate an answer for that question.")
}

function compactValue(value: unknown) {
  if (typeof value === "number") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
  }

  if (value === null || value === undefined || value === "") {
    return "-"
  }

  return String(value)
}

// Database-persisted suggestions
type SavedSuggestion = {
  id: string
  text: string
  createdAt: string
}

export function AiAssistantWorkspace() {
  const [datasets, setDatasets] = React.useState<DatasetOption[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(ACTIVE_DATASET_ID_KEY) || ""
    }
    return ""
  })
  const [_selectedDataset, _setSelectedDataset] = React.useState<DatasetDetail | null>(null)
  const [messages, setMessages] = React.useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Select a dataset from the sidebar, then ask a business question. I will answer from your data.",
      insight: "AI assistant ready",
      explanation: "Choose a dataset and use the suggested questions or write your own prompt.",
      recommendation: "Start with a broad question to understand your data structure.",
    },
  ])
  const [inputValue, setInputValue] = React.useState("")
  const [loadingDatasets, setLoadingDatasets] = React.useState(true)
  const [_loadingDataset, setLoadingDataset] = React.useState(false)
  const [isAsking, setIsAsking] = React.useState(false)
  const [_error, setError] = React.useState<string | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const [savedSuggestions, setSavedSuggestions] = React.useState<SavedSuggestion[]>([])
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = React.useState(false)
  const [leftSidebarOpen, setLeftSidebarOpen] = React.useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = React.useState(true)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isAsking])

  React.useEffect(() => {
    let cancelled = false

    async function loadDatasets() {
      setLoadingDatasets(true)
      setError(null)

      try {
        const response = await fetch("/api/datasets")
        const body = await response.json()

        if (!response.ok) {
          throw new Error(body.error || "Datasets could not be loaded.")
        }

        const nextDatasets = Array.isArray(body.datasets) ? body.datasets : []
        if (cancelled) return

        setDatasets(nextDatasets)
        if (nextDatasets.length === 0) {
          sessionStorage.removeItem(ACTIVE_DATASET_ID_KEY)
        }
      } catch {
        if (!cancelled) setDatasets([])
      } finally {
        if (!cancelled) setLoadingDatasets(false)
      }
    }

    loadDatasets()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false

    async function loadSuggestions() {
      try {
        const response = await fetch("/api/suggestions")
        if (response.ok) {
          const body = await response.json()
          if (!cancelled) {
            setSavedSuggestions(Array.isArray(body.suggestions) ? body.suggestions : [])
          }
        }
      } catch {
        // Keep empty suggestions
      }
    }

    loadSuggestions()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!selectedDatasetId) {
      _setSelectedDataset(null)
      return
    }

    let cancelled = false

    async function loadDataset() {
      setLoadingDataset(true)
      setError(null)

      try {
        const response = await fetch(`/api/datasets/${selectedDatasetId}`)
        const body = await response.json()

        if (!response.ok) {
          throw new Error(body.error || "Dataset could not be loaded.")
        }

        if (!cancelled) {
          _setSelectedDataset(body)
        }
      } catch {
        if (!cancelled) _setSelectedDataset(null)
      } finally {
        if (!cancelled) setLoadingDataset(false)
      }
    }

    loadDataset()
    return () => {
      cancelled = true
    }
  }, [selectedDatasetId])

  async function askAssistant(question: string) {
    const trimmed = question.trim()
    if (!trimmed || isAsking) return

    if (!selectedDatasetId) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: "Please upload a dataset first.",
          insight: "No dataset",
          explanation: "The assistant needs CSV data to answer questions.",
          recommendation: "Upload a file before asking the assistant.",
        },
      ])
      return
    }

    setInputValue("")
    setError(null)
    setIsAsking(true)

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    }

    setMessages((current) => [...current, userMessage])

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          datasetId: selectedDatasetId,
        }),
      })
      const body = await response.json()

      if (!response.ok || body.success === false) {
        throw new Error(body.message || body.error || "The assistant could not answer that question.")
      }

      const assistantMessage: AssistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: responseText(body),
        insight: body.insight,
        explanation: body.explanation,
        recommendation: body.recommendation,
        data: Array.isArray(body.data) ? body.data : [],
        chartType: body.chartType,
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
          insight: "Question failed",
          explanation: "The selected dataset could not be analyzed for this prompt.",
          recommendation: "Try a simpler question or refresh the selected dataset.",
        },
      ])
    } finally {
      setIsAsking(false)
    }
  }

  async function generateSuggestions() {
    if (!selectedDatasetId || isGeneratingSuggestions) return

    setIsGeneratingSuggestions(true)
    try {
      const response = await fetch("/api/suggestions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDatasetId }),
      })

      if (response.ok) {
        const body = await response.json()
        if (Array.isArray(body.suggestions)) {
          setSavedSuggestions(body.suggestions)
        }
      }
    } catch {
      // Keep existing suggestions
    } finally {
      setIsGeneratingSuggestions(false)
    }
  }

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
  const canAsk = Boolean(selectedDatasetId) && !isAsking

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
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
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg border p-4 shadow-sm ${
                    message.role === "user"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-card-foreground"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Analyst
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>

                  {message.role === "assistant" && (message.insight || message.explanation || message.recommendation) && (
                    <div className="mt-4 grid gap-3 border-t border-border pt-3 md:grid-cols-3">
                      {message.insight && <ResponseSection title="Insight" text={message.insight} />}
                      {message.explanation && <ResponseSection title="Takeaway" text={message.explanation} />}
                      {message.recommendation && <ResponseSection title="Next move" text={message.recommendation} />}
                    </div>
                  )}

                  {message.role === "assistant" && message.data && message.data.length > 0 && (
                    <ResultPreview data={message.data} chartType={message.chartType} />
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
              placeholder={selectedDatasetId ? "Ask a question about the selected dataset..." : "Select a dataset first..."}
              disabled={!selectedDatasetId || isAsking}
              className="min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              rows={1}
            />
            <Button type="submit" size="icon" disabled={!inputValue.trim() || !canAsk} aria-label="Send question">
              {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </main>

      {/* Right Sidebar - Suggestions */}
      <aside
        className={`flex-shrink-0 border-l border-border bg-card transition-all duration-200 ${
          rightSidebarOpen ? "w-72" : "w-12"
        } hidden lg:block`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-border p-3">
            <h2 className={`text-sm font-semibold text-foreground ${rightSidebarOpen ? "" : "hidden"}`}>Suggestions</h2>
            <div className="flex items-center gap-1">
              {rightSidebarOpen && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateSuggestions}
                  disabled={!selectedDatasetId || isGeneratingSuggestions}
                  aria-label="Generate more suggestions"
                  className="gap-1.5 text-xs"
                >
                  {isGeneratingSuggestions ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      Generate
                    </>
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                aria-label={rightSidebarOpen ? "Collapse suggestions sidebar" : "Expand suggestions sidebar"}
              >
                {rightSidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {rightSidebarOpen && (
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-2">
{allSuggestionsCombined.length === 0 ? (
                   <p className="px-3 py-2 text-sm text-muted-foreground">
                     {selectedDatasetId ? "No suggestions available" : "Select a dataset to see suggestions"}
                   </p>
                 ) : (
                   allSuggestionsCombined.map((question, index) => (
                     <button
                       key={`${question}-${index}`}
                       type="button"
                       onClick={() => handleSuggestedQuestion(question)}
                       disabled={!canAsk}
                       className="flex w-full items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                     >
                       <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                       <span className="line-clamp-2">{question}</span>
                     </button>
                   ))
                 )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
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

  return (
    <div className="mt-4 rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-primary" />
          Result preview
        </div>
        {chartType && <span className="text-xs text-muted-foreground">{chartType}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-foreground">
                    {compactValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}