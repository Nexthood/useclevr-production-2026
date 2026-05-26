"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import type { SupportTicket, TicketStatus } from "@/lib/support/ticket-store"
import { AlertCircle, CheckCircle2, Clock, Edit, Loader2, RefreshCw, Ticket, Zap } from "lucide-react"
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
  const [isLoading, setIsLoading] = useState(true)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tickets.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTickets()
  }, [])

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

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => loadTickets()} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
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
          title={isSuperAdmin ? "Support queue" : "Your tickets"}
          description={isSuperAdmin ? "Customer, category, priority, status, and latest update." : "Category, priority, status, and latest support update."}
          emptyMessage="No tickets yet."
          rows={tickets as unknown as Record<string, unknown>[]}
          columns={ticketColumns(isSuperAdmin)}
          rowKey={(row) => String(row.id)}
          minWidth="min-w-[980px]"
        />
      )}
    </div>
  )
}

function ticketColumns(isSuperAdmin: boolean): DataTableColumn<Record<string, unknown>>[] {
  return [
    {
      key: "subject",
      header: "Ticket",
      render: (row) => (
        <div className="max-w-md">
          <p className="font-medium text-foreground">{String(row.subject || "-")}</p>
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
      key: "updatedAt",
      header: "Updated",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {row.updatedAt ? new Date(String(row.updatedAt)).toLocaleString() : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <Link
          href={`/app/tickets/${encodeURIComponent(String(row.id))}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          aria-label={`Edit ticket ${String(row.subject || row.id || "")}`}
        >
          <Edit className="h-4 w-4" />
        </Link>
      ),
    },
  ]
}
