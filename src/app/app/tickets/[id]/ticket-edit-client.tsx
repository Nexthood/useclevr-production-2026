"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { SupportTicket, TicketStatus } from "@/lib/support/ticket-store"
import { AlertCircle, CheckCircle2, Clock, Loader2, Save } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

type TicketEditClientProps = {
  id: string
  isSuperAdmin: boolean
}

function statusLabel(status: TicketStatus) {
  if (status === "in_progress") return "In progress"
  if (status === "resolved") return "Resolved"
  return "Open"
}

function statusIcon(status: TicketStatus) {
  if (status === "resolved") return CheckCircle2
  if (status === "in_progress") return Clock
  return AlertCircle
}

export function TicketEditClient({ id, isSuperAdmin }: TicketEditClientProps) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [status, setStatus] = useState<TicketStatus>("open")
  const [adminNote, setAdminNote] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadTicket() {
      setMessage("")
      setIsLoading(true)

      try {
        const response = await fetch("/api/tickets", { cache: "no-store" })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Could not load ticket.")
        }

        const nextTicket = (data.tickets || []).find((item: SupportTicket) => item.id === id) || null
        if (!nextTicket) {
          throw new Error("Ticket not found.")
        }

        if (!cancelled) {
          setTicket(nextTicket)
          setStatus(nextTicket.status)
          setAdminNote(nextTicket.adminNote || "")
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not load ticket.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadTicket()

    return () => {
      cancelled = true
    }
  }, [id])

  async function updateTicket(nextStatus = status) {
    setIsSaving(true)
    setMessage("")

    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus, adminNote }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Could not update ticket.")
      }

      setTicket(data.ticket)
      setStatus(data.ticket.status)
      setAdminNote(data.ticket.adminNote || "")
      setMessage("Ticket updated.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update ticket.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        Loading ticket...
      </Card>
    )
  }

  if (!ticket) {
    return (
      <Card className="border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <p>{message || "Ticket not found."}</p>
        <Link href="/app/tickets" className="mt-3 inline-flex text-primary hover:underline">
          Back to tickets
        </Link>
      </Card>
    )
  }

  const StatusIcon = statusIcon(ticket.status)

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{ticket.subject}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ticket.category} - {ticket.userEmail} - {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            <StatusIcon className="h-3 w-3" />
            {statusLabel(ticket.status)}
          </span>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-background p-4">
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{ticket.message}</p>
        </div>

        {ticket.adminNote && (
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">Support note {ticket.adminName && `- ${ticket.adminName}`}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ticket.adminNoteUpdatedAt ? new Date(ticket.adminNoteUpdatedAt).toLocaleString() : ""}
            </p>
            <p className="mt-1 text-muted-foreground">{ticket.adminNote}</p>
          </div>
        )}
      </Card>

      <Card className="border-border bg-card p-5">
        <h3 className="text-base font-semibold text-foreground">Edit ticket</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="ticket-status">
              Status
            </label>
            <select
              id="ticket-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as TicketStatus)}
              disabled={!isSuperAdmin}
              className="mt-1 flex h-12 w-full rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground disabled:opacity-60"
            >
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {isSuperAdmin && (
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="admin-note">
                Support note
              </label>
              <Input
                id="admin-note"
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder="Reply to the customer..."
                className="mt-1"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isSuperAdmin ? (
              <Button onClick={() => updateTicket()} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save ticket
              </Button>
            ) : ticket.status !== "resolved" ? (
              <Button onClick={() => updateTicket("resolved")} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark resolved
              </Button>
            ) : null}
            <Link
              href="/app/tickets"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              Back
            </Link>
          </div>

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </Card>
    </div>
  )
}
