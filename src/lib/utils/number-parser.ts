export const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹', 'C$', 'A$', 'CHF', '₽', 'R$', '₩', '₪']

export const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,                    // ISO: 2024-01-15
  /^\d{2}\/\d{2}\/\d{4}$/,                  // US: 01/15/2024
  /^\d{2}-\d{2}-\d{4}$/,                    // EU: 15-01-2024
  /^\d{2}\.\d{2}\.\d{4}$/,                  // German: 15.01.2024
  /^\d{4}\/\d{2}\/\d{2}$/,                  // Alt: 2024/01/15
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,   // ISO datetime
]

const PLACEHOLDER_VALUES = [
  'n/a', 'na', 'n/a', 'null', 'none', 'undefined', 'missing',
  '-', '—', '–', '.', '...', 'xxxx', 'xxxxx', 'tbd', 'tbc',
  'unknown', 'unspecified', 'not available', 'not applicable'
]

export function isPlaceholderValue(value: string): boolean {
  const normalized = value.toLowerCase().trim()
  return PLACEHOLDER_VALUES.includes(normalized)
}

export function isNullish(value: any): boolean {
  return value === null || value === undefined || value === ''
}

export function cleanNumericValue(value: any): { cleaned: number | null; wasCleaned: boolean } {
  if (isNullish(value)) {
    return { cleaned: null, wasCleaned: false }
  }

  let strValue = String(value).trim()

  if (isPlaceholderValue(strValue)) {
    return { cleaned: null, wasCleaned: false }
  }

  let wasCleaned = false

  // Remove currency symbols (prefix and suffix)
  for (const symbol of CURRENCY_SYMBOLS) {
    if (strValue.startsWith(symbol)) {
      strValue = strValue.slice(symbol.length).trim()
      wasCleaned = true
      break
    }
    if (strValue.endsWith(symbol)) {
      strValue = strValue.slice(0, -symbol.length).trim()
      wasCleaned = true
      break
    }
  }

  // Handle accounting format: (100) = -100
  if (strValue.startsWith('(') && strValue.endsWith(')')) {
    strValue = '-' + strValue.slice(1, -1)
    wasCleaned = true
  }

  // Remove thousand separators (comma, space)
  const hasSeparators = /[, ]/.test(strValue)
  if (hasSeparators) {
    strValue = strValue.replace(/[, ]/g, '')
    wasCleaned = true
  }

  // Handle percentage (convert to decimal)
  const isPercent = strValue.endsWith('%')
  if (isPercent) {
    strValue = strValue.slice(0, -1)
    wasCleaned = true
  }

  const num = parseFloat(strValue)
  if (isNaN(num)) {
    return { cleaned: null, wasCleaned: false }
  }

  const finalValue = isPercent ? num / 100 : num
  return { cleaned: finalValue, wasCleaned }
}

export function parseNumericValue(value: string): number | null {
  const { cleaned } = cleanNumericValue(value)
  return cleaned
}
