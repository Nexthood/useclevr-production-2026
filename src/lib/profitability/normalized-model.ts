import { parseMoneyNumber, reconcileUnitQuantity, resolveProfitabilitySchema } from "./schema-resolver"
import type { ProfitabilitySchemaResolution, ResolverWarning } from "./schema-resolver"
import { parseCanonicalDate } from "@/lib/data/canonical-date"

/**
 * Canonical normalized Profitability model.
 *
 * Every downstream Profitability calculation (totals, dimensions, trends,
 * reports, AI explanations) consumes these records. The dashboard and report
 * layers must never remap the original uploaded columns themselves.
 */

export type RevenueAmountStrategy = "explicit_amount" | "derived_unit_quantity" | "gross_minus_adjustments"

export type NormalizedRevenueRecord = {
  date: string | null
  /** Raw period label from the source row; keeps original bucket granularity. */
  periodLabel: string | null
  amount: number
  grossAmount: number | null
  discount: number | null
  refund: number | null
  quantity: number | null
  unitPrice: number | null
  product: string | null
  sku: string | null
  customer: string | null
  category: string | null
  department: string | null
  company: string | null
  costCenter: string | null
  location: string | null
  currency: string | null
  provenance: {
    amountStrategy: RevenueAmountStrategy
    amountColumn: string | null
    confidence: number
  }
}

export type NormalizedExpenseRecord = {
  date: string | null
  periodLabel: string | null
  amount: number
  quantity: number | null
  unitCost: number | null
  tax: number | null
  category: string | null
  vendor: string | null
  department: string | null
  costCenter: string | null
  company: string | null
  location: string | null
  currency: string | null
  provenance: {
    amountStrategy: "explicit_amount" | "derived_unit_quantity" | "unresolved"
    amountColumn: string | null
    confidence: number
  }
}

export type MappingDiagnostics = {
  selected: Array<{ concept: string; column: string; confidence: number }>
  unresolvedFields: string[]
  amountStrategy: string
  amountConfidence: number
  skippedRows: number
  rowCount: number
}

export type NormalizedFileResult<TRecord> = {
  records: TRecord[]
  mappingDiagnostics: MappingDiagnostics
  warnings: ResolverWarning[]
  currency: { mixed: boolean; currencies: string[]; source: "column" | "symbols" | null }
}

export function normalizeRevenueRows(
  columns: string[],
  rows: Record<string, unknown>[],
): NormalizedFileResult<NormalizedRevenueRecord> {
  return normalizeRevenueFromResolution(columns, rows, resolveProfitabilitySchema(columns, rows, "revenue"))
}

export function normalizeExpenseRows(
  columns: string[],
  rows: Record<string, unknown>[],
): NormalizedFileResult<NormalizedExpenseRecord> {
  return normalizeExpenseFromResolution(columns, rows, resolveProfitabilitySchema(columns, rows, "expenses"))
}

