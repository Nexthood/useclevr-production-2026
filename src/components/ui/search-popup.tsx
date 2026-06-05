"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  ArrowRight,
  BarChart3,
  Clock,
  Database,
  FileQuestion,
  HelpCircle,
  SearchIcon,
  Send,
  Settings,
  Ticket,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchResult = {
  id: string;
  type: string;
  title: string;
  description?: string;
  href: string;
};

const resultTypes = ["page", "dataset", "report", "faq", "data"] as const;

const quickLinks = [
  {
    href: "/app/datasets",
    label: "Datasets",
    description: "Open uploaded files and tables.",
    icon: Database,
  },
  { href: "/app/upload", label: "Upload", description: "Add a CSV dataset.", icon: BarChart3 },
  {
    href: "/app/assistant",
    label: "AI Assistant",
    description: "Ask questions about a dataset.",
    icon: SearchIcon,
  },
  {
    href: "/app/tickets",
    label: "Tickets",
    description: "Create or review support requests.",
    icon: Ticket,
  },
  { href: "/app/faq", label: "FAQ", description: "Search dashboard help.", icon: HelpCircle },
  {
    href: "/app/settings/profile",
    label: "Settings",
    description: "Manage account and profile.",
    icon: Settings,
  },
];

const RECENT_SEARCHES_KEY = "useclevr_recent_searches";
const MAX_RECENT_SEARCHES = 5;

function loadRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const recent = loadRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // localStorage unavailable
  }
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // localStorage unavailable
  }
}

export function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultListRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearchingRef = useRef(false);

  useEffect(() => {
    const platform = window.navigator.platform || "";
    setShortcutLabel(/Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘ K" : "Ctrl K");
    if (open) {
      setRecentSearches(loadRecentSearches());
    }
  }, [open]);

  const filteredResults = typeFilter
    ? results.filter((result) => result.type === typeFilter)
    : results;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } else {
      searchButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setActiveResultIndex(-1);
  }, [results, typeFilter]);

  useEffect(() => {
    if (!open || filteredResults.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveResultIndex((previous) =>
          previous < filteredResults.length - 1 ? previous + 1 : 0,
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveResultIndex((previous) =>
          previous > 0 ? previous - 1 : filteredResults.length - 1,
        );
      } else if (event.key === "Enter" && activeResultIndex >= 0) {
        const result = filteredResults[activeResultIndex];
        if (result?.href) window.location.href = result.href;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredResults, activeResultIndex]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || isSearchingRef.current) return;
    isSearchingRef.current = true;
    setIsSearching(true);
    setHasSearched(true);

    saveRecentSearch(searchQuery.trim());
    setRecentSearches(loadRecentSearches());

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setResults([]);
    } finally {
      isSearchingRef.current = false;
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void handleSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  return (
    <>
      <Button
        ref={searchButtonRef}
        variant="ghost"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close search" : "Search"}
        className="h-full min-w-11 gap-2 rounded-none border-l border-border/50 px-2.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        title={`Search (${shortcutLabel})`}
      >
        {open ? (
          <X className="h-4 w-4" />
        ) : (
          <>
            <SearchIcon className="h-4 w-4" />
            <span className="hidden min-w-24 items-center justify-between rounded-md border border-border/70 bg-background px-2 py-1 text-xs text-muted-foreground lg:inline-flex">
              <span className="truncate">Search</span>
              <kbd className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground/70">
                {shortcutLabel}
              </kbd>
            </span>
          </>
        )}
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Search UseClevr"
        description="Search dashboard pages, datasets, reports, and FAQ."
        variant="fullscreen"
      >
        <form
          className="flex gap-2 border-b border-border pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (debounceRef.current) clearTimeout(debounceRef.current);
            void handleSearch(query);
          }}
        >
          <Input
            ref={searchInputRef}
            placeholder="Search dashboard pages, datasets, reports, and FAQ..."
            className="h-11 flex-1 text-base"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" className="h-11 gap-2" disabled={!query.trim() || isSearching}>
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{isSearching ? "Searching" : "Search"}</span>
          </Button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {results.length > 0 ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTypeFilter(null)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${typeFilter === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                >
                  All
                </button>
                {resultTypes.map((type) => {
                  const count = results.filter((result) => result.type === type).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTypeFilter(type)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition ${typeFilter === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                    >
                      {type === "faq" ? "FAQ" : type.charAt(0).toUpperCase() + type.slice(1)} ({count})
                    </button>
                  );
                })}
              </div>

              <div
                ref={resultListRef}
                className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card"
              >
                {filteredResults.map((result, index) => (
                  <Link
                    key={result.id}
                    href={result.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between gap-4 p-4 text-left transition ${
                      index === activeResultIndex ? "bg-accent" : "hover:bg-accent"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="rounded-md border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
                          {result.type}
                        </span>
                        <span className="truncate font-medium text-foreground">{result.title}</span>
                      </span>
                      {result.description && (
                        <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                          {result.description}
                        </span>
                      )}
                    </span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </>
          ) : hasSearched ? (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No results found for "{query}".
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a dashboard page, dataset name, report topic, or FAQ question.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Search dashboard pages, datasets, support tickets, reports, and FAQ answers.
                Operator-only results appear for super-admin accounts.
              </div>

              {recentSearches.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent searches</span>
                    <button
                      type="button"
                      onClick={() => { clearRecentSearches(); setRecentSearches([]); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((search) => (
                      <button
                        key={search}
                        type="button"
                        onClick={() => {
                          setQuery(search);
                          void handleSearch(search);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition"
                      >
                        <Clock className="h-3 w-3" />
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted"
                  >
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
