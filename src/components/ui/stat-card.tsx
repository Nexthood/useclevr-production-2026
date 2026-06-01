import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  icon: LucideIcon | React.ComponentType<{ className?: string }>
  label: string
  value: string
  variant?: "large" | "small"
}

export function StatCard({ icon: Icon, label, value, variant = "small" }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className={`mt-2 ${variant === "large" ? "text-2xl font-semibold text-primary" : "text-sm text-muted-foreground"}`}>
        {value}
      </p>
    </div>
  )
}
