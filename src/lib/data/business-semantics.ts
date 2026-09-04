import { debugLog } from "@/lib/utils/debug"

export const BUSINESS_SEMANTIC_PROFILE_VERSION = "useclevr.business-semantics.v1"

export type BusinessSemanticDatasetType =
  | "standard"
  | "retail"
  | "profitability"
  | "accountancy"
  | "prebookkeeping"
  | "marketplace"
  | "saas"
  | "investor"

export type BusinessSemanticDomain =
  | BusinessSemanticDatasetType
  | "general"

export type BusinessSemanticConfidence = "HIGH" | "MEDIUM" | "LOW"

export type BusinessConcept =
  | "date"
  | "investment_date"
  | "transaction_id"
  | "customer_id"
  | "product_id"
  | "quantity"
  | "amount"
  | "currency"
  | "geography"
  | "gross_sales"
  | "net_sales"
  | "units_sold"
  | "product"
  | "sku"
  | "category"
  | "inventory_on_hand"
  | "inventory_value"
  | "unit_cost"
  | "selling_price"
  | "discount"
  | "return"
  | "reorder_point"
  | "revenue"
  | "cogs"
  | "gross_profit"
  | "operating_expense"
  | "operating_profit"
  | "interest_expense"
  | "tax"
  | "net_profit"
  | "debit"
  | "credit"
  | "account"
  | "account_code"
  | "journal_date"
  | "description"
  | "net_movement"
  | "opening_balance"
  | "closing_balance"
  | "gmv"
  | "marketplace_revenue"
  | "merchant_payout"
  | "refund"
  | "commission"
  | "customer"
  | "merchant"
  | "product_category"
  | "mrr"
  | "arr"
  | "subscription_revenue"
  | "new_mrr"
  | "expansion_mrr"
  | "contraction_mrr"
  | "churned_mrr"
  | "active_customers"
  | "new_customers"
  | "churned_customers"
  | "customer_churn_rate"
  | "revenue_churn_rate"
  | "burn"
  | "cash_balance"
  | "runway"
  | "arpu"
  | "portfolio_company"
  | "portfolio_company_annual_revenue"
  | "invested_amount"
  | "latest_valuation"
  | "ownership_percent"
  | "sector"
  | "stage"

export type SemanticMappingStatus = "confirmed" | "ambiguous" | "rejected"
export type SemanticKpiStatus = "AVAILABLE" | "PARTIAL" | "BLOCKED" | "AMBIGUOUS" | "NOT_APPLICABLE"
export type SemanticIssueSeverity = "INFO" | "WARNING" | "ERROR" | "BLOCKING"

export type SemanticColumnMapping = {
  sourceColumn: string
  concept: BusinessConcept
  domain: BusinessSemanticDomain
  confidence: BusinessSemanticConfidence
  mappingMethod: "exact_alias" | "normalized_alias" | "contextual_alias" | "profile_metadata"
  evidence: string[]
  status: SemanticMappingStatus
  alternatives: Array<{
    concept: BusinessConcept
    domain: BusinessSemanticDomain
    confidence: BusinessSemanticConfidence
    reason: string
  }>
  warnings: string[]
}

export type MetricPermission = {
  metric: string
  status: SemanticKpiStatus
  reasonCode: string
  requiredConcepts: BusinessConcept[]
  missingConcepts: BusinessConcept[]
  evidence: string[]
  confidence: BusinessSemanticConfidence
  formulaId?: string
  lineage: LineageRecord[]
}

export type SemanticAmbiguity = {
  sourceColumn: string
  candidateConcepts: BusinessConcept[]
  reason: string
  severity: SemanticIssueSeverity
}

export type SemanticIssue = {
  code: string
  severity: SemanticIssueSeverity
  message: string
  affectedConcepts: BusinessConcept[]
  evidence: string[]
}

export type MissingEvidence = {
  metric: string
  missingConcepts: BusinessConcept[]
  reasonCode: string
}

export type LineageRecord = {
  sourceFile: string | null
  sourceColumn: string
  concept: BusinessConcept
  transformation: "source_column_mapping" | "formula" | "aggregation" | "merge"
  formulaId?: string
  rowScope: "all_rows" | "latest_period" | "filtered_rows" | "unknown"
  confidence: BusinessSemanticConfidence
}

export type SemanticWarning = {
  code: string
  message: string
  severity: Exclude<SemanticIssueSeverity, "ERROR" | "BLOCKING">
}

export type FormulaDefinition = {
  id: string
  metric: string
  expression: string
  requiredConcepts: BusinessConcept[]
  domainRestrictions?: BusinessSemanticDatasetType[]
  aggregation: "sum" | "ratio" | "latest_period" | "derived" | "count_distinct"
  blockedByContradictions?: string[]
}

export type SemanticClassification = {
  datasetType: BusinessSemanticDatasetType
  confidence: BusinessSemanticConfidence
  score: number
  evidence: string[]
  competingClassifications: Array<{
    datasetType: BusinessSemanticDatasetType
    score: number
    confidence: BusinessSemanticConfidence
    evidence: string[]
  }>
  warnings: string[]
  reason: string
}

export type SemanticProfile = {
  version: typeof BUSINESS_SEMANTIC_PROFILE_VERSION
  datasetId: string
  datasetType: BusinessSemanticDatasetType
  classification: SemanticClassification
  classificationConfidence: BusinessSemanticConfidence
  concepts: SemanticColumnMapping[]
  availableMetrics: MetricPermission[]
  blockedMetrics: MetricPermission[]
  ambiguousMetrics: MetricPermission[]
  ambiguities: SemanticAmbiguity[]
  contradictions: SemanticIssue[]
  missingEvidence: MissingEvidence[]
  lineage: LineageRecord[]
  warnings: SemanticWarning[]
  formulas: FormulaDefinition[]
  diagnostics: {
    columnCount: number
    rowCount: number
    confirmedConceptCount: number
    ambiguousConceptCount: number
    generatedAt: string
  }
}