export function normalizeRevenueFromResolution(
  columns: string[],
  rows: Record<string, unknown>[],
  resolution: ProfitabilitySchemaResolution,
): NormalizedFileResult<NormalizedRevenueRecord> {
  const warnings = [...resolution.warnings]
  const mapping = resolution.mapping
  const amountColumn = mapping.amount?.column ?? null
  const quantityColumn = mapping.quantity?.column ?? null
  const unitPriceColumn = mapping.unitPrice?.column ?? null
  const grossColumn = mapping.grossAmount?.column ?? null
  const discountColumn = mapping.discount?.column ?? null
  const refundColumn = mapping.refund?.column ?? null

  if (quantityColumn && unitPriceColumn && amountColumn) {
    const reconciliation = reconcileUnitQuantity(
      rows,
      quantityColumn,
      unitPriceColumn,
      amountColumn,
      mapping.discount?.column ?? null,
    )
    if (reconciliation.checked > 0 && !reconciliation.consistent) {
      warnings.push({
        code: "arithmetic_mismatch",
        message: `unit price x quantity does not reconcile with "${amountColumn}" on ${Math.round(reconciliation.mismatchRatio * 100)}% of sampled rows; the explicit amount column stays authoritative and components are never added to it.`,
      })
    }
  }

  const currencyResolver = createRowCurrencyResolver(rows, resolution, amountColumn)
  const records: NormalizedRevenueRecord[] = []
  let skippedRows = 0
  let negativeDerivedRows = 0

  for (const row of rows) {
    const amount = computeRevenueAmount(row, {
      amountColumn,
      quantityColumn,
      unitPriceColumn,
      grossColumn,
      discountColumn,
      refundColumn,
      strategy: resolution.amountStrategy,
    })
    if (amount !== null && amount < 0) negativeDerivedRows += 1
    if (amount === null || amount < 0) {
      skippedRows += 1
      continue
    }

    const currency = currencyResolver(row)
    records.push({
      date: normalizeDateValue(row[mapping.period?.column ?? ""]),
      periodLabel: dimensionValue(row, mapping.period?.column),
      amount,
      grossAmount: grossColumn ? nonNegative(parseMoneyNumber(row[grossColumn])) : null,
      discount: discountColumn ? nonNegative(parseMoneyNumber(row[discountColumn])) : null,
      refund: refundColumn ? nonNegative(parseMoneyNumber(row[refundColumn])) : null,
      quantity: quantityColumn ? parseMoneyNumber(row[quantityColumn]) : null,
      unitPrice: unitPriceColumn ? parseMoneyNumber(row[unitPriceColumn]) : null,
      product: dimensionValue(row, mapping.product?.column),
      sku: dimensionValue(row, mapping.sku?.column),
      customer: dimensionValue(row, mapping.customer?.column),
      category: dimensionValue(row, mapping.category?.column),
      department: dimensionValue(row, mapping.department?.column),
      company: dimensionValue(row, mapping.company?.column),
      costCenter: null,
      location: dimensionValue(row, mapping.location?.column),
      currency,
      provenance: {
        amountStrategy: resolution.amountStrategy === "unresolved" ? "explicit_amount" : resolution.amountStrategy,
        amountColumn,
        confidence: resolution.amountConfidence,
      },
    })
  }

  if (skippedRows > 0 && rows.length > 0) {
    warnings.push({
      code: "amount_unresolved",
      message: `${skippedRows} of ${rows.length} revenue rows had no usable amount and are excluded from totals.`,
    })
  }

  // Gross-minus-adjustment derivation is authoritative only when the
  // relationship is supported: frequent negative results invalidate it, so
  // the fail-safe withholds revenue instead of presenting a wrong total.
  if (negativeDerivedRows > 0 && rows.length > 0 && negativeDerivedRows / rows.length > 0.2) {
    warnings.push({
      code: "amount_unresolved",
      message: `Gross sales minus refunds/discounts produced negative revenue on ${Math.round((negativeDerivedRows / rows.length) * 100)}% of rows; the derived revenue relationship is unsupported and totals stay withheld.`,
    })
    return {
      records: [],
      mappingDiagnostics: {
        selected: Object.values(mapping).map((field) => ({ concept: field.concept, column: field.column, confidence: field.confidence })),
        unresolvedFields: resolution.unresolvedColumns,
        amountStrategy: "unresolved",
        amountConfidence: 0,
        skippedRows: rows.length,
        rowCount: rows.length,
      },
      warnings,
      currency: resolution.currency,
    }
  }

  return {
    records,
    mappingDiagnostics: {
      selected: Object.values(mapping).map((field) => ({ concept: field.concept, column: field.column, confidence: field.confidence })),
      unresolvedFields: resolution.unresolvedColumns,
      amountStrategy: resolution.amountStrategy,
      amountConfidence: resolution.amountConfidence,
      skippedRows,
      rowCount: rows.length,
    },
    warnings,
    currency: resolution.currency,
  }
}

