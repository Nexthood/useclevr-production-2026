/**
 * Universal Profitability schema resolver + end-to-end parity test.
 *
 * Golden expectations are derived independently from raw fixture cells — never
 * hardcoded into production resolver logic. The matrix covers genuinely
 * different customer schemas (A-L), the permanent golden fixture 04 pin, and
 * full pipeline parity: raw file -> parser -> resolver -> normalized records ->
 * serialization -> persistence representation -> report input -> dashboard model.
 */
import * as fs from "fs"
import * as XLSX from "xlsx"
import { resolveProfitabilitySchema, parseMoneyNumber } from "../../src/lib/profitability/schema-resolver"
import { normalizeRevenueRows, normalizeExpenseRows } from "../../src/lib/profitability/normalized-model"
import { calculateProfitabilityAnalysis, type ProfitabilitySourceFile } from "../../src/lib/profitability/two-file-analysis"
import { parseDelimitedText, escapeCsvCell, parseTabularFile } from "../../src/lib/profitability/file-parsing"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function nearlyEqual(actual: number | null | undefined, expected: number, message: string) {
  assert(actual !== null && actual !== undefined, `${message}: expected ${expected}, received null`)
  assert(Math.abs((actual as number) - expected) < 0.011, `${message}: expected ${expected}, received ${actual}`)
}

function readWorkbookFixture(filePath: string) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer", cellDates: true })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as unknown[][]
  const columns = (grid[0] || []).map(String)
  const rows = grid.slice(1).map((row) => {
    const record: Record<string, unknown> = {}
    columns.forEach((column, index) => {
      record[column] = row[index] ?? null
    })
    return record
  })
  return { columns, rows, rowCount: rows.length }
}

/** Independently computed expectation: SUM of one numeric source column. */
function expectedSum(columns: string[], rows: Record<string, unknown>[], column: string) {
  const index = columns.indexOf(column)
  assert(index >= 0, `Expected column ${column} in fixture`)
  return Math.round(rows.reduce((total, row) => total + Math.abs(parseMoneyNumber(row[column]) ?? 0), 0) * 100) / 100
}

function toCsv(columns: string[], rows: Record<string, unknown>[]) {
  return [
    columns.map(escapeCsvCell).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(",")),
  ].join("\n")
}

function file(
  role: "revenue" | "expenses",
  name: string,
  columns: string[],
  rows: Record<string, unknown>[],
): ProfitabilitySourceFile {
  return { role, name, columns, rows, rowCount: rows.length }
}

/** Restates rows under different (renamed) headers while keeping values. */
function restate(row: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [from, to] of Object.entries(mapping)) out[to] = row[from]
  return out
}

function runPair(
  revenueColumns: string[],
  revenueRows: Record<string, unknown>[],
  expenseColumns: string[],
  expenseRows: Record<string, unknown>[],
) {
  return calculateProfitabilityAnalysis({
    analysisId: "pa_universal",
    revenueFile: file("revenue", "revenue.csv", revenueColumns, revenueRows),
    expensesFile: file("expenses", "expenses.csv", expenseColumns, expenseRows),
  })
}

type FixturePair = {
  id: string
  revenueColumns: string[]
  revenueRows: Record<string, unknown>[]
  expenseColumns: string[]
  expenseRows: Record<string, unknown>[]
  expectedRevenue: number
  expectedExpenses: number
  expectWarning?: string
}

const fixtures: FixturePair[] = []

// A — explicit net_revenue / expense_amount with adversarial sibling columns
{
  const revenueColumns = ["date", "region", "product", "category", "revenue", "net_revenue", "quantity", "unit_price"]
  const revenueRows: Record<string, unknown>[] = []
  for (let i = 0; i < 40; i += 1) {
    const quantity = 5 + (i % 7)
    const unitPrice = 10 + i
    revenueRows.push({
      date: `2026-0${(i % 6) + 1}-1${i % 9}`,
      region: ["North", "South"][i % 2],
      product: `Plan ${i % 4}`,
      category: `Cat ${i % 3}`,
      revenue: 999999,
      net_revenue: quantity * unitPrice - (i % 3),
      quantity,
      unit_price: unitPrice,
    })
  }
  const expenseColumns = ["expense_date", "vendor", "expense_category", "unit_cost", "tax_amount", "expense_amount", "cost_center"]
  const expenseRows: Record<string, unknown>[] = []
  for (let i = 0; i < 25; i += 1) {
    const unitCost = 21 + i
    const quantity = 3 + (i % 5)
    expenseRows.push({
      expense_date: `2026-0${(i % 6) + 1}-05`,
      vendor: `Vendor ${i % 4}`,
      expense_category: ["Software", "Rent", "Travel"][i % 3],
      unit_cost: unitCost,
      tax_amount: 13.5,
      expense_amount: quantity * unitCost + 2.25,
      cost_center: `CC-${i % 3}`,
    })
  }
  fixtures.push({
    id: "A_explicit_totals",
    revenueColumns,
    revenueRows,
    expenseColumns,
    expenseRows,
    expectedRevenue: expectedSum(revenueColumns, revenueRows, "net_revenue"),
    expectedExpenses: expectedSum(expenseColumns, expenseRows, "expense_amount"),
  })
}

