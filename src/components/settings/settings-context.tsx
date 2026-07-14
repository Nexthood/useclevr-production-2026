"use client"

import * as React from "react"

export type SettingsContextValue = {
  setupStatus: { setupAccuracy: number; completedSections: string[]; missingFields: string[]; accountantReviewFlags: string[]; completed: boolean } | null
  usage: {
    subscriptionTier: string
    trialActive: boolean
    trialDaysRemaining: number
    analysisCount: number | null
    total: number | null
    availableCredits: number | null
    reservedCredits: number | null
    usedCredits: number | null
    remainingCredits: number | null
    limitReached: boolean
    canAnalyze: boolean
    unlimited: boolean
    unlimitedLabel: string | null
  } | null
  session: { user?: { id?: string; name?: string | null; email?: string | null; role?: string } } | null
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null)

export function useSettings() {
  const ctx = React.useContext(SettingsContext)
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider")
  return ctx
}

export function SettingsProvider({
  children,
  setupStatus,
  usage,
  session,
}: {
  children: React.ReactNode
  setupStatus: SettingsContextValue["setupStatus"]
  usage: SettingsContextValue["usage"]
  session: SettingsContextValue["session"]
}) {
  return (
    <SettingsContext.Provider value={{ setupStatus, usage, session }}>
      {children}
    </SettingsContext.Provider>
  )
}
