import { parseCanonicalDate } from "@/lib/data/canonical-date"

/**
 * Shared semantic profiling primitives for uploaded tables.
 *
 * This is the generic "raw table -> profiling" layer used by domain-specific
 * resolvers (Profitability, Retail, EDIE, semantic profiles, ClevrSync). It
 * owns the primitives every semantic layer needs and must not contain any
 * domain vocabulary:
 *
 *   - header tokenization (snake_case, camelCase, spaces, case changes)
 *   - locale-tolerant number/money parsing (US "1,234.56", European
 *     "1.234,56", accounting negatives, currency markers)
 *   - per-column value-shape profiling (numeric, date, integer, cardinality,
 *     monetary markers, distribution basics)
 *   - categorical vs identifier vs free-text shape scoring
 *   - row-level arithmetic identity verification (quantity x unit,
 *     base-minus-components reconciliation) with tolerance and coverage
 *
 * Domain resolvers layer their own aliases and financial constraints on top
 * of these primitives; the primitives themselves stay header-agnostic.
 */

export type ColumnProfile = {
  column: string
  tokens: string[]
  normalized: string
  numericRatio: number
  dateRatio: number
  integerRatio: number
  distinctStrings: number
  stringRatio: number
  numericCount: number
  presentCount: number
  min: number
  max: number
  median: number
  sum: number
  currencyMarkers: string[]
  sampleNumeric: number[]
  /** Bounded sample of distinct string values (categorical/free-text evidence). */
  sampleStrings: string[]
}

export type CategoricalShapeScore = {
  /** Column behaves like a repeating category label. */
  categorical: boolean
  /** 0..1; values are near-unique (identifier-like) when high. */
  identifierLikelihood: number
  /** 0..1; values are long/free-text-like when high. */
  freeTextLikelihood: number
  /** Nonnegative-quality score for categorical candidates (can go negative). */
  score: number
  distinctRatio: number
  medianLength: number
}

export type RowIdentitySpec = {
  /** Column expected to hold the (gross/total) base value. */
  base: string
  /** Component columns embedded in the base value (absolute values are subtracted). */
  subtract?: string[]
  /** Verify that base minus components equals quantity x unit per row. */
  productOf?: { quantity: string; unit: string }
}

export type RowIdentityResult = {
  checked: number
  mismatchRatio: number
  consistent: boolean
}

/** Relative row-level tolerance for arithmetic identities. */
export const ROW_IDENTITY_TOLERANCE = 0.02

/** Upper bound of distinct string values retained for shape scoring. */
const MAX_STRING_SAMPLE = 200

/**
 * Tokenizes a column header into lowercase semantic tokens regardless of
 * snake_case, camelCase, PascalCase, spaces, hyphens, or punctuation.
 * CamelCase and acronym boundaries split before lowercasing so
 * "salesValue" and "VATRate" tokenize correctly.
 */
export function tokenizeHeader(header: string): string[] {
  return header
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .trim()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/**
 * Locale-tolerant number/money parsing: understands US "1,234.56", European
 * "1.234,56", accounting negatives "(1,234.56)", and currency markers.
 * Date-shaped strings ("2026-01-02", "01/15/2026") are never numeric, and
 * identifier/period strings with interior separators stay non-numeric.
 */
export function parseLocaleNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw || !/\d/.test(raw)) return null
  if (/\d[-/]\d/.test(raw)) return null
  // Interior separators mean identifiers ("INV-0001", "CUST-001"), periods
  // ("2026-01"), or dates — never money. Leading/trailing sign stays money.
  if (raw.slice(1).includes("-") || raw.includes("/")) return null
  const cleaned = raw.replace(/[^\d.,]/g, "")
  if (!/\d/.test(cleaned)) return null
  const hasComma = cleaned.includes(",")
  const hasDot = cleaned.includes(".")

  let normalized = cleaned
  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(/,/g, ".")
      : cleaned.replace(/,/g, "")
  } else if (hasComma) {
    normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/,(?=\d{1,2}$)/, ".") : cleaned.replace(/,/g, "")
  } else if (hasDot) {
    const dotGroups = cleaned.split(".")
    if (dotGroups.length > 2 || (dotGroups[dotGroups.length - 1] || "").length === 3) {
      normalized = cleaned.replace(/\./g, "")
    }
  }

  const negativeSign = /^\s*[-(]/.test(raw) || /[-)]\s*$/.test(raw)
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return null
  return negativeSign ? -Math.abs(parsed) : parsed
}

const CURRENCY_SYMBOL_CHARS = ["€", "$", "£", "¥", "₹"]

export function extractCurrencyMarkers(text: string): string[] {
  const markers: string[] = []
  for (const symbol of CURRENCY_SYMBOL_CHARS) {
    if (text.includes(symbol)) markers.push(symbol)
  }
  for (const match of text.matchAll(/\b(USD|EUR|GBP|JPY|CHF|CAD|AUD|SEK|NOK|DKK|INR)\b/g)) {
    markers.push(match[1])
  }
  return markers
}

