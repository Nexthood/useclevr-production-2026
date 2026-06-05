"use client"

import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

export function TopbarSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login", redirect: true })}
      className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-inherit transition"
      aria-label="Log out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Log out</span>
    </button>
  )
}
