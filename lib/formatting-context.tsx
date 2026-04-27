"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserFormattingPreferences, getDefaultPreferences } from '@/lib/formatting'

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
    // Load preferences from localStorage
    const stored = localStorage.getItem('formattingPreferences')
    if (stored) {
      try {
        setPreferences(JSON.parse(stored))
      } catch {
        console.error('Failed to parse stored formatting preferences')
      }
    }
    setIsLoading(false)
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
