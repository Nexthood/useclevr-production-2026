"use client"

import { setThemePreference } from "@/app/actions/settings"
import {
  Moon,
  Palette,
  Sun,
} from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

type ThemeChoice = "light" | "dark"
type ZoomLevel = "50" | "75" | "100" | "125" | "150"

const zoomOptions = [
  { id: "50" as const, label: "50%" },
  { id: "75" as const, label: "75%" },
  { id: "100" as const, label: "100%" },
  { id: "125" as const, label: "125%" },
  { id: "150" as const, label: "150%" },
]

const themeOptions = [
  { id: "light" as const, label: "Light Mode", icon: Sun },
  { id: "dark" as const, label: "Dark Mode", icon: Moon },
]

function normalizeTheme(value: string | null): ThemeChoice {
  return value === "light" ? "light" : "dark"
}

function normalizeZoom(value: string | null): ZoomLevel {
  return zoomOptions.some((option) => option.id === value) ? value as ZoomLevel : "100"
}

function applyZoomPreference(value: ZoomLevel) {
  const root = document.documentElement
  root.classList.remove("zoom-50", "zoom-75", "zoom-100", "zoom-125", "zoom-150", "zoom-out", "zoom-normal", "zoom-in")
  root.classList.add(`zoom-${value}`)
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [themeChoice, setThemeChoice] = React.useState<ThemeChoice>("dark")
  const [zoomLevel, setZoomLevel] = React.useState<ZoomLevel>("100")

  React.useEffect(() => {
    const savedTheme = normalizeTheme(localStorage.getItem("theme-preference"))
    const savedZoom = normalizeZoom(localStorage.getItem("theme-zoom-level"))

    setThemeChoice(savedTheme)
    setZoomLevel(savedZoom)
    setTheme(savedTheme)
    applyZoomPreference(savedZoom)
    setMounted(true)
  }, [setTheme])

  const applyTheme = (nextTheme: ThemeChoice) => {
    setThemeChoice(nextTheme)
    setTheme(nextTheme)
    localStorage.setItem("theme-preference", nextTheme)
    void setThemePreference(nextTheme)
  }

  const applyZoom = (next: ZoomLevel) => {
    setZoomLevel(next)
    localStorage.setItem("theme-zoom-level", next)
    applyZoomPreference(next)
  }

  const hasZoomOverride = mounted && zoomLevel !== "100"

  return (
    <Popover className="h-full">
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            "relative inline-flex h-16 min-w-10 items-center justify-center rounded-none p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Display settings"
          title="Display settings"
        >
          <Palette className="h-4 w-4" />
          {hasZoomOverride && (
            <span
              className="absolute right-1.5 top-2 h-1.5 w-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="max-h-[250px] w-56 overflow-y-auto p-2">
        <div className="space-y-2">
          <section aria-labelledby="display-theme-heading">
            <h2
              id="display-theme-heading"
              className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground"
            >
              Theme
            </h2>
            <div className="space-y-1">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={themeChoice === option.id}
                  onClick={() => applyTheme(option.id)}
                  className={`flex h-9 w-full items-center justify-between rounded-md px-2 text-sm transition ${
                    themeChoice === option.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <option.icon className="h-4 w-4" />
                    {option.label}
                  </span>
                  {themeChoice === option.id && <span className="text-xs font-semibold">On</span>}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="display-zoom-heading" className="border-t border-border pt-2">
            <h2
              id="display-zoom-heading"
              className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground"
            >
              Zoom
            </h2>
            <div className="grid grid-cols-5 gap-1 rounded-md bg-muted/60 p-1">
              {zoomOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-label={`Zoom ${option.label}`}
                  aria-pressed={zoomLevel === option.id}
                  onClick={() => applyZoom(option.id)}
                  className={`h-8 rounded-sm text-xs font-medium transition ${
                    zoomLevel === option.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  )
}