// B — quantity x unit price and quantity x unit cost with NO total columns
{
  const revenueColumns = ["period", "department", "units_sold", "unit_price"]
  const revenueRows: Record<string, unknown>[] = []
  let bRevenue = 0
  for (let i = 0; i < 30; i += 1) {
    const quantity = 2 + (i % 6)
    const unitPrice = 15 + (i % 11)
    revenueRows.push({ period: `2026-0${(i % 5) + 1}`, department: `Dept ${i % 3}`, units_sold: quantity, unit_price: unitPrice })
    bRevenue += quantity * unitPrice
  }
  const expenseColumns = ["month", "cost_center", "quantity", "unit_cost"]
  const expenseRows: Record<string, unknown>[] = []
  let bExpenses = 0
  for (let i = 0; i < 20; i += 1) {
    const quantity = 1 + (i % 4)
    const unitCost = 9 + i
    expenseRows.push({ month: `2026-0${(i % 5) + 1}`, cost_center: `CC-${i % 2}`, quantity, unit_cost: unitCost })
    bExpenses += quantity * unitCost
  }
  fixtures.push({
    id: "B_derived_amounts",
    revenueColumns,
    revenueRows,
    expenseColumns,
    expenseRows,
    expectedRevenue: Math.round(bRevenue * 100) / 100,
    expectedExpenses: Math.round(bExpenses * 100) / 100,
  })
}

// C — gross sales + discounts/refunds, no net column
{
  const revenueColumns = ["transaction_date", "gross_sales", "discount", "refunds"]
  const revenueRows: Record<string, unknown>[] = []
  let cRevenue = 0
  for (let i = 0; i < 20; i += 1) {
    const gross = 500 + i * 17
    const discount = 10 + (i % 13)
    const refund = i % 4 === 0 ? 25 : 0
    revenueRows.push({ transaction_date: `2026-0${(i % 6) + 1}-12`, gross_sales: gross, discount, refunds: refund })
    cRevenue += gross - discount - refund
  }
  fixtures.push({
    id: "C_gross_minus_adjustments",
    revenueColumns,
    revenueRows,
    expenseColumns: ["expense_date", "category", "expense_amount"],
    expenseRows: [1, 2, 3].map((i) => ({ expense_date: "2026-03-01", category: `C${i}`, expense_amount: 100 * i })),
    expectedRevenue: Math.round(cRevenue * 100) / 100,
    expectedExpenses: 600,
  })
}

// D — line_total / total_cost style
{
  const revenueColumns = ["Date", "Product", "Line Total"]
  const revenueRows = [
    { Date: "2026-01-05", Product: "Widget", "Line Total": 1250.4 },
    { Date: "2026-02-05", Product: "Gadget", "Line Total": 540.6 },
    { Date: "2026-03-05", Product: "Widget", "Line Total": 300 },
  ]
  const expenseColumns = ["Date", "Vendor", "Total Cost"]
  const expenseRows = [
    { Date: "2026-01-05", Vendor: "Acme", "Total Cost": 410.1 },
    { Date: "2026-02-05", Vendor: "Globex", "Total Cost": 220.9 },
  ]
  fixtures.push({
    id: "D_line_total_style",
    revenueColumns,
    revenueRows,
    expenseColumns,
    expenseRows,
    expectedRevenue: 2091,
    expectedExpenses: 631,
  })
}

// E — misleading columns must never steal monetary roles
{
  const revenueColumns = ["month", "revenue_category", "revenue_month", "sales_region", "revenue"]
  const revenueRows = [
    { month: "2026-01", revenue_category: "Hw", revenue_month: "Bogus", sales_region: "EU", revenue: 1200 },
    { month: "2026-02", revenue_category: "Sw", revenue_month: "Bogus", sales_region: "EU", revenue: 1300 },
  ]
  const expenseColumns = ["expense_date", "cost_center", "expense_category", "spend"]
  const expenseRows = [
    { expense_date: "2026-01-02", cost_center: "CC-1", expense_category: "Rent", spend: 400 },
    { expense_date: "2026-02-02", cost_center: "CC-2", expense_category: "Payroll", spend: 900 },
  ]
  fixtures.push({
    id: "E_misleading_columns",
    revenueColumns,
    revenueRows,
    expenseColumns,
    expenseRows,
    expectedRevenue: 2500,
    expectedExpenses: 1300,
  })
}

