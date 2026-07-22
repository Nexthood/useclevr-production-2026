export const supportedCurrencies = [
  { value: "auto", label: "Auto - based on browser locale" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "CHF", label: "CHF - Swiss Franc" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "HUF", label: "HUF - Hungarian Forint" },
  { value: "RON", label: "RON - Romanian Leu" },
  { value: "PLN", label: "PLN - Polish Zloty" },
  { value: "SEK", label: "SEK - Swedish Krona" },
  { value: "NOK", label: "NOK - Norwegian Krone" },
  { value: "DKK", label: "DKK - Danish Krone" },
] as const

export const manualCurrencies = supportedCurrencies.filter((currency) => currency.value !== "auto")

export const numberFormatOptions = [
  { value: "auto", label: "Auto" },
  { value: "comma_decimal", label: "1,234,567.89" },
  { value: "dot_comma", label: "1.234.567,89" },
  { value: "space_comma", label: "1 234 567,89" },
] as const

export const dateFormatOptions = [
  { value: "auto", label: "Auto" },
  { value: "dd_mm_yyyy", label: "DD/MM/YYYY" },
  { value: "mm_dd_yyyy", label: "MM/DD/YYYY" },
  { value: "yyyy_mm_dd", label: "YYYY-MM-DD" },
] as const

export const timezoneOptions = [
  { value: "auto", label: "Auto - detect from browser" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/Bucharest", label: "Europe/Bucharest" },
  { value: "Europe/Budapest", label: "Europe/Budapest" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
] as const

export const languageOptions = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "nl", label: "Nederlands" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
  { value: "hu", label: "Magyar" },
  { value: "ro", label: "Română" },
] as const

export type DisplayCurrencyPreference = (typeof supportedCurrencies)[number]["value"]
export type BaseCurrencyPreference = (typeof manualCurrencies)[number]["value"]
export type NumberFormatPreference = (typeof numberFormatOptions)[number]["value"]
export type DateFormatPreference = (typeof dateFormatOptions)[number]["value"]
export type TimezonePreference = (typeof timezoneOptions)[number]["value"]
export type LanguagePreference = (typeof languageOptions)[number]["value"]

export type RegionalPreferences = {
  displayCurrency: DisplayCurrencyPreference
  baseCurrency: BaseCurrencyPreference
  numberFormat: NumberFormatPreference
  dateFormat: DateFormatPreference
  timezone: TimezonePreference
  language: LanguagePreference
  localeMode: "auto" | "manual"
  manualLocale?: string
}

export const defaultRegionalPreferences: RegionalPreferences = {
  displayCurrency: "auto",
  baseCurrency: "EUR",
  numberFormat: "auto",
  dateFormat: "auto",
  timezone: "auto",
  language: "auto",
  localeMode: "auto",
}

const currencyByLocalePrefix: Array<[RegExp, BaseCurrencyPreference]> = [
  [/^(nl|de|fr|es|it)-/i, "EUR"],
  [/^en-GB$/i, "GBP"],
  [/^en-US$/i, "USD"],
  [/^(en|fr)-CA$/i, "CAD"],
  [/^en-AU$/i, "AUD"],
  [/^(de|fr|it)-CH$/i, "CHF"],
  [/^ja-JP$/i, "JPY"],
  [/^hu-HU$/i, "HUF"],
  [/^ro-RO$/i, "RON"],
]

const localeByNumberFormat: Record<Exclude<NumberFormatPreference, "auto">, string> = {
  comma_decimal: "en-US",
  dot_comma: "de-DE",
  space_comma: "fr-FR",
}

const localeByDateFormat: Record<Exclude<DateFormatPreference, "auto">, string> = {
  dd_mm_yyyy: "en-GB",
  mm_dd_yyyy: "en-US",
  yyyy_mm_dd: "sv-SE",
}

function asOption<T extends string>(value: unknown, allowed: readonly { value: T }[], fallback: T): T {
  return allowed.some((option) => option.value === value) ? value as T : fallback
}

export function normalizeRegionalPreferences(input: unknown, legacy?: { preferredCurrency?: string | null; numberFormat?: string | null }): RegionalPreferences {
  const record = input && typeof input === "object" ? input as Record<string, unknown> : {}
  const hasRegionalObject = Object.keys(record).length > 0
  const legacyCurrency = legacy?.preferredCurrency?.toUpperCase()
  const legacyNumberFormat = legacy?.numberFormat === "manual" ? "comma_decimal" : legacy?.numberFormat
  const recordNumberFormat = record.numberFormat === "manual" ? "comma_decimal" : record.numberFormat
  const legacyDisplayCurrency = hasRegionalObject
    ? defaultRegionalPreferences.displayCurrency
    : asOption(legacyCurrency, supportedCurrencies, defaultRegionalPreferences.displayCurrency)

  return {
    displayCurrency: asOption(record.displayCurrency, supportedCurrencies, legacyDisplayCurrency),
    baseCurrency: asOption(record.baseCurrency, manualCurrencies, legacyCurrency && legacyCurrency !== "AUTO" ? asOption(legacyCurrency, manualCurrencies, "EUR") : "EUR"),
    numberFormat: asOption(recordNumberFormat ?? legacyNumberFormat, numberFormatOptions, "auto"),
    dateFormat: asOption(record.dateFormat, dateFormatOptions, "auto"),
    timezone: asOption(record.timezone, timezoneOptions, "auto"),
    language: asOption(record.language, languageOptions, "auto"),
    localeMode: record.localeMode === "manual" ? "manual" : "auto",
    manualLocale: typeof record.manualLocale === "string" && record.manualLocale.trim()
      ? record.manualLocale.trim()
      : undefined,
  }
}

export function detectBrowserLocale(): string | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null
  return navigator.languages?.[0] || navigator.language || null
}

