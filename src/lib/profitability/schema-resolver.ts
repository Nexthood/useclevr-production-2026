import { parseCanonicalDate } from "@/lib/data/canonical-date"

/**
 * Universal Profitability schema resolver.
 *
 * Recognizes semantic concepts (not fixture headers) across differently
 * structured revenue and expense files using multiple independent signals:
 *
 *   A. normalized exact aliases
 *   B. token-aware aliases
 *   C. distinctive semantic tokens
 *   D. value-shape / type evidence
 *   E. arithmetic relationships (unit x quantity reconciliation)
 *   F. cross-column consistency (one physical column per concept)
 *   G. confidence scoring with fail-safe ambiguity handling
 *
 * Dangerous broad substring matching is intentionally absent: a column named
 * `revenue_category` can never become the revenue amount, `expense_date` can
 * never become the expense amount, and `cost_center` can never become a cost.
 */

export type ProfitabilitySchemaRole = "revenue" | "expenses"

export type ResolverConcept =
  | "amount"
  | "grossAmount"
  | "discount"
  | "refund"
  | "quantity"
  | "unitPrice"
  | "unitCost"
  | "tax"
  | "period"
  | "product"
  | "sku"
  | "customer"
  | "category"
  | "vendor"
  | "department"
  | "company"
  | "costCenter"
  | "location"
  | "currency"

export type AmountStrategy =
  | "explicit_amount"
  | "derived_unit_quantity"
  | "gross_minus_adjustments"
  | "unresolved"

export type ResolverFieldMapping = {
  concept: ResolverConcept
  column: string
  confidence: number
  signals: string[]
}

export type ResolverWarning = {
  code:
    | "ambiguous_amount_candidates"
    | "amount_unresolved"
    | "arithmetic_mismatch"
    | "no_currency_column"
    | "mixed_currency"
  message: string
  candidates?: string[]
}

export type ProfitabilitySchemaResolution = {
  role: ProfitabilitySchemaRole
  mapping: Partial<Record<ResolverConcept, ResolverFieldMapping>>
  unresolvedColumns: string[]
  amountStrategy: AmountStrategy
  amountConfidence: number
  warnings: ResolverWarning[]
  currency: { mixed: boolean; currencies: string[]; source: "column" | "symbols" | null }
}

export type ColumnStats = {
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
}

const AMOUNT_ALIAS_GROUPS: Record<ProfitabilitySchemaRole, string[][]> = {
  revenue: [
    ["net", "revenue"],
    ["net", "sales"],
    ["net", "amount"],
    ["net", "income"],
    ["sales", "amount"],
    ["sales", "total"],
    ["total", "revenue"],
    ["total", "sales"],
    ["total", "income"],
    ["line", "total"],
    ["line", "revenue"],
    ["line", "amount"],
    ["revenue", "ex", "vat"],
    ["revenue", "excluding", "vat"],
    ["revenue", "net"],
    ["sales", "ex", "vat"],
    ["amount", "received"],
    ["invoiced", "amount"],
    ["billed", "amount"],
    ["turnover"],
    ["revenue"],
    ["sales"],
    ["income"],
    ["amount"],
    ["net"],
    ["value"],
  ],
  expenses: [
    ["expense", "amount"],
    ["expense", "total"],
    ["total", "expense"],
    ["total", "spend"],
    ["line", "total"],
    ["line", "cost"],
    ["total", "cost"],
    ["cost", "total"],
    ["total", "price"],
    ["amount", "paid"],
    ["supplier", "cost"],
    ["purchase", "cost"],
    ["spend"],
    ["spending"],
    ["expense"],
    ["cost"],
    ["amount"],
    ["debit"],
    ["value"],
  ],
}

const GROSS_ALIAS_GROUPS = [
  ["gross", "revenue"],
  ["gross", "sales"],
  ["gross", "amount"],
  ["gross"],
]

const DISCOUNT_ALIAS_GROUPS = [
  ["discount", "amount"],
  ["discounts"],
  ["discount"],
]

const REFUND_ALIAS_GROUPS = [
  ["refund", "amount"],
  ["refunds"],
  ["refund"],
  ["returned", "amount"],
  ["returns"],
  ["credit", "note", "amount"],
  ["credit", "notes"],
]

const QUANTITY_ALIAS_GROUPS = [
  ["quantity"],
  ["qty"],
  ["units", "sold"],
  ["units"],
  ["sales", "volume"],
  ["count", "sold"],
]

