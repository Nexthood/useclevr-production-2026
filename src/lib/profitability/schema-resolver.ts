import {
  extractCurrencyMarkers,
  parseLocaleNumber,
  profileColumn,
  scoreCategoricalShape,
  tokenizeHeader,
  verifyRowIdentity,
  verifyRowSumIdentity,
  type ColumnProfile,
} from "@/lib/data/semantic-profiling"

/**
 * Universal Profitability schema resolver (domain contract).
 *
 * Recognizes semantic concepts (not fixture headers) across differently
 * structured revenue and expense files using multiple independent signals:
 *
 *   A. normalized exact aliases
 *   B. token-aware aliases
 *   C. distinctive semantic tokens
 *   D. value-shape / type evidence (shared profiling primitives)
 *   E. arithmetic relationships (unit x quantity reconciliation)
 *   F. cross-column consistency (one physical column per concept)
 *   G. confidence scoring with fail-safe ambiguity handling
 *
 * The generic primitives (header tokenization, locale-tolerant money
 * parsing, column profiling, categorical shape scoring, row-identity
 * verification) live in src/lib/data/semantic-profiling.ts and are shared
 * with the other domain resolvers; this module owns only the financial
 * vocabulary and the Profitability constraints.
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
  | "reconciled_components"
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
    | "amount_resolved_by_line_identity"
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

export type ColumnStats = ColumnProfile

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

  // Line-identity evidence: when the amount was withheld because tied
  // candidates could not be separated by alias or shape, a proven row-level
  // line decomposition (|final| + |contra| == quantity x unit) may still
  // resolve the tie by demoting the bounded, generically-aliased member.
  resolveWithheldAmountByLineIdentity(role, rows, stats, mapping, warnings, reserved)

  for (const concept of dimensionConcepts) {
    const field = selectDimensionField(concept, stats, reserved)
    if (field) {
      mapping[concept] = field
      reserved.add(field.column)
    }
  }

  // Value-shape fallback: an unmapped category is discovered from categorical
  // behavior alone (repeated short strings, sensible cardinality, low
  // identifier and free-text likelihood) when no alias matches.
  if (!mapping.category) {
    const fallback = selectFallbackCategory(stats, reserved)
    if (fallback) {
      mapping.category = fallback
      reserved.add(fallback.column)
    }
  }

  const currency = observeCurrency(mapping, stats)

  let amountStrategy: AmountStrategy = "unresolved"
  // Fail-safe: when the amount candidates could not be separated, no
  // fallback derivation may fabricate a total — withheld stays withheld.
  const amountAmbiguityWithheld = warnings.some((warning) => warning.code === "ambiguous_amount_candidates")
  if (mapping.amount) {
    amountStrategy = resolveExplicitAmountStrategy(role, rows, mapping)
  } else if (!amountAmbiguityWithheld && (mapping.unitPrice || mapping.unitCost) && mapping.quantity) {
    amountStrategy = "derived_unit_quantity"
  } else if (!amountAmbiguityWithheld && role === "revenue" && mapping.grossAmount) {
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

/**
 * Tokens that only carry generic measure semantics; alias matches that rely
 * on them exclusively carry no role-specific competitiveness, so the owner
 * column may be demoted by stronger arithmetic evidence.
 */
const GENERIC_AMOUNT_ALIAS_TOKENS = new Set(["value"])

/**
 * True when the column's amount evidence includes a ROLE-SPECIFIC amount
 * alias (an alias group carrying at least one non-generic token that the
 * column fully token-matches). Such columns keep amount candidacy even when
 * arithmetic line-identity evidence marks them as the bounded member.
 */
function hasRoleSpecificAmountAlias(stat: ColumnStats, role: ProfitabilitySchemaRole): boolean {
  for (const alias of AMOUNT_ALIAS_GROUPS[role]) {
    if (alias.some((token) => GENERIC_AMOUNT_ALIAS_TOKENS.has(token))) continue
    if (hasAllTokens(stat.tokens, alias)) return true
  }
  return false
}

/**
 * Resolves a withheld amount when tied candidates cannot be separated by
 * alias or shape but a row-level line decomposition separates them: for the
 * pair (A, B) and the mapped quantity x unit product P,
 *   |A| + |B| == |P|   row-wise,
 * marks the bounded member as a proven contra component and the unbounded
 * member as the final amount. Demotion is conservative: a member with a
 * role-specific amount alias is never demoted, and direction-less
 * decompositions (members of comparable magnitude) stay withheld.
 */
