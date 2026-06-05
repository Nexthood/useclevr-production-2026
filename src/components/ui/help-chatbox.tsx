"use client"

import { submitContactRequest } from "@/app/actions/contact"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { dashboardFaqCategories, superAdminFaqCategories } from "@/lib/content/dashboard-faq"
import { allFaqCategories } from "@/lib/content/faq"
import { HelpCircle, Loader2, MessageSquare, Send, X } from "lucide-react"
import { usePathname } from "next/navigation"
import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"

type ChatMessage = {
  role: "user" | "assistant"
  text: string
}

type HelpChatboxAudience = "public" | "dashboard" | "superadmin"

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

function getIntroMessage(audience: HelpChatboxAudience) {
  if (audience === "superadmin") {
    return "Ask about public, dashboard, or operator FAQ topics."
  }

  if (audience === "dashboard") {
    return "Ask about public help or dashboard FAQ topics."
  }

  return "Ask a public FAQ question and I will check the help content first."
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: getIntroMessage(audience) },
  ])
  const [showContact, setShowContact] = useState(false)
  const [email, setEmail] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [status, setStatus] = useState("")
  const [isSending, setIsSending] = useState(false)

  const canSubmitContact = useMemo(
    () => email.includes("@") && contactMessage.trim().length > 8,
    [email, contactMessage]
  )

  useEffect(() => {
    const openChat = () => setOpen(true)
    window.addEventListener("toggle-help-chat", openChat)
    return () => window.removeEventListener("toggle-help-chat", openChat)
  }, [])

  if (hideOnApp && pathname.startsWith("/app")) {
    return null
  }

  function handleQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = query.trim()
    if (!question) return

    const answer = findFaqAnswer(question, audience)
    setMessages((current) => [
      ...current,
      { role: "user", text: question },
      answer
        ? { role: "assistant", text: `${answer.q}\n\n${answer.a}` }
        : {
            role: "assistant",
            text: "I did not find a close FAQ match. Add your email and message and support can follow up.",
          },
    ])
    setShowContact(!answer)
    setContactMessage(question)
    setQuery("")
  }

  async function handleContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmitContact) return
    setIsSending(true)
    setStatus("")
    try {
      const formData = new FormData()
      formData.set("name", "Dashboard support request")
      formData.set("email", email)
      formData.set("company", "")
      formData.set("requestType", "Support")
      formData.set("message", contactMessage)
      const result = await submitContactRequest(formData)
      if (!result.success) throw new Error(result.error || "Could not send request.")
      setStatus("Support request sent.")
      setShowContact(false)
      setEmail("")
      setContactMessage("")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send request.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-4 z-[120] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:right-6">
      {open && (
        <div className="w-[min(calc(100vw-2rem),440px)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Help chat</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Close help chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-80 space-y-3 overflow-auto px-4 py-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-8 bg-primary text-primary-foreground"
                    : "mr-8 whitespace-pre-line border border-border bg-background text-foreground"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          {showContact && (
            <form className="space-y-3 border-t border-border px-4 py-3" onSubmit={handleContact}>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" required className="h-10" />
              <textarea
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                placeholder="Message for support"
                required
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
              <Button type="submit" className="w-full gap-2" disabled={!canSubmitContact || isSending}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Contact support
              </Button>
            </form>
          )}

          <form className="flex gap-2 border-t border-border p-3" onSubmit={handleQuestion}>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help..."
              className="h-12 flex-1 text-sm"
            />
            <Button type="submit" className="h-12 gap-2 px-4">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>

          {status && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{status}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          open
            ? "border border-border bg-background text-foreground hover:bg-muted"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
        aria-label={open ? "Close help chat" : "Open help chat"}
        aria-expanded={open}
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    </div>
  )
}