const UNIT_PRICE_ALIAS_GROUPS = [
  ["unit", "price"],
  ["selling", "price"],
  ["price", "per", "unit"],
  ["unit", "rate"],
  ["price"],
]

const UNIT_COST_ALIAS_GROUPS = [
  ["unit", "cost"],
  ["cost", "per", "unit"],
  ["unit", "cost", "price"],
  ["supplier", "unit", "cost"],
]

const TAX_ALIAS_GROUPS = [
  ["tax", "amount"],
  ["vat", "amount"],
  ["sales", "tax"],
  ["tax"],
  ["vat"],
]

const PERIOD_ALIAS_GROUPS = [
  ["transaction", "date"],
  ["sale", "date"],
  ["expense", "date"],
  ["invoice", "date"],
  ["order", "date"],
  ["posted", "date"],
  ["created", "at"],
  ["date"],
  ["period"],
  ["month"],
  ["year"],
]

const DIMENSION_ALIAS_GROUPS: Partial<Record<ResolverConcept, string[][]>> = {
  period: PERIOD_ALIAS_GROUPS,
  product: [["product", "name"], ["product", "service"], ["service", "name"], ["item", "name"], ["product"], ["service"], ["item"], ["description"]],
  sku: [["product", "code"], ["item", "code"], ["product", "id"], ["sku"]],
  customer: [["customer", "name"], ["customer", "id"], ["customer", "ref"], ["client", "name"], ["account", "name"], ["customer"], ["client"], ["account"]],
  category: [["expense", "category"], ["revenue", "category"], ["expense", "type"], ["income", "type"], ["product", "category"], ["account"], ["category"], ["segment"], ["type"]],
  vendor: [["vendor", "name"], ["supplier", "name"], ["vendor"], ["supplier"], ["payee"], ["merchant"]],
  department: [["department"], ["dept"], ["division"], ["team"]],
  company: [["company", "id"], ["company", "name"], ["business", "unit"], ["company"], ["subsidiary"], ["entity"]],
  costCenter: [["cost", "center"], ["cost", "centre"], ["center"], ["centre"]],
  location: [["store", "id"], ["store"], ["location"], ["region"], ["country"], ["market"], ["territory"], ["branch"], ["city"]],
  currency: [["currency"], ["ccy"], ["curr"]],
}

/**
 * Tokens that disqualify a numeric column from being the authoritative
 * amount: dimensions, identifiers, periods, and rate-like columns.
 */
const AMOUNT_DISQUALIFIER_TOKENS = new Set([
  "category", "type", "date", "region", "channel", "center", "centre", "code", "id", "ref", "reference",
  "name", "description", "method", "status", "currency", "ccy", "count", "pct", "percent", "percentage",
  "ratio", "share", "invoice", "order", "receipt", "payment", "month", "year", "quarter", "week", "day",
])

/** Money-component tokens: a final amount never carries them unqualified. */
const AMOUNT_COMPONENT_TOKENS = new Set(["unit", "price", "tax", "vat", "discount", "refund", "return", "quantity", "qty", "units", "volume"])
/** Component tokens that still allow a final total when paired ("total cost", "line total"). */
const COMPONENT_TOTAL_TOKENS = new Set(["total", "line"])

const QUANTITY_DISQUALIFIER_TOKENS = new Set(["price", "cost", "revenue", "amount", "total", "tax", "vat", "discount", "rate", "value", "spend", "income"])

const UNIT_PRICE_DISQUALIFIER_TOKENS = new Set(["total", "line", "net", "gross", "amount", "revenue", "sales", "discount", "tax", "vat"])

const TAX_DISQUALIFIER_TOKENS = new Set(["total", "line", "amount"])

const DIMENSION_DISQUALIFIER_TOKENS = new Set(["amount", "total", "sum", "price", "cost", "tax", "vat", "quantity", "qty", "units", "discount", "refund"])

const DISTINCTIVE_CONCEPT_TOKENS: Partial<Record<ResolverConcept, Set<string>>> = {
  amount: new Set(["turnover", "spend", "spending", "receipts"]),
  quantity: new Set(["quantity", "qty", "units"]),
  unitPrice: new Set(["price"]),
  unitCost: new Set(["price"]),
  vendor: new Set(["vendor", "supplier", "payee", "merchant"]),
  sku: new Set(["sku"]),
  customer: new Set(["customer", "client"]),
  period: new Set(["date", "period"]),
}

