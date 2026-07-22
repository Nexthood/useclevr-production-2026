"use client"

import { setThemePreference } from "@/app/actions/settings"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"

type ThemeChoice = "light" | "dark"

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    localStorage.removeItem("theme-zoom-level")
    setMounted(true)
  }, [])

  const currentTheme: ThemeChoice = theme === "light" ? "light" : "dark"

  const toggleTheme = () => {
    const nextTheme: ThemeChoice = currentTheme === "light" ? "dark" : "light"
    setTheme(nextTheme)
    localStorage.setItem("theme-preference", nextTheme)
    void setThemePreference(nextTheme)
  }

  const Icon = currentTheme === "light" ? Moon : Sun

  if (!mounted) return null

  return (
    <button
      type="button"
      className={[
        "inline-flex h-11 w-11 items-center justify-center rounded-md p-0 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={currentTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      title={currentTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      onClick={toggleTheme}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
