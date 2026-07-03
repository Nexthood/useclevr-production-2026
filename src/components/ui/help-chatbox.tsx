"use client"

import usyAvatar from "@/assets/images/avatar.png"
import { submitContactRequest } from "@/app/actions/contact"
import { Button } from "@/components/ui/button"
import { dashboardFaqCategories, superAdminFaqCategories } from "@/lib/content/dashboard-faq"
import { allFaqCategories } from "@/lib/content/faq"
import { ArrowUp, Bot, CheckCircle2, Loader2, MessageCircle, Sparkles, X } from "lucide-react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import type { FormEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

type ChatMessage = {
  role: "user" | "assistant"
  text: string
  source?: "ai" | "knowledge"
}

type HelpChatboxAudience = "public" | "dashboard" | "superadmin"

const starterSuggestions = [
  "Upload my first dataset",
  "Explain my dashboard",
  "Analyze my CSV",
  "Forecast my sales",
  "Business Profile setup",
  "How do AI Credits work?",
  "Upgrade to Pro",
  "Billing & invoices",
  "Connect Snowflake",
  "Contact support",
]

const capabilities = [
  "Uploads",
  "Datasets",
  "Dashboards",
  "AI Analysis",
  "Forecasting",
  "Reports",
  "Business Intelligence",
  "KPIs",
  "CSV imports",
  "Retail Analytics",
  "Inventory",
  "Billing",
  "Credits",
  "Settings",
  "Integrations",
  "Troubleshooting",
]

const knowledgeAnswers = [
  {
    keywords: ["upload", "csv", "excel", "first dataset", "import"],
    answer:
      "Start with Upload, then drag in a CSV or Excel file. UseClevr profiles the columns, checks data quality, detects KPIs, and prepares an analysis workspace. For the best result, keep headers clear and include date, revenue, product, customer, cost, or quantity columns when available.",
  },
  {
    keywords: ["dashboard", "explain", "home", "health score", "business health"],
    answer:
      "Your dashboard summarizes business health, KPIs, risks, opportunities, recommendations, and recent activity. Treat it like a management briefing: first check the health score, then review the highest-risk items and the next recommended action.",
  },
  {
    keywords: ["analyze", "analysis", "ai analysis", "csv analysis", "insight"],
    answer:
      "UseClevr analysis combines deterministic calculations with AI explanations. The backend calculates metrics from your uploaded rows, and the assistant explains what the results mean, what risks matter, and what you can do next.",
  },
  {
    keywords: ["forecast", "sales", "predict", "projection", "trend"],
    answer:
      "Forecasting works best when your dataset has a time column and numeric business values such as revenue, sales, profit, quantity, or cost. If those columns are missing, UseClevr will explain what it needs instead of guessing.",
  },
  {
    keywords: ["business profile", "profile", "setup", "company"],
    answer:
      "The Business Profile helps UseClevr personalize analysis for your company. Add your industry, region, currency, size, goals, role, and data purpose so dashboards, recommendations, and reports use the right business context.",
  },
  {
    keywords: ["credit", "credits", "free credits", "ai credits"],
    answer:
      "AI Credits control included analysis usage on Free accounts. Free users get included credits to test the workflow, while paid plans unlock more analysis capacity and advanced AI features. Open Billing or Settings to review your current plan.",
  },
  {
    keywords: ["upgrade", "pro", "business", "plan", "pricing"],
    answer:
      "Upgrade to Pro when you need more datasets, advanced AI analysis, and faster workflows. Choose Business when you need unlimited dataset capacity, team features, priority support, and the most complete Hybrid AI feature set.",
  },
  {
    keywords: ["billing", "invoice", "stripe", "subscription", "payment"],
    answer:
      "Billing and invoices are managed through the secure Stripe flow in Settings. You can review your plan, open checkout, manage payment details, and access billing actions from the account and billing areas.",
  },
  {
    keywords: ["snowflake", "integration", "connect", "warehouse", "database"],
    answer:
      "Snowflake and deeper data-warehouse connectors are planned as integration features. For now, upload CSV or Excel exports, or use AI Providers if you want to connect your own AI engine for analysis routing.",
  },
  {
    keywords: ["support", "ticket", "contact", "help", "human"],
    answer:
      "I can guide you here, and you can also create a dashboard ticket or contact support. Describe the issue, include the dataset or page involved, and UseClevr support can follow up with the right context.",
  },
  {
    keywords: ["retail", "inventory", "stock", "sku", "product"],
    answer:
      "Retail Analytics helps identify low stock, dead stock, top-profit products, category performance, supplier patterns, and reorder priorities. Include SKU, product, stock, sales, cost, revenue, and date columns for stronger results.",
  },
  {
    keywords: ["report", "download", "pdf", "executive summary"],
    answer:
      "Reports turn your analysis into a shareable management summary. Use them for executive updates, accountant handoff, investor conversations, or internal planning after the dataset analysis is complete.",
  },
]

