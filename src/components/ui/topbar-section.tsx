"use client";

import Link from "next/link";
import type React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function TopbarSection({
  icon,
  label,
  value,
  children,
  align = "left",
  iconOnly = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  children?: React.ReactNode;
  align?: "left" | "right";
  iconOnly?: boolean;
}) {
  return (
    <Popover className="h-full">
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex h-full min-w-10 items-center gap-2 whitespace-nowrap px-2.5 text-sm text-foreground outline-none transition hover:bg-muted/50 focus-visible:bg-muted/50 active:bg-muted/70"
          title={label}
          aria-label={label}
        >
          <span className="flex-shrink-0 text-muted-foreground transition group-hover:text-foreground">{icon}</span>
          <span className={iconOnly ? "sr-only" : "hidden min-w-0 lg:block"}>
            <span className="block truncate text-xs font-semibold leading-4 whitespace-nowrap">{label}</span>
            {value && (
              <span className="block truncate text-[11px] leading-4 whitespace-nowrap text-muted-foreground">
                {value}
              </span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align === "right" ? "end" : "start"}
        className="w-64 rounded-lg border border-border/60 bg-popover p-0 shadow-lg"
      >
        {children && <div className="p-2">{children}</div>}
      </PopoverContent>
    </Popover>
  );
}

export function TopbarPanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-2 py-1.5 text-sm font-medium text-primary transition hover:bg-muted/50 hover:text-primary/80 rounded"
    >
      {children}
    </Link>
  );
}
