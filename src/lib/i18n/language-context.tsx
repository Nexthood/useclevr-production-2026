"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { translateText } from './translation-service'

export type Language = 'en' | 'de' | 'hu' | 'ro'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  translate: (text: string) => Promise<string>
}

const translations = {
  en: {
    dashboard: 'Dashboard',
    settings: 'Settings',
    datasets: 'Datasets',
    reports: 'Reports',
    loading: 'Loading...',
  },
  de: {
    dashboard: 'Dashboard',
    settings: 'Einstellungen',
    datasets: 'Datensätze',
    reports: 'Berichte',
    loading: 'Wird geladen...',
  },
  hu: {
    dashboard: 'Irányítópult',
    settings: 'Beállítások',
    datasets: 'Adatkészletek',
    reports: 'Jelentések',
    loading: 'Betöltés...',
  },
  ro: {
    dashboard: 'Tablou de bord',
    settings: 'Setări',
    datasets: 'Seturi de date',
    reports: 'Rapoarte',
    loading: 'Se încarcă...',
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language
    if (saved && ['en', 'de', 'hu', 'ro'].includes(saved)) {
      setLanguage(saved)
    }
  }, [])

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('language', lang)
  }

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key
  }

  const translate = async (text: string): Promise<string> => {
    if (language === 'en') return text
    return await translateText(text, language)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t, translate }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}