export type SemanticDatasetInput = {
  datasetId: string
  datasetType?: string | null
  businessModel?: string | null
  fileName?: string | null
  datasetName?: string | null
  columns: string[]
  rows?: Record<string, unknown>[]
  userMappings?: Partial<Record<BusinessConcept, string>>
}

export type MultiFileSemanticInput = SemanticDatasetInput & {
  role?: string | null
}

type ConceptRule = {
  concept: BusinessConcept
  domain: BusinessSemanticDomain
  aliases: string[]
  contextualAliases?: string[]
  rejectDomains?: BusinessSemanticDatasetType[]
  requireNumeric?: boolean
  requireDate?: boolean
}

const formulaRegistry: FormulaDefinition[] = [
  formula("revenue", "Revenue", "source-backed revenue", ["revenue"], ["standard", "retail", "profitability", "saas"]),
  formula("gross_profit", "Gross Profit", "revenue - cogs", ["revenue", "cogs"], ["standard", "retail", "profitability"]),
  formula("gross_margin", "Gross Margin", "gross_profit / revenue * 100", ["gross_profit", "revenue"], ["standard", "retail", "profitability"]),
  formula("operating_profit", "Operating Profit", "gross_profit - operating_expense", ["gross_profit", "operating_expense"], ["profitability", "standard"]),
  formula("net_profit", "Net Profit", "operating_profit - interest_expense - tax", ["operating_profit", "interest_expense", "tax"], ["profitability", "standard"]),
  formula("mrr", "MRR", "latest-period subscription revenue state", ["mrr"], ["saas"], "latest_period"),
  formula("arr", "ARR", "mrr * 12 or latest-period ARR state", ["mrr"], ["saas"], "latest_period"),
  formula("runway", "Runway", "cash_balance / burn", ["cash_balance", "burn"], ["saas"], "ratio"),
  formula("gmv", "GMV", "source-backed marketplace GMV", ["gmv"], ["marketplace"]),
  formula("marketplace_revenue", "Marketplace Revenue", "source-backed platform revenue", ["marketplace_revenue"], ["marketplace"]),
  formula("take_rate", "Take Rate", "marketplace_revenue / gmv * 100", ["marketplace_revenue", "gmv"], ["marketplace"], "ratio"),
  formula("portfolio_company_annual_revenue", "Portfolio Company Annual Revenue", "source-backed combined annual revenue of portfolio companies", ["portfolio_company_annual_revenue"], ["investor"]),
  formula("invested_amount", "Invested Capital", "source-backed capital deployed into portfolio companies", ["invested_amount"], ["investor"]),
  formula("latest_valuation", "Portfolio Company Valuation", "source-backed latest valuation of portfolio companies", ["latest_valuation"], ["investor"]),
  formula("net_movement", "Net Movement", "debit - credit", ["debit", "credit"], ["accountancy", "prebookkeeping"]),
  formula("inventory_value", "Inventory Value", "inventory_on_hand * unit_cost", ["inventory_on_hand", "unit_cost"], ["retail"], "derived"),
]

