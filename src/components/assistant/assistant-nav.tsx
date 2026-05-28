"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const items = [
  { label: "Chat", href: "/app/assistant" },
  { label: "History", href: "/app/assistant/history" },
]

export function AssistantNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Assistant workspace" className="flex gap-2 overflow-x-auto border-b border-border bg-background px-5 py-3">
      {items.map((item) => {
        const isActive = item.href === "/app/assistant" ? pathname === item.href : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}