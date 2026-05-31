"use client"

import { Contrast, Monitor, Moon, Sun, Type } from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  // Prevent hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  if (!mounted) {
    return (
      <button
        className={["relative rounded-md p-2 transition-colors hover:bg-muted", className].filter(Boolean).join(" ")}
        aria-label="Display settings"
      >
        <Sun className="h-4 w-4" />
      </button>
    )
  }

  const activeTheme = theme || "system"

  return (
    <div ref={menuRef} className="relative h-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={["relative inline-flex h-full min-w-12 items-center justify-center rounded-md p-2 text-foreground transition-colors hover:bg-muted", className].filter(Boolean).join(" ")}
        aria-label="Display settings"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Display settings"
      >
        {activeTheme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : activeTheme === "contrast" ? (
          <Contrast className="h-4 w-4" />
        ) : activeTheme === "large" ? (
          <Type className="h-4 w-4" />
        ) : activeTheme === "system" ? (
          <Monitor className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[160] w-64 rounded-b-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl"
        >
          <div className="border-b border-border pb-2">
            <p className="text-sm font-semibold">Display</p>
            <p className="mt-1 text-xs text-muted-foreground">Choose theme and basic accessibility controls.</p>
          </div>
          <div className="mt-2 grid gap-1">
            {[
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Monitor },
              { id: "contrast", label: "High contrast", icon: Contrast },
              { id: "large", label: "Larger text", icon: Type },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setTheme(option.id)
                  setOpen(false)
                }}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                  activeTheme === option.id ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                <option.icon className="h-4 w-4 text-primary" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
