"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { SupportTicket, TicketPriority, TicketStatus } from "@/lib/support/ticket-store"
import { AlertCircle, CheckCircle2, Clock, Loader2, MessageSquare, Send } from "lucide-react"
import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"

type TicketsClientProps = {
  isSuperAdmin: boolean
}

const categories = ["Billing", "Dataset upload", "AI analysis", "Reports", "Account", "General"]

function statusLabel(status: TicketStatus) {
  if (status === "in_progress") return "In progress"
  if (status === "resolved") return "Resolved"
  return "Open"
}

function statusClassName(status: TicketStatus) {
  if (status === "resolved") return "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100"
  if (status === "in_progress") return "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
  return "bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100"
}

function statusIcon(status: TicketStatus) {
  if (status === "resolved") return CheckCircle2
  if (status === "in_progress") return Clock
  return AlertCircle
}

export function TicketsClient({ isSuperAdmin }: TicketsClientProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState(categories[0])
  const [priority, setPriority] = useState<TicketPriority>("normal")
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const openCount = useMemo(
    () => tickets.filter((ticket) => ticket.status !== "resolved").length,
    [tickets]
  )

  async function loadTickets() {
    setError("")
    const response = await fetch("/api/tickets", { cache: "no-store" })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Could not load tickets.")
    }

    setTickets(data.tickets || [])
    setAdminNotes(
      Object.fromEntries((data.tickets || []).map((ticket: SupportTicket) => [ticket.id, ticket.adminNote || ""]))
    )
  }

  useEffect(() => {
    loadTickets()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load tickets."))
      .finally(() => setIsLoading(false))
  }, [])

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError("")

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

      setTickets((current) => [data.ticket, ...current])
      setSubject("")
      setMessage("")
      setCategory(categories[0])
      setPriority("normal")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create ticket.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateTicket(id: string, status: TicketStatus) {
    setError("")

    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNote: adminNotes[id] || "" }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Could not update ticket.")
      }

      setTickets((current) => current.map((ticket) => (ticket.id === id ? data.ticket : ticket)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update ticket.")
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
      {!isSuperAdmin && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="h-5 w-5 text-primary" />
            New ticket
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Send a support request for billing, uploads, reports, or account access.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleCreateTicket}>
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="ticket-subject">
                Subject
              </label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Short summary"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="ticket-category">
                  Category
                </label>
                <select
                  id="ticket-category"
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
                <label className="text-sm font-medium text-foreground" htmlFor="ticket-priority">
                  Priority
                </label>
                <select
                  id="ticket-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TicketPriority)}
                  className="mt-1 flex h-12 w-full rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="ticket-message">
                Details
              </label>
              <textarea
                id="ticket-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="What happened? Add invoice IDs, dataset names, or screenshots details if useful."
                required
                className="mt-1 min-h-32 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground"
              />
            </div>

            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit ticket
            </Button>
          </form>
        </Card>
      )}

      <Card className={`p-5 ${isSuperAdmin ? "lg:col-span-2" : ""}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{isSuperAdmin ? "Support queue" : "Your tickets"}</h2>
            <p className="text-sm text-muted-foreground">
              {openCount} active {openCount === 1 ? "ticket" : "tickets"}
            </p>
          </div>
          <Button variant="outline" onClick={() => loadTickets()} disabled={isLoading}>
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-100">
            {error}
          </div>
        )}

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tickets
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No tickets yet.
            </div>
          ) : (
            tickets.map((ticket) => {
              const Icon = statusIcon(ticket.status)

              return (
                <div key={ticket.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{ticket.subject}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusClassName(ticket.status)}`}>
                          <Icon className="h-3 w-3" />
                          {statusLabel(ticket.status)}
                        </span>
                        {ticket.priority === "urgent" && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-950 dark:bg-red-950 dark:text-red-100">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ticket.category} · {ticket.userEmail} · {new Date(ticket.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{ticket.message}</p>
                    </div>
                  </div>

                  {ticket.adminNote && (
                    <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
                      <p className="font-medium text-foreground">Support note</p>
                      <p className="mt-1 text-muted-foreground">{ticket.adminNote}</p>
                    </div>
                  )}

                  {isSuperAdmin ? (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <textarea
                        value={adminNotes[ticket.id] || ""}
                        onChange={(event) =>
                          setAdminNotes((current) => ({ ...current, [ticket.id]: event.target.value }))
                        }
                        placeholder="Resolution note for the customer"
                        className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleUpdateTicket(ticket.id, "open")}>
                          Mark open
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateTicket(ticket.id, "in_progress")}>
                          In progress
                        </Button>
                        <Button size="sm" onClick={() => handleUpdateTicket(ticket.id, "resolved")}>
                          Resolve
                        </Button>
                      </div>
                    </div>
                  ) : ticket.status !== "resolved" ? (
                    <div className="mt-4 border-t border-border pt-4">
                      <Button size="sm" variant="outline" onClick={() => handleUpdateTicket(ticket.id, "resolved")}>
                        Mark resolved
                      </Button>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}
