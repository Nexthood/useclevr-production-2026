"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowRight, Info } from "lucide-react"

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
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground h-7 px-2"
        >
          <span className={color}>{label}</span>
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-2">
          <p className="text-sm font-medium">Subscription tier</p>
          <p className="text-xs text-muted-foreground">
            {label === "Free" && "Basic features with limited usage."}
            {label === "Pro" && "Advanced AI features and higher limits."}
            {label === "Business" && "Team collaboration and premium support."}
            {label === "Admin" && "Full system access and management."}
          </p>
          <a
            href="/app/settings/subscription"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Manage subscription <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}