function getFaqItems(audience: HelpChatboxAudience) {
  const categories =
    audience === "public"
      ? allFaqCategories
      : audience === "superadmin"
        ? [...allFaqCategories, ...dashboardFaqCategories, ...superAdminFaqCategories]
        : [...allFaqCategories, ...dashboardFaqCategories]

  return categories.flatMap((category) =>
    category.items.map((item) => ({
      category: category.category,
      q: item.q,
      a: item.a,
      text: `${category.category} ${item.q} ${item.a}`.toLowerCase(),
    })),
  )
}

function findFaqAnswer(query: string, audience: HelpChatboxAudience) {
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2)
  if (terms.length === 0) return null

  return getFaqItems(audience)
    .map((item) => ({
      item,
      score: terms.reduce((score, term) => score + (item.text.includes(term) ? 1 : 0), 0),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item ?? null
}

function findKnowledgeAnswer(query: string) {
  const normalized = query.toLowerCase()
  const match = knowledgeAnswers
    .map((item) => ({
      item,
      score: item.keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item

  if (match) return match.answer

  return "I can help with uploads, datasets, dashboards, AI analysis, forecasting, reports, billing, credits, Business Profile setup, integrations, and troubleshooting. Tell me what you are trying to do, and I will point you to the clearest next step."
}

function buildFallbackAnswer(query: string, audience: HelpChatboxAudience) {
  const faqAnswer = findFaqAnswer(query, audience)
  if (faqAnswer) {
    return `${faqAnswer.q}\n\n${faqAnswer.a}\n\nNext step: if you want, ask me how this applies to your current UseClevr workflow.`
  }

  return `${findKnowledgeAnswer(query)}\n\nNext step: open the matching UseClevr area and I can help you decide what to check first.`
}

async function askUsyAi(question: string) {
  const response = await fetch("/api/hybrid-ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "You are Usy, the official AI Business Intelligence Assistant of UseClevr. Be warm, concise, professional, calm, trustworthy, and practical. Help users understand UseClevr, business intelligence, uploads, dashboards, datasets, forecasts, reports, credits, billing, integrations, and troubleshooting. Explain simply and recommend a useful next action.",
        },
        { role: "user", content: question },
      ],
    }),
  })

  if (!response.ok) throw new Error("Usy AI endpoint is unavailable.")
  const result = await response.json()
  const answer = typeof result.answer === "string" ? result.answer : typeof result.content === "string" ? result.content : ""
  if (!answer.trim()) throw new Error("Usy AI returned an empty answer.")
  return answer.trim()
}

function UsyAvatar({ size = "lg" }: { size?: "sm" | "lg" }) {
  const dimensions = size === "sm" ? "h-11 w-11" : "h-24 w-24"
  const imageSize = size === "sm" ? 44 : 96

  return (
    <div className={`usy-avatar-glow relative shrink-0 rounded-full ${dimensions}`} aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-300 via-blue-300 to-purple-400 p-[2px] shadow-[0_0_28px_rgba(34,211,238,0.22)]">
        <div className="h-full w-full overflow-hidden rounded-full bg-slate-950">
          <Image
            src={usyAvatar}
            alt=""
            width={imageSize}
            height={imageSize}
            className="h-full w-full scale-110 object-cover object-top"
            priority={false}
          />
        </div>
      </div>
    </div>
  )
}

