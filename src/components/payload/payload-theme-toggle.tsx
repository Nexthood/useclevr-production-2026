"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

function applyTheme(next: string) {
  const html = document.documentElement
  html.setAttribute("data-theme", next)
  localStorage.setItem("payload-theme", next)
  if (next === "dark") {
    html.classList.add("dark")
  } else {
    html.classList.remove("dark")
  }
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function PayloadThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<string>("system")

  useEffect(() => {
    const saved = localStorage.getItem("payload-theme") || "system"
    setTheme(saved)
    setMounted(true)
    if (saved === "system") {
      applyTheme(getSystemTheme())
    } else {
      applyTheme(saved)
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (localStorage.getItem("payload-theme") === "system") {
        applyTheme("system")
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  if (!mounted) return null

  const current =
    theme === "system" ? getSystemTheme() : theme

  const options = [
    { id: "light", label: "Light theme", icon: Sun },
    { id: "dark", label: "Dark theme", icon: Moon },
    { id: "system", label: "System theme", icon: Monitor },
  ]

  return (
    <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/70 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-label={option.label}
          title={option.label}
          aria-pressed={theme === option.id}
          onClick={() => {
            setTheme(option.id)
            const target = option.id === "system" ? getSystemTheme() : option.id
            applyTheme(option.id)
            if (option.id === "system") {
              document.documentElement.setAttribute("data-theme", getSystemTheme())
            }
          }}
          className={`inline-flex h-9 items-center justify-center rounded-sm transition ${
            current === option.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          }`}
        >
          <option.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
