/**
 * Google Translation Service with caching
 * T-293: Dashboard language feature with Google Translation API and caching
 */

import { debugLog } from '@/lib/utils/debug'

interface TranslationCache {
  [key: string]: {
    translated: string
    timestamp: number
  }
}

const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
const cache: TranslationCache = {}

export type Language = 'en' | 'de' | 'hu' | 'ro'

const SUPPORTED_LANGUAGES: Language[] = ['en', 'de', 'hu', 'ro']

export function getCachedTranslation(text: string, targetLang: Language): string | null {
  const key = `${text}_${targetLang}`
  const cached = cache[key]
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.translated
  }
  return null
}

export function setCachedTranslation(text: string, targetLang: Language, translated: string): void {
  const key = `${text}_${targetLang}`
  cache[key] = { translated, timestamp: Date.now() }
}

export async function translateText(
  text: string,
  targetLang: Language,
  apiKey?: string
): Promise<string> {
  if (targetLang === 'en') return text

  const cached = getCachedTranslation(text, targetLang)
  if (cached) {
    debugLog('[TRANSLATE] Cache hit for:', text.substring(0, 30))
    return cached
  }

  if (!apiKey) {
    debugLog('[TRANSLATE] No API key, returning original text')
    return text
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          target: targetLang,
          source: 'en',
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Translation API error')
    }

    const data = await response.json()
    const translated = data.data?.translations?.[0]?.translatedText || text

    setCachedTranslation(text, targetLang, translated)
    debugLog('[TRANSLATE] Translated:', text.substring(0, 30), '->', translated.substring(0, 30))

    return translated
  } catch (error) {
    debugLog('[TRANSLATE] Error:', error)
    return text
  }
}

export function getSupportedLanguages(): Language[] {
  return SUPPORTED_LANGUAGES
}

export function clearTranslationCache(): void {
  Object.keys(cache).forEach((key) => delete cache[key])
}