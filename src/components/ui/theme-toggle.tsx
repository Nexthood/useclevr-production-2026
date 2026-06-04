"use client";

import { setThemePreference } from "@/app/actions/settings";
import { Check, Contrast, Monitor, Moon, Palette, Sun, Type } from "lucide-react";
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

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [storedTheme, setStoredTheme] = React.useState("system");
  const [storedContrast, setStoredContrast] = React.useState(false);
  const [storedLarge, setStoredLarge] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme-preference");
    const savedContrast = localStorage.getItem("theme-contrast");
    const savedLarge = localStorage.getItem("theme-large");
    setStoredTheme(saved || "system");
    setStoredContrast(savedContrast === "true");
    setStoredLarge(savedLarge === "true");
  }, []);

  React.useEffect(() => {
    const saved = localStorage.getItem("theme-preference");
    const savedContrast = localStorage.getItem("theme-contrast") === "true";
    const savedLarge = localStorage.getItem("theme-large") === "true";

    // Apply accessibility modifiers as body classes
    const body = document.body;
    body.classList.toggle("contrast", savedContrast);
    body.classList.toggle("large", savedLarge);

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

  const activeTheme = storedTheme;

  return (
    <Popover className="h-full" open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            "relative inline-flex h-full min-w-12 items-center justify-center rounded-md p-2 text-foreground transition-colors hover:bg-muted",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Display settings"
          title="Display settings"
        >
          <Palette className="h-4 w-4 text-muted-foreground" />
          {(storedContrast || storedLarge) && (
            <span className="absolute right-1 top-1 flex h-2 w-2" aria-hidden="true">
              <span
                className={`h-full w-full rounded-full ${storedContrast ? "bg-primary" : "bg-muted-foreground/40"}`}
              />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="mt-0 w-64 rounded-b-lg rounded-t-none p-3">
        <div role="menu">
          <div className="border-b border-border pb-2">
            <p className="text-sm font-semibold">Theme</p>
            <p className="mt-1 text-xs text-muted-foreground">Choose light, dark, or system preference.</p>
          </div>
          <div className="mt-2 grid gap-1">
            {[
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Monitor },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  applyThemeChange(option.id);
                  setOpen(false);
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

          <div className="mt-3 border-t border-border pt-2">
            <p className="text-sm font-semibold">Accessibility</p>
            <p className="mt-1 text-xs text-muted-foreground">Apply contrast and text size options.</p>
          </div>
          <div className="mt-2 grid gap-1">
            <button
              type="button"
              role="menuitem"
              aria-pressed={storedContrast}
              onClick={toggleContrast}
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                storedContrast ? "bg-primary/10 text-foreground" : "text-muted-foreground"
              }`}
            >
              <Contrast className="mt-0.5 h-4 w-4 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">High contrast</span>
                <span className="block text-xs text-muted-foreground">Increase text and border contrast.</span>
              </span>
              {storedContrast && <Check className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />}
            </button>
            <button
              type="button"
              role="menuitem"
              aria-pressed={storedLarge}
              onClick={toggleLarge}
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                storedLarge ? "bg-primary/10 text-foreground" : "text-muted-foreground"
              }`}
            >
              <Type className="mt-0.5 h-4 w-4 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Larger text</span>
                <span className="block text-xs text-muted-foreground">Raise the reading size across pages.</span>
              </span>
              {storedLarge && <Check className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