function resolveWithheldAmountByLineIdentity(
  role: ProfitabilitySchemaRole,
  rows: Record<string, unknown>[],
  stats: ColumnStats[],
  mapping: Partial<Record<ResolverConcept, ResolverFieldMapping>>,
  warnings: ResolverWarning[],
  reserved: Set<string>,
): void {
  if (mapping.amount) return
  const quantity = mapping.quantity
  const unit = role === "revenue" ? mapping.unitPrice : mapping.unitCost
  if (!quantity || !unit) return

  const withdrawalIndex = warnings.findIndex((warning) => warning.code === "ambiguous_amount_candidates" && (warning.candidates?.length ?? 0) >= 2)
  if (withdrawalIndex === -1) return
  const candidates = warnings[withdrawalIndex].candidates as string[]
  const statsByColumn = new Map(stats.map((stat) => [stat.column, stat]))

  // A tied candidate reserved by another concept later in resolution is no
  // longer competing; a single surviving tied candidate wins outright.
  const usable = candidates.filter((column) => !reserved.has(column))
  if (usable.length === 1) {
    const sole = statsByColumn.get(usable[0])
    if (sole) {
      const scored = scoreNumericCandidate("amount", sole, role)
      if (scored.score > 0) {
        mapping.amount = {
          concept: "amount",
          column: sole.column,
          confidence: Math.min(98, scored.score),
          signals: [...scored.signals, "tied_candidate_reserved_elsewhere"],
        }
        reserved.add(sole.column)
        warnings.splice(withdrawalIndex, 1)
      }
      return
    }
  }
  if (usable.length < 2) return

  for (let i = 0; i < usable.length && !mapping.amount; i += 1) {
    for (let j = i + 1; j < usable.length && !mapping.amount; j += 1) {
      const statA = statsByColumn.get(usable[i])
      const statB = statsByColumn.get(usable[j])
      if (!statA || !statB) continue
      const identity = verifyRowSumIdentity(rows, statA.column, statB.column, {
        quantity: quantity.column,
        unit: unit.column,
      })
      if (!identity.consistent || !identity.boundedMember) continue

      const componentStat = identity.boundedMember === statA.column ? statA : statB
      const finalStat = identity.boundedMember === statA.column ? statB : statA
      // Never demote a member that claims a role-specific amount alias, and
      // never promote a final member that lacks one when the component has
      // one: only a generically-aliased bounded member may lose candidacy.
      const componentClaimed = hasRoleSpecificAmountAlias(componentStat, role)
      const finalClaimed = hasRoleSpecificAmountAlias(finalStat, role)
      if (componentClaimed || !finalClaimed) continue

      const scored = scoreNumericCandidate("amount", finalStat, role)
      if (scored.score <= 0) continue
      mapping.amount = {
        concept: "amount",
        column: finalStat.column,
        confidence: Math.min(98, scored.score),
        signals: [...scored.signals, "line_sum_identity:" + componentStat.column],
      }
      reserved.add(finalStat.column)
      reserved.add(componentStat.column)
      warnings.splice(withdrawalIndex, 1, {
        code: "amount_resolved_by_line_identity",
        message: `"${finalStat.column}" was selected as the ${role === "revenue" ? "revenue" : "expense"} amount because the row-level line identity "${finalStat.column}" + "${componentStat.column}" = "${quantity.column}" x "${unit.column}" holds on ${identity.checked} of ${rows.length} sampled rows; "${componentStat.column}" is a bounded contra component and stays excluded from amount candidacy.`,
        candidates: [finalStat.column, componentStat.column],
      })
    }
  }
}

/**
 * Chooses the authoritative amount strategy for an explicit amount column.
 * The column stays authoritative unless a monetary component (discount,
 * refund, tax) is PROVEN row-arithmetic-embedded: the identity
 *   amount - components == quantity x unit
 * must hold within tolerance on substantially all rows. Only that verified
 * reconciliation licenses subtracting the component; without it the explicit
 * column is final and components are never subtracted or added.
 */
function resolveExplicitAmountStrategy(
  role: ProfitabilitySchemaRole,
  rows: Record<string, unknown>[],
  mapping: Partial<Record<ResolverConcept, ResolverFieldMapping>>,
): AmountStrategy {
  const amount = mapping.amount
  if (!amount) return "unresolved"
  const componentColumns = role === "revenue"
    ? [mapping.discount?.column, mapping.refund?.column]
    : [mapping.tax?.column]
  const subtract = componentColumns.filter((column): column is string => Boolean(column))
  const quantity = mapping.quantity
  const unit = role === "revenue" ? mapping.unitPrice : mapping.unitCost
  if (!quantity || !unit || subtract.length === 0) return "explicit_amount"

  const identity = verifyRowIdentity(rows, {
    base: amount.column,
    subtract,
    productOf: { quantity: quantity.column, unit: unit.column },
  })
  const minChecked = Math.max(3, Math.ceil(rows.length * 0.25))
  if (identity.checked >= minChecked && identity.consistent) {
    return "reconciled_components"
  }
  return "explicit_amount"
}

/**
 * Discovers an unmapped category from value shape alone: string-dominant,
 * repeated values with sensible cardinality, short labels, low identifier
 * and free-text likelihood. Header names are ignored so unknown headers with
 * strong categorical behavior stay discoverable.
 */
function selectFallbackCategory(
  stats: ColumnStats[],
  reserved: Set<string>,
): ResolverFieldMapping | null {
  let best: { stat: ColumnStats; score: number } | null = null
  for (const stat of stats) {
    if (reserved.has(stat.column)) continue
    if (stat.numericRatio >= 0.5 || stat.dateRatio >= 0.7) continue
    const shape = scoreCategoricalShape(stat)
    if (!shape.categorical) continue
    if (shape.identifierLikelihood >= 0.5 || shape.freeTextLikelihood >= 0.5) continue
    if (!best || shape.score > best.score) best = { stat, score: shape.score }
  }
  if (!best) return null
  return {
    concept: "category",
    column: best.stat.column,
    confidence: Math.min(80, 30 + Math.round(best.score / 2)),
    signals: ["value_shape_category"],
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
          // Money-measure tokens only disqualify numeric-shaped columns; a
          // string-shaped compound header such as "cost_type" is a dimension
          // label, not a hidden money column.
          disqualified = stat.numericRatio >= 0.5
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
  return profileColumn(column, rows)
}

export function columnTokens(column: string): string[] {
  return tokenizeHeader(column)
}

function hasAllTokens(tokens: string[], alias: string[]): boolean {
  return alias.every((token) => tokens.includes(token))
}

export const parseMoneyNumber = parseLocaleNumber

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
