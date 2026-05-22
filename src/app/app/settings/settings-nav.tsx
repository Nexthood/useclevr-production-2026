"use client"

import { Activity, Briefcase, CreditCard, ReceiptText, ShieldCheck, ShoppingCart, SlidersHorizontal, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const items = [
  { href: "/app/settings/profile",        label: "Profile",        icon: User },
  { href: "/app/settings/preferences",    label: "Settings",       icon: SlidersHorizontal },
  { href: "/app/settings/business",       label: "Business",       icon: Briefcase },
  { href: "/app/settings/subscription",   label: "Subscription",   icon: CreditCard },
  { href: "/app/settings/activity",       label: "Activity",       icon: Activity },
  { href: "/app/settings/checkout",       label: "Checkout",       icon: ShoppingCart },
  { href: "/app/settings/billing",        label: "Billing",        icon: ReceiptText },
]

const adminItems = [
  { href: "/app/settings/payment",  label: "Payment",  icon: CreditCard },
  { href: "/app/settings/credits",  label: "Credit Rules", icon: ShieldCheck },
  { href: "/app/settings/total-activity", label: "Total Activity", icon: Activity },
]

export function SettingsNav({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname()
  const visibleItems = showAdmin ? [...items, ...adminItems] : items

  return (
    <nav className="w-full shrink-0 space-y-1 md:w-56">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
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
