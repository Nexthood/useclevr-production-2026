import type React from "react"

type PublicPageHeaderProps = {
  eyebrow?: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PublicPageHeader({ eyebrow, title, description, actions }: PublicPageHeaderProps) {
  return (
    <section className="border-b border-border/30 bg-muted/20">
      <div className="container mx-auto min-w-0 px-4 py-14 text-center md:px-6 md:py-16">
        {eyebrow && (
          <div className="mb-4 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            {eyebrow}
          </div>
        )}
        <h1 className="mx-auto max-w-4xl break-words text-4xl font-bold tracking-tight text-foreground md:text-5xl">{title}</h1>
        {description && (
          <p className="mx-auto mt-4 max-w-2xl break-words text-lg text-muted-foreground">{description}</p>
        )}
        {actions && <div className="mt-6 flex min-w-0 justify-center">{actions}</div>}
      </div>
    </section>
  )
}
