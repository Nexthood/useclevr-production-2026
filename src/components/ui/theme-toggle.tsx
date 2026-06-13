"use client"

import { setThemePreference } from "@/app/actions/settings"
import {
  Contrast,
  Monitor,
  Moon,
  Palette,
  Scan,
  Sun,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

type TextSize = "small" | "normal" | "large"
type ZoomLevel = "zoom-out" | "normal" | "zoom-in"
type ContrastMode = "normal" | "high"

const textSizeOptions = [
  { id: "small" as const, label: "Small text", icon: Type, iconClass: "h-3.5 w-3.5" },
  { id: "normal" as const, label: "Normal text", icon: Type, iconClass: "h-4 w-4" },
  { id: "large" as const, label: "Large text", icon: Type, iconClass: "h-5 w-5" },
]

const zoomOptions = [
  { id: "zoom-out" as const, label: "Zoom out", icon: ZoomOut },
  { id: "normal" as const, label: "Normal zoom", icon: Scan },
  { id: "zoom-in" as const, label: "Zoom in", icon: ZoomIn },
]

const contrastOptions = [
  { id: "normal" as const, label: "Normal contrast", icon: Contrast },
  { id: "high" as const, label: "High contrast", icon: Contrast },
]

function applyDocumentPreference(
  group: "text-size" | "zoom" | "contrast",
  value: string,
) {
  const root = document.documentElement
  const prefixes = {
    "text-size": ["text-size-small", "text-size-normal", "text-size-large"],
    zoom: ["zoom-out", "zoom-normal", "zoom-in"],
    contrast: ["contrast-normal", "contrast-high"],
  }

  root.classList.remove(...prefixes[group])
  root.classList.add(`${group}-${value}`)
}

function SegmentedIconControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{
    id: T
    label: string
    icon: React.ComponentType<{ className?: string }>
    iconClass?: string
  }>
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div
        className="grid gap-1 rounded-md bg-muted/70 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-label={option.label}
            title={option.label}
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={`inline-flex h-9 items-center justify-center rounded-sm transition ${
              value === option.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
          >
            <option.icon className={option.iconClass || "h-4 w-4"} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [themeChoice, setThemeChoice] = React.useState("system")
  const [textSize, setTextSize] = React.useState<TextSize>("normal")
  const [zoomLevel, setZoomLevel] = React.useState<ZoomLevel>("normal")
  const [contrastMode, setContrastMode] = React.useState<ContrastMode>("normal")

  React.useEffect(() => {
    const savedTheme = localStorage.getItem("theme-preference") || "system"
    const savedTextSize =
      (localStorage.getItem("theme-text-size") as TextSize | null) || "normal"
    const savedZoom =
      (localStorage.getItem("theme-zoom-level") as ZoomLevel | null) || "normal"
    const savedContrast =
      (localStorage.getItem("theme-contrast-mode") as ContrastMode | null) || "normal"

    setThemeChoice(savedTheme)
    setTextSize(savedTextSize)
    setZoomLevel(savedZoom)
    setContrastMode(savedContrast)
    setTheme(savedTheme)
    applyDocumentPreference("text-size", savedTextSize)
    applyDocumentPreference("zoom", savedZoom)
    applyDocumentPreference("contrast", savedContrast)
    setMounted(true)
  }, [setTheme])

  const applyTheme = (nextTheme: string) => {
    setThemeChoice(nextTheme)
    setTheme(nextTheme)
    localStorage.setItem("theme-preference", nextTheme)
    void setThemePreference(nextTheme)
  }

  const applyTextSize = (next: TextSize) => {
    setTextSize(next)
    localStorage.setItem("theme-text-size", next)
    applyDocumentPreference("text-size", next)
  }

  const applyZoom = (next: ZoomLevel) => {
    setZoomLevel(next)
    localStorage.setItem("theme-zoom-level", next)
    applyDocumentPreference("zoom", next)
  }

  const applyContrast = (next: ContrastMode) => {
    setContrastMode(next)
    localStorage.setItem("theme-contrast-mode", next)
    applyDocumentPreference("contrast", next)
  }

  const hasAccessibilityOverride =
    textSize !== "normal" || zoomLevel !== "normal" || contrastMode !== "normal"

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
          {mounted && hasAccessibilityOverride && (
            <span
              className="absolute right-1.5 top-2 h-1.5 w-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-4">
          <section aria-labelledby="display-theme-heading">
            <h2
              id="display-theme-heading"
              className="mb-2 text-xs font-semibold uppercase text-muted-foreground"
            >
              Theme
            </h2>
            <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/70 p-1">
              {[
                { id: "light", label: "Light theme", icon: Sun },
                { id: "dark", label: "Dark theme", icon: Moon },
                { id: "system", label: "System theme", icon: Monitor },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.label}
                  title={option.label}
                  aria-pressed={themeChoice === option.id}
                  onClick={() => applyTheme(option.id)}
                  className={`inline-flex h-9 items-center justify-center rounded-sm transition ${
                    themeChoice === option.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  }`}
                >
                  <option.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="display-accessibility-heading"
            className="space-y-3 border-t border-border pt-3"
          >
            <h2
              id="display-accessibility-heading"
              className="text-xs font-semibold uppercase text-muted-foreground"
            >
              Accessibility
            </h2>
            <SegmentedIconControl
              label="Text size"
              value={textSize}
              options={textSizeOptions}
              onChange={applyTextSize}
            />
            <SegmentedIconControl
              label="Zoom"
              value={zoomLevel}
              options={zoomOptions}
              onChange={applyZoom}
            />
            <SegmentedIconControl
              label="Contrast"
              value={contrastMode}
              options={contrastOptions}
              onChange={applyContrast}
            />
          </section>
        </div>
      </PopoverContent>
    </Popover>
  )
}