const conceptRules: ConceptRule[] = [
  rule("date", "general", ["date", "transaction_date", "order_date", "invoice_date", "month", "period", "billing_month", "event_date", "revenue_period", "reporting_period", "fiscal_period", "financial_period", "period_end", "fiscal_year", "year"], { requireDate: true }),
  rule("investment_date", "investor", ["investment_date", "investment date", "date_of_investment", "invested_date", "deal_date", "funding_date"], { requireDate: true }),
  rule("transaction_id", "general", ["transaction_id", "transaction_number", "order_id", "invoice_id", "journal_id", "document_number"]),
  rule("customer_id", "general", ["customer_id", "client_id", "account_id", "buyer_id"]),
  rule("product_id", "general", ["product_id", "sku", "item_id"]),
  rule("quantity", "general", ["quantity", "qty", "units", "units_sold"], { requireNumeric: true }),
  rule("currency", "general", ["currency", "currency_code", "iso_currency"]),
  rule("geography", "general", ["country", "region", "city", "location", "market"]),
  rule("gross_sales", "retail", ["gross_sales"]),
  rule("net_sales", "retail", ["net_sales", "sales_amount", "total_sales", "order_total", "turnover"], { requireNumeric: true }),
  rule("units_sold", "retail", ["units_sold", "quantity", "qty"], { requireNumeric: true }),
  rule("product", "retail", ["product", "product_name", "item", "item_name"]),
  rule("sku", "retail", ["sku", "product_code", "item_code"]),
  rule("category", "retail", ["category", "department"]),
  rule("inventory_on_hand", "retail", ["inventory_on_hand", "stock_on_hand", "stock", "inventory"], { requireNumeric: true }),
  rule("inventory_value", "retail", ["inventory_value", "stock_value"], { requireNumeric: true }),
  rule("unit_cost", "retail", ["unit_cost", "product_cost", "cost_price"], { requireNumeric: true }),
  rule("selling_price", "retail", ["selling_price", "retail_price", "unit_price"], { requireNumeric: true }),
  rule("discount", "retail", ["discount", "discount_amount"], { requireNumeric: true }),
  rule("return", "retail", ["return_status", "returned", "return_amount"]),
  rule("reorder_point", "retail", ["reorder_point", "reorder_level"], { requireNumeric: true }),
  rule("revenue", "profitability", ["revenue", "income", "subscription_revenue"], { contextualAliases: ["sales", "net_sales", "total_sales"], requireNumeric: true, rejectDomains: ["accountancy", "prebookkeeping", "marketplace"] }),
  rule("cogs", "profitability", ["cogs", "cost_of_goods_sold", "cost_of_goods", "cost_of_sales", "direct_cost", "product_cost"], { requireNumeric: true }),
  rule("gross_profit", "profitability", ["gross_profit", "gross_profit_amount"], { requireNumeric: true }),
  rule("operating_expense", "profitability", ["operating_expense", "operating_expenses", "opex", "sg_a", "sga"], { requireNumeric: true }),
  rule("operating_profit", "profitability", ["operating_profit", "ebit"], { requireNumeric: true }),
  rule("interest_expense", "profitability", ["interest_expense", "interest"], { requireNumeric: true }),
  rule("tax", "profitability", ["tax_expense", "tax", "taxes", "vat"], { requireNumeric: true }),
  rule("net_profit", "profitability", ["net_profit", "net_income", "profit"], { requireNumeric: true }),
  rule("debit", "accountancy", ["debit"], { requireNumeric: true }),
  rule("credit", "accountancy", ["credit"], { requireNumeric: true }),
  rule("account", "accountancy", ["account", "account_name", "ledger_account"]),
  rule("account_code", "accountancy", ["account_code", "account_number"]),
  rule("journal_date", "accountancy", ["journal_date", "transaction_date", "posted_date"], { requireDate: true }),
  rule("description", "accountancy", ["description", "memo", "narrative"]),
  rule("opening_balance", "accountancy", ["opening_balance"], { requireNumeric: true }),
  rule("closing_balance", "accountancy", ["closing_balance"], { requireNumeric: true }),
  rule("gmv", "marketplace", ["gmv", "gross_merchandise_value"], { requireNumeric: true }),
  rule("marketplace_revenue", "marketplace", ["marketplace_revenue", "platform_fee", "take_rate_amount"], { requireNumeric: true }),
  rule("merchant_payout", "marketplace", ["merchant_payout", "seller_payout", "payout"], { requireNumeric: true }),
  rule("refund", "marketplace", ["refund", "refund_amount", "return_amount"], { requireNumeric: true }),
  rule("commission", "marketplace", ["commission", "take_rate", "platform_commission"], { requireNumeric: true }),
  rule("customer", "marketplace", ["buyer", "buyer_id", "customer", "customer_id"]),
  rule("merchant", "marketplace", ["seller", "seller_id", "merchant", "merchant_id", "vendor_id"]),
  rule("product_category", "marketplace", ["product_category", "category"]),
  rule("mrr", "saas", ["mrr", "monthly_recurring_revenue"], { requireNumeric: true }),
  rule("arr", "saas", ["arr", "annual_recurring_revenue"], { requireNumeric: true }),
  rule("subscription_revenue", "saas", ["subscription_revenue", "recurring_revenue", "billing_amount"], { requireNumeric: true }),
  rule("new_mrr", "saas", ["new_mrr"], { requireNumeric: true }),
  rule("expansion_mrr", "saas", ["expansion_mrr", "upsell_mrr"], { requireNumeric: true }),
  rule("contraction_mrr", "saas", ["contraction_mrr", "downsell_mrr"], { requireNumeric: true }),
  rule("churned_mrr", "saas", ["churned_mrr", "churn_mrr"], { requireNumeric: true }),
  rule("active_customers", "saas", ["active_customers", "subscriber_count"], { requireNumeric: true }),
  rule("new_customers", "saas", ["new_customers", "new_customer_count"], { requireNumeric: true }),
  rule("churned_customers", "saas", ["churned_customers", "churned_customer_count"], { requireNumeric: true }),
  rule("customer_churn_rate", "saas", ["customer_churn_rate", "churn_rate"], { requireNumeric: true }),
  rule("revenue_churn_rate", "saas", ["revenue_churn_rate"], { requireNumeric: true }),
  rule("burn", "saas", ["burn", "burn_rate", "cash_burn"], { requireNumeric: true }),
  rule("cash_balance", "saas", ["cash_balance", "cash"], { requireNumeric: true }),
  rule("runway", "saas", ["runway", "runway_months"], { requireNumeric: true }),
  rule("arpu", "saas", ["arpu", "arpa", "average_revenue_per_user"], { requireNumeric: true }),
  rule("portfolio_company", "investor", ["portfolio_company", "portfolio_company_id", "company_id", "company_name", "company"]),
  rule("portfolio_company_annual_revenue", "investor", ["annual_revenue", "portfolio_company_revenue", "company_revenue", "portfolio_company_annual_revenue"], { requireNumeric: true }),
  rule("invested_amount", "investor", ["invested_amount", "investment_amount", "invested_capital", "capital_deployed"], { requireNumeric: true }),
  rule("latest_valuation", "investor", ["latest_valuation", "current_valuation", "portfolio_company_valuation", "company_valuation", "valuation"], { requireNumeric: true }),
  rule("ownership_percent", "investor", ["ownership_percent", "ownership", "stake_percent", "equity_percent"], { requireNumeric: true }),
  rule("sector", "investor", ["sector", "industry"]),
  rule("stage", "investor", ["stage", "investment_stage", "company_stage"]),
]

const ambiguousFinancialNames = new Set(["amount", "total", "value", "balance", "net", "gross"])

