/**
 * Shared file-to-rows parsing for the Profitability upload stage.
 *
 * Client-safe (no Node APIs). The Profitability upload must parse exactly once
 * with one authoritative reader so the resolver, normalized model, persistence
 * payload, and dashboard never see different row shapes.
 *
 * CSV cells stay strings; Excel cells keep their raw numbers and become ISO
 * date strings through `serializeCellValue`. Semantic typing (money, dates,
 * dimensions) happens in the universal schema resolver, not here.
 */

export type ParsedTabularFile = {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

/** RFC4180-compliant delimited-text parser without third-party dependencies. */
export function parseDelimitedText(text: string, delimiter?: string): { columns: string[]; rows: Record<string, unknown>[] } {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
  const resolvedDelimiter = delimiter || detectDelimiter(firstLine)
  const records = tokenizeRecords(text, resolvedDelimiter)
  if (records.length === 0) return { columns: [], rows: [] }

  const columns = records[0].map((value, index) => {
    const header = value.trim().replace(/^"+|"+$/g, "").trim()
    return header || `column_${index + 1}`
  })

  const rows: Record<string, unknown>[] = []
  for (let rowIndex = 1; rowIndex < records.length; rowIndex += 1) {
    const record = records[rowIndex]
    if (record.length === 1 && record[0].trim() === "") continue
    const row: Record<string, unknown> = {}
    columns.forEach((column, index) => {
      const cell = record[index] ?? ""
      row[column] = unescapeQuoted(cell.trim())
    })
    rows.push(row)
  }
  return { columns, rows }
}

function tokenizeRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let current: string[] = []
  let field = ""
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      current.push(field)
      field = ""
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index += 1
      current.push(field)
      field = ""
      if (current.length > 1 || (current.length === 1 && current[0].trim() !== "")) {
        records.push(current)
      }
      current = []
    } else {
      field += char
    }
  }
  current.push(field)
  if (current.length > 1 || (current.length === 1 && current[0].trim() !== "")) {
    records.push(current)
  }
  return records
}

function unescapeQuoted(value: string): string {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1).replace(/""/g, '"')
  }
  return value
}

function countUnquoted(line: string, delimiter: string): number {
  let count = 0
  let inQuotes = false
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes
    else if (char === delimiter && !inQuotes) count += 1
  }
  return count
}

export function detectDelimiter(sampleLine: string): string {
  const counts: Array<{ delimiter: string; count: number }> = [
    { delimiter: ",", count: countUnquoted(sampleLine, ",") },
    { delimiter: ";", count: countUnquoted(sampleLine, ";") },
    { delimiter: "\t", count: countUnquoted(sampleLine, "\t") },
    { delimiter: "|", count: countUnquoted(sampleLine, "|") },
  ]
  return counts.sort((a, b) => b.count - a.count)[0]?.delimiter ?? ","
}

type WorkbookLike = {
  read: (data: ArrayBuffer | Buffer, options?: Record<string, unknown>) => {
    SheetNames: string[]
    Sheets: Record<string, unknown>
  }
  utils: {
    sheet_to_json: (sheet: unknown, options?: Record<string, unknown>) => unknown[][]
  }
}

let cachedXlsxModule: WorkbookLike | null = null

async function loadXlsx(): Promise<WorkbookLike | null> {
  if (cachedXlsxModule) return cachedXlsxModule
  try {
    const mod = (await import("xlsx")) as unknown as { default?: WorkbookLike } & WorkbookLike
    cachedXlsxModule = (mod.default ?? mod) as WorkbookLike
    return cachedXlsxModule
  } catch {
    return null
  }
}

/**
 * Parses CSV and Excel files into rows with one deterministic reader:
 * Excel dates stay Date objects (`cellDates`), numbers stay numbers, zero
 * values are preserved, and the first sheet is the data sheet.
 */
export async function parseTabularFile(file: File): Promise<ParsedTabularFile> {
  const name = file.name.toLowerCase()
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await loadXlsx()
    if (!XLSX) throw new Error("EXCEL_SUPPORT_UNAVAILABLE")
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "arraybuffer", cellDates: true })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as unknown[][]
    if (grid.length === 0) return { columns: [], rows: [], rowCount: 0 }
    const columns: string[] = (grid[0] || []).map((value, index) => {
      const header = value === null || value === undefined ? "" : String(value).trim()
      return header || `column_${index + 1}`
    })
    const rows: Record<string, unknown>[] = []
    for (const row of grid.slice(1)) {
      if (!row || row.every((cell) => cell === null || cell === undefined || cell === "")) continue
      const record: Record<string, unknown> = {}
      columns.forEach((column, index) => {
        record[column] = row[index] ?? ""
      })
      rows.push(record)
    }
    return { columns, rows, rowCount: rows.length }
  }

  const text = await file.text()
  const parsed = parseDelimitedText(text, ",")
  return { columns: parsed.columns, rows: parsed.rows, rowCount: parsed.rows.length }
}

/**
 * Serializes a row cell for CSV transport. Excel Date objects are written as
 * ISO dates so persisted datasets keep timezone-stable periods.
 */
export function serializeCellValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ""
    const iso = value.toISOString()
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso
  }
  return String(value)
}

/** Escapes a row value as a CSV cell, preserving dates as ISO strings. */
export function escapeCsvCell(value: unknown): string {
  const text = serializeCellValue(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