export function normalizeExpenseFromResolution(
  columns: string[],
  rows: Record<string, unknown>[],
  resolution: ProfitabilitySchemaResolution,
): NormalizedFileResult<NormalizedExpenseRecord> {
  const warnings = [...resolution.warnings]
  const mapping = resolution.mapping
  const amountColumn = mapping.amount?.column ?? null
  const quantityColumn = mapping.quantity?.column ?? null
  const unitCostColumn = mapping.unitCost?.column ?? null

  if (quantityColumn && unitCostColumn && amountColumn) {
    const reconciliation = reconcileUnitQuantity(rows, quantityColumn, unitCostColumn, amountColumn)
    if (reconciliation.checked > 0 && !reconciliation.consistent) {
      warnings.push({
        code: "arithmetic_mismatch",
        message: `unit cost x quantity does not reconcile with "${amountColumn}" on ${Math.round(reconciliation.mismatchRatio * 100)}% of sampled rows; the explicit amount column stays authoritative and tax or unit cost are never added to it.`,
      })
    }
  }

  const currencyResolver = createRowCurrencyResolver(rows, resolution, amountColumn)
  const records: NormalizedExpenseRecord[] = []
  let skippedRows = 0

  for (const row of rows) {
    const amount = computeExpenseAmount(row, {
      amountColumn,
      quantityColumn,
      unitCostColumn,
      strategy: resolution.amountStrategy,
    })
    if (amount === null) {
      skippedRows += 1
      continue
    }

    records.push({
      date: normalizeDateValue(row[mapping.period?.column ?? ""]),
      periodLabel: dimensionValue(row, mapping.period?.column),
      amount,
      quantity: quantityColumn ? parseMoneyNumber(row[quantityColumn]) : null,
      unitCost: unitCostColumn ? parseMoneyNumber(row[unitCostColumn]) : null,
      tax: mapping.tax ? nonNegative(parseMoneyNumber(row[mapping.tax.column])) : null,
      category: dimensionValue(row, mapping.category?.column),
      vendor: dimensionValue(row, mapping.vendor?.column),
      department: dimensionValue(row, mapping.department?.column),
      costCenter: dimensionValue(row, mapping.costCenter?.column),
      company: dimensionValue(row, mapping.company?.column),
      location: dimensionValue(row, mapping.location?.column),
      currency: currencyResolver(row),
      provenance: {
        amountStrategy: resolution.amountStrategy === "unresolved" ? "unresolved" : resolution.amountStrategy === "gross_minus_adjustments" ? "explicit_amount" : resolution.amountStrategy,
        amountColumn,
        confidence: resolution.amountConfidence,
      },
    })
  }

  if (skippedRows > 0 && rows.length > 0) {
    warnings.push({
      code: "amount_unresolved",
      message: `${skippedRows} of ${rows.length} expense rows had no usable amount and are excluded from totals.`,
    })
  }

  return {
    records,
    mappingDiagnostics: {
      selected: Object.values(mapping).map((field) => ({ concept: field.concept, column: field.column, confidence: field.confidence })),
      unresolvedFields: resolution.unresolvedColumns,
      amountStrategy: resolution.amountStrategy,
      amountConfidence: resolution.amountConfidence,
      skippedRows,
      rowCount: rows.length,
    },
    warnings,
    currency: resolution.currency,
  }
}

