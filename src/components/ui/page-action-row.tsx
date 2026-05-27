import type React from "react"

export function PageActionRow({
  children,
  description,
}: {
  children: React.ReactNode
  description?: string
}) {
  return (
    <div className="border-b border-border bg-background px-5 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : <div />}
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  )
}