// F — different capitalization/spaces
{
  const revenueColumns = ["Net Sales", "Units Sold", "Sale Date", "Product Name"]
  const revenueRows = [
    { "Net Sales": 800.5, "Units Sold": 10, "Sale Date": "2026-01-01", "Product Name": "A" },
    { "Net Sales": 900.5, "Units Sold": 11, "Sale Date": "2026-02-01", "Product Name": "B" },
  ]
  const expenseColumns = ["Expense Amount", "Unit Cost", "Units", "Expense Category"]
  const expenseRows = [
    { "Expense Amount": 300.25, "Unit Cost": 3, Units: 100, "Expense Category": "Software" },
    { "Expense Amount": 400.75, "Unit Cost": 4, Units: 100, "Expense Category": "Rent" },
  ]
  fixtures.push({
    id: "F_capitalization_spaces",
    revenueColumns,
    revenueRows,
    expenseColumns,
    expenseRows,
    expectedRevenue: 1701,
    expectedExpenses: 701,
  })
}

// G — reordered columns
{
  const revenueColumns = ["unit_price", "quantity", "net_revenue", "sale_date"]
  const revenueRows = [
    { sale_date: "2026-01-15", net_revenue: 500.5, quantity: 5, unit_price: 100.1 },
  ]
  const expenseColumns = ["amount", "expense_category", "vendor"]
  const expenseRows = [
    { vendor: "V", expense_category: "COGS", amount: 210.75 },
  ]
  fixtures.push({
    id: "G_reordered_columns",
    revenueColumns,
    revenueRows,
    expenseColumns,
    expenseRows,
    expectedRevenue: 500.5,
    expectedExpenses: 210.75,
  })
}

// H — extra irrelevant numeric columns
{
  const revenueColumns = ["date", "net_revenue", "discount_pct", "footfall", "conversion_rate", "star_rating"]
  const revenueRows = [
    { date: "2026-01-01", net_revenue: 1500, discount_pct: 5, footfall: 200, conversion_rate: 3.2, star_rating: 4 },
    { date: "2026-02-01", net_revenue: 1500, discount_pct: 7, footfall: 180, conversion_rate: 2.9, star_rating: 5 },
  ]
  const expenseColumns = ["date", "expense_amount", "tax_rate", "headcount", "office_sqm"]
  const expenseRows = [
    { date: "2026-01-01", expense_amount: 600, tax_rate: 19, headcount: 12, office_sqm: 340 },
  ]
  fixtures.push({
    id: "H_extra_numeric_columns",
    revenueColumns,
    revenueRows,
    expenseColumns,
    expenseRows,
    expectedRevenue: 3000,
    expectedExpenses: 600,
  })
}

// I — missing optional dimensions (period-less, category-less)
{
  const revenueColumns = ["amount"]
  const revenueRows = [{ amount: 700 }, { amount: 300 }]
  const expenseColumns = ["value"]
  const expenseRows = [{ value: 250 }]
  fixtures.push({
    id: "I_missing_dimensions",
    revenueColumns,
    revenueRows,
    expenseColumns,
    expenseRows,
    expectedRevenue: 1000,
    expectedExpenses: 250,
  })
}

// J — ambiguous financial columns must fail safe, not guess
{
  const revenueColumns = ["period", "amount", "value"]
  const revenueRows = [
    { period: "2026-01", amount: 400, value: 390 },
    { period: "2026-02", amount: 400, value: 610 },
  ]
  const expenseColumns = ["period", "category", "total_cost", "gross_cost"]
  const expenseRows = [
    { period: "2026-01", category: "Rent", total_cost: 120, gross_cost: 120 },
    { period: "2026-02", category: "Rent", total_cost: 130, gross_cost: 131 },
  ]
  fixtures.push({
    id: "J_ambiguous_amounts",
    revenueColumns,
    revenueRows,
    expenseColumns,
    expenseRows,
    expectedRevenue: 0, // asserted below as withheld (null), numeric sentinel unused
    expectedExpenses: 0,
    expectWarning: "ambiguous",
  })
}

// L — mixed currency must not silently aggregate
{
  const revenueColumns = ["date", "amount", "currency"]
  const revenueRows = [
    { date: "2026-01-01", amount: 500, currency: "EUR" },
    { date: "2026-01-01", amount: 500, currency: "USD" },
  ]
  fixtures.push({
    id: "L_mixed_currency",
    revenueColumns,
    revenueRows,
    expenseColumns: ["date", "expense_amount", "currency"],
    expenseRows: [{ date: "2026-01-01", expense_amount: 100, currency: "EUR" }],
    expectedRevenue: 0,
    expectedExpenses: 0,
    expectWarning: "currency",
  })
}

