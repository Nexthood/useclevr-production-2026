"use client"

import { HelpCircle, MessageSquare, ShieldCheck, Ticket } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

type HelpMenuProps = {
  isSuperAdmin?: boolean
}

const helpLinks = [
  { href: "/app/tickets", label: "Tickets", icon: Ticket },
  { href: "/app/faq", label: "Dashboard FAQ", icon: MessageSquare },
]

export function HelpMenu({ isSuperAdmin = false }: HelpMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-cyan-100"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span>Help</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[130] mt-2 w-52 rounded-lg border border-border bg-card p-2 shadow-xl"
        >
          {[...helpLinks, ...(isSuperAdmin ? [{ href: "/app/admin/faq", label: "Admin FAQ", icon: ShieldCheck }] : [])].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition hover:bg-accent"
            >
              <item.icon className="h-4 w-4 text-primary" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