export function buildBusinessSemanticProfile(input: SemanticDatasetInput): SemanticProfile {
  const columns = unique(input.columns.filter(Boolean))
  const rows = input.rows ?? []
  const classification = classifyBusinessDataset(input)
  const mappings = mapColumnsToConcepts({
    columns,
    rows,
    datasetType: classification.datasetType,
    sourceFile: input.fileName ?? input.datasetName ?? null,
    userMappings: input.userMappings,
  })
  const confirmed = mappings.filter((mapping) => mapping.status === "confirmed")
  const ambiguities = mappings
    .filter((mapping) => mapping.status === "ambiguous")
    .map((mapping): SemanticAmbiguity => ({
      sourceColumn: mapping.sourceColumn,
      candidateConcepts: [mapping.concept, ...mapping.alternatives.map((alternative) => alternative.concept)],
      reason: mapping.warnings[0] || "Column has more than one plausible business meaning.",
      severity: "WARNING",
    }))
  const lineage = confirmed.map((mapping): LineageRecord => ({
    sourceFile: input.fileName ?? input.datasetName ?? null,
    sourceColumn: mapping.sourceColumn,
    concept: mapping.concept,
    transformation: "source_column_mapping",
    rowScope: metricRowScope(mapping.concept),
    confidence: mapping.confidence,
  }))
  const contradictions = detectContradictions({ columns, rows, mappings, datasetType: classification.datasetType })
  const metricPermissions = formulaRegistry.map((definition) =>
    metricPermission(definition, confirmed, classification.datasetType, lineage, contradictions),
  )
  const missingEvidence = metricPermissions
    .filter((permission) => permission.missingConcepts.length > 0)
    .map((permission) => ({
      metric: permission.metric,
      missingConcepts: permission.missingConcepts,
      reasonCode: permission.reasonCode,
    }))
  const profile: SemanticProfile = {
    version: BUSINESS_SEMANTIC_PROFILE_VERSION,
    datasetId: input.datasetId,
    datasetType: classification.datasetType,
    classification,
    classificationConfidence: classification.confidence,
    concepts: mappings,
    availableMetrics: metricPermissions.filter((permission) => permission.status === "AVAILABLE"),
    blockedMetrics: metricPermissions.filter((permission) => permission.status === "BLOCKED" || permission.status === "NOT_APPLICABLE"),
    ambiguousMetrics: metricPermissions.filter((permission) => permission.status === "AMBIGUOUS" || permission.status === "PARTIAL"),
    ambiguities,
    contradictions,
    missingEvidence,
    lineage,
    warnings: [
      ...classification.warnings.map((message): SemanticWarning => ({ code: "CLASSIFICATION_WARNING", message, severity: "WARNING" })),
      ...ambiguities.map((ambiguity): SemanticWarning => ({ code: "AMBIGUOUS_MAPPING", message: ambiguity.reason, severity: "WARNING" })),
    ],
    formulas: formulaRegistry,
    diagnostics: {
      columnCount: columns.length,
      rowCount: rows.length,
      confirmedConceptCount: confirmed.length,
      ambiguousConceptCount: mappings.length - confirmed.length,
      generatedAt: new Date().toISOString(),
    },
  }

  traceSemanticProfile(profile)
  return profile
}

export function combineBusinessSemanticProfiles(inputs: MultiFileSemanticInput[]): SemanticProfile {
  const profiles = inputs.map((input) => buildBusinessSemanticProfile(input))
  const first = profiles[0]
  if (!first) {
    return buildBusinessSemanticProfile({ datasetId: "empty_multi_file_profile", columns: [], rows: [] })
  }

  const contradictions: SemanticIssue[] = []
  const datasetTypes = unique(profiles.map((profile) => profile.datasetType))
  if (datasetTypes.length > 1) {
    contradictions.push({
      code: "INCOMPATIBLE_DATASET_TYPES",
      severity: "BLOCKING",
      message: "Uploaded files classify into incompatible semantic domains.",
      affectedConcepts: [],
      evidence: datasetTypes,
    })
  }

  const currencies = unique(inputs.flatMap((input) => currencyValues(input)))
  if (currencies.length > 1) {
    contradictions.push({
      code: "POSSIBLE_INCOMPATIBLE_CURRENCIES",
      severity: "BLOCKING",
      message: "Merged profile contains multiple currency columns and requires explicit currency compatibility.",
      affectedConcepts: ["currency"],
      evidence: currencies,
    })
  }

  const mergedColumns = unique(inputs.flatMap((input) => input.columns))
  const mergedRows = inputs.flatMap((input) => input.rows ?? [])
  const profile = buildBusinessSemanticProfile({
    datasetId: first.datasetId,
    datasetType: contradictions.length > 0 ? "standard" : first.datasetType,
    businessModel: first.datasetType,
    fileName: inputs.map((input) => input.fileName).filter(Boolean).join(" + "),
    columns: mergedColumns,
    rows: mergedRows,
  })

  return {
    ...profile,
    contradictions: [...profile.contradictions, ...contradictions],
    lineage: [
      ...profile.lineage,
      ...profiles.flatMap((sourceProfile) =>
        sourceProfile.lineage.map((lineage) => ({ ...lineage, transformation: "merge" as const })),
      ),
    ],
  }
}

export function conceptColumn(profile: SemanticProfile, concept: BusinessConcept): string | null {
  return profile.concepts.find((mapping) => mapping.concept === concept && mapping.status === "confirmed")?.sourceColumn ?? null
}

