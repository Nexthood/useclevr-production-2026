"use client"

import * as React from "react"
import { Sparkles, Send, X, MessageSquare, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface ChatPanelProps {
  datasetId?: string
  datasetName?: string
  columns?: string[]
  onColumnClick?: (columnName: string) => void
}

export function ChatPanel({ datasetId, datasetName, columns = [], onColumnClick }: ChatPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [inputValue, setInputValue] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // Fetch suggestions when dataset changes
  React.useEffect(() => {
    if (datasetId) {
      fetch(`/api/datasets/${datasetId}/suggestions`)
        .then(res => res.json())
        .then(data => {
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestions(data.suggestions)
          }
        })
        .catch(console.error)
    } else {
      setSuggestions([])
    }
  }, [datasetId])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (text?: string) => {
    const messageText = text || inputValue.trim()
    if (!messageText || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)
    setIsExpanded(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: messageText }],
          datasetId,
          context: { datasetName },
        }),
      })

      if (!response.ok) throw new Error("Failed")

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: "Error. Please try again.", timestamp: new Date() },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleColumnClick = (col: string) => {
    handleSend(`Analyze the "${col}" column`)
    onColumnClick?.(col)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isExpanded) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setIsExpanded(true)}
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => setIsExpanded(false)} />
      <div className="relative bg-background w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="bg-primary p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Clevr AI Analyst</h3>
              <p className="text-white/70 text-xs">{datasetName || "Your data assistant"}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)} className="text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Ask about your data</p>
              
              {/* Smart Suggestions */}
              {suggestions.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.slice(0, 4).map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(suggestion)}
                        className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs hover:bg-blue-100 dark:hover:bg-blue-900 text-left max-w-[200px]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {columns.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {columns.slice(0, 5).map((col) => (
                    <button
                      key={col}
                      onClick={() => handleColumnClick(col)}
                      className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm hover:bg-primary/20"
                    >
                      {col}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl p-3 text-sm ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          {/* Quick suggestions above input */}
          {suggestions.length > 0 && messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {suggestions.slice(0, 3).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(suggestion)}
                  className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs hover:bg-blue-100 dark:hover:bg-blue-900"
                >
                  {suggestion.length > 40 ? suggestion.slice(0, 40) + '...' : suggestion}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question..."
              className="pr-10 h-10"
              disabled={isLoading}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
