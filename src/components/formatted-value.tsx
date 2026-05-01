"use client"

import React from 'react'
import { useFormatting } from '@/lib/formatting-context'
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '@/lib/formatting'

interface FormattedCurrencyProps {
  value: number
  currency?: string
  showCurrencyCode?: boolean
  className?: string
}

interface FormattedNumberProps {
  value: number
  decimals?: number
  className?: string
}

export function FormattedCurrency({ 
  value, 
  currency, 
  showCurrencyCode = false,
  className = '' 
}: FormattedCurrencyProps) {
  const { preferences, isLoading } = useFormatting()

  if (isLoading) {
    return <span className={className}>Loading...</span>
  }

  const displayCurrency = currency || preferences.preferredCurrency
  const formatted = formatCurrencyUtil(value, preferences, displayCurrency)

  return <span className={className}>{formatted}</span>
}

export function FormattedNumber({ 
  value, 
  decimals = 2,
  className = '' 
}: FormattedNumberProps) {
  const { preferences, isLoading } = useFormatting()

  if (isLoading) {
    return <span className={className}>Loading...</span>
  }

  const formatted = formatNumberUtil(value, preferences, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })

  return <span className={className}>{formatted}</span>
}

// Utility hook for getting formatting functions
export function useFormat() {
  const { preferences, isLoading } = useFormatting()

  return {
    formatCurrency: (value: number, currency?: string) => 
      formatCurrencyUtil(value, preferences, currency || preferences.preferredCurrency),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => 
      formatNumberUtil(value, preferences, options),
    preferences,
    isLoading,
  }
}