export function metricStatus(profile: SemanticProfile, metric: string): SemanticKpiStatus {
  return (
    profile.availableMetrics.find((permission) => permission.metric === metric)?.status ??
    profile.ambiguousMetrics.find((permission) => permission.metric === metric)?.status ??
    profile.blockedMetrics.find((permission) => permission.metric === metric)?.status ??
    "BLOCKED"
  )
}

export function buildBusinessSemanticPromptBlock(profile: SemanticProfile): string {
  const available = profile.availableMetrics.map((metric) => metric.metric).join(", ") || "none"
  const blocked = profile.blockedMetrics
    .filter((metric) => metric.status === "BLOCKED")
    .map((metric) => `${metric.metric}: ${metric.reasonCode}`)
    .join("; ") || "none"
  const ambiguous = profile.ambiguities
    .map((ambiguity) => `${ambiguity.sourceColumn}: ${ambiguity.candidateConcepts.join(" or ")}`)
    .join("; ") || "none"

  return `\nAUTHORITATIVE BUSINESS SEMANTIC PROFILE\nSemantic profile version: ${profile.version}\nDataset type: ${profile.datasetType} (${profile.classificationConfidence})\nRule: no semantic evidence means no metric; no metric evidence means no business claim.\n${profile.datasetType === 'investor' ? 'Note: Revenue refers to combined annual revenue of portfolio companies.\n' : ''}Available metrics: ${available}\nBlocked metrics: ${blocked}\nAmbiguous mappings: ${ambiguous}\nThe assistant must explain only metrics marked available by this deterministic profile and must not override blocked or ambiguous metric restrictions.\n`
}

export function profileSupportsMetric(profile: SemanticProfile, metric: string): boolean {
  return profile.availableMetrics.some((permission) => permission.metric === metric && permission.status === "AVAILABLE")
}

export function normalizeBusinessSemanticDatasetType(value?: string | null): BusinessSemanticDatasetType | null {
    const normalized = normalizeName(value ?? "")
    if (!normalized) return null
    if (normalized === "retail" || normalized === "local_retail" || normalized === "ecommerce") return "retail"
    if (normalized === "profitability" || normalized === "profitability_pnl") return "profitability"
    if (normalized === "accountancy" || normalized === "accounting") return "accountancy"
    if (normalized === "prebookkeeping" || normalized === "pre_bookkeeping") return "prebookkeeping"
    if (normalized === "marketplace" || normalized === "marketplace_startup") return "marketplace"
    if (normalized === "saas" || normalized === "saas_startup" || normalized === "startup") return "saas"
    if (normalized === "standard" || normalized === "generic" || normalized === "generic_business_data") return "standard"
    if (normalized === "investor" || normalized === "investment" || normalized === "portfolio" || normalized === "investor_portfolio" || normalized === "vc" || normalized === "private_equity") return "investor"
    return null
}

function classifyBusinessDataset(input: SemanticDatasetInput): SemanticClassification {
  const explicit = normalizeBusinessSemanticDatasetType(input.datasetType)
  const explicitBusinessModel = normalizeBusinessSemanticDatasetType(input.businessModel)
  const text = [input.fileName, input.datasetName, ...input.columns].filter(Boolean).join(" ")
  const normalizedText = normalizeName(text)
  const scores = new Map<BusinessSemanticDatasetType, { score: number; evidence: string[] }>()
  const add = (type: BusinessSemanticDatasetType, score: number, evidence: string) => {
    const current = scores.get(type) ?? { score: 0, evidence: [] }
    current.score += score
    current.evidence.push(evidence)
    scores.set(type, current)
  }

  if (explicit && explicit !== "standard") add(explicit, 6, `Explicit dataset type is ${explicit}.`)
  if (explicitBusinessModel && explicitBusinessModel !== "standard") add(explicitBusinessModel, 4, `Business model signal is ${explicitBusinessModel}.`)
  if (hasAll(input.columns, ["debit", "credit"]) && /account|ledger|journal/.test(normalizedText)) add("accountancy", 8, "Debit, credit, and account/journal evidence detected.")
  if (/prebookkeeping|invoice|receipt|bank_statement/.test(normalizedText)) add("prebookkeeping", 5, "Pre-bookkeeping upload terminology detected.")
  if (/profitability|operating_expense|opex|gross_profit|net_profit|cogs/.test(normalizedText)) add("profitability", 5, "Profitability statement terminology detected.")
  if (/gmv|gross_merchandise|commission|take_rate|seller_payout|merchant_payout|marketplace/.test(normalizedText)) add("marketplace", 6, "Marketplace transaction terminology detected.")
  if (/mrr|arr|subscription|recurring|churn|runway|cash_burn|active_customers/.test(normalizedText)) add("saas", 6, "SaaS/subscription terminology detected.")
  if (/sku|stock|inventory|reorder|store|branch|pos|unit_cost/.test(normalizedText)) add("retail", 5, "Retail inventory or point-of-sale terminology detected.")
  const hasInvestorPortfolioSignal = /investor|investment|portfolio|investment_date|invested_amount|capital_deployed|latest_valuation|ownership|stake|portfolio_company|company_id/.test(normalizedText)
  const hasInvestorFinancialSignal = /annual_revenue|valuation|sector|stage/.test(normalizedText)
  if (hasInvestorPortfolioSignal && (hasInvestorFinancialSignal || explicit === "investor" || explicitBusinessModel === "investor")) {
    add("investor", 6, "Investor portfolio terminology detected.")
  }
  if (/revenue|sales|customer|date|product/.test(normalizedText)) add("standard", 2, "General business columns detected.")

  const ranked = Array.from(scores.entries())
    .map(([datasetType, data]) => ({ datasetType, ...data }))
    .sort((a, b) => b.score - a.score)
  const best = ranked[0] ?? { datasetType: explicit ?? "standard", score: explicit ? 4 : 1, evidence: explicit ? [`Explicit dataset type is ${explicit}.`] : ["No strong domain signal was detected."] }
  const competingClassifications = ranked.slice(1, 4).map((item) => ({
    datasetType: item.datasetType,
    score: item.score,
    confidence: confidenceFromScore(item.score),
    evidence: item.evidence,
  }))
  const warnings: string[] = []
  if (best.score < 4) warnings.push("Classification confidence is low; domain-specific KPIs require stronger semantic evidence.")
  if (competingClassifications[0] && best.score - competingClassifications[0].score <= 1) {
    warnings.push(`Competing ${competingClassifications[0].datasetType} classification is close to the selected domain.`)
  }

  return {
    datasetType: best.score < 4 && !explicit ? "standard" : best.datasetType,
    confidence: confidenceFromScore(best.score),
    score: best.score,
    evidence: best.evidence,
    competingClassifications,
    warnings,
    reason: best.evidence.join(" "),
  }
}

