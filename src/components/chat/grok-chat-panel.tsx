"use client"

import { debugError } from "@/lib/debug"



import { Button } from "@/components/ui/button"
import {
  BarChart3,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from "lucide-react"
import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  insight?: string
  explanation?: string
  recommendation?: string
  data?: any[]
  chartType?: "bar" | "line" | "pie" | "table"
  metricColumn?: string
}

interface GrokChatPanelProps {
  isOpen?: boolean
  onClose?: () => void
  datasetId?: string
  datasetName?: string
  rowCount?: number
  columnCount?: number
  data?: any[]
  columns?: string[]
  analysis?: any
}

// Clickable suggestion cards for welcome area - pill shaped
const welcomeSuggestions = [
  "Top performing products",
  "Revenue trends",
  "Most profitable regions",
  "Customer churn risk",
  "Growth opportunities",
]

// Quick question chips above input
const quickQuestionChips = [
  { label: "Top regions", icon: TrendingUp },
  { label: "Revenue trends", icon: BarChart3 },
  { label: "Customer churn risk", icon: TrendingDown },
  { label: "Growth opportunities", icon: Zap },
]

// Chart colors
const CHART_COLORS = ['#22D3EE', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#A855F7'];

// Number formatter - compact display like 301K or 2.67M
const formatCompactNumber = (num: number | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';

  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(2);
};

/**
 * Render chart based on data and chart type
 */
function ChartRenderer({ data, chartType, metricColumn }: { data: any[], chartType: string, metricColumn?: string }) {
  if (!data || data.length === 0) return null;

  // Get the label and value keys
  const keys = Object.keys(data[0]);
  const labelKey = keys.find(k => k !== metricColumn && typeof data[0][k] === 'string') || keys[0];
  const valueKey = metricColumn || keys.find(k => typeof data[0][k] === 'number') || keys[1];

  const chartData = data.map((row, idx) => ({
    name: String(row[labelKey] || row[keys[0]] || `Item ${idx + 1}`),
    value: Number(row[valueKey]) || 0,
  }));

  if (chartType === 'line') {
    return (
      <div className="animate-fade-in mt-3 min-w-0 min-h-0" style={{ minWidth: 0, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height={160} minWidth={0} minHeight={0} aspect={undefined}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252C38" />
            <XAxis dataKey="name" stroke="#8B97A8" fontSize={12} />
            <YAxis stroke="#8B97A8" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#141A23', border: '1px solid #252C38', borderRadius: '8px' }}
              labelStyle={{ color: '#E6EDF3' }}
              formatter={(value: number | undefined) => [formatCompactNumber(value), '']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#22D3EE"
              strokeWidth={2}
              dot={{ fill: '#22D3EE', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#8B5CF6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'pie') {
    return (
      <div className="animate-fade-in mt-3 min-w-0 min-h-0" style={{ minWidth: 0, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height={160} minWidth={0} minHeight={0} aspect={undefined}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#141A23', border: '1px solid #252C38', borderRadius: '8px' }}
              labelStyle={{ color: '#E6EDF3' }}
              formatter={(value: number | undefined) => [formatCompactNumber(value), '']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default to bar chart
  // Don't render bar chart if only 1 category - show text instead
  const validDataPoints = chartData.filter(d => d.value > 0);
  if (chartType !== 'line' && chartType !== 'pie' && validDataPoints.length === 1) {
    const item = validDataPoints[0];
    return (
      <div className="mt-3 p-3 rounded-lg bg-[#141A23] border border-[#2A3442]">
        <p className="text-sm text-[#8B97A8]">
          <span className="text-[#E6EDF3] font-medium">{item.name}</span>: ${formatCompactNumber(item.value)}
        </p>
      </div>
    );
  }
  if (chartType !== 'line' && chartType !== 'pie' && validDataPoints.length < 2) {
    return null;
  }

  return (
    <div className="animate-fade-in mt-3 min-w-0 min-h-0" style={{ minWidth: 0, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height={160} minWidth={0} minHeight={0} aspect={undefined}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252C38" />
          <XAxis dataKey="name" stroke="#8B97A8" fontSize={12} />
          <YAxis stroke="#8B97A8" fontSize={12} />
          <Tooltip
            contentStyle={{ backgroundColor: '#141A23', border: '1px solid #252C38', borderRadius: '8px' }}
            labelStyle={{ color: '#E6EDF3' }}
            formatter={(value: number | undefined) => [formatCompactNumber(value), '']}
          />
          <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrokChatPanel({ isOpen = false, onClose, datasetId, datasetName, rowCount, columnCount, data: chatData, columns: chatColumns }: GrokChatPanelProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [inputValue, setInputValue] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [attachedFile, setAttachedFile] = React.useState<File | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Add welcome message when panel opens for first time
  React.useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: "welcome",
        role: "assistant",
        content: "I'm your AI data analyst. Choose a suggested question to explore your dataset.",
        timestamp: new Date(),
        insight: "Your dataset is ready for analysis",
        explanation: `${datasetName || 'This dataset'} contains ${rowCount || 0} rows and ${columnCount || 0} columns. I can help you discover trends, compare metrics, and get actionable recommendations.`,
        recommendation: "Select one of the suggested questions below to begin.",
      }
      setMessages([welcomeMessage])
    }
  }, [isOpen, datasetName, rowCount, columnCount])

  const handleSend = async (text?: string) => {
    const messageText = text || inputValue.trim()
    // Allow sending if there's text OR an attached file
    if (!messageText && !attachedFile) return

    // Include attachment info in the message
    const attachmentInfo = attachedFile ? ` [Attached file: ${attachedFile.name}]` : ''
    const fullMessage = messageText + attachmentInfo

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: fullMessage,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setAttachedFile(null) // Clear attachment after sending
    setIsLoading(true)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: messageText,
          datasetId,
          data: chatData || [],
          columns: chatColumns || [],
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const responseData = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseData.answer || responseData.response || "I couldn't get a response. Please try again.",
        timestamp: new Date(),
        insight: responseData.insight,
        explanation: responseData.explanation,
        recommendation: responseData.recommendation,
        data: responseData.data,
        chartType: responseData.chartType,
        metricColumn: responseData.metricColumn,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
        insight: "Analysis failed",
        explanation: "There was an error processing your request. Please check your connection and try again.",
        recommendation: "Try rephrasing your question or uploading a different dataset.",
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

  const clearChat = () => {
    setMessages([])
  }

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/report/${datasetId}?share=true`
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert("Share link copied to clipboard!")
    } catch {
      debugError("Failed to copy share link")
    }
  }

  const handleNewAnalysis = () => {
    // Clear chat and start new analysis
    setMessages([])
  }

  const extractInsight = (content: string): string => {
    const sentences = content.split(/[.!?]/)
    return sentences[0]?.trim() || "Key finding"
  }

  const extractExplanation = (content: string): string => {
    const sentences = content.split(/[.!?]/)
    return sentences.slice(1, 3).join(". ").trim() || content.substring(0, 200)
  }

  const extractRecommendation = (content: string): string => {
    const recommendations = [
      "Consider focusing on top-performing segments",
      "Review underperforming areas for improvement",
      "Monitor key metrics weekly",
      "Expand successful strategies to other areas",
    ]
    return recommendations[Math.floor(Math.random() * recommendations.length)]
  }

  return (
    <>
      {/* Sliding Panel Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Main Panel - Full height AI workspace */}
      <div
        className={`fixed top-0 right-0 h-full w-[calc(100%-240px)] bg-background z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header - Minimal AI Analyst header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">AI Analyst</h2>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* New Analysis Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewAnalysis}
                className="text-[#8B97A8] hover:text-[#E6EDF3] hover:bg-[#141A23] h-8 px-3 text-sm"
              >
                New Analysis
              </Button>

              {/* Share Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="text-[#8B97A8] hover:text-[#E6EDF3] hover:bg-[#141A23] h-8 px-3 text-sm"
              >
                Share
              </Button>

              {/* Close Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-[#8B97A8] hover:text-[#E6EDF3] hover:bg-[#141A23] h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages - Scrollable area with max-width 880px centered */}
          <div className="flex-1 overflow-y-auto pb-24 min-h-0">
            <div className="max-w-[880px] mx-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`animate-slide-in-up ${message.role === "user" ? "flex justify-end" : "flex justify-start"}`}
                >
                  <div className={`max-w-[90%] ${message.role === "user" ? "order-2" : "order-1"}`}>
                    {message.role === "user" ? (
                      // User message bubble - gradient on right
                      <div className="max-w-[420px] rounded-[16px] px-4 py-3 text-white shadow-lg"
                           style={{
                             background: 'linear-gradient(135deg, #22D3EE, #8B5CF6)',
                           }}>
                        <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                    ) : (
                      // AI Response - Single message bubble with sections
                      <div className="max-w-[680px] rounded-[14px] px-4 py-4 border"
                           style={{
                             background: '#141A23',
                             borderColor: '#2A3442',
                           }}>
                        {/* INSIGHT Section - short human-readable summary */}
                        {message.insight && (
                          <div className="mt-0">
                            <p className="text-[13px] uppercase tracking-wide font-medium" style={{ color: '#22D3EE' }}>
                              INSIGHT
                            </p>
                            <p className="text-[15px] text-[#E6EDF3] leading-[1.6] mt-1">
                              {message.insight}
                            </p>
                          </div>
                        )}

                        {/* Chart Card - separated from text */}
                        {message.data && message.data.length > 0 && message.chartType && message.chartType !== 'table' && (
                          <div
                            className="mt-3 rounded-[14px] border p-4"
                            style={{
                              background: '#141A23',
                              borderColor: '#2A3442',
                            }}
                          >
                            <p className="text-[13px] uppercase tracking-wide font-medium mb-3" style={{ color: '#8B5CF6' }}>
                              VISUAL RESULT
                            </p>
                            <ChartRenderer
                              data={message.data}
                              chartType={message.chartType}
                              metricColumn={message.metricColumn}
                            />
                          </div>
                        )}

                        {/* KEY TAKEAWAYS - bullet points from explanation */}
                        {message.explanation && (
                          <div className="mt-3">
                            <p className="text-[13px] uppercase tracking-wide font-medium" style={{ color: '#8B5CF6' }}>
                              KEY TAKEAWAYS
                            </p>
                            <div className="text-[15px] leading-[1.6] mt-1" style={{ color: '#8B97A8' }}>
                              {message.explanation.split(/[\n\•\-]/).filter(Boolean).slice(0, 3).map((point, i) => (
                                <p key={i} className="flex gap-2 mt-1">
                                  <span>•</span>
                                  <span>{point.trim()}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* RECOMMENDATION Section - actionable recommendation */}
                        {message.recommendation && (
                          <div className="mt-3">
                            <p className="text-[13px] uppercase tracking-wide font-medium" style={{ color: '#22C55E' }}>
                              RECOMMENDATION
                            </p>
                            <p className="text-[15px] text-[#E6EDF3] leading-[1.6] mt-1">
                              {message.recommendation}
                            </p>
                          </div>
                        )}

                        {/* Quick Question Chips - attached to assistant result */}
                        <div className="mt-4 pt-3 border-t border-[#2A3442]">
                          <div className="flex flex-wrap gap-2">
                            {quickQuestionChips.map((chip, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSend(chip.label)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C2431] border border-[#2A3442] text-xs text-[#8B97A8] hover:text-[#E6EDF3] hover:bg-[#252C38] transition-all duration-200 disabled:opacity-50"
                              >
                                <chip.icon className="h-3 w-3" />
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading State - Thinking indicator */}
              {isLoading && (
                <div className="flex justify-start animate-slide-in-up">
                  <div className="bg-[#141A23] rounded-2xl px-6 py-4 border border-[#252C38]">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-white animate-pulse" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-[#22D3EE] rounded-full animate-thinking" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-[#8B5CF6] rounded-full animate-thinking" style={{ animationDelay: '200ms' }}></span>
                        <span className="w-2 h-2 bg-[#22D3EE] rounded-full animate-thinking" style={{ animationDelay: '400ms' }}></span>
                      </div>
                      <span className="text-sm text-[#8B97A8] ml-2">Analyzing your data...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Welcome Suggestion Cards - Pill shaped */}
          {messages.length === 1 && messages[0].id === "welcome" && (
            <div className="px-6 pb-32">
              <div className="max-w-[880px] mx-auto">
                <p className="text-base text-[#8B97A8] mb-4">Choose a suggested question to explore your dataset.</p>
                <div className="flex flex-wrap gap-3">
                  {welcomeSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(suggestion)}
                      disabled={isLoading}
                      className="px-[18px] py-[10px] rounded-[999px] bg-[#141A23] border border-[#2A3442] text-[14px] text-[#E6EDF3] hover:bg-[#1C2431] hover:scale-105 transition-all duration-200 disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Input Area removed for MVP: free-text disabled. Users should use suggested chips above. */}
        </div>
      </div>
    </>
  )
}
