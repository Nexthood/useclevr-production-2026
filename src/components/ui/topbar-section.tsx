"use client";

import Link from "next/link";
import type React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function TopbarSection({
  icon,
  label,
  value,
  header,
  description,
  children,
  align = "left",
  noBorder = false,
  iconOnly = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  header: string;
  description: string;
  children?: React.ReactNode;
  align?: "left" | "right";
  noBorder?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <Popover className="h-full">
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group flex h-full min-w-10 items-center gap-2 whitespace-nowrap px-2.5 text-sm text-foreground outline-none transition hover:bg-muted/50 focus-visible:bg-muted/50 active:bg-muted/70 ${noBorder ? "" : "border-l border-border/50"}`}
          title={label}
          aria-label={label}
        >
          <span className="flex-shrink-0 text-muted-foreground transition group-hover:text-foreground">{icon}</span>
          <span className={iconOnly ? "sr-only" : "hidden min-w-0 lg:block"}>
            <span className="block truncate text-xs font-semibold leading-4">{label}</span>
            {value && (
              <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                {value}
              </span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align === "right" ? "end" : "start"}
        className="mt-1 w-72 rounded-lg border border-border/60 bg-popover p-0 shadow-lg"
      >
        <div className="p-4">
          <div className="border-b border-border/50 pb-3">
            <p className="text-sm font-semibold text-foreground">{header}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground/90">{description}</p>
          </div>
          {children && <div className="mt-3 space-y-2">{children}</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TopbarPanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block text-sm font-medium text-primary transition hover:text-primary/80"
    >
      {children}
    </Link>
  );
}