function mapColumnsToConcepts(input: {
  columns: string[]
  rows: Record<string, unknown>[]
  datasetType: BusinessSemanticDatasetType
  sourceFile: string | null
  userMappings?: Partial<Record<BusinessConcept, string>>
}): SemanticColumnMapping[] {
  const mappings: SemanticColumnMapping[] = []
  const byColumn = input.columns.map((sourceColumn) => ({ sourceColumn, normalized: normalizeName(sourceColumn) }))
  for (const column of byColumn) {
    if (ambiguousFinancialNames.has(column.normalized) && isMostlyNumeric(input.rows, column.sourceColumn)) {
      mappings.push(ambiguousMapping(column.sourceColumn, "amount", [
        "revenue",
        "cogs",
        "operating_expense",
        "refund",
        "merchant_payout",
      ]))
      continue
    }

    const candidates = conceptRules
      .filter((rule) => ruleMatchesColumn(rule, column.normalized, input.rows, column.sourceColumn))
      .filter((rule) => !rule.rejectDomains?.includes(input.datasetType))
      .map((rule) => ({
        rule,
        exact: rule.aliases.some((alias) => normalizeName(alias) === column.normalized),
        contextual: rule.contextualAliases?.some((alias) => normalizeName(alias) === column.normalized) ?? false,
      }))

    const explicitConcept = Object.entries(input.userMappings ?? {}).find(([, mappedColumn]) => mappedColumn === column.sourceColumn)?.[0] as BusinessConcept | undefined
    if (explicitConcept) {
      mappings.push({
        sourceColumn: column.sourceColumn,
        concept: explicitConcept,
        domain: "general",
        confidence: "HIGH",
        mappingMethod: "profile_metadata",
        evidence: [`User-provided mapping assigns ${column.sourceColumn} to ${explicitConcept}.`],
        status: "confirmed",
        alternatives: [],
        warnings: [],
      })
      continue
    }

    const domainCandidates = candidates.filter((candidate) => candidate.rule.domain === input.datasetType || candidate.rule.domain === "general")
    const ranked = (domainCandidates.length > 0 ? domainCandidates : candidates).sort((a, b) => scoreCandidate(b, input.datasetType) - scoreCandidate(a, input.datasetType))
    const best = ranked[0]
    if (!best) continue

    const alternatives = ranked
      .slice(1, 4)
      .map((candidate) => ({
        concept: candidate.rule.concept,
        domain: candidate.rule.domain,
        confidence: confidenceFromScore(scoreCandidate(candidate, input.datasetType)),
        reason: `${column.sourceColumn} also matches ${candidate.rule.concept}.`,
      }))
    const closeAlternative = ranked[1] && scoreCandidate(best, input.datasetType) - scoreCandidate(ranked[1], input.datasetType) <= 1
    const status: SemanticMappingStatus = closeAlternative ? "ambiguous" : "confirmed"
    mappings.push({
      sourceColumn: column.sourceColumn,
      concept: best.rule.concept,
      domain: best.rule.domain,
      confidence: closeAlternative ? "MEDIUM" : confidenceFromScore(scoreCandidate(best, input.datasetType)),
      mappingMethod: best.exact ? "exact_alias" : best.contextual ? "contextual_alias" : "normalized_alias",
      evidence: [
        `${column.sourceColumn} matches ${best.rule.concept} alias rules.`,
        `Dataset classification is ${input.datasetType}.`,
      ],
      status,
      alternatives,
      warnings: closeAlternative ? [`${column.sourceColumn} has competing semantic meanings and requires review before metric use.`] : [],
    })
  }

  return dedupeConceptMappings(mappings, input.datasetType)
}

