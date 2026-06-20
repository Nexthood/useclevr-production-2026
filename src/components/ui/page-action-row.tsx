import type React from "react"

export function PageActionRow({
  children,
  description,
}: {
  children: React.ReactNode
  description?: string
}) {
  return (
    <div className="border-b border-border bg-background px-5 py-2.5">
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {description ? <p className="min-w-0 text-xs text-muted-foreground">{description}</p> : <div />}
        <div className="relative z-10 flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:justify-end">{children}</div>
      </div>
    </div>
  )
}
