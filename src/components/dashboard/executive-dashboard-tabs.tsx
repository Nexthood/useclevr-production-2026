"use client"

import * as React from "react"

export type ExecutiveDashboardTab = "overview" | "financial" | "inventory" | "geography" | "ai"

type ExecutiveDashboardTabsProps = {
  initialActive: ExecutiveDashboardTab
  range: string
  panels: Record<ExecutiveDashboardTab, React.ReactNode>
}

const dashboardTabs: { key: ExecutiveDashboardTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "financial", label: "Financial" },
  { key: "inventory", label: "Inventory" },
  { key: "geography", label: "Geography" },
  { key: "ai", label: "AI & Activity" },
]

export function ExecutiveDashboardTabs({ initialActive, range, panels }: ExecutiveDashboardTabsProps) {
  const [activeTab, setActiveTab] = React.useState<ExecutiveDashboardTab>(initialActive)

  React.useEffect(() => {
    setActiveTab(initialActive)
  }, [initialActive])

  const handleTabChange = (tab: ExecutiveDashboardTab) => {
    setActiveTab(tab)

    const params = new URLSearchParams(window.location.search)
    params.set("range", params.get("range") || range)
    params.set("tab", tab)
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
  }

  return (
    <section className="space-y-4">
      <nav className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card/80 p-2" aria-label="Dashboard detail sections">
        {dashboardTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-selected={activeTab === tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={[
              "whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              activeTab === tab.key
                ? "bg-cyan-300/10 text-cyan-700 dark:text-cyan-100"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div>{panels[activeTab]}</div>
    </section>
  )
}
