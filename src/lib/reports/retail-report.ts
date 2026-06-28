export type RetailRow = Record<string, unknown>

export type RetailColumns = {
  product?: string
  sku?: string
  category?: string
  supplier?: string
  revenue?: string
  cost?: string
  profit?: string
  margin?: string
  price?: string
  quantitySold?: string
  stock?: string
  reorderLevel?: string
  date?: string
}

export type RetailKpis = {
  totalRevenue: number | null
  grossProfit: number | null
  profitMargin: number | null
  salesRows: number
  inventoryValue: number | null
  productCount: number
  lowStockItems: number
  deadStockItems: number
}

export type ProductPerformance = {
  name: string
  sku?: string
  category?: string
  supplier?: string
  revenue: number
  profit: number
  quantitySold: number
  stock: number | null
  reorderLevel: number | null
  inventoryValue: number | null
  margin: number | null
  status: "healthy" | "low_stock" | "dead_stock" | "overstock"
}

export type RetailGroup = {
  name: string
  revenue: number
  profit: number
  margin: number | null
  quantitySold: number
  stock: number
  products: number
}

export type AbcItem = ProductPerformance & {
  contribution: number
  cumulativeContribution: number
  className: "A" | "B" | "C"
}

export type InventoryHealth = {
  score: number
  healthy: number
  lowStock: number
  overstock: number
  deadStock: number
  reorderRisk: number
}

export type Recommendation = {
  priority: "Critical" | "Important" | "Opportunity"
  title: string
  explanation: string
  affected?: string
  impact?: string
}

export type RetailReport = {
  columns: RetailColumns
  kpis: RetailKpis
  executiveSummary: string[]
  recommendations: Recommendation[]
  inventoryHealth: InventoryHealth
  products: ProductPerformance[]
  categories: RetailGroup[]
  suppliers: RetailGroup[]
  abc: AbcItem[]
  revenueTrend: RetailGroup[]
  profitTrend: RetailGroup[]
  forecast: string
  confidenceScore: number
}

const COLUMN_PATTERNS: Array<[keyof RetailColumns, RegExp[]]> = [
  ["product", [/^product$/i, /product.*name/i, /item.*name/i, /^item$/i, /description/i]],
  ["sku", [/^sku$/i, /stock.*keeping/i, /item.*code/i, /product.*code/i]],
  ["category", [/category/i, /department/i, /segment/i, /collection/i]],
  ["supplier", [/supplier/i, /vendor/i, /brand/i, /manufacturer/i]],
  ["revenue", [/revenue/i, /sales.*amount/i, /net.*sales/i, /gross.*sales/i, /^amount$/i, /^total$/i]],
  ["cost", [/cost/i, /cogs/i, /unit.*cost/i, /purchase.*price/i]],
  ["profit", [/profit/i, /gross.*profit/i, /net.*profit/i]],
  ["margin", [/margin/i, /profit.*pct/i, /profit.*percent/i]],
  ["price", [/^price$/i, /selling.*price/i, /retail.*price/i, /unit.*price/i]],
  ["quantitySold", [/quantity.*sold/i, /qty.*sold/i, /units.*sold/i, /^quantity$/i, /^qty$/i, /sold/i]],
  ["stock", [/^stock$/i, /inventory/i, /on.*hand/i, /available/i, /stock.*level/i]],
  ["reorderLevel", [/reorder/i, /minimum.*stock/i, /min.*stock/i, /safety.*stock/i]],
  ["date", [/^date$/i, /order.*date/i, /sale.*date/i, /created.*at/i, /period/i]],
]

