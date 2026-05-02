"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CreditCard, Settings, SlidersHorizontal, User } from "lucide-react"

const items = [
  { href: "/app/settings/profile", label: "Profile", icon: User },
  { href: "/app/settings/preferences", label: "Settings", icon: SlidersHorizontal },
  { href: "/app/settings/subscription", label: "Subscription", icon: CreditCard },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="w-full shrink-0 space-y-1 md:w-56">
      {items.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

