import { parseCanonicalDate } from "@/lib/data/canonical-date"

/** String label extraction shared by the Profitability aggregation layer. */
export function labelValue(value: unknown): string {
  const label = String(value ?? "").trim()
  return label ? label.slice(0, 80) : ""
}

/** Canonical YYYY-MM key for monthly aggregation; empty when not date-like. */
export function monthKey(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ""
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`
  }
  const text = String(value ?? "").trim()
  const yyyyMm = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/)
  if (yyyyMm) return `${yyyyMm[1]}-${yyyyMm[2].padStart(2, "0")}`
  const parsed = parseCanonicalDate(text)
  if (!parsed) return ""
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`
}
