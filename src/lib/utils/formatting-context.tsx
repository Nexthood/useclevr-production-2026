"use client"

import { debugError } from "@/lib/utils/debug";



import type { UserFormattingPreferences } from '@/lib/utils/formatting';
import { getDefaultPreferences } from '@/lib/utils/formatting';
import { normalizeRegionalPreferences } from '@/lib/utils/regional-preferences';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

interface FormattingContextType {
  preferences: UserFormattingPreferences
  setPreferences: (prefs: UserFormattingPreferences) => void
  isLoading: boolean
}

const FormattingContext = createContext<FormattingContextType | undefined>(undefined)

export function FormattingProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserFormattingPreferences>(getDefaultPreferences())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    // Load a local value immediately, then refresh from the authenticated profile.
    const stored = localStorage.getItem('formattingPreferences')
    if (stored) {
      try {
        setPreferences(JSON.parse(stored))
      } catch {
        debugError('Failed to parse stored formatting preferences')
      }
    }

    fetch('/api/settings/preferences', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) return null
        return response.json()
      })
      .then((payload) => {
        if (ignore || !payload?.preferences) return
        const regional = normalizeRegionalPreferences(payload.preferences)
        const nextPreferences: UserFormattingPreferences = {
          ...regional,
          preferredCurrency: regional.displayCurrency,
          baseCurrency: regional.baseCurrency,
          numberFormat: regional.numberFormat,
        }
        setPreferences(nextPreferences)
        localStorage.setItem('formattingPreferences', JSON.stringify(nextPreferences))
      })
      .catch(() => {
        debugError('Failed to load saved formatting preferences')
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  const handleSetPreferences = (prefs: UserFormattingPreferences) => {
    setPreferences(prefs)
    localStorage.setItem('formattingPreferences', JSON.stringify(prefs))
  }

  return (
    <FormattingContext.Provider value={{ preferences, setPreferences: handleSetPreferences, isLoading }}>
      {children}
    </FormattingContext.Provider>
  )
}

export function useFormatting() {
  const context = useContext(FormattingContext)
  if (context === undefined) {
    throw new Error('useFormatting must be used within a FormattingProvider')
  }
  return context
}
