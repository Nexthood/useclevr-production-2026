"use client"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AiAccuracyDisclaimer } from "@/components/chat/ai-accuracy-disclaimer"
import { GHOST_MODE_STORAGE_KEY } from "@/lib/ai/ghost-mode"
import {
  AnalyticalResultView,
  normalizeAnalyticalResult,
  type SupportedAnalyticalResult,
} from "@/components/chat/analytical-results"
import {
  normalizeSegmentDeclineAnalysis,
  SegmentDeclineResults,
  type SegmentDeclineAnalysisPayload,
} from "@/components/chat/segment-decline-results"
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
  datasetId?: string
  role: "user" | "assistant"
  content: string
  insight?: string
  explanation?: string
  recommendation?: string
  data?: Record<string, unknown>[]
  chartType?: string
  providerName?: string
  modelName?: string
  confidence?: number
  providerStatus?: ProviderStatus
  privacyWarning?: string | null
  error?: string
  errorCode?: string
  retryQuestion?: string
  replyToId?: string
  deterministicAnalysis?: SegmentDeclineAnalysisPayload
  analyticalResult?: SupportedAnalyticalResult
  generatedAt?: string
}

type ProviderStatus = {
  label: string
  state: "connection_healthy" | "fallback_active" | "provider_unavailable" | "offline_active" | "local_unavailable"
  message: string
  fallbackActive: boolean
  route?: "local" | "cloud" | "direct" | "none"
}

type OverrideAction = "accept" | "reject" | "edit" | "undo"

type ResponseEditorState = {
  message: AssistantMessage
  draft: string
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
const GHOST_MODE_NOTICE_KEY = "useclevr_ghost_mode_notice_seen"

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

function buildWelcomeMessage(): AssistantMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: "Ask a general business question, or select a dataset from the sidebar for dataset-aware analysis.",
    insight: "AI assistant ready",
    explanation: "UseClevr routes answers through your AI Providers settings and Hybrid AI mode.",
    recommendation: "Select a dataset for questions about risks, best performers, and next actions.",
  }
}

function buildDatasetContextMessage(datasetId: string, datasets: DatasetOption[]): AssistantMessage {
  if (!datasetId) return buildWelcomeMessage()

  const dataset = datasets.find((candidate) => candidate.id === datasetId)
  const datasetName = dataset?.name || "the selected dataset"
  return {
    id: `dataset-context-${datasetId}`,
    datasetId,
    role: "assistant",
    content: `Dataset context is set to ${datasetName}. Ask questions about this dataset only.`,
    insight: "Dataset context updated",
    explanation: "The next answer uses only the active dataset selected in the sidebar.",
    recommendation: "Ask a dataset-specific question when you are ready.",
  }
}

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

function datasetAssistantErrorMessage(body: Record<string, unknown>, fallback: string) {
  const code = typeof body.code === "string" ? body.code : ""
  if (code === "NO_DATASET_SELECTED") return "Select a dataset before asking questions."
  if (code === "DATASET_NOT_FOUND") return "The selected dataset could not be found for this account."
  if (code === "UNAUTHORIZED") return "Sign in before asking dataset questions."
  if (code === "EMPTY_DATASET") return "This dataset does not contain enough usable information."
  if (code === "PROVIDER_TIMEOUT") return "The request timed out. Please retry."
  if (code === "INVALID_PROVIDER_RESPONSE") return "The AI provider returned an invalid response. Please retry."
  if (code === "PROVIDER_MISSING") return "The AI assistant is not configured for provider-backed answers."
  if (code === "PROVIDER_UNAVAILABLE" || code === "AI_PROVIDER_ERROR") return "The AI assistant is temporarily unavailable. Please try again shortly."
  const message = String(body.message || body.error || fallback).trim()
  if (!message || /could not answer that question/i.test(message)) return fallback
  return message
}

function classifyClientFetchError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { code: "PROVIDER_TIMEOUT", message: "The request timed out. Please retry." }
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/networkerror|failed to fetch|load failed/i.test(message)) {
    return { code: "NETWORK_ERROR", message: "The assistant connection was interrupted. Please retry." }
  }
  return { code: "INTERNAL_ERROR", message: "The assistant could not complete the request. Please retry." }
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

