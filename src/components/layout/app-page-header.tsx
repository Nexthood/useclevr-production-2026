import { ChevronRight } from "lucide-react"
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
}

export function AppPageHeader({ title, description, breadcrumbs = [], actions }: AppPageHeaderProps) {
  return (
    <header className="sticky top-16 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex min-h-16 flex-col items-start justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="min-w-0 space-y-0.5">
          <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">
          {actions}
        </div>
      </div>
      {breadcrumbs.length > 0 && (
        <div className="border-t border-border/70 bg-muted/30 px-4 py-2 sm:px-6">
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
