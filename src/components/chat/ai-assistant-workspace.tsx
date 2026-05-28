"use client"

import { Button } from "@/components/ui/button"
import {
  BarChart3,
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

const suggestedQuestions = [
  "What are the key insights in this dataset?",
  "Which segment performs best?",
  "Show me revenue trends over time",
  "Where are the biggest risks or anomalies?",
  "What are the top 5 categories by value?",
  "How does this data distribute across regions?",
  "What patterns exist in the monthly trends?",
  "Which metrics have the highest variance?",
  "Can you identify outliers in the data?",
  "What correlations exist between columns?",
  "Summarize the data quality issues",
  "Which time periods show growth?",
  "Compare performance across segments",
  "What metrics should I track weekly?",
  "Are there seasonal patterns visible?",
]

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

export function AiAssistantWorkspace() {
  const [_datasets, setDatasets] = React.useState<DatasetOption[]>([])
  const [selectedDatasetId, _setSelectedDatasetId] = React.useState<string>(() => {
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
      content: "Select a dataset, then ask a business question. I will answer from the selected data.",
      insight: "AI assistant ready",
      explanation: "Use the suggested questions or write your own prompt once a dataset is selected.",
      recommendation: "Start with a broad question, then narrow into segments, trends, or risks.",
    },
  ])
  const [inputValue, setInputValue] = React.useState("")
  const [_loadingDatasets, setLoadingDatasets] = React.useState(true)
  const [_loadingDataset, setLoadingDataset] = React.useState(false)
  const [isAsking, setIsAsking] = React.useState(false)
  const [_error, setError] = React.useState<string | null>(null)
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
        if (nextDatasets.length === 0) {
          sessionStorage.removeItem(ACTIVE_DATASET_ID_KEY)
        } else if (nextDatasets[0]?.id) {
          const idToSelect = nextDatasets[0].id
          _setSelectedDatasetId(idToSelect)
        }
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : "Datasets could not be loaded.")
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
      } catch (loadError) {
        if (!cancelled) {
          _setSelectedDataset(null)
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
    if (!trimmed || isAsking) return

    // If no dataset, show message
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    askAssistant(inputValue)
  }

  function handleSuggestedQuestion(question: string) {
    setInputValue(question)
    void askAssistant(question)
  }

  const canAsk = Boolean(selectedDatasetId) && !isAsking

  return (
    <div className="flex flex-col h-full min-h-[600px] overflow-hidden">
      <section className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        <div className="flex-1 overflow-y-auto p-4 pb-24">
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

        <form onSubmit={handleSubmit} className="sticky bottom-0 border-t border-border bg-background p-4">
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

      <aside className="min-h-0 overflow-y-auto border-t border-border bg-muted/20 p-4 lg:border-l lg:border-t-0">
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Suggested questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Clicking a question sends it to the chat.</p>
          </div>
          <div className="space-y-2">
            {suggestedQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => handleSuggestedQuestion(question)}
                disabled={!canAsk}
                className="flex w-full items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{question}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
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