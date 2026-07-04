"use client"

import usyAvatar from "@/assets/images/avatar.png"
import { Button } from "@/components/ui/button"
import { publicMonthlyPlanPrices } from "@/lib/billing/plans"
import { dashboardFaqCategories, superAdminFaqCategories } from "@/lib/content/dashboard-faq"
import { allFaqCategories } from "@/lib/content/faq"
import { ArrowUp, Bot, Loader2, MessageCircle, Sparkles, X } from "lucide-react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import type { FormEvent } from "react"
import { useEffect, useRef, useState } from "react"

type ChatMessage = {
  role: "user" | "assistant"
  text: string
  source?: "ai" | "knowledge"
  followUps?: string[]
}

type HelpChatboxAudience = "public" | "dashboard" | "superadmin"

const starterSuggestions = [
  "Analyze my CSV",
  "Explain my dashboard",
  "Forecast my sales",
  "Find business opportunities",
  "Upgrade to Pro",
  "AI Credits",
  "Connect Snowflake",
  "Business Profile",
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

const fallbackFollowUps = [
  "Upload my first dataset",
  "Explain my dashboard",
  "How do AI credits work?",
  "Contact support",
]

const followUpTopics = [
  {
    keywords: ["upload", "csv", "excel", "file", "import", "dataset"],
    questions: [
      "How do I prepare my CSV?",
      "What file formats are supported?",
      "Why did my upload fail?",
      "Analyze my uploaded dataset",
    ],
  },
  {
    keywords: ["dashboard", "kpi", "score", "health", "metric", "result"],
    questions: [
      "Explain these KPIs",
      "What does this score mean?",
      "Show business opportunities",
      "How can I improve this result?",
    ],
  },
  {
    keywords: ["billing", "invoice", "stripe", "subscription", "payment", "plan", "upgrade", "pro", "business", "credit", "credits"],
    questions: [
      "Compare Free vs Pro",
      "Upgrade to Business",
      "Where are invoices?",
      "How do credits work?",
    ],
  },
  {
    keywords: ["forecast", "sales", "predict", "projection", "trend", "accuracy"],
    questions: [
      "What columns are needed?",
      "Why did forecast fail?",
      "Forecast my sales",
      "Improve forecast accuracy",
    ],
  },
  {
    keywords: ["opportunity", "growth", "risk", "recommendation", "action", "insight"],
    questions: [
      "Find business opportunities",
      "What are the biggest risks?",
      "What should I do next?",
      "Prioritize my actions",
    ],
  },
  {
    keywords: ["business profile", "profile", "company", "setup", "onboarding"],
    questions: [
      "What profile fields matter?",
      "Complete Business Profile",
      "How does profile data improve AI?",
      "What should I enter first?",
    ],
  },
  {
    keywords: ["snowflake", "integration", "connect", "provider", "ai provider"],
    questions: [
      "Connect an AI provider",
      "What integrations are available?",
      "Connect Snowflake",
      "Use local AI analysis",
    ],
  },
] as const

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
      `AI Credits control included analysis usage on Free accounts. Free users get included credits to test the workflow. Pro is €${publicMonthlyPlanPrices.pro}/month and unlocks more analysis capacity with advanced AI features. Business is €${publicMonthlyPlanPrices.business}/month for broader team and business usage. Open Billing or Settings to review your current plan.`,
  },
  {
    keywords: ["upgrade", "pro", "business", "plan", "pricing"],
    answer:
      `Pro is €${publicMonthlyPlanPrices.pro}/month. Upgrade to Pro when you need more datasets, advanced AI analysis, and faster workflows. Business is €${publicMonthlyPlanPrices.business}/month. Choose Business when you need unlimited dataset capacity, team features, priority support, and the most complete Hybrid AI feature set.`,
  },
  {
    keywords: ["billing", "invoice", "stripe", "subscription", "payment"],
    answer:
      `Billing and invoices are managed through the secure Stripe flow in Settings. Pro is €${publicMonthlyPlanPrices.pro}/month. Business is €${publicMonthlyPlanPrices.business}/month. You can review your plan, open checkout, manage payment details, and access billing actions from the account and billing areas.`,
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

function getFollowUpSuggestions(query: string, answer: string) {
  const haystack = `${query} ${answer}`.toLowerCase()
  const topic = followUpTopics.find((item) => item.keywords.some((keyword) => haystack.includes(keyword)))
  return (topic?.questions ?? fallbackFollowUps).slice(0, 5)
}

function SuggestionChip({
  label,
  index,
  onClick,
  compact = false,
}: {
  label: string
  index: number
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group rounded-2xl border text-left font-semibold text-white transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
        "bg-[linear-gradient(135deg,rgba(34,211,238,0.15),rgba(216,180,254,0.12))] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
        "hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(34,211,238,0.16),0_0_20px_rgba(216,180,254,0.1)]",
        compact ? "px-3 py-1.5 text-xs" : "px-3.5 py-2.5 text-sm",
        index % 2 === 0
          ? "border-cyan-200/35 hover:border-cyan-100/75 hover:bg-cyan-200/[0.16]"
          : "border-fuchsia-200/30 hover:border-fuchsia-100/70 hover:bg-fuchsia-200/[0.14]",
      ].join(" ")}
    >
      {label}
    </button>
  )
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
            `You are Usy, the official AI Business Intelligence Assistant of UseClevr. Be warm, concise, professional, calm, trustworthy, and practical. Help users understand UseClevr, business intelligence, uploads, dashboards, datasets, forecasts, reports, credits, billing, integrations, and troubleshooting. Current pricing: Pro is €${publicMonthlyPlanPrices.pro}/month. Business is €${publicMonthlyPlanPrices.business}/month. Do not mention annual pricing unless UseClevr explicitly provides it in the current prompt. Explain simply and recommend a useful next action.`,
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

