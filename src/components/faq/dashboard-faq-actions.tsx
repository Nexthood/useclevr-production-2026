"use client"

import { MessageCircle, Send, Ticket } from "lucide-react"
import Link from "next/link"

const actions = [
  {
    label: "Suggest feedback",
    description: "Send product ideas or improvement notes.",
    href: "/contact",
    icon: Send,
  },
  {
    label: "Chat support",
    description: "Open the floating help chat.",
    action: "chat",
    icon: MessageCircle,
  },
  {
    label: "Open ticket",
    description: "Create and track a support request.",
    href: "/app/tickets",
    icon: Ticket,
  },
] as const

export function DashboardFaqActions() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon
        const className = "flex min-h-24 items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-accent/50"
        const content = (
          <>
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-foreground">{action.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{action.description}</span>
            </span>
          </>
        )

        if ("action" in action) {
          return (
            <button
              key={action.label}
              type="button"
              className={className}
              onClick={() => window.dispatchEvent(new CustomEvent("toggle-help-chat"))}
            >
              {content}
            </button>
          )
        }

        return (
          <Link key={action.label} href={action.href} className={className}>
            {content}
          </Link>
        )
      })}
    </div>
  )
}
