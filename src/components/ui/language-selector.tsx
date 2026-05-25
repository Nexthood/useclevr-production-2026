"use client"

import { useState } from 'react'
import { Globe } from 'lucide-react'
import { useLanguage, type Language } from '@/lib/i18n/language-context'

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
]

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)

  const currentLang = LANGUAGES.find((l) => l.code === language)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
        title="Select language"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{currentLang?.flag}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-slate-300 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-950">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  language === lang.code ? 'font-semibold text-primary' : 'text-slate-900 dark:text-white'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}