"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Sparkles, 
  Send, 
  Loader2, 
  FileSpreadsheet, 
  Columns, 
  Rows, 
  Database,
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb,
  Copy,
  ThumbsUp,
  ThumbsDown
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  confidence?: "high" | "medium" | "low"
  columns_used?: string[]
}

interface ColumnInfo {
  name: string
  type: string
  non_null_count: number
  sample_values: unknown[]
}

interface AiChatInterfaceProps {
  datasetId: string
  datasetName: string
  columns: ColumnInfo[]
  rowCount: number
}

export function AiChatInterface({ datasetId, datasetName, columns, rowCount }: AiChatInterfaceProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [inputValue, setInputValue] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [columnsUsed, setColumnsUsed] = React.useState<string[]>([])
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const exampleQuestions = [
    "What patterns do you see in the data?",
    "Show me the distribution of values",
    "What are the key insights from this dataset?",
    "Are there any outliers or anomalies?",
  ]

  const handleSend = async () => {
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
    setColumnsUsed([])

    try {
      const response = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: inputValue }],
          datasetId,
          context: { columns, rowCount },
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        confidence: data.confidence || "high",
        columns_used: data.columns_used || [],
      }

      setMessages((prev) => [...prev, assistantMessage])
      setColumnsUsed(data.columns_used || [])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
        confidence: "low",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getConfidenceColor = (confidence?: string) => {
    switch (confidence) {
      case "high": return "text-green-500"
      case "medium": return "text-yellow-500"
      case "low": return "text-red-500"
      default: return "text-muted-foreground"
    }
  }

  const getConfidenceLabel = (confidence?: string) => {
    switch (confidence) {
      case "high": return "High confidence"
      case "medium": return "Medium confidence"
      case "low": return "Lower confidence"
      default: return ""
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{datasetName}</h1>
              <p className="text-xs text-muted-foreground">
                {rowCount.toLocaleString()} rows • {columns.length} columns
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Dataset Metadata */}
        <div className="w-72 border-r border-border/40 bg-muted/30 p-4 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Dataset Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Rows</span>
                  <span className="font-medium">{rowCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Columns</span>
                  <span className="font-medium">{columns.length}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Columns className="h-4 w-4" />
                Columns
              </h3>
              <div className="space-y-1">
                {columns.slice(0, 10).map((col) => (
                  <button
                    key={col.name}
                    onClick={() => {
                      setInputValue(`Analyze the "${col.name}" column`)
                      handleSend()
                    }}
                    className={`w-full text-sm py-1.5 px-2 rounded-md transition-colors text-left ${
                      columnsUsed.includes(col.name) 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-muted hover:text-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{col.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{col.type}</span>
                    </div>
                  </button>
                ))}
                {columns.length > 10 && (
                  <p className="text-xs text-muted-foreground py-2">
                    +{columns.length - 10} more columns
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Panel - Chat Interface */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl font-semibold">Ask your data a question</h3>
                  <p className="text-muted-foreground">
                    I'll analyze your dataset and provide insights in plain English. 
                    No SQL or technical knowledge required.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {exampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => setInputValue(question)}
                      className="text-left p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                    >
                      <Lightbulb className="h-4 w-4 text-primary mb-1" />
                      <span>{question}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-xl p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "assistant" && message.confidence && (
                      <div className="flex items-center gap-2 mb-2 text-xs">
                        <span className={getConfidenceColor(message.confidence)}>
                          {getConfidenceLabel(message.confidence)}
                        </span>
                      </div>
                    )}
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    
                    {message.role === "assistant" && message.columns_used && message.columns_used.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Info className="h-3 w-3" />
                          <span>Columns used in analysis</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {message.columns_used.map((col) => (
                            <span
                              key={col}
                              className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {message.role === "assistant" && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
                        <button className="p-1 rounded hover:bg-background/50 transition-colors">
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button className="p-1 rounded hover:bg-background/50 transition-colors">
                          <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button className="p-1 rounded hover:bg-background/50 transition-colors">
                          <ThumbsDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium">U</span>
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border/40 p-4 pb-24">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask your data a question..."
                  className="pr-12 h-12"
                  disabled={isLoading}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
