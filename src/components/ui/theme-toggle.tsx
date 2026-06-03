"use client";

import { setThemePreference } from "@/app/actions/settings";
import { Contrast, Monitor, Moon, Sun, Type } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const saveTheme = (theme: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("theme-preference", theme);
  }
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    // Restore theme from localStorage on mount
    const saved = localStorage.getItem("theme-preference");
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
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const activeTheme = theme || "system";

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
      </PopoverTrigger>

      <PopoverContent align="end" className="mt-0 w-64 rounded-b-lg rounded-t-none p-3">
        <div role="menu">
          <div className="border-b border-border pb-2">
            <p className="text-sm font-semibold">Display</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose theme and basic accessibility controls.
            </p>
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
                  setTheme(option.id);
                  saveTheme(option.id);
                  setOpen(false);
                  void setThemePreference(option.id);
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
      </PopoverContent>
    </Popover>
  );
}