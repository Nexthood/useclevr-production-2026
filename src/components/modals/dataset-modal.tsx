"use client"

import * as React from "react"
import { X, Download, Sparkles, Send, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface DatasetModalProps {
  isOpen: boolean
  onClose: () => void
  dataset: {
    id: string
    name: string
    fileName: string
    rowCount: number
    columnCount: number
    columns: string[]
    createdAt: Date | null
  } | null
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface AnalysisResult {
  file_info: {
    rows: number
    columns: number
    column_names: string[]
    inferred_type: string
    date_range: string | null
  }
  key_metrics: {
    business_insights: string[]
  }
  recommendations: string[]
}

export function DatasetModal({ isOpen, onClose, dataset }: DatasetModalProps): React.ReactNode {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [inputValue, setInputValue] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [analysisResult, setAnalysisResult] = React.useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // Auto-analyze when modal opens
  React.useEffect(() => {
    if (isOpen && dataset) {
      analyzeDataset()
    }
  }, [isOpen, dataset])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const analyzeDataset = async () => {
    if (!dataset) return
    
    setIsAnalyzing(true)
    setMessages([
      {
        id: "loading",
        role: "assistant",
        content: `Analyzing "${dataset.name}"...`,
        timestamp: new Date(),
      },
    ])
    
    try {
      const response = await fetch(`/api/datasets/${dataset.id}/analyze`, {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json()
        const fullError = errorData.details 
          ? `${errorData.error}: ${errorData.details}` 
          : (errorData.error || "Analysis failed")
        throw new Error(fullError)
      }

      const data = await response.json()
      setAnalysisResult(data)
      
      setMessages([
        {
          id: "1",
          role: "assistant",
          content: `Analysis complete! I've analyzed "${dataset.name}" with ${data.file_info.rows.toLocaleString()} rows. ${data.key_metrics?.business_insights?.length || 0} insights found. Ask me anything about your data!`,
          timestamp: new Date(),
        },
      ])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze"
      setMessages([
        {
          id: "error",
          role: "assistant",
          content: `I couldn't analyze this dataset: ${errorMessage}. But I can still chat about your data! Ask me anything about "${dataset.name}".`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "I can help you analyze this data. What specific insights are you looking for?",
        "Based on this dataset, I can see patterns in your data. Would you like me to explore them?",
        "Great question! Let me provide insights about your data.",
        `This dataset has ${dataset?.rowCount.toLocaleString()} rows and ${dataset?.columnCount} columns. What would you like to know?`,
      ]
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickActions = [
    "Show data summary",
    "Find trends",
    "Analyze columns",
    "Check quality",
  ]

  if (!isOpen || !dataset) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Full Screen Modal - Grok Style */}
      <div className="fixed inset-0 z-50 flex">
        {/* Left Side - Data Overview */}
        <div className="w-96 bg-card border-r border-border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-foreground font-medium truncate">{dataset.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {dataset.rowCount.toLocaleString()} rows • {dataset.columnCount} columns
                </p>
              </div>
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-2">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Analyzing...</span>
                </>
              ) : analysisResult ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-green-400">Analysis ready</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Analysis Summary */}
          {analysisResult && (
            <div className="p-4 border-b border-border bg-muted/50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-green-400 text-sm font-medium">Analysis Complete</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {analysisResult.file_info.inferred_type}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {analysisResult.key_metrics?.business_insights?.length || 0} insights found
              </p>
            </div>
          )}

          {/* Columns List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Columns</h3>
            <div className="space-y-2">
              {dataset.columns.map((col, idx) => (
                <div key={idx} className="flex items-center justify-between bg-muted rounded-lg p-3">
                  <span className="text-foreground text-sm truncate">{col}</span>
                  <span className="text-xs text-muted-foreground">String</span>
                </div>
              ))}
            </div>
          </div>

          {/* Export Button */}
          <div className="p-4 border-t border-border">
            <Button variant="outline" className="w-full border-border text-foreground hover:bg-muted">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>

        {/* Right Side - AI Chat */}
        <div className="flex-1 flex flex-col bg-background">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-foreground font-medium">Clevr AI Analyst</h2>
                <p className="text-xs text-muted-foreground">{dataset.name}</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-gradient-primary text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-muted-foreground">U</span>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-b border-border">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => setInputValue(action)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-sm text-foreground transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4">
            <div className="relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your data..."
                className="pr-12 h-10 bg-muted border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary"
                disabled={isLoading}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
