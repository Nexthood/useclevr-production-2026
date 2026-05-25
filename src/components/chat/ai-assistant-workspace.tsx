"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
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

const suggestedQuestions = [
  "What are the key insights in this dataset?",
  "Which segment performs best?",
  "Show me revenue trends",
  "Where are the biggest risks or anomalies?",
]

function formatDate(value?: string | null) {
  if (!value) return "Recent"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recent"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

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

export function AiAssistantWorkspace() {
  const [datasets, setDatasets] = React.useState<DatasetOption[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = React.useState("")
  const [selectedDataset, setSelectedDataset] = React.useState<DatasetDetail | null>(null)
  const [messages, setMessages] = React.useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Select a dataset, then ask a business question. I will answer from the selected data.",
      insight: "AI assistant ready",
      explanation: "Use the suggested questions or write your own prompt once a dataset is selected.",
      recommendation: "Start with a broad question, then narrow into segments, trends, or risks.",
    },
  ])
  const [inputValue, setInputValue] = React.useState("")
  const [loadingDatasets, setLoadingDatasets] = React.useState(true)
  const [loadingDataset, setLoadingDataset] = React.useState(false)
  const [isAsking, setIsAsking] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

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
        if (nextDatasets[0]?.id) {
          setSelectedDatasetId(nextDatasets[0].id)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Datasets could not be loaded.")
        }
      } finally {
        if (!cancelled) {
          setLoadingDatasets(false)
        }
      }
    }

    loadDatasets()

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!selectedDatasetId) {
      setSelectedDataset(null)
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
          setSelectedDataset(body)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSelectedDataset(null)
          setError(loadError instanceof Error ? loadError.message : "Dataset could not be loaded.")
        }
      } finally {
        if (!cancelled) {
          setLoadingDataset(false)
        }
      }
    }

    loadDataset()

    return () => {
      cancelled = true
    }
  }, [selectedDatasetId])

  async function askAssistant(question: string) {
    const trimmed = question.trim()
    if (!trimmed || isAsking || !selectedDatasetId) return

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    askAssistant(inputValue)
  }

  const columns = selectedDataset?.columns || selectedDataset?.dataset.columns || []
  const rowCount = selectedDataset?.totalRows || selectedDataset?.dataset.rowCount || 0
  const selectedDatasetName = selectedDataset?.dataset.name || datasets.find((dataset) => dataset.id === selectedDatasetId)?.name
  const canAsk = Boolean(selectedDatasetId) && !loadingDataset && !isAsking

  return (
    <div className="grid min-h-[calc(100vh-136px)] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-muted/20 p-4 lg:border-b-0 lg:border-r">
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Dataset</h2>
            <p className="mt-1 text-sm text-muted-foreground">Answers use the selected dataset.</p>
          </div>

          {loadingDatasets ? (
            <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading datasets
            </div>
          ) : datasets.length > 0 ? (
            <div className="space-y-2">
              {datasets.map((dataset) => {
                const active = dataset.id === selectedDatasetId
                return (
                  <button
                    key={dataset.id}
                    type="button"
                    onClick={() => setSelectedDatasetId(dataset.id)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                  >
                    <Database className={`mt-0.5 h-4 w-4 flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{dataset.name}</span>
                      <span className="block text-xs text-muted-foreground">{formatDate(dataset.createdAt)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <Card className="p-4 text-sm">
              <p className="font-medium text-foreground">No datasets yet</p>
              <p className="mt-1 text-muted-foreground">Upload a CSV file before asking the assistant.</p>
              <Link href="/app/upload" className="mt-3 inline-flex">
                <Button size="sm">Upload dataset</Button>
              </Link>
            </Card>
          )}

          {selectedDatasetId && (
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedDatasetName || "Selected dataset"}</p>
                  <p className="text-xs text-muted-foreground">
                    {loadingDataset ? "Loading metadata" : `${rowCount.toLocaleString()} rows`}
                  </p>
                </div>
                {loadingDataset ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>

              {columns.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Columns</p>
                  <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                    {columns.slice(0, 18).map((column) => (
                      <span key={column} className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
                        {column}
                      </span>
                    ))}
                    {columns.length > 18 && (
                      <span className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
                        +{columns.length - 18}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {error && (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-h-[calc(100vh-136px)] flex-col">
        <div className="border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            {suggestedQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => askAssistant(question)}
                disabled={!canAsk}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[86%] rounded-lg border p-4 shadow-sm ${
                    message.role === "user"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-card-foreground"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI assistant
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

        <form onSubmit={handleSubmit} className="border-t border-border bg-background p-4">
          <div className="mx-auto flex max-w-4xl gap-2">
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
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Clear assistant chat"
              onClick={() => {
                setMessages([])
                setInputValue("")
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

function ResponseSection({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
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
