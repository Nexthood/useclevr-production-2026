"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import type { SupportTicket, TicketStatus } from "@/lib/support/ticket-store"
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw, Ticket, Zap } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type TicketsClientProps = {
  isSuperAdmin: boolean
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState("")

  const totals = useMemo(
    () => ({
      total: tickets.length,
      open: tickets.filter((ticket) => ticket.status === "open").length,
      inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
      urgent: tickets.filter((ticket) => ticket.priority === "urgent" && ticket.status !== "resolved").length,
    }),
    [tickets],
  )

  async function loadTickets() {
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/tickets", { cache: "no-store" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Could not load tickets.")
      }

      setTickets(data.tickets || [])
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tickets.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTickets()
  }, [])

  const allSelected = tickets.length > 0 && tickets.every((ticket) => selectedIds.has(ticket.id))

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(tickets.map((ticket) => ticket.id)) : new Set())
  }

  function toggleTicket(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  async function resolveSelected() {
    if (selectedIds.size === 0 || isUpdating) return
    const confirmed = window.confirm(`Mark ${selectedIds.size} selected ticket${selectedIds.size === 1 ? "" : "s"} as resolved?`)
    if (!confirmed) return

    setIsUpdating(true)
    setError("")
    try {
      await Promise.all(
        Array.from(selectedIds).map(async (id) => {
          const response = await fetch("/api/tickets", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: "resolved" }),
          })
          if (!response.ok) {
            const body = await response.json().catch(() => ({}))
            throw new Error(body.error || "Could not update selected tickets.")
          }
        }),
      )
      await loadTickets()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update selected tickets.")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total tickets", value: totals.total, icon: Ticket, color: "text-cyan-800 dark:text-cyan-100", bg: "bg-cyan-500/10" },
          { label: "Open", value: totals.open, icon: AlertCircle, color: "text-blue-800 dark:text-blue-100", bg: "bg-blue-500/10" },
          { label: "In progress", value: totals.inProgress, icon: Clock, color: "text-amber-800 dark:text-amber-100", bg: "bg-amber-500/10" },
          { label: "Urgent", value: totals.urgent, icon: Zap, color: "text-red-800 dark:text-red-100", bg: "bg-red-500/10" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{isSuperAdmin ? "Support queue" : "Your tickets"}</h2>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin ? "Customer tickets with status, priority, and latest update." : "Your support requests with status and latest update."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={resolveSelected} disabled={selectedIds.size === 0 || isUpdating} className="gap-2">
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Resolve selected
          </Button>
          <Button variant="outline" onClick={() => loadTickets()} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-border bg-card p-8 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </Card>
      ) : isLoading ? (
        <Card className="border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading tickets...
        </Card>
      ) : (
        <DataTable
          emptyMessage="No tickets yet."
          rows={tickets as unknown as Record<string, unknown>[]}
          columns={ticketColumns({
            isSuperAdmin,
            allSelected,
            selectedIds,
            toggleAll,
            toggleTicket,
          })}
          rowKey={(row) => String(row.id)}
          minWidth="min-w-[980px]"
        />
      )}
    </div>
  )
}

function ticketColumns({
  isSuperAdmin,
  allSelected,
  selectedIds,
  toggleAll,
  toggleTicket,
}: {
  isSuperAdmin: boolean
  allSelected: boolean
  selectedIds: Set<string>
  toggleAll: (checked: boolean) => void
  toggleTicket: (id: string, checked: boolean) => void
}): DataTableColumn<Record<string, unknown>>[] {
  return [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(event) => toggleAll(event.target.checked)}
          aria-label="Select all tickets"
          className="h-4 w-4 rounded border-border accent-primary"
        />
      ),
      render: (row) => {
        const id = String(row.id)
        return (
          <input
            type="checkbox"
            checked={selectedIds.has(id)}
            onChange={(event) => toggleTicket(id, event.target.checked)}
            aria-label={`Select ticket ${id}`}
            className="h-4 w-4 rounded border-border accent-primary"
          />
        )
      },
    },
    {
      key: "id",
      header: "ID",
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{String(row.id).slice(0, 8)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const status = String(row.status || "open") as TicketStatus
        const Icon = statusIcon(status)

        return (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusClassName(status)}`}>
            <Icon className="h-3 w-3" />
            {statusLabel(status)}
          </span>
        )
      },
    },
    {
      key: "subject",
      header: "Ticket",
      render: (row) => (
        <div className="max-w-md">
          <Link
            href={`/app/tickets/${encodeURIComponent(String(row.id))}`}
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            {String(row.subject || "-")}
          </Link>
          <div>
            <Link href={`/app/tickets/${encodeURIComponent(String(row.id))}`} className="text-xs text-primary hover:underline">
              Edit ticket
            </Link>
          </div>
          <p className="truncate text-xs text-muted-foreground">{String(row.message || "-")}</p>
        </div>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: "customer",
            header: "Customer",
            render: (row: Record<string, unknown>) => <span className="text-muted-foreground">{String(row.userEmail || "-")}</span>,
          },
        ]
      : []),
    {
      key: "category",
      header: "Category",
      render: (row) => <span className="text-muted-foreground">{String(row.category || "General")}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            row.priority === "urgent"
              ? "bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100"
              : "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200"
          }`}
        >
          {String(row.priority || "normal")}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {row.updatedAt ? new Date(String(row.updatedAt)).toLocaleString() : "-"}
        </span>
      ),
    },
  ]
}
