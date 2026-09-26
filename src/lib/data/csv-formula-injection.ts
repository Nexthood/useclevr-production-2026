/**
 * Neutralizes spreadsheet formula injection in CSV/TSV exports. Values
 * originating from user-controlled uploads must never begin a cell with a
 * formula or DDE prefix when the export is opened in Excel, LibreOffice, or
 * Google Sheets. Numbers keep their sign: `-123.45` stays untouched, while
 * `=cmd`, `+2|cmd`, and `@SUM` are prefixed with a single quote.
 */
export function neutralizeCsvFormulaInjection(value: unknown): string {
  const text = String(value ?? "")
  const first = text.charAt(0)

  if (first === "=" || first === "+" || first === "@" || first === "\t" || first === "\r") {
    return `'${text}`
  }

  if (first === "-" && !/^[\d.(]/.test(text.slice(1))) {
    return `'${text}`
  }

  return text
}