function metricPermission(
  definition: FormulaDefinition,
  mappings: SemanticColumnMapping[],
  datasetType: BusinessSemanticDatasetType,
  lineage: LineageRecord[],
  contradictions: SemanticIssue[],
): MetricPermission {
  if (definition.domainRestrictions && !definition.domainRestrictions.includes(datasetType)) {
    return {
      metric: definition.metric,
      status: "NOT_APPLICABLE",
      reasonCode: "DOMAIN_NOT_APPLICABLE",
      requiredConcepts: definition.requiredConcepts,
      missingConcepts: [],
      evidence: [`${definition.metric} does not apply to ${datasetType} datasets.`],
      confidence: "HIGH",
      formulaId: definition.id,
      lineage: [],
    }
  }

  const availableConcepts = new Set(mappings.map((mapping) => mapping.concept))
  const missingConcepts = definition.requiredConcepts.filter((concept) => !availableConcepts.has(concept))
  const blocking = contradictions.find((issue) =>
    issue.severity === "BLOCKING" && issue.affectedConcepts.some((concept) => definition.requiredConcepts.includes(concept)),
  )
  if (blocking) {
    return {
      metric: definition.metric,
      status: "BLOCKED",
      reasonCode: blocking.code,
      requiredConcepts: definition.requiredConcepts,
      missingConcepts,
      evidence: blocking.evidence,
      confidence: "LOW",
      formulaId: definition.id,
      lineage: [],
    }
  }
  if (missingConcepts.length > 0) {
    return {
      metric: definition.metric,
      status: "BLOCKED",
      reasonCode: "MISSING_REQUIRED_EVIDENCE",
      requiredConcepts: definition.requiredConcepts,
      missingConcepts,
      evidence: [`Missing concepts: ${missingConcepts.join(", ")}.`],
      confidence: "HIGH",
      formulaId: definition.id,
      lineage: [],
    }
  }

  return {
    metric: definition.metric,
    status: "AVAILABLE",
    reasonCode: "SEMANTIC_EVIDENCE_AVAILABLE",
    requiredConcepts: definition.requiredConcepts,
    missingConcepts: [],
    evidence: definition.requiredConcepts.map((concept) => `${concept} is mapped from source data.`),
    confidence: mappings.some((mapping) => definition.requiredConcepts.includes(mapping.concept) && mapping.confidence !== "HIGH") ? "MEDIUM" : "HIGH",
    formulaId: definition.id,
    lineage: lineage.filter((record) => definition.requiredConcepts.includes(record.concept)),
  }
}

function detectContradictions(input: {
  columns: string[]
  rows: Record<string, unknown>[]
  mappings: SemanticColumnMapping[]
  datasetType: BusinessSemanticDatasetType
}): SemanticIssue[] {
  const issues: SemanticIssue[] = []
  const confirmed = input.mappings.filter((mapping) => mapping.status === "confirmed")
  const mappedConcepts = new Set(confirmed.map((mapping) => mapping.concept))
  if ((input.datasetType === "accountancy" || input.datasetType === "prebookkeeping") && (mappedConcepts.has("revenue") || mappedConcepts.has("net_profit"))) {
    issues.push({
      code: "LEDGER_PNL_LEAKAGE",
      severity: "BLOCKING",
      message: "Ledger debit/credit structures cannot be interpreted as profitability metrics without account classification.",
      affectedConcepts: ["revenue", "gross_profit", "operating_profit", "net_profit"],
      evidence: input.columns,
    })
  }
  if (input.datasetType === "marketplace" && mappedConcepts.has("gmv") && mappedConcepts.has("revenue")) {
    issues.push({
      code: "GMV_REVENUE_CONFLATION",
      severity: "BLOCKING",
      message: "Marketplace GMV is not company revenue unless a separate marketplace revenue concept is mapped.",
      affectedConcepts: ["gmv", "revenue", "marketplace_revenue"],
      evidence: confirmed.filter((mapping) => mapping.concept === "gmv" || mapping.concept === "revenue").map((mapping) => mapping.sourceColumn),
    })
  }
  const currencyColumn = confirmed.find((mapping) => mapping.concept === "currency")?.sourceColumn
  if (currencyColumn) {
    const currencies = unique(input.rows.map((row) => String(row[currencyColumn] ?? "").trim().toUpperCase()).filter((value) => /^[A-Z]{3}$/.test(value)))
    if (currencies.length > 1) {
      issues.push({
        code: "INCOMPATIBLE_CURRENCIES",
        severity: "BLOCKING",
        message: "Dataset contains multiple currency codes and needs currency normalization before money KPIs are reliable.",
        affectedConcepts: ["currency", "revenue", "cogs", "operating_expense", "gmv", "marketplace_revenue"],
        evidence: currencies,
      })
    }
  }
  const mrrColumn = confirmed.find((mapping) => mapping.concept === "mrr")?.sourceColumn
  const arrColumn = confirmed.find((mapping) => mapping.concept === "arr")?.sourceColumn
  if (mrrColumn && arrColumn) {
    const inconsistent = input.rows.slice(0, 100).some((row) => {
      const mrr = numericValue(row[mrrColumn])
      const arr = numericValue(row[arrColumn])
      return mrr !== null && arr !== null && mrr !== 0 && Math.abs(arr - mrr * 12) / Math.abs(mrr * 12) > 0.05
    })
    if (inconsistent) {
      issues.push({
        code: "ARR_MRR_RELATIONSHIP_CONFLICT",
        severity: "WARNING",
        message: "ARR and MRR values do not consistently follow ARR = MRR x 12.",
        affectedConcepts: ["arr", "mrr"],
        evidence: [mrrColumn, arrColumn],
      })
    }
  }
  return issues
}

function formula(
  id: string,
  metric: string,
  expression: string,
  requiredConcepts: BusinessConcept[],
  domainRestrictions?: BusinessSemanticDatasetType[],
  aggregation: FormulaDefinition["aggregation"] = "sum",
): FormulaDefinition {
  return { id, metric, expression, requiredConcepts, domainRestrictions, aggregation }
}

function rule(
  concept: BusinessConcept,
  domain: BusinessSemanticDomain,
  aliases: string[],
  options: Omit<ConceptRule, "concept" | "domain" | "aliases"> = {},
): ConceptRule {
  return { concept, domain, aliases, ...options }
}

