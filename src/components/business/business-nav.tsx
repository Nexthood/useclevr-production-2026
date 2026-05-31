"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const primaryItems = [
  { label: "Business", href: "/app/business" },
]

const secondaryItems = [
  { label: "Account", href: "/app/settings/profile" },
  { label: "Business Settings", href: "/app/business/profile" },
  { label: "Locations", href: "/app/business/locations" },
  { label: "Tax & VAT", href: "/app/business/tax" },
  { label: "Financial", href: "/app/business/financial" },
]

export function BusinessNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Business workspace" className="flex gap-2 overflow-x-auto border-b border-border bg-background px-5 py-3">
      {primaryItems.map((item) => {
        const isActive = item.href === "/app/business" ? pathname === item.href : pathname.startsWith(item.href)

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
      <span className="mx-2 text-xs text-muted-foreground self-center">|</span>
      {secondaryItems.map((item) => {
        const isActive = item.href === "/app/business" ? pathname === item.href : pathname.startsWith(item.href)

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