export function detectBrowserTimezone(): string | null {
  if (typeof window === "undefined" || typeof Intl === "undefined") return null
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null
}

export function resolveUserLocale(preferences: RegionalPreferences, browserLocale?: string | null): string {
  if (preferences.localeMode === "manual" && preferences.manualLocale) return preferences.manualLocale
  return browserLocale || detectBrowserLocale() || "en-US"
}

export function resolveDisplayCurrency(preferences: RegionalPreferences, locale?: string | null): BaseCurrencyPreference {
  if (preferences.displayCurrency !== "auto") return preferences.displayCurrency
  const resolvedLocale = locale || (preferences.localeMode === "manual" ? preferences.manualLocale : null) || detectBrowserLocale()
  if (!resolvedLocale) return "EUR"
  const match = currencyByLocalePrefix.find(([pattern]) => pattern.test(resolvedLocale))
  return match?.[1] || "EUR"
}

export function resolveTimezone(preferences: RegionalPreferences, browserTimezone?: string | null): string {
  if (preferences.timezone !== "auto") return preferences.timezone
  return browserTimezone || detectBrowserTimezone() || "Europe/Amsterdam"
}

export function formatNumberWithPreferences(value: number, preferences: RegionalPreferences, browserLocale?: string | null, options: Intl.NumberFormatOptions = {}) {
  const locale = preferences.numberFormat === "auto"
    ? resolveUserLocale(preferences, browserLocale)
    : localeByNumberFormat[preferences.numberFormat]
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options }).format(value)
}

export function formatCurrencyWithPreferences(value: number, preferences: RegionalPreferences, browserLocale?: string | null) {
  const locale = preferences.numberFormat === "auto"
    ? resolveUserLocale(preferences, browserLocale)
    : localeByNumberFormat[preferences.numberFormat]
  const currency = resolveDisplayCurrency(preferences, locale)
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDateWithPreferences(value: Date, preferences: RegionalPreferences, browserLocale?: string | null) {
  if (preferences.dateFormat !== "auto") {
    const locale = localeByDateFormat[preferences.dateFormat]
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(value)
  }
  return new Intl.DateTimeFormat(resolveUserLocale(preferences, browserLocale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value)
}