/** Profiles one column's value shape across all rows (header-agnostic). */
export function profileColumn(column: string, rows: Record<string, unknown>[]): ColumnProfile {
  const tokens = tokenizeHeader(column)
  let numericCount = 0
  let dateCount = 0
  let stringCount = 0
  let presentCount = 0
  let integerCount = 0
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let sum = 0
  const numericValues: number[] = []
  const distinctStrings = new Set<string>()
  const currencyMarkers = new Set<string>()

  for (const row of rows) {
    const value = row[column]
    if (value === null || value === undefined || value === "") continue
    presentCount += 1

    if (value instanceof Date) {
      dateCount += 1
      continue
    }

    const text = String(value).trim()
    const parsed = parseLocaleNumber(text)
    if (parsed !== null) {
      numericCount += 1
      if (Number.isInteger(parsed)) integerCount += 1
      numericValues.push(parsed)
      sum += parsed
      min = Math.min(min, parsed)
      max = Math.max(max, parsed)
      for (const marker of extractCurrencyMarkers(text)) currencyMarkers.add(marker)
    } else if (parseCanonicalDate(text)) {
      dateCount += 1
    } else {
      stringCount += 1
      distinctStrings.add(text)
      for (const marker of extractCurrencyMarkers(text)) currencyMarkers.add(marker)
    }
  }

  numericValues.sort((a, b) => a - b)
  const median = numericValues.length === 0 ? 0 : numericValues.length % 2 === 1
    ? numericValues[(numericValues.length - 1) / 2]
    : (numericValues[numericValues.length / 2 - 1] + numericValues[numericValues.length / 2]) / 2

  return {
    column,
    tokens,
    normalized: tokens.join(" "),
    numericRatio: presentCount === 0 ? 0 : numericCount / presentCount,
    dateRatio: presentCount === 0 ? 0 : dateCount / presentCount,
    integerRatio: numericCount === 0 ? 0 : integerCount / numericCount,
    distinctStrings: distinctStrings.size,
    stringRatio: presentCount === 0 ? 0 : stringCount / presentCount,
    numericCount,
    presentCount,
    min: numericValues.length === 0 ? 0 : min,
    max: numericValues.length === 0 ? 0 : max,
    median,
    sum,
    currencyMarkers: Array.from(currencyMarkers),
    sampleNumeric: numericValues.slice(0, 120),
    sampleStrings: Array.from(distinctStrings).slice(0, MAX_STRING_SAMPLE),
  }
}

/**
 * Scores how strongly a column behaves like a categorical label from value
 * shape alone (repeated short strings, sensible cardinality, not an
 * identifier, not free text). Header names are deliberately ignored so
 * unknown headers with strong categorical behavior stay discoverable.
 */
export function scoreCategoricalShape(profile: ColumnProfile): CategoricalShapeScore {
  const stringDominant = profile.stringRatio >= 0.5 && profile.numericRatio < 0.5
  const distinctRatio = profile.presentCount === 0 ? 1 : profile.distinctStrings / profile.presentCount
  if (!stringDominant || profile.distinctStrings === 0) {
    return {
      categorical: false,
      identifierLikelihood: stringDominant ? 0 : 1,
      freeTextLikelihood: 0,
      score: 0,
      distinctRatio,
      medianLength: 0,
    }
  }

  const identifierLikelihood = Math.min(1, Math.max(0, (distinctRatio - 0.6) / 0.35))
  const lengths = profile.sampleStrings.map((value) => value.length).sort((a, b) => a - b)
  const medianLength = lengths.length === 0 ? 0 : lengths.length % 2 === 1
    ? lengths[(lengths.length - 1) / 2]
    : (lengths[lengths.length / 2 - 1] + lengths[lengths.length / 2]) / 2
  const freeTextLikelihood = Math.min(1, Math.max(0, (medianLength - 40) / 40))

  let score = 0
  if (profile.distinctStrings >= 2 && profile.distinctStrings <= 60) score += 30
  if (distinctRatio <= 0.6) score += 25
  if (medianLength <= 48) score += 20
  if (profile.currencyMarkers.length === 0) score += 5
  score -= Math.round(identifierLikelihood * 50)
  score -= Math.round(freeTextLikelihood * 50)

  return {
    categorical: score >= 30,
    identifierLikelihood,
    freeTextLikelihood,
    score,
    distinctRatio,
    medianLength,
  }
}

/**
 * Verifies a row-level arithmetic identity:
 *   |base - sum(|components|)|  ~=  |quantity x unit|   (when productOf given)
 *   sum(|components|) <= |base|                          (when only subtract given)
 * Rows missing any referenced value are skipped. An identity is consistent
 * when at most 10% of checked rows deviate beyond ROW_IDENTITY_TOLERANCE.
 */
export function verifyRowIdentity(
  rows: Record<string, unknown>[],
  spec: RowIdentitySpec,
): RowIdentityResult {
  let checked = 0
  let mismatched = 0
  const subtract = spec.subtract ?? []
  for (const row of rows) {
    const baseRaw = parseLocaleNumber(row[spec.base])
    if (baseRaw === null) continue
    const base = Math.abs(baseRaw)
    let components = 0
    let missing = false
    for (const column of subtract) {
      const value = parseLocaleNumber(row[column])
      if (value === null) {
        missing = true
        break
      }
      components += Math.abs(value)
    }
    if (missing) continue
    const net = Math.max(0, base - components)

    if (spec.productOf) {
      const quantity = parseLocaleNumber(row[spec.productOf.quantity])
      const unit = parseLocaleNumber(row[spec.productOf.unit])
      if (quantity === null || unit === null) continue
      const product = Math.abs(quantity * unit)
      if (base === 0 && product === 0 && components === 0) continue
      const deviation = Math.abs(net - product) / Math.max(net, product, 1)
      checked += 1
      if (deviation > ROW_IDENTITY_TOLERANCE) mismatched += 1
    } else {
      checked += 1
      if (components > base + 0.005) mismatched += 1
    }
  }
  return {
    checked,
    mismatchRatio: checked === 0 ? 1 : mismatched / checked,
    consistent: checked > 0 && mismatched / checked <= 0.1,
  }
}
