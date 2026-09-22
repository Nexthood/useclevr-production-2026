const ISO_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
const ISO_MONTH_PATTERN = /^(\d{4})-(\d{1,2})$/
const ISO_YEAR_PATTERN = /^\d{4}$/
const US_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
const EU_DATE_PATTERN = /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/
const ALT_DATE_PATTERN = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
const COMPACT_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/

function createUtcDate(year: number, monthIndex: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, monthIndex, day))
  if (Number.isNaN(date.getTime())) return null
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) return null
  return date
}

const MONTH_NAME_PATTERN = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i

function fromNativeParse(value: string): Date | null {
  // The native Date parser is lenient enough to turn arbitrary identifiers
  // ("PC-001") into dates. Only parse free-form text that carries explicit date
  // evidence: a four-digit year or a month name.
  if (!/\d{4}/.test(value) && !MONTH_NAME_PATTERN.test(value)) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseCompactDate(match: RegExpMatchArray): Date | null {
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return createUtcDate(Number(match[1]), month - 1, day)
}

/**
 * Canonical date parsing for the whole analysis pipeline.
 * All modules (data cleaner, business semantics, risk intelligence) must use this
 * parser so one value cannot be valid in one module and invalid in another.
 * Accepts Date instances, ISO dates/datetimes, YYYY-MM and YYYY periods, US
 * MM/DD/YYYY, EU DD-MM-YYYY, German DD.MM.YYYY, YYYY/MM/DD, and compact YYYYMMDD.
 */
export function parseCanonicalDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== "string" && typeof value !== "number") return null

  const text = String(value).trim()
  if (!text) return null
  // Pure numbers are ambiguous (Excel serials, IDs, epoch millis) and must not
  // silently parse as dates; only YYYY and YYYYMMDD digit forms are canonical.
  if (/^\d+$/.test(text) && text.length !== 4 && text.length !== 8) return null

  const isoDateMatch = text.match(ISO_DATE_PATTERN)
  if (isoDateMatch) return fromNativeParse(text)

  const isoMonthMatch = text.match(ISO_MONTH_PATTERN)
  if (isoMonthMatch) return createUtcDate(Number(isoMonthMatch[1]), Number(isoMonthMatch[2]) - 1, 1)

  if (ISO_YEAR_PATTERN.test(text)) return createUtcDate(Number(text), 0, 1)

  const usMatch = text.match(US_DATE_PATTERN)
  if (usMatch) return createUtcDate(Number(usMatch[3]), Number(usMatch[1]) - 1, Number(usMatch[2]))

  const euMatch = text.match(EU_DATE_PATTERN)
  if (euMatch) return createUtcDate(Number(euMatch[3]), Number(euMatch[2]) - 1, Number(euMatch[1]))

  const altMatch = text.match(ALT_DATE_PATTERN)
  if (altMatch) return createUtcDate(Number(altMatch[1]), Number(altMatch[2]) - 1, Number(altMatch[3]))

  const compactMatch = text.match(COMPACT_DATE_PATTERN)
  if (compactMatch) return parseCompactDate(compactMatch)

  return fromNativeParse(text)
}

export function isMostlyCanonicalDate(rows: Record<string, unknown>[], column: string, threshold = 0.5): boolean {
  const values = rows
    .map((row) => row[column])
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
  if (values.length === 0) return false
  const valid = values.filter((value) => parseCanonicalDate(value) !== null).length
  return valid / values.length >= threshold
}

export function periodKeyFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}
