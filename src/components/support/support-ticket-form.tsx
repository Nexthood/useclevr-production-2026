"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { useState } from "react"

const categories = ["Billing", "Dataset upload", "AI analysis", "Reports", "Account", "General"]

type SupportTicketFormProps = {
  compact?: boolean
  onCreated?: () => void
  redirectTo?: string
}

export function SupportTicketForm({ compact = false, onCreated, redirectTo }: SupportTicketFormProps) {
  const router = useRouter()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState(categories[0])
  const [priority, setPriority] = useState("normal")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus("")

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category, priority }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Could not create ticket.")
      }

      setSubject("")
      setMessage("")
      setCategory(categories[0])
      setPriority("normal")
      setStatus("Ticket created.")
      onCreated?.()
      if (redirectTo) {
        router.push(redirectTo)
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create ticket.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium text-foreground" htmlFor={compact ? "faq-ticket-subject" : "ticket-subject"}>
          Subject
        </label>
        <Input
          id={compact ? "faq-ticket-subject" : "ticket-subject"}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Short summary"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor={compact ? "faq-ticket-category" : "ticket-category"}>
            Category
          </label>
          <select
            id={compact ? "faq-ticket-category" : "ticket-category"}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1 flex h-12 w-full rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground"
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor={compact ? "faq-ticket-priority" : "ticket-priority"}>
            Priority
          </label>
          <select
            id={compact ? "faq-ticket-priority" : "ticket-priority"}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="mt-1 flex h-12 w-full rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground"
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor={compact ? "faq-ticket-message" : "ticket-message"}>
          Details
        </label>
        <textarea
          id={compact ? "faq-ticket-message" : "ticket-message"}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What happened? Add invoice IDs, dataset names, or screenshots details if useful."
          required
          className="mt-1 min-h-28 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" className="gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit ticket
        </Button>
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
      </div>
    </form>
  )
}
