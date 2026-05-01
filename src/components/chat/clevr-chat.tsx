"use client"

import * as React from "react"
import { 
  Sparkles, 
  Send, 
  Loader2, 
  X, 
  Upload, 
  BarChart3, 
  TrendingUp, 
  FileQuestion,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Clevr Agent Configuration
const CLEVR_CONFIG = {
  name: "Clevr",
  role: "AI Data Agent",
  greeting: [
    "Hi, I'm Clevr. I help you work with data.",
    "Upload a CSV and I'll take it from there.",
    "I'm here to turn your data into answers."
  ],
  idlePrompts: [
    "Need help with your data?",
    "I can analyze your CSV.",
    "Ask me anything about your dataset."
  ],
  quickActions: [
    { id: "upload", label: "Upload a CSV", icon: Upload },
    { id: "analyze", label: "Analyze my data", icon: BarChart3 },
    { id: "trends", label: "Find trends", icon: TrendingUp },
    { id: "explain", label: "Explain this dataset", icon: FileQuestion }
  ],
  followUpOptions: [
    "Get a summary",
    "Find trends",
    "Detect problems",
    "Ask a specific question"
  ]
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  suggestedActions?: string[]
}

interface ClevrChatProps {
  datasetId?: string
  datasetName?: string
  onUpload?: () => void
  onAnalyze?: () => void
  onFindTrends?: () => void
  onExplain?: () => void
}

export function ClevrChat({ 
  datasetId, 
  datasetName,
  onUpload,
  onAnalyze,
  onFindTrends,
  onExplain 
}: ClevrChatProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [inputValue, setInputValue] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [greetingIndex, setGreetingIndex] = React.useState(0)
  const [idlePromptIndex, setIdlePromptIndex] = React.useState(0)
  const [showOptions, setShowOptions] = React.useState(false)
  const [isIdle, setIsIdle] = React.useState(true)
  const idleTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // Listen for toggle-chat event from button
  React.useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev)
    window.addEventListener('toggle-chat', handleToggle)
    return () => window.removeEventListener('toggle-chat', handleToggle)
  }, [])

  // Initialize with random greeting
  React.useEffect(() => {
    const randomIndex = Math.floor(Math.random() * CLEVR_CONFIG.greeting.length)
    setGreetingIndex(randomIndex)
  }, [])
  
  // Cycle through idle prompts
  React.useEffect(() => {
    if (!isOpen && isIdle) {
      const interval = setInterval(() => {
        setIdlePromptIndex(prev => (prev + 1) % CLEVR_CONFIG.idlePrompts.length)
      }, 10000) // Change every 10 seconds
      return () => clearInterval(interval)
    }
  }, [isOpen, isIdle])

  // Handle idle timeout - resume animations after 10 seconds of inactivity
  React.useEffect(() => {
    if (!isOpen) {
      // Set idle timeout to resume animations after 10 seconds
      idleTimeoutRef.current = setTimeout(() => {
        setIsIdle(true)
      }, 10000)
      
      return () => {
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current)
        }
      }
    }
  }, [isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getQuickActionHandler = (actionId: string) => {
    switch (actionId) {
      case "upload":
        return () => {
          addMessage("user", "How do I upload a CSV?")
          setTimeout(() => {
            addMessage("assistant", 
              "Follow these steps:\n\n1️⃣ Click Upload Dataset\n2️⃣ Select your CSV file\n3️⃣ Wait for processing\n\nOnce it's ready, I'll guide you through the analysis.", 
              ["Upload a CSV"]
            )
          }, 500)
          onUpload?.()
        }
      case "analyze":
        return () => {
          addMessage("user", "Analyze my data")
          setTimeout(() => {
            addMessage("assistant", 
              "Great. What would you like to do first?\n\n1️⃣ Get a summary\n2️⃣ Find trends\n3️⃣ Detect problems\n4️⃣ Ask a specific question",
              ["Get a summary", "Find trends", "Detect problems", "Ask a specific question"]
            )
          }, 500)
          onAnalyze?.()
        }
      case "trends":
        return () => {
          addMessage("user", "Find trends")
          setTimeout(() => {
            addMessage("assistant", 
              "I'll help you spot trends in your data.\n\nWhat kind of trends interest you?\n\n• Over time patterns\n• Category comparisons\n• Seasonal variations\n• Growth/decline indicators",
              ["Over time", "By category", "Seasonal", "Growth rates"]
            )
          }, 500)
          onFindTrends?.()
        }
      case "explain":
        return () => {
          addMessage("user", "Explain this dataset")
          setTimeout(() => {
            if (datasetName) {
              addMessage("assistant", 
                `I'll analyze "${datasetName}" for you.\n\nHere are the key aspects I'll cover:\n\n• Data structure overview\n• Column descriptions\n• Data quality assessment\n• Notable patterns\n\nWhat would you like to know first?`,
                ["Data summary", "Column details", "Quality check", "Key insights"]
              )
            } else {
              addMessage("assistant", 
                "Upload a dataset first, then I can provide:\n\n• Column overview\n• Data types\n• Sample values\n• Quality issues\n\nUpload a CSV to get started!",
                ["Upload a CSV"]
              )
            }
          }, 500)
          onExplain?.()
        }
      default:
        return () => {}
    }
  }

  const addMessage = (role: "user" | "assistant", content: string, suggestedActions?: string[]) => {
    const message: Message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      role,
      content,
      timestamp: new Date(),
      suggestedActions
    }
    setMessages(prev => [...prev, message])
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue
    setInputValue("")
    addMessage("user", userMessage)
    setIsLoading(true)
    setShowOptions(false)

    // Detect analytical questions and route to appropriate endpoint
    const isAnalytical = /how many|total|sum|average|highest|lowest|most|least|profit|revenue|region|top|percentage|margin|count|number of|product|loss|negative/i.test(userMessage);
    const endpoint = isAnalytical ? '/api/query' : '/api/chat';
    
    // Prepare request body based on endpoint
    const requestBody = isAnalytical 
      ? { datasetId, question: userMessage }
      : { messages: [{ role: "user", content: userMessage }], datasetId, context: { datasetName } };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const data = await response.json()

      // Handle error responses
      if (data.error) {
        addMessage("assistant", data.error + (data.reason ? `: ${data.reason}` : ''));
      } else {
        // Determine suggested actions based on message content
        const content = data.content || data.result || JSON.stringify(data);
        const suggestedActions = detectSuggestedActions(userMessage, content)
        addMessage("assistant", content, suggestedActions.length > 0 ? suggestedActions : undefined)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addMessage("assistant", "Fehler: " + msg + ". Bitte versuchen Sie es erneut.")
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

  const handleSuggestedAction = (action: string) => {
    addMessage("user", action)
    setIsLoading(true)

    // Simulate quick response for common actions
    setTimeout(() => {
      let response = ""
      const actionLower = action.toLowerCase()

      if (actionLower.includes("summary")) {
        response = "Here's what I found:\n\n• Total records: " + (datasetId ? "analyzing..." : "waiting for data") + "\n• Date range: pending\n• Key metrics: pending\n• Notable: Upload your data for full analysis"
      } else if (actionLower.includes("trend")) {
        response = "Looking for trends requires time-based data.\n\nI can help identify:\n• Growth patterns\n• Seasonal fluctuations\n• Anomalies\n\nIs your data time-series?"
      } else if (actionLower.includes("problem") || actionLower.includes("issue")) {
        response = "I'll scan for common data issues:\n\n• Missing values\n• Duplicates\n• Inconsistent formatting\n• Outliers\n\nThis helps ensure accurate analysis."
      } else {
        response = `Great question about "${action}". Let me analyze that for you.\n\n[Full analysis would appear here with your data]`
      }

      addMessage("assistant", response)
      setIsLoading(false)
    }, 800)
  }

  const detectSuggestedActions = (userMessage: string, assistantResponse: string): string[] => {
    const messageLower = (userMessage + " " + assistantResponse).toLowerCase()
    const actions: string[] = []

    if (messageLower.includes("summary") || messageLower.includes("overview")) {
      actions.push("Get detailed summary", "Show statistics", "Compare segments")
    }
    if (messageLower.includes("trend") || messageLower.includes("pattern")) {
      actions.push("Show trend chart", "Compare periods", "Forecast future")
    }
    if (messageLower.includes("problem") || messageLower.includes("issue") || messageLower.includes("error")) {
      actions.push("Show all issues", "Fix problems", "Ignore for now")
    }
    if (messageLower.includes("insight") || messageLower.includes("finding")) {
      actions.push("Deep dive", "Create visualization", "Export findings")
    }

    return actions.slice(0, 3)
  }

  const isFirstInteraction = messages.length === 0

  // Animation classes based on state
  const getAnimationClass = () => {
    if (isOpen) return ""
    if (isHovered || !isIdle) return ""
    return "animate-float-and-pulse"
  }

  return (
    <>
      {/* Floating Chat Button with Pulse Animation */}
      <div 
        className="fixed bottom-7 right-7 z-50"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Idle Prompt Badge */}
        {!isOpen && isIdle && (
          <div className="absolute -top-10 right-0 bg-background border border-border/50 rounded-full px-3 py-1 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {CLEVR_CONFIG.idlePrompts[idlePromptIndex]}
            </p>
          </div>
        )}
        
        <button
          onClick={() => {
            if (isOpen) {
              setIsOpen(false)
              // Resume idle state and animations after closing
              setIsIdle(true)
            } else {
              setIsOpen(true)
              setIsIdle(false)
              if (idleTimeoutRef.current) {
                clearTimeout(idleTimeoutRef.current)
              }
            }
          }}
          className={`relative h-14 w-14 rounded-full bg-primary shadow-lg transition-all duration-300 flex items-center justify-center group ${getAnimationClass()}`}
          aria-label={isOpen ? "Close chat" : "Open chat"}
        >
          {/* Outer Glow Effect */}
          <span className={`absolute inset-0 rounded-full transition-all duration-500 ${isHovered || !isIdle ? 'shadow-[0_0_25px_rgba(139,92,246,0.4)]' : 'shadow-[0_0_20px_rgba(139,92,246,0.3)]'}`} />
          
          {/* Inner Glow Layer */}
          <span className={`absolute inset-0 rounded-full bg-primary/10 transition-opacity duration-300 ${isHovered || !isIdle ? 'opacity-100' : 'opacity-60'}`} />
          
          {/* Button Content */}
          <div className="relative">
            {isOpen ? (
              <X className="h-6 w-6 text-white" />
            ) : (
              <Sparkles className="h-6 w-6 text-white" />
            )}
          </div>
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-20 w-80 sm:w-96 bg-background rounded-2xl shadow-2xl border border-border/50 z-50 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="bg-primary p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">{CLEVR_CONFIG.name}</h3>
              <p className="text-white/70 text-xs">{CLEVR_CONFIG.role}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-4">
            {isFirstInteraction ? (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <p className="text-sm">{CLEVR_CONFIG.greeting[greetingIndex]}</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium ml-11">Quick actions</p>
                  <div className="grid grid-cols-2 gap-2 ml-11">
                    {CLEVR_CONFIG.quickActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={getQuickActionHandler(action.id)}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left text-sm"
                      >
                        <action.icon className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="truncate">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                    )}
                    
                    <div className={`max-w-[80%] ${message.role === "user" ? "order-first" : ""}`}>
                      <div
                        className={`rounded-2xl p-3 text-sm ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted rounded-tl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>

                      {/* Suggested Actions */}
                      {message.suggestedActions && message.suggestedActions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.suggestedActions.map((action, index) => (
                            <button
                              key={index}
                              onClick={() => handleSuggestedAction(action)}
                              className="block w-full text-left px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              → {action}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium">U</span>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2 justify-start">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm p-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border/50 p-3">
            <div className="relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Clevr..."
                className="pr-10 h-10 text-sm"
                disabled={isLoading}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
