"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        className={["relative rounded-md p-2 transition-colors hover:bg-accent hover:text-accent-foreground", className].filter(Boolean).join(" ")}
        aria-label="Toggle theme"
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute top-2 left-2 h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={["relative rounded-md p-2 transition-colors hover:bg-accent hover:text-accent-foreground", className].filter(Boolean).join(" ")}
      aria-label="Toggle theme"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute top-2 left-2 h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  )
}