function ruleMatchesColumn(rule: ConceptRule, normalizedColumn: string, rows: Record<string, unknown>[], sourceColumn: string) {
  const aliases = [...rule.aliases, ...(rule.contextualAliases ?? [])].map(normalizeName)
  const aliasMatch = aliases.some((alias) => normalizedColumn === alias || normalizedColumn.includes(alias))
  if (!aliasMatch) return false
  if (rule.requireNumeric && !isMostlyNumeric(rows, sourceColumn)) return false
  if (rule.requireDate && rows.length > 0 && !isMostlyDate(rows, sourceColumn)) return false
  return true
}

function scoreCandidate(candidate: { rule: ConceptRule; exact: boolean; contextual: boolean }, datasetType: BusinessSemanticDatasetType) {
  let score = candidate.exact ? 8 : candidate.contextual ? 5 : 4
  if (candidate.rule.domain === datasetType) score += 3
  if (candidate.rule.domain === "general") score += 1
  return score
}

function ambiguousMapping(sourceColumn: string, concept: BusinessConcept, alternatives: BusinessConcept[]): SemanticColumnMapping {
  return {
    sourceColumn,
    concept,
    domain: "general",
    confidence: "LOW",
    mappingMethod: "normalized_alias",
    evidence: [`${sourceColumn} is a generic financial label without enough business context.`],
    status: "ambiguous",
    alternatives: alternatives.map((alternative) => ({
      concept: alternative,
      domain: "general",
      confidence: "LOW",
      reason: `${sourceColumn} can mean ${alternative} in different business domains.`,
    })),
    warnings: [`${sourceColumn} is ambiguous and must not be used as revenue, cost, or profit without stronger evidence.`],
  }
}

function dedupeConceptMappings(mappings: SemanticColumnMapping[], datasetType: BusinessSemanticDatasetType) {
  const byConcept = new Map<BusinessConcept, SemanticColumnMapping[]>()
  for (const mapping of mappings) {
    byConcept.set(mapping.concept, [...(byConcept.get(mapping.concept) ?? []), mapping])
  }

  return mappings.map((mapping) => {
    const duplicates = byConcept.get(mapping.concept) ?? []
    if (duplicates.length <= 1 || mapping.status !== "confirmed") return mapping
    const best = duplicates
      .filter((candidate) => candidate.status === "confirmed")
      .sort((a, b) => confidenceScore(b.confidence) - confidenceScore(a.confidence))[0]
    if (best?.sourceColumn === mapping.sourceColumn) return mapping
    return {
      ...mapping,
      status: "ambiguous" as const,
      warnings: [`Multiple columns map to ${mapping.concept}; downstream metrics require one authoritative source.`],
      alternatives: duplicates
        .filter((candidate) => candidate.sourceColumn !== mapping.sourceColumn)
        .map((candidate) => ({
          concept: candidate.concept,
          domain: candidate.domain,
          confidence: candidate.confidence,
          reason: `${candidate.sourceColumn} also maps to ${candidate.concept} in ${datasetType}.`,
        })),
    }
  })
}

function traceSemanticProfile(profile: SemanticProfile) {
  debugLog("[BUSINESS SEMANTICS]", {
    version: profile.version,
    datasetId: profile.datasetId,
    datasetType: profile.datasetType,
    classificationConfidence: profile.classificationConfidence,
    confirmedConcepts: profile.diagnostics.confirmedConceptCount,
    ambiguousConcepts: profile.diagnostics.ambiguousConceptCount,
    availableMetrics: profile.availableMetrics.map((metric) => metric.metric),
    blockedMetrics: profile.blockedMetrics.filter((metric) => metric.status === "BLOCKED").map((metric) => metric.metric),
    contradictions: profile.contradictions.map((issue) => issue.code),
  })
}

function currencyValues(input: MultiFileSemanticInput) {
  const currencyColumn = input.columns.find((column) => normalizeName(column) === "currency" || normalizeName(column) === "currency_code" || normalizeName(column) === "iso_currency")
  if (!currencyColumn) return []
  return unique((input.rows ?? [])
    .map((row) => String(row[currencyColumn] ?? "").trim().toUpperCase())
    .filter((value) => /^[A-Z]{3}$/.test(value)))
}

function metricRowScope(concept: BusinessConcept): LineageRecord["rowScope"] {
  if (["mrr", "arr", "active_customers", "cash_balance", "runway"].includes(concept)) return "latest_period"
  return "all_rows"
}

function confidenceFromScore(score: number): BusinessSemanticConfidence {
  if (score >= 8) return "HIGH"
  if (score >= 4) return "MEDIUM"
  return "LOW"
}

function confidenceScore(confidence: BusinessSemanticConfidence) {
  if (confidence === "HIGH") return 3
  if (confidence === "MEDIUM") return 2
  return 1
}

function hasAll(columns: string[], required: string[]) {
  const names = new Set(columns.map(normalizeName))
  return required.every((column) => names.has(column))
}

function isMostlyNumeric(rows: Record<string, unknown>[], column: string) {
  if (rows.length === 0) return true
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "")
  if (values.length === 0) return false
  const numeric = values.filter((value) => numericValue(value) !== null).length
  return numeric / values.length >= 0.6
}

function isMostlyDate(rows: Record<string, unknown>[], column: string) {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "")
  if (values.length === 0) return false
  const valid = values.filter((value) => !Number.isNaN(Date.parse(String(value)))).length
  return valid / values.length >= 0.5
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const negative = /^\(.*\)$/.test(trimmed)
  const parsed = Number.parseFloat(trimmed.replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(parsed)) return null
  return negative ? -Math.abs(parsed) : parsed
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s.-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}
