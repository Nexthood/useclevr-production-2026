"use client"

import { ArrowRight } from "lucide-react"

export function UserLevelLink({ subscriptionTier }: { subscriptionTier: string | null | undefined }) {
  const tierLabels = {
    free: "Free",
    pro: "Pro",
    business: "Business",
    superadmin: "Admin",
  } as const

  const tierColors = {
    free: "text-slate-600 dark:text-slate-400",
    pro: "text-primary",
    business: "text-purple-600 dark:text-purple-400",
    superadmin: "text-amber-600 dark:text-amber-400",
  } as const

  const tier = subscriptionTier as keyof typeof tierLabels | undefined
  const label = tier ? tierLabels[tier] : "Free"
  const color = tier ? tierColors[tier] : tierColors.free

  return (
    <a
      href="/app/settings/subscription"
      className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      title="Manage subscription"
    >
      <span className={color}>{label}</span>
      <ArrowRight className="h-3 w-3" />
    </a>
  )
}