function computeRevenueAmount(
  row: Record<string, unknown>,
  context: {
    amountColumn: string | null
    quantityColumn: string | null
    unitPriceColumn: string | null
    grossColumn: string | null
    discountColumn: string | null
    refundColumn: string | null
    strategy: string
  },
): number | null {
  // Precedence 1: explicit final/line revenue column. Components (quantity,
  // unit price, gross, discount) are never summed with it.
  if (context.amountColumn) {
    return nonNegativeOrSkip(parseMoneyNumber(row[context.amountColumn]))
  }

  // Precedence 2: quantity x unit price when no final revenue column exists.
  if (context.strategy === "derived_unit_quantity" && context.quantityColumn && context.unitPriceColumn) {
    const quantity = parseMoneyNumber(row[context.quantityColumn])
    const unitPrice = parseMoneyNumber(row[context.unitPriceColumn])
    if (quantity === null || unitPrice === null) return null
    let derived = Math.abs(quantity) * Math.abs(unitPrice)
    if (context.discountColumn) derived -= nonNegative(parseMoneyNumber(row[context.discountColumn])) ?? 0
    if (context.refundColumn) derived -= nonNegative(parseMoneyNumber(row[context.refundColumn])) ?? 0
    return round(derived)
  }

  // Precedence 3: gross minus refunds/discounts when the schema supports it.
  if (context.strategy === "gross_minus_adjustments" && context.grossColumn) {
    const gross = nonNegative(parseMoneyNumber(row[context.grossColumn]))
    if (gross === null) return null
    let derived = gross
    if (context.discountColumn) derived -= nonNegative(parseMoneyNumber(row[context.discountColumn])) ?? 0
    if (context.refundColumn) derived -= nonNegative(parseMoneyNumber(row[context.refundColumn])) ?? 0
    return round(derived)
  }

  return null
}

function computeExpenseAmount(
  row: Record<string, unknown>,
  context: {
    amountColumn: string | null
    quantityColumn: string | null
    unitCostColumn: string | null
    strategy: string
  },
): number | null {
  // Precedence 1: explicit final expense/line-total column. Tax and unit cost
  // are recorded separately and are never added to it.
  if (context.amountColumn) {
    return nonNegativeOrSkip(parseMoneyNumber(row[context.amountColumn]))
  }

  // Precedence 2: quantity x unit cost when no total column exists. Tax is
  // NOT added: without an explicit total the schema cannot prove that tax is
  // additive rather than already included.
  if (context.strategy === "derived_unit_quantity" && context.quantityColumn && context.unitCostColumn) {
    const quantity = parseMoneyNumber(row[context.quantityColumn])
    const unitCost = parseMoneyNumber(row[context.unitCostColumn])
    if (quantity === null || unitCost === null) return null
    return round(Math.abs(quantity) * Math.abs(unitCost))
  }

  return null
}

function createRowCurrencyResolver(
  rows: Record<string, unknown>[],
  resolution: ProfitabilitySchemaResolution,
  amountColumn: string | null,
): (row: Record<string, unknown>) => string | null {
  const currencyColumn = resolution.mapping.currency?.column
  if (currencyColumn) {
    return (row) => {
      const value = row[currencyColumn]
      const text = value === null || value === undefined ? "" : String(value).trim()
      return text ? text.slice(0, 8) : null
    }
  }
  if (resolution.currency.source === "symbols" && !resolution.currency.mixed && resolution.currency.currencies.length === 1) {
    const single = resolution.currency.currencies[0]
    return () => single
  }
  if (resolution.currency.mixed && amountColumn) {
    return (row) => {
      const value = row[amountColumn]
      const text = value === null || value === undefined ? "" : String(value)
      const match = text.match(/(€|\$|£|¥|₹|USD|EUR|GBP|JPY|CHF|CAD|AUD|SEK|NOK|DKK|INR)/)
      return match ? match[1] : null
    }
  }
  return () => null
}

function dimensionValue(row: Record<string, unknown>, column: string | undefined): string | null {
  if (!column) return null
  const value = row[column]
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text.slice(0, 120) : null
}

function normalizeDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }
  const parsed = parseCanonicalDate(value)
  return parsed ? parsed.toISOString().slice(0, 10) : null
}

function nonNegativeOrSkip(value: number | null): number | null {
  if (value === null) return null
  return round(Math.abs(value))
}

function nonNegative(value: number | null): number | null {
  if (value === null) return null
  return round(Math.abs(value))
}

export type { ProfitabilitySchemaResolution, ResolverWarning }

function round(value: number): number {
  return Math.round(value * 100) / 100
}