export function HelpChatbox({
  audience = "public",
  hideOnApp = false,
}: {
  audience?: HelpChatboxAudience
  hideOnApp?: boolean
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [email, setEmail] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [status, setStatus] = useState("")
  const [isAsking, setIsAsking] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const canSubmitContact = useMemo(
    () => email.includes("@") && contactMessage.trim().length > 8,
    [email, contactMessage],
  )

  useEffect(() => {
    const openChat = () => setOpen(true)
    window.addEventListener("toggle-help-chat", openChat)
    return () => window.removeEventListener("toggle-help-chat", openChat)
  }, [])

  useEffect(() => {
    if (!open) return
    window.setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, isAsking])

  if (hideOnApp && pathname.startsWith("/app")) {
    return null
  }

  async function submitQuestion(question: string) {
    const trimmed = question.trim()
    if (!trimmed || isAsking) return

    setQuery("")
    setStatus("")
    setMessages((current) => [...current, { role: "user", text: trimmed }])
    setIsAsking(true)

    try {
      const answer = await askUsyAi(trimmed)
      setMessages((current) => [...current, { role: "assistant", text: answer, source: "ai" }])
    } catch {
      const answer = buildFallbackAnswer(trimmed, audience)
      setMessages((current) => [...current, { role: "assistant", text: answer, source: "knowledge" }])
    } finally {
      setIsAsking(false)
    }
  }

  function handleQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitQuestion(query)
  }

  async function handleContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmitContact) return
    setIsSending(true)
    setStatus("")
    try {
      const formData = new FormData()
      formData.set("name", "Usy support request")
      formData.set("email", email)
      formData.set("company", "")
      formData.set("requestType", "Support")
      formData.set("message", contactMessage)
      const result = await submitContactRequest(formData)
      if (!result.success) throw new Error(result.error || "Could not send request.")
      setStatus("Support request sent. Usy will stay here if you need another step.")
      setEmail("")
      setContactMessage("")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send request.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[120] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          className="fixed inset-x-3 bottom-3 top-auto flex max-h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/[0.92] text-white shadow-[0_28px_90px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:absolute sm:bottom-20 sm:right-0 sm:inset-x-auto sm:w-[min(calc(100vw-2rem),480px)] sm:max-h-[min(760px,calc(100vh-7rem))]"
          aria-label="Usy chat assistant"
        >
          <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_92%_8%,rgba(168,85,247,0.2),transparent_30%),rgba(15,23,42,0.88)] px-4 py-4 sm:px-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <UsyAvatar size="sm" />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold leading-tight">Usy</h2>
                  <p className="truncate text-xs text-cyan-100/80">UseClevr AI Business Assistant</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/10 bg-white/[0.08] p-2 text-white/70 transition hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                aria-label="Close Usy chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={transcriptRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.length === 0 ? (
              <div className="space-y-5">
                <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-6 text-center shadow-inner shadow-white/5">
                  <UsyAvatar />
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" />
                    Always here to help
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">Hi, I'm Usy 👋</h3>
                  <p className="mt-1 text-sm font-medium text-cyan-100">Your AI Business Intelligence Assistant.</p>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-200/[0.85]">
                    I'm here to help you understand your data, analyze your business, discover opportunities,
                    explain dashboards, generate insights, and answer anything about UseClevr.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/80">Try asking</p>
                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                    {starterSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => submitQuestion(suggestion)}
                        className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-left text-sm text-slate-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300/80">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                    Usy can help with
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {capabilities.map((capability) => (
                      <span key={capability} className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-200">
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6 ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-cyan-300 to-purple-300 text-slate-950 shadow-lg shadow-cyan-950/20"
                          : "border border-white/10 bg-white/[0.07] text-slate-100"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/80">
                          <Bot className="h-3 w-3" />
                          Usy
                        </div>
                      )}
                      {message.text}
                    </div>
                  </div>
                ))}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-slate-100">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                      Usy is thinking...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {messages.some((message) => message.text.toLowerCase().includes("support")) && (
            <form className="space-y-2 border-t border-white/10 bg-white/[0.035] px-4 py-3 sm:px-5" onSubmit={handleContact}>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-200" />
                Send a support note
              </div>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                type="email"
                className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              />
              <textarea
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                placeholder="Message for support"
                className="min-h-20 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              />
              <Button type="submit" className="h-10 w-full gap-2 bg-white text-slate-950 hover:bg-cyan-50" disabled={!canSubmitContact || isSending}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                Send to support
              </Button>
            </form>
          )}

          <form className="border-t border-white/10 bg-slate-950/[0.84] p-3 sm:p-4" onSubmit={handleQuestion}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-2 shadow-inner shadow-white/5 focus-within:border-cyan-300/55">
              <textarea
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    submitQuestion(query)
                  }
                }}
                placeholder="Ask Usy anything about UseClevr..."
                rows={2}
                className="max-h-32 min-h-16 w-full resize-none bg-transparent px-2 py-2 text-sm leading-5 text-white placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-3 px-1 pb-1">
                <span className="text-[11px] text-slate-400">Powered by UseClevr Hybrid AI</span>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!query.trim() || isAsking}
                  className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-300 to-purple-300 text-slate-950 hover:opacity-90"
                  aria-label="Send message to Usy"
                >
                  {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {status && <p className="mt-2 text-xs text-slate-300">{status}</p>}
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group inline-flex h-14 items-center gap-3 rounded-full border border-cyan-200/25 bg-slate-950/90 px-3 pr-4 text-white shadow-[0_18px_45px_rgba(15,23,42,0.3)] backdrop-blur-xl transition hover:border-cyan-200/55 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        aria-label={open ? "Close Usy chat" : "Ask Usy"}
        aria-expanded={open}
        title="Ask Usy"
      >
        <UsyAvatar size="sm" />
        <span className="hidden text-sm font-semibold sm:inline">Ask Usy</span>
        <MessageCircle className="h-4 w-4 text-cyan-100 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </div>
  )
}