async function main() {
  for (const fixture of fixtures) {
    const analysis = runPair(fixture.revenueColumns, fixture.revenueRows, fixture.expenseColumns, fixture.expenseRows)

    if (fixture.id === "J_ambiguous_amounts") {
      assert(analysis.status === "failed", `J: ambiguous candidates must fail safe (got status ${analysis.status})`)
      assert(analysis.totalRevenue === null, "J: ambiguous revenue must stay withheld")
      assert(analysis.dataQualityNotes.some((note) => note.includes("tie") || note.includes("withheld")), "J: ambiguity warning must be reported")
      assert(analysis.schemaDiagnostics?.revenue.warnings.some((warning) => warning.includes("tie")), "J: resolver diagnostics must expose the ambiguity")
      console.log(`Fixture ${fixture.id}: FAILSAFE withheld with warning ✓`)
      continue
    }

    if (fixture.id === "L_mixed_currency") {
      assert(analysis.currencyObservation?.mixed === true, "L: mixed currency must be detected")
      assert(analysis.totalRevenue === null && analysis.totalExpenses === null, "L: combined totals must be withheld for mixed currencies")
      assert(analysis.dataQualityNotes.some((note) => note.includes("Mixed currencies")), "L: mixed-currency warning must be present")
      console.log(`Fixture ${fixture.id}: MIXED CURRENCY withheld ✓`)
      continue
    }

    if (fixture.id === "B_derived_amounts") {
      assert(analysis.schemaDiagnostics?.revenue.amountStrategy === "derived_unit_quantity", "B: revenue must derive from unit price x quantity")
      assert(analysis.schemaDiagnostics?.expenses.amountStrategy === "derived_unit_quantity", "B: expenses must derive from unit cost x quantity")
      assert((analysis.metricSources.revenue?.note || "").includes("Revenue derived from unit price and quantity"), "B: revenue provenance must name the derivation")
      assert((analysis.metricSources.operatingExpenses?.note || "").includes("derived from unit cost and quantity"), "B: expense provenance must name the derivation and tax exclusion")
    }

    if (fixture.id === "C_gross_minus_adjustments") {
      assert(analysis.schemaDiagnostics?.revenue.amountStrategy === "gross_minus_adjustments", "C: revenue must derive from gross minus adjustments")
      assert((analysis.metricSources.revenue?.note || "").includes("gross sales minus refunds and discounts"), "C: revenue provenance must name the gross derivation")
    }

    if (fixture.id === "E_misleading_columns") {
      assert(analysis.schemaDiagnostics?.revenue.selected.some((field) => field.column === "revenue" && field.concept === "amount"), "E: amount must select 'revenue', never 'revenue_category'/'revenue_month'")
      assert(!analysis.schemaDiagnostics?.revenue.selected.some((field) => field.column === "revenue_category" && field.concept === "amount"), "E: revenue_category must never become the amount")
      const expenseResolution = resolveProfitabilitySchema(fixture.expenseColumns, fixture.expenseRows, "expenses")
      assert(expenseResolution.mapping.amount?.column === "spend", "E: expense amount must select 'spend', never 'expense_date' or 'cost_center'")
      assert(expenseResolution.mapping.category?.column === "expense_category" || expenseResolution.mapping.category?.column === "cost_center", "E: expense category must be a dimension")
      assert(expenseResolution.mapping.costCenter?.column === "cost_center", "E: cost_center must resolve as a cost center dimension")
    }

    nearlyEqual(analysis.totalRevenue, fixture.expectedRevenue, `${fixture.id} revenue`)
    nearlyEqual(analysis.totalExpenses, fixture.expectedExpenses, `${fixture.id} expenses`)
    nearlyEqual(analysis.netProfit, Math.round((fixture.expectedRevenue - fixture.expectedExpenses) * 100) / 100, `${fixture.id} net profit`)
    const expectedMargin = fixture.expectedRevenue > 0
      ? Math.round(((fixture.expectedRevenue - fixture.expectedExpenses) / fixture.expectedRevenue) * 10000) / 100
      : null
    if (expectedMargin !== null) nearlyEqual(analysis.netMargin, expectedMargin, `${fixture.id} margin`)
    assert(analysis.status === "ready", `${fixture.id}: status must be ready (got ${analysis.status}) for ${JSON.stringify(analysis.missingColumns)}`)
    console.log(`Fixture ${fixture.id}: revenue ${analysis.totalRevenue} / expenses ${analysis.totalExpenses} / profit ${analysis.netProfit} / margin ${analysis.netMargin} ✓`)
  }

  // K — CSV and XLSX versions produce identical results (fixture 04 CSV export)
  {
    const workbookRevenue = readWorkbookFixture("test-fixtures/business-models/04_profitability_revenue_test.xlsx")
    const workbookExpenses = readWorkbookFixture("test-fixtures/business-models/04_profitability_expenses_test.xlsx")

    const csvRevenue = parseDelimitedText(toCsv(workbookRevenue.columns, workbookRevenue.rows), ",")
    const csvExpenses = parseDelimitedText(toCsv(workbookExpenses.columns, workbookExpenses.rows), ",")

    const xlsxAnalysis = runPair(workbookRevenue.columns, workbookRevenue.rows, workbookExpenses.columns, workbookExpenses.rows)
    const csvAnalysis = runPair(csvRevenue.columns, csvRevenue.rows, csvExpenses.columns, csvExpenses.rows)

    nearlyEqual(xlsxAnalysis.totalRevenue, 86312, "Fixture 04 XLSX revenue")
    nearlyEqual(xlsxAnalysis.totalExpenses, 34633.2, "Fixture 04 XLSX expenses")
    nearlyEqual(xlsxAnalysis.netProfit, 51678.8, "Fixture 04 XLSX net profit")
    nearlyEqual(xlsxAnalysis.netMargin, 59.87, "Fixture 04 XLSX net margin")
    nearlyEqual(csvAnalysis.totalRevenue, 86312, "Fixture 04 CSV revenue")
    nearlyEqual(csvAnalysis.totalExpenses, 34633.2, "Fixture 04 CSV expenses")
    nearlyEqual(csvAnalysis.netProfit, 51678.8, "Fixture 04 CSV net profit")
    nearlyEqual(csvAnalysis.netMargin, 59.87, "Fixture 04 CSV net margin")
    assert(xlsxAnalysis.status === "ready" && csvAnalysis.status === "ready", "Fixture 04 must be ready in CSV and XLSX")

    // Explicit component precedence: net_revenue/expense_amount stay authoritative
    assert(xlsxAnalysis.schemaDiagnostics?.revenue.selected.some((field) => field.column === "net_revenue" && field.concept === "amount"), "Fixture 04 revenue must map net_revenue")
    assert(xlsxAnalysis.schemaDiagnostics?.expenses.selected.some((field) => field.column === "expense_amount" && field.concept === "amount"), "Fixture 04 expenses must map expense_amount")
    console.log("Fixture 04 (XLSX + CSV): revenue 86312 / expenses 34633.2 / profit 51678.8 / margin 59.87% ✓")
  }

  // Ambiguous resolver fail-safety against dangerous substring matches
  {
    const bait = ["revenue_category", "expense_date", "cost_center", "sales_region"]
    const revenueResolution = resolveProfitabilitySchema([...bait, "line_total"], [{ revenue_category: "X", expense_date: "2026-01-01", cost_center: "C", sales_region: "EU", line_total: 4242 }], "revenue")
    assert(revenueResolution.mapping.amount?.column === "line_total", "Substring bait must never become the revenue amount")
    const expenseResolution = resolveProfitabilitySchema(["amount"], [{ amount: "1.234,56" }, { amount: "2.000,00" }], "expenses")
    const normalized = normalizeExpenseRows(["amount"], [{ amount: "1.234,56" }, { amount: "2.000,00" }])
    nearlyEqual(normalized.records.reduce((total, record) => total + record.amount, 0), 3234.56, "European decimal amounts must parse deterministically")
    assert(expenseResolution.mapping.amount?.column === "amount", "Plain amount column must resolve")

    // A sales-volume-only file must never fabricate a revenue amount.
    const volumeOnly = runPair(
      ["period", "sales_volume"],
      [{ period: "2026-01", sales_volume: 100 }],
      ["period", "expense_category", "unit_cost"],
      [{ period: "2026-01", expense_category: "Rent", unit_cost: 50 }],
    )
    assert(volumeOnly.status === "failed", `Volume-only revenue must fail safe (got ${volumeOnly.status})`)
    assert(volumeOnly.totalRevenue === null, "Volume-only revenue total must stay withheld")
    assert(volumeOnly.dataQualityNotes.some((note) => note.includes("amount column")), "Volume-only revenue must report the unresolved amount")
  }

  // End-to-end parity: raw workbook -> shared parser -> resolver -> normalized -> CSV -> server parse -> report input -> dashboard model
  {
    const workbookRevenue = readWorkbookFixture("test-fixtures/business-models/04_profitability_revenue_test.xlsx")
    const workbookExpenses = readWorkbookFixture("test-fixtures/business-models/04_profitability_expenses_test.xlsx")
    const analysis = calculateProfitabilityAnalysis({
      analysisId: "pa_fixture04",
      revenueFile: file("revenue", "04_profitability_revenue_test.xlsx", workbookRevenue.columns, workbookRevenue.rows),
      expensesFile: file("expenses", "04_profitability_expenses_test.xlsx", workbookExpenses.columns, workbookExpenses.rows),
    })

    // The dashboard renders exactly this payload from the persisted dataset.
    const persistedPayload = JSON.parse(JSON.stringify(analysis)) as Record<string, unknown>
    nearlyEqual(persistedPayload.totalRevenue as number, 86312, "Persisted dashboard payload revenue")
    nearlyEqual(persistedPayload.totalExpenses as number, 34633.2, "Persisted dashboard payload expenses")

    // The report builder consumes the stored profitability metrics without remapping.
    const builtInput = await buildDatasetReportInput({      id: "ds_parity_fixture04",
      userId: "synthetic_user",
      name: "Fixture 04 Parity",
      fileName: "04_profitability.csv",
      fileSize: 1000,
      mimeType: "text/csv",
      storageKey: "private/storage/key.csv",
      checksum: null,
      rowCount: workbookRevenue.rows.length + workbookExpenses.rows.length,
      columnCount: workbookRevenue.columns.length + workbookExpenses.columns.length,
      columns: [...workbookRevenue.columns, ...workbookExpenses.columns],
      data: [...workbookRevenue.rows, ...workbookExpenses.rows],
      columnTypes: null,
      previewRowCount: null,
      previewGenerated: null,
      fullAnalysisCompleted: null,
      analysisStatus: "ready",
      analysisProgress: null,
      analysisMessage: null,
      analysisError: null,
      invalidRowCount: null,
      missingValueCounts: null,
      precomputedMetrics: persistedPayload,
      columnMapping: null,
      detectedColumns: null,
      aiInsights: null,
      status: "ready",
      analysis: { profitability: persistedPayload },
      datasetType: "profitability",
      businessModel: "generic",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    const financials = (builtInput as unknown as { financials: { revenue: number; operatingExpenses: number; netProfit: number; netMargin: number } }).financials
    nearlyEqual(financials.revenue, 86312, "Report input revenue parity")
    nearlyEqual(financials.operatingExpenses, 34633.2, "Report input expenses parity")
    nearlyEqual(financials.netProfit, 51678.8, "Report input net profit parity")
    nearlyEqual(financials.netMargin, 59.87, "Report input net margin parity")

    // Node-side shared reader equals the upload path for the same files.
    const nodeCsvRevenue = await parseTabularFile(new File([toCsv(workbookRevenue.columns, workbookRevenue.rows)], "04_profitability_revenue_test.csv", { type: "text/csv" }))
    const nodeParity = runPair(nodeCsvRevenue.columns, nodeCsvRevenue.rows, workbookExpenses.columns, workbookExpenses.rows)
    nearlyEqual(nodeParity.totalRevenue, 86312, "Shared reader revenue parity")
    nearlyEqual(nodeParity.totalExpenses, 34633.2, "Shared reader expense parity")

    console.log("End-to-end parity (parser -> resolver -> normalized -> persisted -> report): revenue 86312 / expenses 34633.2 / profit 51678.8 / margin 59.87% ✓")
  }

  // K — CSV and XLSX versions of a genuinely different synthetic schema produce identical results
  {
    const headerRow = ["Sale Date", "Product Name", "Units Sold", "Unit Price", "Net Sales"]
    const dataRows = [
      ["2026-01-15", "Alpha", 10, 20, 200.5],
      ["2026-02-15", "Beta", 5, 30, 150.25],
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([dataRows && [headerRow], dataRows].flat().filter(Boolean) as unknown[][]), "Revenue")
    const xlsxBytes = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer)
    const xlsxFile = new File([xlsxBytes.buffer as ArrayBuffer], "revenue_K.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const csvText = [headerRow, ...dataRows].map((cells) => cells.map(escapeCsvCell).join(",")).join("\n")

    const parsedXlsx = await parseTabularFile(xlsxFile)
    const parsedCsv = parseDelimitedText(csvText, ",")
    assert(parsedXlsx.columns.join("|") === parsedCsv.columns.join("|"), "K: XLSX and CSV must expose identical columns")
    const normalizedXlsx = normalizeRevenueRows(parsedXlsx.columns, parsedXlsx.rows)
    const normalizedCsv = normalizeRevenueRows(parsedCsv.columns, parsedCsv.rows)
    const sumXlsx = Math.round(normalizedXlsx.records.reduce((total, record) => total + record.amount, 0) * 100) / 100
    const sumCsv = Math.round(normalizedCsv.records.reduce((total, record) => total + record.amount, 0) * 100) / 100
    assert(sumXlsx === sumCsv && sumXlsx === 350.75, `K: XLSX and CSV totals must match (got ${sumXlsx} vs ${sumCsv})`)
    assert(normalizedXlsx.records[0].date === "2026-01-15", "K: XLSX dates must serialize as ISO dates")
    console.log("Fixture K_csv_xlsx_versions: XLSX and CSV agree at 350.75 ✓")
  }

  // M — alternative structure: gross line values with embedded components and
  // a compound categorical header (cost_type). Permanent golden CSVs; totals
  // derive from raw cells and must equal 72,450.00 / 28,975.50 exactly.
  {
    const revenueFixture = parseDelimitedText(fs.readFileSync("scripts/analysis/fixtures/alternative_structure_revenue_test.csv", "utf8"), ",")
    const expenseFixture = parseDelimitedText(fs.readFileSync("scripts/analysis/fixtures/alternative_structure_expenses_test.csv", "utf8"), ",")
    const analysis = runPair(revenueFixture.columns, revenueFixture.rows, expenseFixture.columns, expenseFixture.rows)

    nearlyEqual(analysis.totalRevenue, 72450, "M revenue")
    nearlyEqual(analysis.totalExpenses, 28975.5, "M expenses")
    nearlyEqual(analysis.netProfit, 43474.5, "M profit")
    nearlyEqual(analysis.netMargin, 60.01, "M margin")
    assert(analysis.status === "ready", `M must be ready (got ${analysis.status})`)
    assert(analysis.schemaDiagnostics?.revenue.amountStrategy === "reconciled_components", `M: revenue must reconcile sales_value minus discount_value against quantity x unit price (got ${analysis.schemaDiagnostics?.revenue.amountStrategy})`)
    assert(analysis.schemaDiagnostics?.expenses.amountStrategy === "reconciled_components", `M: expenses must reconcile spend_value minus tax_value against quantity x unit cost (got ${analysis.schemaDiagnostics?.expenses.amountStrategy})`)
    assert(analysis.schemaDiagnostics?.revenue.selected.some((field) => field.column === "sales_value" && field.concept === "amount"), "M: sales_value must carry the amount role")
    assert(analysis.schemaDiagnostics?.expenses.selected.some((field) => field.column === "spend_value" && field.concept === "amount"), "M: spend_value must carry the amount role")
    assert(analysis.schemaDiagnostics?.expenses.selected.some((field) => field.column === "cost_type" && field.concept === "category"), "M: cost_type must resolve generically as the expense category")
    assert(analysis.expenseCategories.length > 0 && analysis.expenseCategories.every(([name]) => name !== "Uncategorized"), "M: expense categories must come from cost_type, not Uncategorized")

    const derivedRevenue = Math.round((expectedSum(revenueFixture.columns, revenueFixture.rows, "sales_value") - expectedSum(revenueFixture.columns, revenueFixture.rows, "discount_value")) * 100) / 100
    const derivedExpenses = Math.round((expectedSum(expenseFixture.columns, expenseFixture.rows, "spend_value") - expectedSum(expenseFixture.columns, expenseFixture.rows, "tax_value")) * 100) / 100
    nearlyEqual(analysis.totalRevenue, derivedRevenue, "M revenue must equal sales_value minus discount_value derived from raw cells")
    nearlyEqual(analysis.totalExpenses, derivedExpenses, "M expenses must equal spend_value minus tax_value derived from raw cells")
    console.log(`Fixture M_alternative_structure: revenue ${analysis.totalRevenue} / expenses ${analysis.totalExpenses} / profit ${analysis.netProfit} / margin ${analysis.netMargin} ✓`)

    const revenueRows = revenueFixture.rows
    const expenseRows = expenseFixture.rows

    // M1 — reordered columns + irrelevant extra columns (string note, numeric
    // rating, identifier-like and numeric-looking reference columns)
    {
      const reorderedRevenueColumns = ["star_rating", "discount_value", "batch_note", "sales_value", "product_code", "quantity", "unit_price", "date", "product"]
      const reorderedRevenueRows = revenueRows.map((row, index) => ({ ...row, star_rating: 4, batch_note: "auto", product_code: 100777 + index }))
      const reorderedExpenseColumns = ["internal_flag", "spend_value", "cost_type", "tax_value", "quantity", "unit_cost", "vendor", "date"]
      const reorderedExpenseRows = expenseRows.map((row, index) => ({ ...row, internal_flag: index % 2 }))
      const reordered = runPair(reorderedRevenueColumns, reorderedRevenueRows, reorderedExpenseColumns, reorderedExpenseRows)
      nearlyEqual(reordered.totalRevenue, 72450, "M1 reordered revenue")
      nearlyEqual(reordered.totalExpenses, 28975.5, "M1 reordered expenses")
      assert(reordered.status === "ready", "M1 must stay ready")
      console.log("Fixture M1_reordered_and_irrelevant: identical totals 72450 / 28975.5 ✓")
    }

    // M2 — renamed headers: spaces/case (aliases keep semantics) and
    // camelCase variants; unknown amount headers backed by strong
    // mathematical relationships keep the same totals via reconciliation.
    {
      const renameRevenue: Record<string, string> = {
        date: "Sale Date", product: "Product", quantity: "Quantity", unit_price: "Unit Price",
        sales_value: "Sales Value", discount_value: "Discount Value",
      }
      const renameExpense: Record<string, string> = {
        date: "Date", vendor: "Vendor", cost_type: "Cost Type", quantity: "Quantity",
        unit_cost: "Unit Cost", spend_value: "Spend Value", tax_value: "Tax Value",
      }
      const renamed = runPair(
        Object.values(renameRevenue),
        revenueRows.map((row) => restate(row, renameRevenue)),
        Object.values(renameExpense),
        expenseRows.map((row) => restate(row, renameExpense)),
      )
      nearlyEqual(renamed.totalRevenue, 72450, "M2 renamed revenue")
      nearlyEqual(renamed.totalExpenses, 28975.5, "M2 renamed expenses")

      const camel = runPair(
        ["saleDate", "productName", "quantity", "unitPrice", "salesValue", "discountValue"],
        revenueRows.map((row) => restate(row, {
          date: "saleDate", product: "productName", quantity: "quantity", sales_value: "salesValue", discount_value: "discountValue", unit_price: "unitPrice",
        })),
        ["date", "vendor", "costType", "quantity", "unitCost", "spendValue", "taxValue"],
        expenseRows.map((row) => restate(row, {
          date: "date", vendor: "vendor", quantity: "quantity", spend_value: "spendValue", tax_value: "taxValue", unit_cost: "unitCost", cost_type: "costType",
        })),
      )
      nearlyEqual(camel.totalRevenue, 72450, "M2 camelCase revenue")
      nearlyEqual(camel.totalExpenses, 28975.5, "M2 camelCase expenses")

      const unknown = runPair(
        ["date", "item_name", "quantity", "unit_price"],
        revenueRows,
        ["date", "vendor", "cost_type", "quantity", "unit_cost"],
        expenseRows,
      )
      nearlyEqual(unknown.totalRevenue, 72450, "M2 unknown revenue headers reconcile via quantity x unit price")
      nearlyEqual(unknown.totalExpenses, 28975.5, "M2 unknown expense headers reconcile via quantity x unit cost")
      console.log("Fixture M2_renamed_headers: renamed/camelCase/unknown-header totals invariant ✓")
    }

    // M3 — European decimals and currency symbols; XLSX with real Excel dates.
    {
      const eur = (value: unknown) => {
        const num = parseMoneyNumber(value) ?? 0
        if (num === 0) return 0
        return `€${num.toFixed(2).replace(".", ",")}`
      }
      const euroRevenueRows = revenueRows.map((row) => ({ ...row, sales_value: eur(row.sales_value), discount_value: eur(row.discount_value) }))
      const euroExpenseRows = expenseRows.map((row) => ({ ...row, spend_value: eur(row.spend_value), tax_value: eur(row.tax_value) }))
      const euro = runPair(revenueFixture.columns, euroRevenueRows, expenseFixture.columns, euroExpenseRows)
      nearlyEqual(euro.totalRevenue, 72450, "M3 European-decimal revenue")
      nearlyEqual(euro.totalExpenses, 28975.5, "M3 European-decimal expenses")

      const workbook = XLSX.utils.book_new()
      const revenueSheet = [revenueFixture.columns, ...revenueRows.map((row) => revenueFixture.columns.map((column) => {
        if (column === "date") {
          const [year, month, day] = String(row.date).split("-").map(Number)
          return new Date(Date.UTC(year, month - 1, day))
        }
        return row[column]
      }))]
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(revenueSheet as unknown[][]), "Revenue")
      const xlsxBytes = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer)
      const parsedXlsx = await parseTabularFile(new File([xlsxBytes.buffer as ArrayBuffer], "m_revenue.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
      const xlsxAnalysis = calculateProfitabilityAnalysis({
        analysisId: "pa_m_xlsx",
        revenueFile: file("revenue", "m_revenue.xlsx", parsedXlsx.columns, parsedXlsx.rows),
        expensesFile: file("expenses", "alternative_structure_expenses_test.csv", expenseFixture.columns, expenseRows),
      })
      nearlyEqual(xlsxAnalysis.totalRevenue, 72450, "M3 XLSX Excel-date revenue")
      assert(parsedXlsx.rows.every((row) => row.date instanceof Date || typeof row.date === "string"), "M3: XLSX dates must survive parsing")
      console.log("Fixture M3_locale_and_xlsx: European decimals and Excel dates invariant ✓")
    }

    // M4 — expense shape where the embedded-component identity is NOT proven
    // (tax sits inside the amount plus escalation): no subtraction, explicit
    // amount stays authoritative, tax never added.
    {
      const expenseColumns = ["expense_date", "expense_category", "quantity", "unit_cost", "tax_amount", "expense_amount"]
      const expenseRows = [1, 2, 3, 4, 5].map((i) => ({
        expense_date: `2026-0${i}-10`,
        expense_category: "Software",
        quantity: 2,
        unit_cost: 45,
        tax_amount: 5.4,
        expense_amount: 2 * 45 + 5.4 + 5,
      }))
      const unprovenRevenueRows = revenueRows.slice(0, 5).map((row) => ({
        ...row,
        net_revenue: Math.round((Number(row.quantity) * Number(row.unit_price)) * 100) / 100,
      }))
      const unproven = runPair(["date", "product", "quantity", "unit_price", "net_revenue"], unprovenRevenueRows, expenseColumns, expenseRows)
      nearlyEqual(unproven.totalExpenses, Math.round(expectedSum(expenseColumns, expenseRows, "expense_amount") * 100) / 100, "M4 unproven identity keeps the explicit amount")
      assert(unproven.schemaDiagnostics?.expenses.amountStrategy === "explicit_amount", "M4: identity failure must keep explicit_amount")
      console.log("Fixture M4_unproven_identity: explicit amount stays authoritative, no tax subtraction ✓")
    }

    // M5 — mixed currency inside the alternative structure must withhold
    // combined totals instead of aggregating.
    {
      const mixedExpenseRows = expenseRows.map((row, index) => ({ ...row, spend_value: `${index % 2 === 0 ? "€" : "$"}${row.spend_value}` }))
      const mixed = runPair(revenueFixture.columns, revenueRows, expenseFixture.columns, mixedExpenseRows)
      assert(mixed.currencyObservation?.mixed === true, "M5: mixed currencies must be detected")
      assert(mixed.totalRevenue === null && mixed.totalExpenses === null, "M5: combined totals must stay withheld")
      assert(mixed.dataQualityNotes.some((note) => note.includes("Mixed currencies")), "M5: mixed-currency warning must be present")
      console.log("Fixture M5_mixed_currency: totals withheld ✓")
    }
  }

  console.log(JSON.stringify({ status: "pass", fixtures: fixtures.length + 1 }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