const PERIOD_NAME_TOKENS = new Set(["year", "month", "period", "quarter"])

const CURRENCY_SYMBOL_CHARS = ["€", "$", "£", "¥", "₹"]

export function resolveProfitabilitySchema(
  columns: string[],
  rows: Record<string, unknown>[],
  role: ProfitabilitySchemaRole,
): ProfitabilitySchemaResolution {
  const warnings: ResolverWarning[] = []
  const stats = columns.map((column) => buildColumnStats(column, rows))
  const reserved = new Set<string>()
  const mapping: Partial<Record<ResolverConcept, ResolverFieldMapping>> = {}

  const numericConcepts: ResolverConcept[] = role === "revenue"
    ? ["amount", "grossAmount", "discount", "refund", "unitPrice", "quantity"]
    : ["amount", "unitCost", "tax", "quantity"]
  const dimensionConcepts: ResolverConcept[] = role === "revenue"
    ? ["period", "product", "sku", "customer", "category", "department", "company", "location", "currency"]
    : ["period", "vendor", "category", "department", "costCenter", "company", "location", "currency"]

  for (const concept of numericConcepts) {
    const field = selectNumericField(concept, stats, role, reserved, warnings)
    if (field) {
      mapping[concept] = field
      reserved.add(field.column)
    }
  }

  for (const concept of dimensionConcepts) {
    const field = selectDimensionField(concept, stats, reserved)
    if (field) {
      mapping[concept] = field
      reserved.add(field.column)
    }
  }

  const currency = observeCurrency(mapping, stats)

  let amountStrategy: AmountStrategy = "unresolved"
  if (mapping.amount) {
    amountStrategy = "explicit_amount"
  } else if ((mapping.unitPrice || mapping.unitCost) && mapping.quantity) {
    amountStrategy = "derived_unit_quantity"
  } else if (role === "revenue" && mapping.grossAmount) {
    amountStrategy = "gross_minus_adjustments"
  } else {
    const rejected = stats
      .filter((stat) => !reserved.has(stat.column) && looksLikeRejectedMoneyColumn(stat, role))
      .map((stat) => stat.column)
    warnings.push({
      code: "amount_unresolved",
      message: `No reliable ${role === "revenue" ? "revenue" : "expense"} amount column was recognized${rejected.length > 0 ? ` (rejected candidate columns: ${rejected.join(", ")})` : ""}; monetary totals stay withheld instead of guessed.`,
      candidates: rejected.length > 0 ? rejected : undefined,
    })
  }

  return {
    role,
    mapping,
    unresolvedColumns: columns.filter((column) => !reserved.has(column)),
    amountStrategy,
    amountConfidence: mapping.amount ? mapping.amount.confidence : 0,
    warnings,
    currency,
  }
}

