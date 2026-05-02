import type React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

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
    <header className="border-b border-border bg-card/95 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 px-6 py-3">
        <div className="min-w-0">
          {breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
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
          )}
          <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
