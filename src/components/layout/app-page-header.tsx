import { ChevronRight, FileText } from "lucide-react"
import Link from "next/link"
import type React from "react"

type Breadcrumb = {
  label: string
  href?: string
}

type AppPageHeaderProps = {
  title: string
  description?: string
  breadcrumbs?: Breadcrumb[]
  actions?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}

export function AppPageHeader({ title, description, breadcrumbs = [], actions, icon: Icon = FileText }: AppPageHeaderProps) {
  return (
    <header className="relative z-40 shrink-0 border-b border-border/60 bg-card/95 backdrop-blur-sm">
      <div className="flex min-h-14 min-w-0 flex-col items-start justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="relative z-10 flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      </div>
      {breadcrumbs.length > 0 && (
        <div className="border-t border-border/70 bg-muted/30 px-4 py-1.5 sm:px-5">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3 w-3" />}
                {item.href ? (
                  <Link href={item.href} className="transition hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
