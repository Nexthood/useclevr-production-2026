"use client"

import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

export function TopbarSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Log out"
    >
      <LogOut className="h-4 w-4" />
    </button>
  )
}