function providerNameFromResponse(body: Record<string, unknown>) {
  if (typeof body.providerName === "string" && body.providerName.trim()) return displayProviderName(body.providerName)
  if (isProviderStatus(body.providerStatus) && typeof body.providerStatus.label === "string") return body.providerStatus.label
  return displayProviderName(undefined)
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
      const urlDatasetId = new URLSearchParams(window.location.search).get("datasetId")
      if (urlDatasetId) return urlDatasetId
      return sessionStorage.getItem(ACTIVE_DATASET_ID_KEY) || ""
    }
    return ""
  })
  const [messages, setMessages] = React.useState<AssistantMessage[]>([buildWelcomeMessage()])
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
  const [ghostMode, setGhostMode] = React.useState(() => {
    if (typeof window === "undefined") return false
    return sessionStorage.getItem(GHOST_MODE_STORAGE_KEY) === "true"
  })
  const [showGhostNotice, setShowGhostNotice] = React.useState(false)
  const [feedbackMap, setFeedbackMap] = React.useState<Record<string, "positive" | "negative">>({})
  const [overrideMap, setOverrideMap] = React.useState<Record<string, OverrideAction>>({})
  const [responseEditor, setResponseEditor] = React.useState<ResponseEditorState | null>(null)
  const [responseEditorError, setResponseEditorError] = React.useState("")
  const [savingResponseEdit, setSavingResponseEdit] = React.useState(false)
  const responseEditorTextareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const initialUrlQuestionRef = React.useRef<string | null>(null)
  const initialUrlQuestionAskedRef = React.useRef(false)
  const previousDatasetIdRef = React.useRef(selectedDatasetId)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isAsking])

  React.useEffect(() => {
    if (!responseEditor) return
    const timeout = window.setTimeout(() => responseEditorTextareaRef.current?.focus(), 0)
    return () => window.clearTimeout(timeout)
  }, [responseEditor])

  React.useEffect(() => {
    if (ghostMode) {
      sessionStorage.setItem(GHOST_MODE_STORAGE_KEY, "true")
      return
    }
    sessionStorage.removeItem(GHOST_MODE_STORAGE_KEY)
  }, [ghostMode])

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const datasetId = params.get("datasetId")
    const question = params.get("question")
    if (datasetId) {
      setSelectedDatasetId(datasetId)
      sessionStorage.setItem(ACTIVE_DATASET_ID_KEY, datasetId)
    }
    if (question?.trim()) {
      initialUrlQuestionRef.current = question.trim()
      setInputValue(question.trim())
    }
  }, [])

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
        if (nextDatasets.length === 0) {
          sessionStorage.removeItem(ACTIVE_DATASET_ID_KEY)
          setSelectedDatasetId("")
          return
        }
        setSelectedDatasetId((current) => {
          if (!current || nextDatasets.some((dataset: DatasetOption) => dataset.id === current)) return current
          const nextActiveDatasetId = nextDatasets[0]?.id || ""
          if (nextActiveDatasetId) {
            sessionStorage.setItem(ACTIVE_DATASET_ID_KEY, nextActiveDatasetId)
          } else {
            sessionStorage.removeItem(ACTIVE_DATASET_ID_KEY)
          }
          return nextActiveDatasetId
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
    if (previousDatasetIdRef.current === selectedDatasetId) return
    previousDatasetIdRef.current = selectedDatasetId
    setInputValue("")
    setMessages([buildDatasetContextMessage(selectedDatasetId, datasets)])
  }, [selectedDatasetId, datasets])

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

    const userMessageId = `user-${Date.now()}`
    const userMessage: AssistantMessage = {
      id: userMessageId,
      role: "user",
      content: trimmed,
    }

    setMessages((current) => [...current, userMessage])

    let timeoutId: number | null = null
    try {
      const controller = new AbortController()
      timeoutId = window.setTimeout(() => controller.abort(), 45_000)
      const response = await fetch(selectedDatasetId ? "/api/hybrid-ai/dataset-chat" : "/api/hybrid-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          datasetId: selectedDatasetId || undefined,
          ghostMode,
          messages: [...messages, userMessage]
            .filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({ role: message.role, content: message.content })),
        }),
      })
      if (timeoutId) window.clearTimeout(timeoutId)
      timeoutId = null
      
      const body = await readAssistantResponse(response)

      if (!response.ok || body.success === false) {
        const errorMessage = datasetAssistantErrorMessage(body, "The assistant could not complete the request. Please retry.")
        const assistantMessage: AssistantMessage = {
          id: `assistant-error-${Date.now()}`,
          traceId: typeof body.traceId === "string" ? body.traceId : undefined,
          datasetId: selectedDatasetId || undefined,
          role: "assistant",
          content: errorMessage,
          error: errorMessage,
          errorCode: typeof body.code === "string" ? body.code : undefined,
          retryQuestion: trimmed,
          replyToId: userMessageId,
          providerName: providerNameFromResponse(body),
          modelName: typeof body.modelName === "string" ? body.modelName : undefined,
          confidence: typeof body.confidence === "number" ? body.confidence : undefined,
          providerStatus: isProviderStatus(body.providerStatus) ? body.providerStatus : undefined,
          privacyWarning: typeof body.privacyWarning === "string" ? body.privacyWarning : null,
          generatedAt: new Date().toISOString(),
        }
        setMessages((current) => [...current, assistantMessage])
        return
      }

      const assistantMessage: AssistantMessage = {
        id: `assistant-${Date.now()}`,
        traceId: typeof body.traceId === "string" ? body.traceId : undefined,
        datasetId: selectedDatasetId || undefined,
        role: "assistant",
        replyToId: userMessageId,
        content: responseText(body),
        insight: typeof body.insight === "string" ? body.insight : undefined,
        explanation: typeof body.explanation === "string" ? body.explanation : (selectedDatasetId ? "The response used summarized dataset context, backend KPI extracts, column profiles, and bounded sample rows." : undefined),
        recommendation: typeof body.recommendation === "string" ? body.recommendation : undefined,
        data: Array.isArray(body.data) ? body.data : [],
        chartType: typeof body.chartType === "string" ? body.chartType : undefined,
        deterministicAnalysis: normalizeSegmentDeclineAnalysis(body.deterministicAnalysis) ?? undefined,
        analyticalResult: normalizeAnalyticalResult(body.analyticalResult) ?? undefined,
        providerName: providerNameFromResponse(body),
        modelName: typeof body.modelName === "string" ? body.modelName : undefined,
        confidence: typeof body.confidence === "number" ? body.confidence : undefined,
        providerStatus: isProviderStatus(body.providerStatus) ? body.providerStatus : undefined,
        privacyWarning: typeof body.privacyWarning === "string" ? body.privacyWarning : null,
        generatedAt: new Date().toISOString(),
      }

      setMessages((current) => [...current, assistantMessage])
    } catch (askError) {
      if (timeoutId) window.clearTimeout(timeoutId)
      const classified = classifyClientFetchError(askError)
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: classified.message,
          error: classified.message,
          errorCode: classified.code,
          retryQuestion: trimmed,
          replyToId: userMessageId,
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

  async function recordOverride(message: AssistantMessage, action: OverrideAction) {
    if (action === "edit") {
      openResponseEditor(message)
      return
    }
    setOverrideMap((prev) => ({ ...prev, [message.id]: action }))
    try {
      await fetch("/api/ai-governance/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traceId: message.traceId,
          datasetId: message.datasetId,
          action,
          originalValue: message.content,
          editedValue: null,
          reason: action === "accept" ? "User accepted AI suggestion" : action === "undo" ? "User undid a prior AI decision" : undefined,
        }),
      })
    } catch (error) {
      debugError("[AI_GOVERNANCE] Override feedback failed", error)
    }
  }

  function openResponseEditor(message: AssistantMessage) {
    setResponseEditor({ message, draft: message.content })
    setResponseEditorError("")
  }

  function closeResponseEditor() {
    if (savingResponseEdit) return
    setResponseEditor(null)
    setResponseEditorError("")
  }

  async function saveResponseEdit() {
    if (!responseEditor || savingResponseEdit) return
    if (!responseEditor.draft.trim()) {
      setResponseEditorError("Edited response cannot be empty.")
      return
    }

    setSavingResponseEdit(true)
    setResponseEditorError("")
    try {
      const response = await fetch("/api/ai-governance/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traceId: responseEditor.message.traceId,
          datasetId: responseEditor.message.datasetId,
          action: "edit",
          originalValue: responseEditor.message.content,
          editedValue: responseEditor.draft,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Edited response could not be saved.")
      }

      const editedMessageId = responseEditor.message.id
      const editedContent = responseEditor.draft
      setMessages((current) => current.map((message) =>
        message.id === editedMessageId ? { ...message, content: editedContent } : message
      ))
      setOverrideMap((prev) => ({ ...prev, [editedMessageId]: "edit" }))
      setResponseEditor(null)
    } catch (error) {
      setResponseEditorError(error instanceof Error ? error.message : "Edited response could not be saved.")
    } finally {
      setSavingResponseEdit(false)
    }
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

  function handleDatasetSelection(dataset: DatasetOption) {
    if (dataset.id === selectedDatasetId) return
    setSelectedDatasetId(dataset.id)
    sessionStorage.setItem(ACTIVE_DATASET_ID_KEY, dataset.id)
  }

  function toggleGhostMode() {
    setGhostMode((current) => {
      const next = !current
      if (next) {
        const noticeSeen = sessionStorage.getItem(GHOST_MODE_NOTICE_KEY) === "true"
        if (!noticeSeen) {
          setShowGhostNotice(true)
          sessionStorage.setItem(GHOST_MODE_NOTICE_KEY, "true")
        }
      } else {
        setShowGhostNotice(false)
        setFeedbackMap({})
        setOverrideMap({})
        setMessages([buildDatasetContextMessage(selectedDatasetId, datasets)])
      }
      return next
    })
  }

  React.useEffect(() => {
    if (!selectedDatasetId || initialUrlQuestionAskedRef.current || !initialUrlQuestionRef.current) return
    initialUrlQuestionAskedRef.current = true
    void askAssistant(initialUrlQuestionRef.current)
  }, [selectedDatasetId])

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
      <Dialog open={Boolean(responseEditor)} onOpenChange={(open) => {
        if (!open) closeResponseEditor()
      }}>
        <DialogContent className="flex max-h-[85vh] max-w-[min(900px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 p-0 text-slate-50 shadow-[0_32px_120px_rgba(2,6,23,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl dark:bg-card/95 sm:max-w-[820px]">
          <div className="border-b border-white/10 px-5 py-4 sm:px-6">
            <DialogHeader className="pr-8">
              <DialogTitle>Edit AI response</DialogTitle>
              <DialogDescription className="text-slate-300">
                Review and edit this response before saving it.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 px-5 py-4 sm:px-6">
            <label htmlFor="ai-response-editor" className="sr-only">
              Edited AI response
            </label>
            <textarea
              id="ai-response-editor"
              ref={responseEditorTextareaRef}
              value={responseEditor?.draft ?? ""}
              onChange={(event) => {
                setResponseEditor((current) => current ? { ...current, draft: event.target.value } : current)
                if (responseEditorError) setResponseEditorError("")
              }}
              className="min-h-[320px] max-h-[55vh] w-full resize-y overflow-y-auto rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-sm leading-6 text-slate-50 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-primary/60 focus:ring-2 focus:ring-primary/30 sm:min-h-[380px]"
              aria-label="Edited AI response"
              disabled={savingResponseEdit}
            />
            {responseEditorError && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {responseEditorError}
              </p>
            )}
          </div>
          <DialogFooter className="border-t border-white/10 px-5 pb-5 pt-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={closeResponseEditor}
              disabled={savingResponseEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveResponseEdit}
              disabled={savingResponseEdit || !responseEditor?.draft.trim()}
              className="gap-2"
            >
              {savingResponseEdit && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingResponseEdit ? "Saving" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      onClick={() => handleDatasetSelection(dataset)}
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

        {showGhostNotice && ghostMode && (
          <div className="flex items-start gap-2 border-b border-cyan-200/20 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-900 dark:text-cyan-100">
            <EclipseModeGlyph enabled className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Eclipse Mode active</p>
              <p className="mt-0.5 text-cyan-900/80 dark:text-cyan-100/80">
                Private AI session with minimized conversation retention. Cloud AI may still process the minimum context required to answer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGhostNotice(false)}
              className="ml-auto rounded p-0.5 text-cyan-900/70 hover:bg-cyan-500/10 hover:text-cyan-950 dark:text-cyan-100/70 dark:hover:text-cyan-50"
              aria-label="Dismiss Eclipse Mode notice"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <AiPrivacyStatusPanel latestMessage={latestProviderMessage} ghostMode={ghostMode} onToggleGhostMode={toggleGhostMode} />

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`${message.deterministicAnalysis ? "w-full max-w-full md:max-w-[92%]" : "max-w-[85%]"} rounded-lg border p-4 shadow-sm ${
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
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          AI-generated
                        </span>
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

                  {message.role === "assistant" && !message.error && (
                    <AiGovernanceMetadata message={message} />
                  )}

                  {message.role === "assistant" && message.error && (
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                      <Info className="h-4 w-4" />
                      Dataset assistant issue
                    </div>
                  )}

                  {message.deterministicAnalysis ? (
                    <SegmentDeclineResults analysis={message.deterministicAnalysis} />
                  ) : message.analyticalResult ? (
                    <AnalyticalResultView result={message.analyticalResult} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  )}

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
                      {message.retryQuestion && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 h-8 gap-1.5 border-destructive/30 bg-background text-xs text-foreground hover:bg-destructive/10"
                          onClick={() => askAssistant(message.retryQuestion || "")}
                          disabled={isAsking}
                        >
                          <Repeat className="h-3.5 w-3.5" />
                          Retry
                        </Button>
                      )}
                    </div>
                  )}

                  {message.role === "assistant" && !message.error && (message.insight || message.explanation || message.recommendation) && (
                    <div className="mt-4 grid gap-3 border-t border-border pt-3 md:grid-cols-3">
                      {message.insight && <ResponseSection title="Insight" text={message.insight} />}
                      {message.explanation && <ResponseSection title="Takeaway" text={message.explanation} />}
                      {message.recommendation && <ResponseSection title="Next move" text={message.recommendation} />}
                    </div>
                  )}

                  {message.role === "assistant" && !message.deterministicAnalysis && !message.analyticalResult && message.data && message.data.length > 0 && (
                    <ResultPreview data={message.data} chartType={message.chartType} />
                  )}

                  {/* Feedback buttons */}
                  {message.role === "assistant" && !message.error && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/30 pt-2">
                      <span className="mr-1 text-[10px] font-medium uppercase text-muted-foreground">Human control</span>
                      {(["accept", "reject", "edit", "undo"] as const).map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => recordOverride(message, action)}
                          disabled={ghostMode}
                          className={`rounded border px-2 py-1 text-[10px] font-medium transition ${
                            overrideMap[message.id] === action
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          }`}
                        >
                          {action === "accept" ? "Accept" : action === "reject" ? "Reject" : action === "edit" ? "Edit" : "Undo"}
                        </button>
                      ))}
                      <span className="ml-auto text-[10px] font-medium uppercase text-muted-foreground">Feedback</span>
                      <button
                        type="button"
                        onClick={() => sendFeedback(message.traceId, "positive")}
                        disabled={ghostMode || !message.traceId}
                        className={`rounded p-1 transition ${
                          feedbackMap[message.traceId || ""] === "positive"
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        }`}
                        aria-label="Mark as helpful"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => sendFeedback(message.traceId, "negative")}
                        disabled={ghostMode || !message.traceId}
                        className={`rounded p-1 transition ${
                          feedbackMap[message.traceId || ""] === "negative"
                            ? "text-destructive bg-destructive/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="mx-auto max-w-3xl">
            <AiAccuracyDisclaimer />
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
                      {ghostMode ? "Eclipse Mode conversations are not saved to history." : "No past conversations yet. Ask a question to get started."}
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

function AiPrivacyStatusPanel({
  latestMessage,
  ghostMode,
  onToggleGhostMode,
}: {
  latestMessage?: AssistantMessage
  ghostMode: boolean
  onToggleGhostMode: () => void
}) {
  const status = latestMessage?.providerStatus
  const message = status?.message || "Provider routing appears after the next AI response."
  const providerName = latestMessage?.providerName || "Not used yet"
  const modelName = latestMessage?.modelName || "Pending"
  const route = status?.route === "local" ? "Local" : status?.route === "cloud" ? "Cloud" : status?.route === "direct" ? "Direct" : status?.route === "none" ? "Unavailable" : "Pending"

  return (
    <div className="border-b border-border bg-background px-4 py-2">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">AI Privacy Status</p>
            <button
              type="button"
              onClick={onToggleGhostMode}
              title="Eclipse Mode minimizes retention of AI conversation content while preserving operational metadata required for security, billing, provider routing, and service reliability."
              role="switch"
              aria-checked={ghostMode}
              aria-label="Eclipse Mode — minimize AI conversation retention"
              className={[
                "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                ghostMode
                  ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-900 shadow-[0_0_20px_rgba(34,211,238,0.12)] dark:text-cyan-100"
                  : "border-border bg-background text-muted-foreground hover:border-cyan-300/40 hover:text-foreground",
              ].join(" ")}
            >
              <EclipseModeGlyph enabled={ghostMode} />
              <span>{ghostMode ? "Eclipse Mode ON" : "Eclipse Mode OFF"}</span>
            </button>
          </div>
          <p className="mt-0.5 text-muted-foreground">
            {ghostMode
              ? "Private AI session with minimized conversation retention. Dataset storage is unchanged."
              : status?.state === "offline_active"
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
          {ghostMode && (
            <span className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-0.5 font-medium text-cyan-800 dark:text-cyan-100">
              No chat history
            </span>
          )}
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

function EclipseModeGlyph({ enabled, className = "" }: { enabled: boolean; className?: string }) {
  return (
    <span
      className={[
        "relative inline-flex h-4 w-4 items-center justify-center overflow-visible",
        className,
      ].join(" ")}
      aria-hidden="true"
    >
      <span
        className={[
          "absolute inset-0 rounded-full border",
          enabled
            ? "border-cyan-200/70 bg-[radial-gradient(circle_at_38%_35%,#fef9c3_0%,#fde68a_36%,#22d3ee_82%)] shadow-[0_0_10px_rgba(34,211,238,0.38)]"
            : "border-amber-200/80 bg-[radial-gradient(circle_at_35%_32%,#fff7cc_0%,#facc15_54%,#f59e0b_100%)] shadow-[0_0_8px_rgba(250,204,21,0.18)]",
        ].join(" ")}
      />
      <span
        className={[
          "absolute left-0 top-0.5 h-3.5 w-3.5 rounded-full border border-slate-700 bg-slate-950 shadow-[inset_0_0_7px_rgba(148,163,184,0.22)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
          enabled ? "translate-x-0.5 opacity-100" : "translate-x-5 opacity-0",
        ].join(" ")}
      />
    </span>
  )
}

function AiGovernanceMetadata({ message }: { message: AssistantMessage }) {
  const route = message.providerStatus?.route
  const mode =
    route === "local"
      ? "Local AI"
      : route === "cloud"
        ? message.providerStatus?.fallbackActive
          ? "Hybrid AI"
          : "Cloud AI"
        : route === "direct"
          ? "Direct Data Analysis"
          : "Hybrid AI"
  const confidence = estimateMessageConfidence(message)
  const generatedAt = message.generatedAt ? new Date(message.generatedAt).toLocaleString() : new Date().toLocaleString()
  const reasoningSummary =
    message.explanation ||
    (message.deterministicAnalysis || message.analyticalResult
      ? "Answer uses deterministic calculations from the selected dataset."
      : message.providerStatus?.message || "Answer uses the configured AI routing policy and available dataset context.")

  return (
    <div className="mb-3 grid gap-2 rounded-md border border-border bg-background/70 p-2 text-[11px] text-muted-foreground sm:grid-cols-2">
      <span><strong className="text-foreground">Provider:</strong> {message.providerName || "Direct Data Analysis"}</span>
      <span><strong className="text-foreground">Model:</strong> {message.modelName || "Deterministic engine"}</span>
      <span><strong className="text-foreground">Mode:</strong> {mode}</span>
      <span><strong className="text-foreground">Confidence:</strong> {confidence}%</span>
      <span><strong className="text-foreground">Generated:</strong> {generatedAt}</span>
      <span><strong className="text-foreground">Reason:</strong> {reasoningSummary}</span>
    </div>
  )
}

function estimateMessageConfidence(message: AssistantMessage) {
  if (typeof message.confidence === "number" && Number.isFinite(message.confidence)) return Math.max(0, Math.min(100, Math.round(message.confidence)))
  if (message.deterministicAnalysis || message.analyticalResult || message.providerStatus?.route === "direct") return 94
  if (message.providerStatus?.state === "connection_healthy") return 88
  if (message.providerStatus?.state === "fallback_active") return 82
  if (message.providerStatus?.state === "provider_unavailable" || message.providerStatus?.state === "local_unavailable") return 58
  return 75
}

function errorExplanation(message: AssistantMessage) {
  if (message.errorCode === "NO_DATASET_SELECTED") return "No dataset was selected for this Dataset AI request."
  if (message.errorCode === "DATASET_NOT_FOUND") return "The dataset ID in the request does not match an available dataset for this account."
  if (message.errorCode === "UNAUTHORIZED") return "The request did not include a valid signed-in session."
  if (message.errorCode === "EMPTY_DATASET") return "The selected dataset has no usable rows for grounded analysis."
  if (message.errorCode === "PROVIDER_TIMEOUT") return "The Dataset AI request exceeded the response time limit."
  if (message.errorCode === "NETWORK_ERROR") return "The browser connection to the Dataset AI endpoint was interrupted."
  if (message.errorCode === "PROVIDER_MISSING") return "Dataset context loaded, but no AI provider is configured for provider-backed answers."
  if (message.errorCode === "PROVIDER_UNAVAILABLE" || message.errorCode === "AI_PROVIDER_ERROR") return "The provider route is unavailable after dataset context preparation."
  if (message.errorCode === "INVALID_PROVIDER_RESPONSE") return "The provider returned a response the Dataset AI could not parse safely."
  if (message.providerStatus?.label === "Failed before provider execution") {
    return "The request stopped during dataset validation or deterministic analysis before any AI provider was selected."
  }
  if (message.errorCode?.startsWith("missing_") || message.errorCode === "insufficient_periods") {
    return "The selected dataset does not contain enough validated fields for this analysis."
  }
  return "The assistant could not complete this request. The provider status above shows whether the failure happened before or during provider routing."
}

function errorNextStep(message: AssistantMessage) {
  if (message.errorCode === "NO_DATASET_SELECTED") return "Select a dataset in the left sidebar, then ask again."
  if (message.errorCode === "DATASET_NOT_FOUND") return "Refresh the dataset list and choose the dataset again."
  if (message.errorCode === "UNAUTHORIZED") return "Sign in again and retry the question."
  if (message.errorCode === "EMPTY_DATASET") return "Upload a dataset with rows and columns before asking Dataset AI."
  if (message.errorCode === "PROVIDER_TIMEOUT" || message.errorCode === "NETWORK_ERROR") return "Use Retry to send the same question again."
  if (message.errorCode === "PROVIDER_MISSING") return "Ask a revenue, segment, trend, or risk question for direct dataset analysis, or configure an AI provider."
  if (message.errorCode === "PROVIDER_UNAVAILABLE" || message.errorCode === "AI_PROVIDER_ERROR") return "Retry shortly, or check AI Providers if provider-backed answers are required."
  if (message.errorCode === "INVALID_PROVIDER_RESPONSE") return "Retry the same question. If it repeats, switch provider settings."
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
