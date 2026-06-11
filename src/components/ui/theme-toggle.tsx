"use client";

import { setThemePreference } from "@/app/actions/settings";
import { Check, Contrast, Monitor, Moon, Palette, Sun, Type, ZoomIn, ZoomOut } from "lucide-react";
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

type TextSize = "normal" | "large";
type ZoomLevel = "normal" | "zoom-in";
type ContrastMode = "normal" | "high";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [storedTheme, setStoredTheme] = React.useState("system");
  const [storedContrast, setStoredContrast] = React.useState(false);
  const [storedLarge, setStoredLarge] = React.useState(false);
  const [storedReducedMotion, setStoredReducedMotion] = React.useState(false);
  const [textSize, setTextSize] = React.useState<TextSize>("normal");
  const [zoomLevel, setZoomLevel] = React.useState<ZoomLevel>("normal");
  const [contrastMode, setContrastMode] = React.useState<ContrastMode>("normal");

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme-preference");
    const savedContrast = localStorage.getItem("theme-contrast");
    const savedLarge = localStorage.getItem("theme-large");
    const savedReducedMotion = localStorage.getItem("theme-reduced-motion");
    const savedTextSize = localStorage.getItem("theme-text-size") as TextSize | null;
    const savedZoomLevel = localStorage.getItem("theme-zoom-level") as ZoomLevel | null;
    const savedContrastMode = localStorage.getItem("theme-contrast-mode") as ContrastMode | null;
    setStoredTheme(saved || "system");
    setStoredContrast(savedContrast === "true");
    setStoredLarge(savedLarge === "true");
    setStoredReducedMotion(savedReducedMotion === "true");
    setTextSize(savedTextSize || "normal");
    setZoomLevel(savedZoomLevel || "normal");
    setContrastMode(savedContrastMode || "normal");
  }, []);

  React.useEffect(() => {
    const saved = localStorage.getItem("theme-preference");
    const savedContrast = localStorage.getItem("theme-contrast") === "true";
    const savedLarge = localStorage.getItem("theme-large") === "true";
    const savedReducedMotion = localStorage.getItem("theme-reduced-motion") === "true";
    const savedTextSize = localStorage.getItem("theme-text-size") as TextSize;
    const savedZoomLevel = localStorage.getItem("theme-zoom-level") as ZoomLevel;
    const savedContrastMode = localStorage.getItem("theme-contrast-mode") as ContrastMode;

    const body = document.body;
    body.classList.toggle("contrast", savedContrast || savedContrastMode === "high");
    body.classList.toggle("large", savedLarge || savedTextSize === "large");
    body.classList.toggle("reduced-motion", savedReducedMotion);
    body.classList.toggle("zoom-in", savedZoomLevel === "zoom-in");

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

  const applyTextSize = (next: TextSize) => {
    setTextSize(next);
    localStorage.setItem("theme-text-size", next);
    document.body.classList.toggle("large", next === "large");
  };

  const applyZoomLevel = (next: ZoomLevel) => {
    setZoomLevel(next);
    localStorage.setItem("theme-zoom-level", next);
    document.body.classList.toggle("zoom-in", next === "zoom-in");
  };

  const applyContrastMode = (next: ContrastMode) => {
    setContrastMode(next);
    localStorage.setItem("theme-contrast-mode", next);
    document.body.classList.toggle("contrast", next === "high");
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
          {(storedContrast || storedLarge || storedReducedMotion || contrastMode === "high") && (
            <span className="absolute right-1 top-1 flex h-2 w-2" aria-hidden="true">
              <span className="h-full w-full rounded-full bg-primary" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-3">
        <div role="menu" className="space-y-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme</p>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "system", label: "System", icon: Monitor },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  aria-label={`Set theme to ${option.label}`}
                  aria-pressed={activeTheme === option.id}
                  onClick={() => {
                    applyThemeChange(option.id);
                    setOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-md p-2 text-xs transition hover:bg-muted ${
                    activeTheme === option.id ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <option.icon className="h-4 w-4" />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accessibility</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Normal text size"
                  aria-pressed={textSize === "normal"}
                  onClick={() => applyTextSize("normal")}
                  className={`flex items-center justify-center rounded-md p-2 transition hover:bg-muted ${
                    textSize === "normal" ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Type className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Large text size"
                  aria-pressed={textSize === "large"}
                  onClick={() => applyTextSize("large")}
                  className={`flex items-center justify-center rounded-md p-2 transition hover:bg-muted ${
                    textSize === "large" ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Type className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Zoom out"
                  aria-pressed={zoomLevel === "normal"}
                  onClick={() => applyZoomLevel("normal")}
                  className={`flex items-center justify-center rounded-md p-2 transition hover:bg-muted ${
                    zoomLevel === "normal" ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Normal zoom"
                  aria-pressed={zoomLevel === "normal"}
                  onClick={() => applyZoomLevel("normal")}
                  className={`flex items-center justify-center rounded-md p-2 transition hover:bg-muted ${
                    zoomLevel === "normal" ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="text-sm font-semibold">100</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Zoom in"
                  aria-pressed={zoomLevel === "zoom-in"}
                  onClick={() => applyZoomLevel("zoom-in")}
                  className={`flex items-center justify-center rounded-md p-2 transition hover:bg-muted ${
                    zoomLevel === "zoom-in" ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Normal contrast"
                  aria-pressed={contrastMode === "normal"}
                  onClick={() => applyContrastMode("normal")}
                  className={`flex items-center justify-center rounded-md p-2 transition hover:bg-muted ${
                    contrastMode === "normal" ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Contrast className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  aria-label="High contrast"
                  aria-pressed={contrastMode === "high"}
                  onClick={() => applyContrastMode("high")}
                  className={`flex items-center justify-center rounded-md p-2 transition hover:bg-muted ${
                    contrastMode === "high" ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Contrast className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                role="menuitem"
                aria-label="Toggle larger text"
                aria-pressed={storedLarge}
                onClick={toggleLarge}
                className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                  storedLarge ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                }`}
              >
                <span>Larger text</span>
                {storedLarge && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
              </button>
              <button
                type="button"
                role="menuitem"
                aria-label="Toggle reduced motion"
                aria-pressed={storedReducedMotion}
                onClick={toggleReducedMotion}
                className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                  storedReducedMotion ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                }`}
              >
                <span>Reduced motion</span>
                {storedReducedMotion && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