function UsyAvatar({ size = "lg", interactive = false }: { size?: "sm" | "md" | "lg"; interactive?: boolean }) {
  const dimensions = size === "sm" ? "h-14 w-14" : size === "md" ? "h-16 w-16" : "h-24 w-24"
  const imageSize = size === "sm" ? 56 : size === "md" ? 64 : 96

  return (
    <div
      className={[
        "usy-avatar-glow relative isolate shrink-0 rounded-full",
        dimensions,
        interactive ? "transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.03]" : "",
      ].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <div className="absolute inset-0 z-[1] rounded-full bg-gradient-to-br from-cyan-200 via-sky-300 to-fuchsia-300 p-[2px] shadow-[0_0_26px_rgba(34,211,238,0.3),0_0_34px_rgba(168,85,247,0.18)]">
        <div className="relative h-full w-full overflow-hidden rounded-full bg-slate-950">
          <Image
            src={usyAvatar}
            alt=""
            width={imageSize}
            height={imageSize}
            className="h-full w-full scale-110 object-cover object-top"
            priority={false}
          />
          <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_15%,rgba(255,255,255,0.28),transparent_34%),linear-gradient(145deg,transparent_45%,rgba(34,211,238,0.16))]" />
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
  const [isAsking, setIsAsking] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    setMessages((current) => [...current, { role: "user", text: trimmed }])
    setIsAsking(true)

    try {
      const answer = await askUsyAi(trimmed)
      setMessages((current) => [
        ...current,
        { role: "assistant", text: answer, source: "ai", followUps: getFollowUpSuggestions(trimmed, answer) },
      ])
    } catch {
      const answer = buildFallbackAnswer(trimmed, audience)
      setMessages((current) => [
        ...current,
        { role: "assistant", text: answer, source: "knowledge", followUps: getFollowUpSuggestions(trimmed, answer) },
      ])
    } finally {
      setIsAsking(false)
    }
  }

  function handleQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitQuestion(query)
  }

  return (
    <div className="fixed bottom-4 right-4 z-[120] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          className="usy-panel-open fixed inset-x-3 bottom-3 top-6 flex flex-col overflow-hidden rounded-[30px] border border-cyan-200/25 bg-slate-950/[0.95] text-white shadow-[0_34px_100px_rgba(8,13,30,0.6),0_0_52px_rgba(34,211,238,0.16)] backdrop-blur-2xl sm:absolute sm:bottom-24 sm:right-0 sm:top-auto sm:inset-x-auto sm:h-[min(700px,calc(100vh-11rem))] sm:w-[min(calc(100vw-2rem),520px)]"
          aria-label="Usy chat assistant"
        >
          <header className="relative shrink-0 overflow-hidden border-b border-cyan-200/18 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.24),transparent_34%),radial-gradient(circle_at_86%_0%,rgba(216,180,254,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.99),rgba(17,24,39,0.94))] px-5 py-4 sm:px-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200 to-fuchsia-200/80" />
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold leading-tight tracking-tight">Usy</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/[0.12] px-2.5 py-1 text-[11px] font-medium leading-none text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                    Online
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-cyan-50/[0.82]">UseClevr AI Business Assistant</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.08] p-2 text-white/70 transition hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                aria-label="Close Usy chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main ref={transcriptRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-4 sm:px-5 sm:py-5">
            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col gap-4">
                <div className="relative overflow-hidden rounded-[28px] border border-cyan-200/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.048))] px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_60px_rgba(2,6,23,0.22)] sm:px-6">
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />
                  <div className="flex justify-center">
                    <UsyAvatar />
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-xs font-medium text-cyan-50">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
                    Always here to help
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">Hi, I'm Usy 👋</h3>
                  <p className="mt-1.5 text-sm font-medium text-cyan-50">Your AI Business Intelligence Assistant.</p>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-200/[0.88]">
                    I'm here to help you understand your data, analyze your business, discover opportunities,
                    explain dashboards, generate insights, and answer anything about UseClevr.
                  </p>
                </div>

                <div>
                  <p className="mb-2.5 text-sm font-semibold text-slate-100">What can I help you with today?</p>
                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                    {starterSuggestions.map((suggestion, index) => (
                      <SuggestionChip
                        key={suggestion}
                        label={suggestion}
                        index={index}
                        onClick={() => submitQuestion(suggestion)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.052] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/[0.85]">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                    Usy can help with
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {capabilities.map((capability) => (
                      <span key={capability} className="rounded-full border border-cyan-100/10 bg-slate-900/75 px-2.5 py-1 text-[11px] text-slate-200">
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-1">
                {messages.map((message, index) => {
                  const showFollowUps =
                    message.role === "assistant" &&
                    index === messages.length - 1 &&
                    Array.isArray(message.followUps) &&
                    message.followUps.length > 0 &&
                    !isAsking

                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-[90%] space-y-2 sm:max-w-[86%]">
                        <div
                          className={`whitespace-pre-line rounded-3xl px-4 py-3 text-sm leading-6 ${
                            message.role === "user"
                              ? "rounded-br-lg bg-gradient-to-br from-cyan-200 via-sky-200 to-fuchsia-200 text-slate-950 shadow-[0_16px_38px_rgba(34,211,238,0.18)]"
                              : "rounded-bl-lg border border-cyan-100/15 bg-white/[0.086] text-slate-50 shadow-[inset_3px_0_0_rgba(34,211,238,0.58),0_16px_38px_rgba(2,6,23,0.18)] backdrop-blur"
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
                        {showFollowUps && (
                          <div className="flex flex-wrap gap-2 pl-1">
                            {message.followUps?.map((followUp, followUpIndex) => (
                              <SuggestionChip
                                key={followUp}
                                label={followUp}
                                index={followUpIndex}
                                onClick={() => submitQuestion(followUp)}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-3xl border border-cyan-100/15 bg-white/[0.085] px-4 py-3 text-sm text-slate-100 shadow-[inset_3px_0_0_rgba(34,211,238,0.62)]">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                      Usy is thinking...
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          <form className="shrink-0 border-t border-cyan-100/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(8,13,30,0.98))] p-3 sm:p-4" onSubmit={handleQuestion}>
            <div className="rounded-[22px] border border-cyan-200/[0.2] bg-white/[0.08] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_46px_rgba(2,6,23,0.2)] focus-within:border-cyan-200/70 focus-within:shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_20px_56px_rgba(34,211,238,0.13)]">
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
                placeholder="Ask Usy anything..."
                rows={1}
                className="max-h-24 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-white placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-3 px-1 pb-0.5">
                <span className="text-[11px] text-slate-400">Powered by UseClevr Hybrid AI</span>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!query.trim() || isAsking}
                  className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-200 via-sky-200 to-fuchsia-200 text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.28)] hover:opacity-95"
                  aria-label="Send message to Usy"
                >
                  {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="usy-launcher group inline-flex h-16 items-center gap-3 rounded-full border border-cyan-200/35 bg-slate-950/[0.92] px-2.5 pr-5 text-white shadow-[0_20px_52px_rgba(8,13,30,0.38),0_0_30px_rgba(34,211,238,0.16)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-200/70 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        aria-label={open ? "Close Usy chat" : "Ask Usy"}
        aria-expanded={open}
        title="Ask Usy"
      >
        <UsyAvatar size="sm" interactive />
        <span className="hidden text-sm font-semibold sm:inline">Ask Usy</span>
        <MessageCircle className="h-4 w-4 text-cyan-100 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </div>
  )
}
