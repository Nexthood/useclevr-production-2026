import {
  defaultRegionalPreferences,
  formatCurrencyWithPreferences,
  formatDateWithPreferences,
  formatNumberWithPreferences,
  normalizeRegionalPreferences,
  resolveDisplayCurrency,
  resolveTimezone,
} from "@/lib/utils/regional-preferences"

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`)
  }
}

function assertIncludes(actual: string, expected: string, label: string) {
  if (!actual.includes(expected)) {
    throw new Error(`${label}: expected "${actual}" to include "${expected}"`)
  }
}

const auto = defaultRegionalPreferences

assertEqual(resolveDisplayCurrency(auto, "en-GB"), "GBP", "en-GB resolves to GBP")
assertEqual(resolveDisplayCurrency(auto, "en-US"), "USD", "en-US resolves to USD")
assertEqual(resolveDisplayCurrency(auto, "nl-NL"), "EUR", "nl-NL resolves to EUR")
assertEqual(resolveDisplayCurrency(auto, null), "EUR", "missing locale falls back to EUR")

const manualUsd = normalizeRegionalPreferences({
  displayCurrency: "USD",
  baseCurrency: "EUR",
  numberFormat: "comma_decimal",
  dateFormat: "mm_dd_yyyy",
  timezone: "America/New_York",
  language: "en",
  localeMode: "auto",
})

assertEqual(resolveDisplayCurrency(manualUsd, "nl-NL"), "USD", "manual display currency persists")
assertEqual(resolveTimezone(manualUsd, "Europe/Amsterdam"), "America/New_York", "manual timezone persists")

assertIncludes(formatCurrencyWithPreferences(1116800, manualUsd, "nl-NL"), "$1,116,800.00", "manual USD currency preview")
assertEqual(formatNumberWithPreferences(1116800, { ...auto, numberFormat: "dot_comma" }, "en-US"), "1.116.800,00", "dot/comma number preview")
assertEqual(formatNumberWithPreferences(1116800, { ...auto, numberFormat: "space_comma" }, "en-US"), "1 116 800,00", "space/comma number preview")
assertEqual(formatDateWithPreferences(new Date(Date.UTC(2026, 6, 21, 12, 0, 0)), { ...auto, dateFormat: "dd_mm_yyyy" }, "en-US"), "21/07/2026", "DD/MM/YYYY preview")
assertEqual(formatDateWithPreferences(new Date(Date.UTC(2026, 6, 21, 12, 0, 0)), { ...auto, dateFormat: "mm_dd_yyyy" }, "en-GB"), "07/21/2026", "MM/DD/YYYY preview")

console.log("Regional preference checks passed.")

