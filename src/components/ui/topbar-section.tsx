"use client"

import Link from "next/link"
import type React from "react"

export function TopbarSection({
  icon,
  label,
  value,
  header,
  description,
  children,
  align = "left",
  noBorder = false,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  header: string
  description: string
  children?: React.ReactNode
  align?: "left" | "right"
  noBorder?: boolean
}) {
  return (
    <div className="group relative h-full">
      <div
        tabIndex={0}
        className={`flex h-full min-w-12 items-center gap-2 px-3 text-sm text-foreground outline-none transition hover:bg-muted/70 focus-visible:bg-muted/70 ${noBorder ? "" : "border-l border-border/70"}`}>
        <span className="text-primary">{icon}</span>
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-xs font-semibold leading-4">{label}</span>
          {value && <span className="block truncate text-[11px] leading-4 text-muted-foreground">{value}</span>}
        </span>
      </div>

      <div
        className={`pointer-events-none absolute top-full z-[150] mt-0 w-72 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        <div className="rounded-b-lg border border-border bg-popover p-4 text-popover-foreground shadow-xl">
          <div className="border-b border-border pb-3">
            <p className="text-sm font-semibold">{header}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
          {children && <div className="mt-3 space-y-2">{children}</div>}
        </div>
      </div>
    </div>
  )
}

export function TopbarPanelLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className="block text-sm font-medium text-primary transition hover:text-primary/80">
      {children}
    </Link>
  )
}