export function getDisplayName({
  profile,
  sessionUser,
}: {
  profile?: { firstName?: string | null; fullName?: string | null; email?: string | null } | null
  sessionUser?: { name?: string | null; email?: string | null } | null
}) {
  const firstName = cleanText(profile?.firstName)
  if (firstName) return firstName

  const fullName = cleanText(profile?.fullName)
  if (fullName) return fullName.split(/\s+/)[0] || fullName

  const sessionName = cleanText(sessionUser?.name)
  if (sessionName) return sessionName.split(/\s+/)[0] || sessionName

  const email = cleanText(profile?.email) || cleanText(sessionUser?.email)
  if (email && email.includes("@")) return email.split("@")[0]

  return "there"
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function detectRetailColumns(rows: RetailRow[], explicitColumns: string[] = []): RetailColumns {
  const rowColumns = rows[0] ? Object.keys(rows[0]) : []
  const columns = [...new Set([...explicitColumns, ...rowColumns])].filter(Boolean)
  const detected: RetailColumns = {}

  for (const [key, patterns] of COLUMN_PATTERNS) {
    detected[key] = columns.find((column) => {
      const normalized = normalizeColumn(column)
      return patterns.some((pattern) => pattern.test(normalized))
    })
  }

  return detected
}

export function calculateKpis(rows: RetailRow[], columns: RetailColumns): RetailKpis {
  const products = aggregateProducts(rows, columns)
  const totalRevenue = sumNullable(rows.map((row) => getRevenue(row, columns)))
  const grossProfit = sumNullable(rows.map((row) => getProfit(row, columns)))
  const inventoryValue = sumNullable(products.map((product) => product.inventoryValue))
  const profitMargin = totalRevenue && grossProfit !== null ? (grossProfit / totalRevenue) * 100 : null

  return {
    totalRevenue,
    grossProfit,
    profitMargin,
    salesRows: rows.length,
    inventoryValue,
    productCount: products.length,
    lowStockItems: products.filter((product) => product.status === "low_stock").length,
    deadStockItems: products.filter((product) => product.status === "dead_stock").length,
  }
}

export function buildRetailReport(rows: RetailRow[], explicitColumns: string[] = []): RetailReport {
  const columns = detectRetailColumns(rows, explicitColumns)
  const products = aggregateProducts(rows, columns)
  const categories = aggregateGroups(products, "category")
  const suppliers = aggregateGroups(products, "supplier")
  const kpis = calculateKpis(rows, columns)
  const inventoryHealth = calculateInventoryHealth(products)
  const abc = calculateABCAnalysis(products)
  const revenueTrend = aggregateTrend(rows, columns, "revenue")
  const profitTrend = aggregateTrend(rows, columns, "profit")

  return {
    columns,
    kpis,
    executiveSummary: generateExecutiveSummary({ kpis, products, categories, suppliers, inventoryHealth }),
    recommendations: generateRecommendations({ kpis, products, categories, suppliers, inventoryHealth, abc }),
    inventoryHealth,
    products,
    categories,
    suppliers,
    abc,
    revenueTrend,
    profitTrend,
    forecast: generateForecast(rows, columns, products, revenueTrend),
    confidenceScore: calculateConfidenceScore(rows, columns),
  }
}

export function generateExecutiveSummary({
  kpis,
  products,
  categories,
  suppliers,
  inventoryHealth,
}: {
  kpis: RetailKpis
  products: ProductPerformance[]
  categories: RetailGroup[]
  suppliers: RetailGroup[]
  inventoryHealth: InventoryHealth
}) {
  const summary: string[] = []
  const topProduct = [...products].sort((a, b) => b.revenue - a.revenue)[0]
  const topProfit = [...products].sort((a, b) => b.profit - a.profit)[0]
  const topCategory = categories[0]
  const topSupplier = suppliers[0]

  if (kpis.totalRevenue !== null) summary.push(`Total revenue is ${formatCurrency(kpis.totalRevenue)} across ${kpis.salesRows.toLocaleString()} sales rows.`)
  if (kpis.grossProfit !== null) summary.push(`Gross profit is ${formatCurrency(kpis.grossProfit)}${kpis.profitMargin !== null ? ` with a ${kpis.profitMargin.toFixed(1)}% margin` : ""}.`)
  if (topProduct) summary.push(`${topProduct.name} is the leading revenue product, contributing ${formatCurrency(topProduct.revenue)}.`)
  if (topProfit) summary.push(`${topProfit.name} contributes the highest product profit at ${formatCurrency(topProfit.profit)}.`)
  if (topCategory) summary.push(`${topCategory.name} is the strongest category by revenue with ${formatCurrency(topCategory.revenue)}.`)
  if (topSupplier) summary.push(`${topSupplier.name} is the highest revenue supplier at ${formatCurrency(topSupplier.revenue)}.`)
  if (kpis.lowStockItems > 0) summary.push(`${kpis.lowStockItems} product${kpis.lowStockItems === 1 ? "" : "s"} are below reorder level and need stock attention.`)
  if (kpis.deadStockItems > 0) summary.push(`${kpis.deadStockItems} product${kpis.deadStockItems === 1 ? "" : "s"} show dead-stock risk because stock remains with no detected sales.`)
  summary.push(`Inventory health score is ${inventoryHealth.score}/100 based on healthy, low-stock, overstock, and dead-stock signals.`)

  return summary.slice(0, 8)
}

export function generateRecommendations({
  kpis,
  products,
  categories,
  suppliers,
  inventoryHealth,
  abc,
}: {
  kpis: RetailKpis
  products: ProductPerformance[]
  categories: RetailGroup[]
  suppliers: RetailGroup[]
  inventoryHealth: InventoryHealth
  abc: AbcItem[]
}): Recommendation[] {
  const recommendations: Recommendation[] = []
  const lowStock = products.filter((product) => product.status === "low_stock").sort((a, b) => b.revenue - a.revenue)
  const deadStock = products.filter((product) => product.status === "dead_stock").sort((a, b) => (b.inventoryValue || 0) - (a.inventoryValue || 0))
  const lowMargin = products.filter((product) => product.margin !== null && product.margin < 15).sort((a, b) => (a.margin || 0) - (b.margin || 0))
  const topA = abc.filter((item) => item.className === "A")

  if (lowStock[0]) {
    recommendations.push({
      priority: "Critical",
      title: "Reorder high-value low-stock items",
      explanation: `${lowStock[0].name} is below reorder level and has generated ${formatCurrency(lowStock[0].revenue)} revenue.`,
      affected: lowStock[0].sku ? `${lowStock[0].name} (${lowStock[0].sku})` : lowStock[0].name,
      impact: "Protects revenue from avoidable stockouts.",
    })
  }

  if (deadStock[0]) {
    recommendations.push({
      priority: "Important",
      title: "Release cash tied up in dead stock",
      explanation: `${deadStock[0].name} has stock on hand without detected sales movement.`,
      affected: deadStock[0].name,
      impact: deadStock[0].inventoryValue ? `${formatCurrency(deadStock[0].inventoryValue)} inventory value at risk.` : "Reduces inventory drag.",
    })
  }

  if (lowMargin[0]) {
    recommendations.push({
      priority: "Important",
      title: "Review weak-margin products",
      explanation: `${lowMargin[0].name} has an estimated margin of ${lowMargin[0].margin?.toFixed(1)}%.`,
      affected: lowMargin[0].name,
      impact: "Improves profit quality without needing more sales volume.",
    })
  }

  if (topA.length > 0) {
    recommendations.push({
      priority: "Opportunity",
      title: "Protect the A-class product set",
      explanation: `${topA.length} product${topA.length === 1 ? "" : "s"} drive the majority of detected value.`,
      affected: topA.slice(0, 3).map((item) => item.name).join(", "),
      impact: "Focuses purchasing, promotions, and availability on the products that matter most.",
    })
  }

  if (categories[0]) {
    recommendations.push({
      priority: "Opportunity",
      title: "Double down on the strongest category",
      explanation: `${categories[0].name} leads category revenue with ${formatCurrency(categories[0].revenue)}.`,
      affected: categories[0].name,
      impact: "Improves merchandising and campaign focus.",
    })
  }

  if (suppliers[0] && suppliers[0].revenue > (kpis.totalRevenue || 0) * 0.4) {
    recommendations.push({
      priority: "Important",
      title: "Reduce supplier concentration risk",
      explanation: `${suppliers[0].name} represents a large share of detected revenue.`,
      affected: suppliers[0].name,
      impact: "Protects supply continuity and negotiating leverage.",
    })
  }

  if (inventoryHealth.score < 65) {
    recommendations.push({
      priority: "Critical",
      title: "Stabilize inventory health",
      explanation: `Inventory health is ${inventoryHealth.score}/100, with ${inventoryHealth.lowStock} low-stock and ${inventoryHealth.deadStock} dead-stock products.`,
      impact: "Improves service levels and reduces trapped cash.",
    })
  }

  return recommendations.slice(0, 8)
}

export function calculateInventoryHealth(products: ProductPerformance[]): InventoryHealth {
  if (products.length === 0) {
    return { score: 0, healthy: 0, lowStock: 0, overstock: 0, deadStock: 0, reorderRisk: 0 }
  }

  const lowStock = products.filter((product) => product.status === "low_stock").length
  const overstock = products.filter((product) => product.status === "overstock").length
  const deadStock = products.filter((product) => product.status === "dead_stock").length
  const healthy = products.length - lowStock - overstock - deadStock
  const penalty = lowStock * 5 + deadStock * 8 + overstock * 3
  const score = Math.max(0, Math.min(100, Math.round(100 - (penalty / products.length) * 10)))

  return { score, healthy, lowStock, overstock, deadStock, reorderRisk: lowStock + deadStock }
}

export function calculateABCAnalysis(products: ProductPerformance[]): AbcItem[] {
  const sorted = [...products].sort((a, b) => b.revenue - a.revenue)
  const total = sorted.reduce((sum, product) => sum + product.revenue, 0)
  let cumulative = 0

  return sorted.map((product) => {
    const contribution = total > 0 ? (product.revenue / total) * 100 : 0
    cumulative += contribution
    return {
      ...product,
      contribution,
      cumulativeContribution: cumulative,
      className: cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C",
    }
  })
}

function aggregateProducts(rows: RetailRow[], columns: RetailColumns): ProductPerformance[] {
  const products = new Map<string, ProductPerformance>()

  rows.forEach((row, index) => {
    const name = getText(row, columns.product) || getText(row, columns.sku) || `Product ${index + 1}`
    const sku = getText(row, columns.sku)
    const key = `${name}::${sku || ""}`
    const revenue = getRevenue(row, columns) || 0
    const profit = getProfit(row, columns) || 0
    const quantitySold = getNumber(row, columns.quantitySold) || 0
    const stock = getNumber(row, columns.stock)
    const reorderLevel = getNumber(row, columns.reorderLevel)
    const price = getNumber(row, columns.price)
    const inventoryValue = stock !== null && price !== null ? stock * price : null
    const margin = revenue > 0 ? (profit / revenue) * 100 : getNumber(row, columns.margin)
    const existing = products.get(key)

    if (existing) {
      existing.revenue += revenue
      existing.profit += profit
      existing.quantitySold += quantitySold
      existing.stock = stock ?? existing.stock
      existing.reorderLevel = reorderLevel ?? existing.reorderLevel
      existing.inventoryValue = addNullable(existing.inventoryValue, inventoryValue)
      existing.margin = existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : existing.margin
      existing.status = getProductStatus(existing)
      return
    }

    const product: ProductPerformance = {
      name,
      sku,
      category: getText(row, columns.category),
      supplier: getText(row, columns.supplier),
      revenue,
      profit,
      quantitySold,
      stock,
      reorderLevel,
      inventoryValue,
      margin,
      status: "healthy",
    }
    product.status = getProductStatus(product)
    products.set(key, product)
  })

  return [...products.values()].sort((a, b) => b.revenue - a.revenue)
}

function aggregateGroups(products: ProductPerformance[], field: "category" | "supplier"): RetailGroup[] {
  const groups = new Map<string, RetailGroup>()

  for (const product of products) {
    const name = product[field]
    if (!name) continue
    const existing = groups.get(name) || {
      name,
      revenue: 0,
      profit: 0,
      margin: null,
      quantitySold: 0,
      stock: 0,
      products: 0,
    }
    existing.revenue += product.revenue
    existing.profit += product.profit
    existing.quantitySold += product.quantitySold
    existing.stock += product.stock || 0
    existing.products += 1
    existing.margin = existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : null
    groups.set(name, existing)
  }

  return [...groups.values()].sort((a, b) => b.revenue - a.revenue)
}

function aggregateTrend(rows: RetailRow[], columns: RetailColumns, metric: "revenue" | "profit"): RetailGroup[] {
  if (!columns.date) return []
  const groups = new Map<string, RetailGroup>()

  for (const row of rows) {
    const date = getDateBucket(row, columns.date)
    if (!date) continue
    const value = metric === "revenue" ? getRevenue(row, columns) || 0 : getProfit(row, columns) || 0
    const existing = groups.get(date) || {
      name: date,
      revenue: 0,
      profit: 0,
      margin: null,
      quantitySold: 0,
      stock: 0,
      products: 0,
    }
    if (metric === "revenue") existing.revenue += value
    if (metric === "profit") existing.profit += value
    groups.set(date, existing)
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function generateForecast(rows: RetailRow[], columns: RetailColumns, products: ProductPerformance[], revenueTrend: RetailGroup[]) {
  const risks = products.filter((product) => product.status === "low_stock" || product.status === "dead_stock").length
  if (!columns.date || revenueTrend.length < 3) {
    return risks > 0
      ? `Not enough historical data for reliable forecast. ${risks} product${risks === 1 ? "" : "s"} still show stockout or dead-stock risk.`
      : "Not enough historical data for reliable forecast."
  }

  const recent = revenueTrend.slice(-3)
  const average = recent.reduce((sum, item) => sum + item.revenue, 0) / recent.length
  return `Estimated next-period revenue is ${formatCurrency(average)} based on the latest ${recent.length} detected periods. ${risks} product${risks === 1 ? "" : "s"} need stock risk review.`
}

function calculateConfidenceScore(rows: RetailRow[], columns: RetailColumns) {
  const detected = Object.values(columns).filter(Boolean).length
  const base = Math.min(50, rows.length / 10)
  return Math.max(20, Math.min(96, Math.round(base + detected * 5)))
}

function getProductStatus(product: ProductPerformance): ProductPerformance["status"] {
  if ((product.quantitySold || 0) <= 0 && (product.stock || 0) > 0) return "dead_stock"
  if (product.stock !== null && product.reorderLevel !== null && product.stock <= product.reorderLevel) return "low_stock"
  if (product.stock !== null && product.quantitySold > 0 && product.stock > product.quantitySold * 4) return "overstock"
  return "healthy"
}

function getRevenue(row: RetailRow, columns: RetailColumns) {
  const direct = getNumber(row, columns.revenue)
  if (direct !== null) return direct
  const price = getNumber(row, columns.price)
  const quantity = getNumber(row, columns.quantitySold)
  return price !== null && quantity !== null ? price * quantity : null
}

function getProfit(row: RetailRow, columns: RetailColumns) {
  const direct = getNumber(row, columns.profit)
  if (direct !== null) return direct
  const revenue = getRevenue(row, columns)
  const cost = getNumber(row, columns.cost)
  const quantity = getNumber(row, columns.quantitySold)
  if (revenue !== null && cost !== null) return revenue - (quantity !== null ? cost * quantity : cost)
  return null
}

function getText(row: RetailRow, column?: string) {
  if (!column) return undefined
  const value = row[column]
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text || undefined
}

function getNumber(row: RetailRow, column?: string): number | null {
  if (!column) return null
  const value = row[column]
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const normalized = value.replace(/[^0-9,.-]/g, "").replace(/,/g, "")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function getDateBucket(row: RetailRow, column?: string) {
  if (!column) return null
  const value = row[column]
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function normalizeColumn(column: string) {
  return column.toLowerCase().replace(/[_-]+/g, " ").trim()
}

function cleanText(value?: string | null) {
  const text = value?.trim()
  return text || undefined
}

function sumNullable(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0)
}

function addNullable(a: number | null, b: number | null) {
  if (a === null) return b
  if (b === null) return a
  return a + b
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}
