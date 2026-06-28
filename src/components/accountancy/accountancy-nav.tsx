"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const primaryItems = [
  { label: "Overview", href: "/app/accountancy" },
  { label: "Reporting", href: "/app/accountancy/reporting" },
  { label: "Tax", href: "/app/accountancy/tax" },
  { label: "Compliance", href: "/app/accountancy/compliance" },
]

export function AccountancyNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Accountancy workspace" className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-background px-5 py-3">
      {primaryItems.map((item) => {
        const isActive = item.href === "/app/accountancy" ? pathname === item.href : pathname.startsWith(item.href)

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
