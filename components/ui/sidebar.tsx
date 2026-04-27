"use client"

import * as React from "react"
import { createContext, useContext, useState } from "react"

type SidebarContextType = {
  open: boolean
  setOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({
  children,
  defaultOpen = true,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const toggleSidebar = () => setOpen(!open)

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

export function SidebarInset({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <main
      className={[
        "flex-1 bg-background min-h-screen ml-64",
        className,
      ].join(" ")}
    >
      {children}
    </main>
  )
}

export function Sidebar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <aside
      className={[
        "border-r bg-card w-64 min-h-screen hidden md:flex flex-col",
        className,
      ].join(" ")}
    >
      {children}
    </aside>
  )
}