function selectNumericField(
  concept: ResolverConcept,
  stats: ColumnStats[],
  role: ProfitabilitySchemaRole,
  reserved: Set<string>,
  warnings: ResolverWarning[],
): ResolverFieldMapping | null {
  const scored = stats
    .filter((stat) => !reserved.has(stat.column))
    .map((stat) => ({ stat, ...scoreNumericCandidate(concept, stat, role) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.stat.column.localeCompare(b.stat.column))

  if (scored.length === 0) return null
  const top = scored[0]

  if (concept === "amount" && scored.length > 1) {
    const runnerUp = scored[1]
    const scoreGap = top.score - runnerUp.score
    const sumDelta = Math.abs(top.stat.sum - runnerUp.stat.sum)
    const materialDelta = sumDelta > Math.max(0.005 * Math.max(Math.abs(top.stat.sum), Math.abs(runnerUp.stat.sum), 1), 0.01)
    if (scoreGap === 0 && materialDelta) {
      warnings.push({
        code: "ambiguous_amount_candidates",
        message: `Two columns tie as possible ${role === "revenue" ? "revenue" : "expense"} amounts ("${top.stat.column}" and "${runnerUp.stat.column}") and no signal separates them; monetary totals stay withheld.`,
        candidates: [top.stat.column, runnerUp.stat.column],
      })
      return null
    }
    if (scoreGap > 0 && scoreGap <= 5 && materialDelta) {
      warnings.push({
        code: "ambiguous_amount_candidates",
        message: `Columns "${top.stat.column}" and "${runnerUp.stat.column}" both plausibly carry the ${role === "revenue" ? "revenue" : "expense"} amount; "${top.stat.column}" was selected on evidence ${JSON.stringify(top.signals)} while "${runnerUp.stat.column}" ("${runnerUp.signals.join(", ")}") was not - verify this mapping against your data.`,
        candidates: [top.stat.column, runnerUp.stat.column],
      })
    }
  }

  return { concept, column: top.stat.column, confidence: Math.min(98, top.score), signals: top.signals }
}

function scoreNumericCandidate(
  concept: ResolverConcept,
  stat: ColumnStats,
  role: ProfitabilitySchemaRole,
): { score: number; signals: string[] } {
  if (stat.numericRatio < 0.8) return { score: 0, signals: [] }
  if (stat.presentCount === 0) return { score: 0, signals: [] }

  const signals: string[] = []
  let score = 0

  if (concept === "amount") {
    if (columnRejectedForAmount(stat, role)) return { score: 0, signals: [] }
    for (const alias of AMOUNT_ALIAS_GROUPS[role]) {
      if (stat.normalized === alias.join(" ")) {
        score = Math.max(score, 60 + alias.length * 2)
        signals.push(`exact_alias:${alias.join(" ")}`)
        break
      }
    }
    if (score === 0) {
      for (const alias of AMOUNT_ALIAS_GROUPS[role]) {
        if (hasAllTokens(stat.tokens, alias)) {
          score = Math.max(score, 40 + (alias.length === stat.tokens.length ? 8 : 0))
          signals.push(`token_alias:${alias.join(" ")}`)
          break
        }
      }
    }
    if (score === 0) {
      if (stat.tokens.some((token) => DISTINCTIVE_CONCEPT_TOKENS.amount?.has(token))) {
        score = 35
        signals.push("distinctive_token")
      }
    }
    if (score === 0) return { score: 0, signals: [] }
    score += 12
    signals.push("numeric_shape")
    if (stat.currencyMarkers.length > 0) {
      score += 4
      signals.push("currency_evidence")
    }
    return { score, signals }
  }

  if (concept === "grossAmount") {
    if (role !== "revenue") return { score: 0, signals: [] }
    for (const alias of GROSS_ALIAS_GROUPS) {
      if (stat.normalized === alias.join(" ")) {
        score = Math.max(score, 45 + alias.length)
        signals.push(`exact_alias:${alias.join(" ")}`)
        break
      }
    }
    if (score === 0) {
      for (const alias of GROSS_ALIAS_GROUPS) {
        if (hasAllTokens(stat.tokens, alias)) {
          score = Math.max(score, 38 + (alias.length === stat.tokens.length ? 8 : 0))
          signals.push(`token_alias:${alias.join(" ")}`)
          break
        }
      }
    }
    return score === 0 ? { score: 0, signals: [] } : { score: score + 12, signals: [...signals, "numeric_shape"] }
  }

  if (concept === "discount") {
    return scoreComponentCandidate(stat, DISCOUNT_ALIAS_GROUPS, new Set(["pct", "percent", "percentage", "rate"]))
  }

  if (concept === "refund") {
    return scoreComponentCandidate(stat, REFUND_ALIAS_GROUPS, new Set<string>())
  }

  if (concept === "unitPrice") {
    return scoreComponentCandidate(stat, UNIT_PRICE_ALIAS_GROUPS, UNIT_PRICE_DISQUALIFIER_TOKENS)
  }

  if (concept === "unitCost") {
    return scoreComponentCandidate(stat, UNIT_COST_ALIAS_GROUPS, UNIT_PRICE_DISQUALIFIER_TOKENS)
  }

  if (concept === "tax") {
    return scoreComponentCandidate(stat, TAX_ALIAS_GROUPS, TAX_DISQUALIFIER_TOKENS)
  }

  if (concept === "quantity") {
    for (const token of stat.tokens) {
      if (QUANTITY_DISQUALIFIER_TOKENS.has(token)) return { score: 0, signals: [] }
    }
    const scoredMatch = scoreComponentCandidate(stat, QUANTITY_ALIAS_GROUPS, new Set<string>())
    if (scoredMatch.score === 0) return scoredMatch
    if (stat.integerRatio >= 0.8) {
      scoredMatch.score += 6
      scoredMatch.signals.push("integer_dominant")
    }
    if (stat.median > 100000) return { score: 0, signals: [] }
    return scoredMatch
  }

  return { score: 0, signals: [] }
}

function scoreComponentCandidate(
  stat: ColumnStats,
  aliasGroups: string[][],
  disqualifiers: Set<string>,
): { score: number; signals: string[] } {
  for (const token of stat.tokens) {
    if (disqualifiers.has(token)) return { score: 0, signals: [] }
  }
  const signals: string[] = []
  let score = 0
  for (const alias of aliasGroups) {
    if (stat.normalized === alias.join(" ")) {
      score = Math.max(score, 40 + alias.length)
      signals.push(`exact_alias:${alias.join(" ")}`)
      break
    }
  }
  if (score === 0) {
    for (const alias of aliasGroups) {
      if (hasAllTokens(stat.tokens, alias)) {
        score = Math.max(score, 35 + (alias.length === stat.tokens.length ? 8 : 0))
        signals.push(`token_alias:${alias.join(" ")}`)
        break
      }
    }
  }
  if (score === 0) return { score: 0, signals: [] }
  score += 12
  signals.push("numeric_shape")
  return { score, signals }
}

function columnRejectedForAmount(stat: ColumnStats, role: ProfitabilitySchemaRole): boolean {
  const hasNeutralizer = hasNeutralizerIn(stat.tokens)
  for (const token of stat.tokens) {
    if (AMOUNT_DISQUALIFIER_TOKENS.has(token)) return true
  }
  for (const token of stat.tokens) {
    if (!AMOUNT_COMPONENT_TOKENS.has(token)) continue
    if (hasNeutralizer) continue
    if (role === "expenses" && (token === "cost" || COMPONENT_TOTAL_TOKENS.has(token))) continue
    if (role === "revenue" && COMPONENT_TOTAL_TOKENS.has(token)) continue
    return true
  }
  if (role === "revenue") {
    for (const token of stat.tokens) {
      if (token === "cost" || token === "cogs" || token === "expense" || token === "gross") return true
    }
  }
  return false
}

function hasNeutralizerIn(tokens: string[]): boolean {
  return tokens.includes("net") || tokens.includes("ex") || tokens.includes("excluding")
}

function looksLikeRejectedMoneyColumn(stat: ColumnStats, role: ProfitabilitySchemaRole): boolean {
  if (stat.numericRatio < 0.8) return false
  const tokens = stat.tokens
  if (role === "revenue") {
    return tokens.includes("unit") || tokens.includes("price") || tokens.includes("discount") || tokens.includes("tax") || tokens.includes("vat")
  }
  return tokens.includes("unit") || tokens.includes("tax") || tokens.includes("vat")
}

function selectDimensionField(
  concept: ResolverConcept,
  stats: ColumnStats[],
  reserved: Set<string>,
): ResolverFieldMapping | null {
  const aliasGroups = DIMENSION_ALIAS_GROUPS[concept]
  if (!aliasGroups) return null

  let best: { stat: ColumnStats; score: number; signals: string[] } | null = null

  for (const stat of stats) {
    if (reserved.has(stat.column)) continue
    const signals: string[] = []
    let score = 0

    // An exact alias match bypasses modifier disqualification: "cost_center"
    // contains the "cost" token but is precisely a cost-center dimension.
    let exactAliasMatch = false
    for (const alias of aliasGroups) {
      if (stat.normalized === alias.join(" ")) {
        score = Math.max(score, 55 + alias.length)
        signals.push(`exact_alias:${alias.join(" ")}`)
        exactAliasMatch = true
        break
      }
    }
    if (!exactAliasMatch) {
      for (const alias of aliasGroups) {
        if (hasAllTokens(stat.tokens, alias)) {
          score = Math.max(score, 38 + (alias.length === stat.tokens.length ? 8 : 0))
          signals.push(`token_alias:${alias.join(" ")}`)
          break
        }
      }
      if (score === 0) {
        const distinctive = DISTINCTIVE_CONCEPT_TOKENS[concept]
        if (distinctive && stat.tokens.some((token) => distinctive.has(token))) {
          score = 34
          signals.push("distinctive_token")
        }
      }
      if (score === 0) continue
    }

    if (concept === "currency") {
      if (stat.currencyMarkers.length === 0 && stat.numericRatio > 0.5) continue
      score += 10
    } else if (concept === "period") {
      const isNamedPeriodColumn = stat.tokens.some((token) => PERIOD_NAME_TOKENS.has(token)) && stat.numericRatio >= 0.9
      if (stat.dateRatio < 0.7 && !isNamedPeriodColumn) continue
      score += stat.dateRatio >= 0.7 ? 12 : 6
      signals.push(stat.dateRatio >= 0.7 ? "date_shape" : "named_period_shape")
    } else {
      let disqualified = false
      for (const token of stat.tokens) {
        if (DIMENSION_DISQUALIFIER_TOKENS.has(token)) {
          disqualified = true
          break
        }
      }
      if (disqualified && !exactAliasMatch) continue
      if (stat.stringRatio >= 0.5 && stat.numericRatio < 0.5) {
        score += 8
        signals.push("dimension_shape")
      } else if ((concept === "sku" || concept === "company") && stat.numericRatio < 0.8) {
        score += 4
        signals.push("identifier_shape")
      } else {
        continue
      }
    }

    if (!best || score > best.score) best = { stat, score: Math.min(98, score), signals }
  }

  if (!best) return null
  return { concept, column: best.stat.column, confidence: best.score, signals: best.signals }
}

function observeCurrency(
  mapping: Partial<Record<ResolverConcept, ResolverFieldMapping>>,
  stats: ColumnStats[],
): { mixed: boolean; currencies: string[]; source: "column" | "symbols" | null } {
  const currencyColumn = mapping.currency
  if (currencyColumn) {
    const stat = stats.find((entry) => entry.column === currencyColumn.column)
    const currencies = Array.from(new Set(stat?.currencyMarkers || [])).sort()
    return { mixed: currencies.length > 1, currencies, source: currencies.length > 0 ? "column" : null }
  }
  const amountColumn = mapping.amount?.column
  const stat = stats.find((entry) => entry.column === amountColumn)
  const currencies = Array.from(new Set(stat?.currencyMarkers || [])).sort()
  return { mixed: currencies.length > 1, currencies, source: currencies.length > 0 ? "symbols" : null }
}

export function buildColumnStats(column: string, rows: Record<string, unknown>[]): ColumnStats {
  const tokens = columnTokens(column)
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
    const parsed = parseMoneyNumber(text)
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
  }
}

export function columnTokens(column: string): string[] {
  return column
    .toLowerCase()
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function hasAllTokens(tokens: string[], alias: string[]): boolean {
  return alias.every((token) => tokens.includes(token))
}

/**
 * Locale-tolerant money parsing: understands US "1,234.56", European
 * "1.234,56", accounting negatives "(1,234.56)", and currency markers.
 * Date-shaped strings ("2026-01-02", "01/15/2026") are never money, and
 * identifier/period strings with interior separators stay non-numeric.
 */
export function parseMoneyNumber(value: unknown): number | null {
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

function extractCurrencyMarkers(text: string): string[] {
  const markers: string[] = []
  for (const symbol of CURRENCY_SYMBOL_CHARS) {
    if (text.includes(symbol)) markers.push(symbol)
  }
  for (const match of text.matchAll(/\b(USD|EUR|GBP|JPY|CHF|CAD|AUD|SEK|NOK|DKK|INR)\b/g)) {
    markers.push(match[1])
  }
  return markers
}

/**
 * Checks that quantity x unit reconciles with an amount column (or is at
 * least internally coherent when no amount column exists yet).
 */
export function reconcileUnitQuantity(
  rows: Record<string, unknown>[],
  quantityColumn: string,
  unitColumn: string,
  amountColumn: string | null,
  discountColumn: string | null = null,
): { consistent: boolean; mismatchRatio: number; checked: number } {
  let checked = 0
  let mismatched = 0
  for (const row of rows) {
    const quantity = parseMoneyNumber(row[quantityColumn])
    const unit = parseMoneyNumber(row[unitColumn])
    if (quantity === null || unit === null) continue
    const product = Math.abs(quantity * unit)
    const discount = discountColumn ? Math.abs(parseMoneyNumber(row[discountColumn]) ?? 0) : 0
    const candidates = discount > 0 ? [product, Math.abs(product - discount)] : [product]
    if (candidates.every((base) => base === 0)) continue
    checked += 1
    if (amountColumn) {
      const amount = Math.abs(parseMoneyNumber(row[amountColumn]) ?? 0)
      const bestDeviation = Math.min(...candidates.map((base) => Math.abs(amount - base) / Math.max(amount, base, 1)))
      if (bestDeviation > 0.02) mismatched += 1
    }
  }
  if (checked === 0) return { consistent: false, mismatchRatio: 1, checked: 0 }
  return { consistent: mismatched / checked <= 0.1, mismatchRatio: mismatched / checked, checked }
}
