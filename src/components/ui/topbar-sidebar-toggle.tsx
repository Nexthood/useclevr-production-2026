"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useEffect, useState } from "react"

const SIDEBAR_TOGGLE_EVENT = "useclevr:sidebar-toggle"

export function TopbarSidebarToggle() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("useclevr_sidebar_collapsed")
    if (stored === "true") {
      setIsCollapsed(true)
    }

    const handleChange = (e: CustomEvent) => {
      setIsCollapsed(e.detail.collapsed)
    }
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, handleChange as EventListener)
    return () => window.removeEventListener(SIDEBAR_TOGGLE_EVENT, handleChange as EventListener)
  }, [])

  const handleToggle = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem("useclevr_sidebar_collapsed", String(next))
    window.dispatchEvent(new CustomEvent(SIDEBAR_TOGGLE_EVENT, { detail: { collapsed: next } }))
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="flex h-full min-w-12 items-center justify-center px-3 text-muted-foreground transition hover:bg-muted/70"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  )
}

