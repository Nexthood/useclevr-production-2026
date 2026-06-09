"use client";

import { setThemePreference } from "@/app/actions/settings";
import { Check, Contrast, Monitor, Moon, Palette, Sun, Type, Zap, ZoomIn, ZoomOut, Accessibility, Mic } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const saveTheme = (theme: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("theme-preference", theme);
  }
};

const saveContrast = (enabled: boolean) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("theme-contrast", String(enabled));
  }
};

const saveLarge = (enabled: boolean) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("theme-large", String(enabled));
  }
};

const saveReducedMotion = (enabled: boolean) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("theme-reduced-motion", String(enabled));
  }
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [storedTheme, setStoredTheme] = React.useState("system");
  const [storedContrast, setStoredContrast] = React.useState(false);
  const [storedLarge, setStoredLarge] = React.useState(false);
  const [storedReducedMotion, setStoredReducedMotion] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme-preference");
    const savedContrast = localStorage.getItem("theme-contrast");
    const savedLarge = localStorage.getItem("theme-large");
    const savedReducedMotion = localStorage.getItem("theme-reduced-motion");
    setStoredTheme(saved || "system");
    setStoredContrast(savedContrast === "true");
    setStoredLarge(savedLarge === "true");
    setStoredReducedMotion(savedReducedMotion === "true");
  }, []);

  React.useEffect(() => {
    const saved = localStorage.getItem("theme-preference");
    const savedContrast = localStorage.getItem("theme-contrast") === "true";
    const savedLarge = localStorage.getItem("theme-large") === "true";
    const savedReducedMotion = localStorage.getItem("theme-reduced-motion") === "true";

    // Apply accessibility modifiers as body classes
    const body = document.body;
    body.classList.toggle("contrast", savedContrast);
    body.classList.toggle("large", savedLarge);
    body.classList.toggle("reduced-motion", savedReducedMotion);

    // Apply theme if not already set
    if (saved && theme !== saved) {
      void setTheme(saved);
    }
  }, [theme, setTheme]);

  if (!mounted) {
    return (
      <button
        className={["relative rounded-md p-2 transition-colors hover:bg-muted", className]
          .filter(Boolean)
          .join(" ")}
        aria-label="Display settings"
      >
        <Palette className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  const applyThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    saveTheme(newTheme);
    setStoredTheme(newTheme);
    void setThemePreference(newTheme);
  };

  const toggleContrast = () => {
    const next = !storedContrast;
    setStoredContrast(next);
    saveContrast(next);
    document.body.classList.toggle("contrast", next);
  };

  const toggleLarge = () => {
    const next = !storedLarge;
    setStoredLarge(next);
    saveLarge(next);
    document.body.classList.toggle("large", next);
  };

  const toggleReducedMotion = () => {
    const next = !storedReducedMotion;
    setStoredReducedMotion(next);
    saveReducedMotion(next);
    document.body.classList.toggle("reduced-motion", next);
  };

  const activeTheme = storedTheme;

  return (
    <Popover className="h-full" open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            "relative inline-flex h-16 min-w-12 items-center justify-center rounded-none p-2 text-foreground transition-colors hover:bg-muted/50",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Display settings"
          title="Display settings"
        >
          <Palette className="h-4 w-4 text-muted-foreground" />
          {(storedContrast || storedLarge || storedReducedMotion) && (
            <span className="absolute right-1 top-1 flex h-2 w-2" aria-hidden="true">
              <span
                className={`h-full w-full rounded-full ${storedContrast ? "bg-primary" : storedLarge ? "bg-secondary" : "bg-muted-foreground/40"}`}
              />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-3">
        <div role="menu">
          <div className="border-b border-border pb-2">
            <p className="text-sm font-semibold">Theme</p>
            <p className="mt-1 text-xs text-muted-foreground">Choose light, dark, or system preference.</p>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "eyedropper", label: "Color", icon: Palette },
              { id: "zoom-in", label: "Zoom in", icon: ZoomIn },
              { id: "zoom-out", label: "Zoom out", icon: ZoomOut },
              { id: "a11y", label: "A11y", icon: Accessibility },
              { id: "voice", label: "Voice", icon: Mic },
              { id: "system", label: "System", icon: Monitor },
              { id: "contrast", label: "Contrast", icon: Contrast },
              { id: "large", label: "Large", icon: Type },
              { id: "motion", label: "Motion", icon: Zap },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                aria-label={option.id === "light" || option.id === "dark" || option.id === "system"
                  ? `Set theme to ${option.label}`
                  : option.label}
                aria-pressed={option.id === "contrast" ? storedContrast : option.id === "large" ? storedLarge : option.id === "motion" ? storedReducedMotion : activeTheme === option.id}
                onClick={() => {
                  if (option.id === "light" || option.id === "dark" || option.id === "system") {
                    applyThemeChange(option.id)
                  } else if (option.id === "contrast") {
                    toggleContrast()
                  } else if (option.id === "large") {
                    toggleLarge()
                  } else if (option.id === "motion") {
                    toggleReducedMotion()
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1 rounded-md p-2 text-xs transition hover:bg-muted ${
                  (option.id === "light" || option.id === "dark" || option.id === "system") && activeTheme === option.id
                    ? "bg-muted text-foreground"
                    : (option.id === "contrast" && storedContrast) ||
                      (option.id === "large" && storedLarge) ||
                      (option.id === "motion" && storedReducedMotion)
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <option.icon className="h-4 w-4" />
                <span className="sr-only">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
