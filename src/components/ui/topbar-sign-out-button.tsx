"use client"

import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

export function TopbarSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: window.location.origin + "/login" })}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
      aria-label="Log out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Log out</span>
    </button>
  )
}
