export type DatasetSourceType = "csv" | "excel" | "pdf" | "image" | "sql" | "snowflake" | "api" | "unknown";

export type SemanticBusinessModel =
  | "Retail"
  | "Marketplace"
  | "POS"
  | "Inventory"
  | "Accounting"
  | "CRM"
  | "SaaS"
  | "Manufacturing"
  | "Healthcare"
  | "Finance"
  | "HR"
  | "Generic";

export type CanonicalSemanticRole =
  | "Revenue"
  | "GMV"
  | "Marketplace Revenue"
  | "Commission"
  | "Cost"
  | "Merchant Payout"
  | "Refund"
  | "Profit"
  | "Margin"
  | "Customer"
  | "Company"
  | "Users"
  | "Price per User"
  | "Merchant"
  | "Seller"
  | "Buyer"
  | "Product"
  | "Product Category"
  | "Category"
  | "Geography"
  | "Country"
  | "Region"
  | "City"
  | "Date"
  | "Quantity"
  | "Currency"
  | "SKU"
  | "Invoice"
  | "Order"
  | "Email"
  | "Phone"
  | "UUID"
  | "Boolean"
  | "Percentage"
  | "Status"
  | "Employee"
  | "Account"
  | "Metric"
  | "Text"
  | "Unknown";

export type SemanticValueType =
  | "Money"
  | "Percentage"
  | "Date"
  | "Country"
  | "City"
  | "Currency"
  | "SKU"
  | "Invoice"
  | "Customer"
  | "Email"
  | "Phone"
  | "UUID"
  | "Boolean"
  | "Number"
  | "Text"
  | "Empty";

export type KpiFormat = "currency" | "number" | "percentage";

export interface ConfidenceEvidence {
  signal: string;
  weight: number;
  explanation: string;
}

export interface FileStructureScan {
  sourceType: DatasetSourceType;
  encoding: string;
  delimiter: string | null;
  workbook: {
    detected: boolean;
    sheets: string[];
  };
  mergedCells: "none" | "detected" | "unknown";
  hiddenRows: "none" | "detected" | "unknown";
  emptyRegions: Array<{ rowStart: number; rowEnd: number; columnStart: number; columnEnd: number }>;
  headerRow: number;
  dataStartRow: number;
  confidence: number;
  explanations: string[];
}

export interface SemanticColumnScan {
  columnName: string;
  normalizedName: string;
  canonicalRole: CanonicalSemanticRole;
  valueTypes: SemanticValueType[];
  primaryValueType: SemanticValueType;
  confidence: number;
  nullable: boolean;
  uniqueValues: number;
  sampleValues: string[];
  evidence: ConfidenceEvidence[];
  explanation: string;
}

export interface RelationshipDetection {
  id: string;
  label: string;
  kind: "formula" | "dependency" | "ratio" | "identity";
  confidence: number;
  leftRole: CanonicalSemanticRole;
  outputRole: CanonicalSemanticRole;
  inputRoles: CanonicalSemanticRole[];
  columns: string[];
  formula: string;
  explanation: string;
}

export interface BusinessModelDetection {
  model: SemanticBusinessModel;
  confidence: number;
  evidence: ConfidenceEvidence[];
  alternatives: Array<{ model: SemanticBusinessModel; confidence: number }>;
  explanation: string;
}

export type SaasProfileId =
  | "subscription_mrr_movements"
  | "subscription_snapshot"
  | "transactional_saas"
  | "customer_cohort"
  | "saas_financial"
  | "hybrid_saas"
  | "generic_saas";

export type SaasCanonicalConcept =
  | "period"
  | "movement_event_date"
  | "customer_id"
  | "customer_count"
  | "subscription_id"
  | "company"
  | "plan"
  | "subscription_status"
  | "users"
  | "active_users"
  | "seats_before"
  | "seats"
  | "licenses"
  | "price_per_user"
  | "unit_price"
  | "revenue"
  | "subscription_revenue"
  | "mrr"
  | "mrr_before"
  | "mrr_after"
  | "mrr_delta"
  | "movement_type"
  | "arr"
  | "expansion_mrr"
  | "contraction_mrr"
  | "cost"
  | "profit"
  | "profit_margin"
  | "cac"
  | "ltv"
  | "new_customers"
  | "churned_customers"
  | "churn_rate"
  | "churn"
  | "retention"
  | "burn"
  | "cash_balance"
  | "runway"
  | "channel"
  | "country"
  | "region"
  | "startup_stage";

export type SaasCapabilityId =
  | "revenue_analysis"
  | "profitability"
  | "unit_economics"
  | "plan_performance"
  | "customer_analysis"
  | "subscription_metrics"
  | "mrr_analysis"
  | "arr_analysis"
  | "churn_analysis"
  | "retention_analysis"
  | "cac_analysis"
  | "ltv_analysis"
  | "growth_analysis"
  | "cohort_analysis"
  | "channel_analysis"
  | "geography_analysis"
  | "startup_stage_analysis"
  | "cash_analysis"
  | "burn_analysis"
  | "runway_analysis";

export interface SaasCapabilityDetail {
  id: SaasCapabilityId;
  available: boolean;
  confidence: number;
  evidence: string[];
  missingRequirements: string[];
  reason: string;
}

export interface SaasResolvedMetric {
  value: number | null;
  sourceColumns: string[];
  status: "available" | "unavailable";
  reason: string;
}

export interface SaasPeriodComparability {
  periodField: string | null;
  latestPeriod: string | null;
  latestPeriodComparable: boolean;
  reason: string | null;
}

export interface SaasSemanticResolution {
  profile: SaasProfileId;
  confidence: number;
  evidence: ConfidenceEvidence[];
  mappings: Partial<Record<SaasCanonicalConcept, string>>;
  capabilities: {
    recurringRevenue: boolean;
    unitEconomics: boolean;
    cohortRetention: boolean;
    subscriptionLifecycle: boolean;
    financialRunway: boolean;
    segmentation: boolean;
    geography: boolean;
  };
  capabilityDetails: Record<SaasCapabilityId, SaasCapabilityDetail>;
  availableCapabilities: SaasCapabilityId[];
  unavailableCapabilities: Array<Pick<SaasCapabilityDetail, "id" | "reason" | "missingRequirements">>;
  capabilityCoverage: number;
  metrics: Record<string, SaasResolvedMetric>;
  suggestedQuestions: string[];
  periodComparability: SaasPeriodComparability;
  dataGaps: string[];
  explanation: string;
}

export type SaasAssistantSummaryRow = {
  label: string;
  value: number;
  sharePct?: number;
  rows?: number;
  sourceColumns: string[];
};

export type SaasAssistantPeriodRow = {
  period: string;
  mrr: number | null;
  netMovement: number | null;
  activeCustomers: number | null;
  rows: number;
};

export type SaasAssistantSummary = {
  profile: SaasProfileId;
  confidence: number;
  mappings: Partial<Record<SaasCanonicalConcept, string>>;
  metrics: Record<string, SaasResolvedMetric>;
  suggestedQuestions: string[];
  latestPeriod: string | null;
  periodRows: SaasAssistantPeriodRow[];
  planRows: SaasAssistantSummaryRow[];
  customerRows: SaasAssistantSummaryRow[];
  movementRows: SaasAssistantSummaryRow[];
  dataGaps: string[];
};

export interface DynamicKpi {
  id: string;
  title: string;
  value: number | string | null;
  format: KpiFormat;
  sourceColumns: string[];
  confidence: number;
  explanation: string;
}

export interface DynamicDashboardWidget {
  id: string;
  type: "kpi" | "bar" | "line" | "table";
  title: string;
  xAxis?: string;
  yAxis?: string;
  sourceColumns: string[];
  confidence: number;
  explanation: string;
}

export interface DynamicDashboardDefinition {
  businessModel: SemanticBusinessModel;
  kpis: DynamicKpi[];
  widgets: DynamicDashboardWidget[];
  generatedFrom: "semantic-dataset-intelligence-engine";
  generatedAt: string;
}

export interface DatasetIntelligenceEngineResult {
  version: "die.v1";
  generatedAt: string;
  fileStructure: FileStructureScan;
  columns: SemanticColumnScan[];
  relationships: RelationshipDetection[];
  businessModel: BusinessModelDetection;
  saas: SaasSemanticResolution | null;
  kpis: DynamicKpi[];
  dashboard: DynamicDashboardDefinition;
  aiContext: {
    businessModel: BusinessModelDetection;
    saas: SaasSemanticResolution | null;
    semanticColumns: Array<{
      columnName: string;
      canonicalRole: CanonicalSemanticRole;
      primaryValueType: SemanticValueType;
      confidence: number;
      explanation: string;
    }>;
    relationships: RelationshipDetection[];
    kpis: DynamicKpi[];
    confidenceSummary: {
      averageColumnConfidence: number;
      modelConfidence: number;
      lowConfidenceColumns: string[];
    };
    governance: {
      confidence: number;
      evidence: string[];
      calculationSource: "deterministic_dataset_intelligence_engine";
      datasetSource: "selected_dataset_rows";
      providerSource: "none";
      providerDisclosure: "No provider-generated values were used.";
    };
  };
}

export interface DatasetIntelligenceEngineInput {
  rows: Record<string, unknown>[];
  columns?: string[];
  fileName?: string;
  rawText?: string;
  mimeType?: string;
  sheetNames?: string[];
}

type Detector<T> = {
  id: string;
  detect: (input: DatasetIntelligenceEngineInput) => T;
};

const COLUMN_SYNONYMS: Array<{
  role: CanonicalSemanticRole;
  patterns: RegExp[];
  valueTypes?: SemanticValueType[];
  explanation: string;
}> = [
    { role: "GMV", patterns: [/\bgross_merchandise_value\b/, /\bgmv\b/], valueTypes: ["Money", "Number"], explanation: "Column name matches marketplace gross merchandise value terminology." },
    { role: "Marketplace Revenue", patterns: [/\bplatform_fee\b/, /\bmarketplace_revenue\b/, /\btake_rate_amount\b/], valueTypes: ["Money", "Number"], explanation: "Column name matches marketplace platform-fee or take-rate revenue terminology." },
    { role: "Merchant Payout", patterns: [/\bseller_payout\b/, /\bmerchant_payout\b/, /\bpayout\b/], valueTypes: ["Money", "Number"], explanation: "Column name matches merchant or seller payout terminology." },
    { role: "Refund", patterns: [/\brefund_amount\b/, /\brefund\b/, /\breturn_amount\b/], valueTypes: ["Money", "Number"], explanation: "Column name matches refund or return amount terminology." },
    { role: "Revenue", patterns: [/\bsales_amount\b/, /\brevenue\b/, /\bsales\b/, /\border_total\b/, /\bnet_sales\b/, /\bamount\b/], valueTypes: ["Money", "Number"], explanation: "Column name matches revenue, sales, amount, or GMV terminology." },
    { role: "Commission", patterns: [/\bcommission\b/, /\bfee\b/], valueTypes: ["Money", "Number"], explanation: "Column name matches commission or fee terminology." },
    { role: "Cost", patterns: [/\bcost\b/, /\bcogs\b/, /\bexpense\b/, /\bunit_cost\b/], valueTypes: ["Money", "Number"], explanation: "Column name matches cost, COGS, or expense terminology." },
    { role: "Profit", patterns: [/\bprofit\b/, /\bgross_profit\b/, /\bnet_profit\b/, /\bearnings\b/], valueTypes: ["Money", "Number"], explanation: "Column name matches profit or earnings terminology." },
    { role: "Margin", patterns: [/\bmargin\b/, /\bprofit_margin\b/], valueTypes: ["Percentage", "Number"], explanation: "Column name matches margin terminology." },
    { role: "Users", patterns: [/\busers\b/, /\buser_count\b/, /\bseats\b/, /\bseat_count\b/], valueTypes: ["Number"], explanation: "Column name identifies users or seats." },
    { role: "Price per User", patterns: [/\bprice_per_user\b/, /\bprice_per_seat\b/, /\brevenue_per_user\b/, /\barpu\b/, /\barpa\b/], valueTypes: ["Money", "Number"], explanation: "Column name identifies per-user or per-seat pricing." },
    { role: "Company", patterns: [/\bcompany\b/, /\bcompany_name\b/, /\baccount_name\b/, /\borganization\b/, /\borg\b/], valueTypes: ["Text"], explanation: "Column name identifies a company or organization dimension." },
    { role: "Customer", patterns: [/\bbuyer_id\b/, /\bbuyer\b/, /\bpurchaser\b/, /\bcustomer\b/, /\bcustomer_id\b/, /\bclient\b/, /\baccount_id\b/], valueTypes: ["Customer", "Text", "UUID"], explanation: "Column name identifies customers, buyers, purchasers, clients, or accounts." },
    { role: "Merchant", patterns: [/\bseller_id\b/, /\bseller\b/, /\bmerchant\b/, /\bvendor_id\b/], valueTypes: ["Customer", "Text", "UUID"], explanation: "Column name identifies merchants, sellers, or vendors." },
    { role: "Buyer", patterns: [/\bpurchaser_id\b/], valueTypes: ["Customer", "Text", "UUID"], explanation: "Column name identifies buyers or purchasers." },
    { role: "Product", patterns: [/\bproduct\b/, /\bitem\b/, /\blisting\b/, /\bproduct_name\b/], valueTypes: ["Text", "SKU"], explanation: "Column name identifies product, item, or listing entities." },
    { role: "Product Category", patterns: [/\bcategory\b/, /\bproduct_category\b/, /\bsubcategory\b/], valueTypes: ["Text"], explanation: "Column name identifies product category or subcategory." },
    { role: "Category", patterns: [/\bsegment\b/, /\bstartup_stage\b/, /\bplan\b/, /\bchannel\b/, /\bacquisition_channel\b/, /\bdepartment\b/, /\bindustry\b/], valueTypes: ["Text"], explanation: "Column name identifies a business grouping dimension." },
    { role: "Geography", patterns: [/\bcountry\b/, /\bcountry_code\b/, /\bnation\b/], valueTypes: ["Country"], explanation: "Column name identifies geography or country-level location." },
    { role: "Country", patterns: [/\bnation_code\b/], valueTypes: ["Country"], explanation: "Column name identifies country-level geography." },
    { role: "Region", patterns: [/\bregion\b/, /\bterritory\b/, /\bstate\b/, /\bprovince\b/], valueTypes: ["Text"], explanation: "Column name identifies regional geography." },
    { role: "City", patterns: [/\bcity\b/, /\btown\b/], valueTypes: ["City"], explanation: "Column name identifies city-level geography." },
    { role: "Date", patterns: [/\bdate\b/, /\border_date\b/, /\bcreated_at\b/, /\btimestamp\b/, /\bmonth\b/, /\bperiod\b/, /\byear\b/, /\bquarter\b/], valueTypes: ["Date"], explanation: "Column name identifies dates or reporting periods." },
    { role: "Quantity", patterns: [/\bquantity\b/, /\bqty\b/, /\bunits\b/, /\bunit_count\b/, /\bvolume\b/], valueTypes: ["Number"], explanation: "Column name identifies quantity or volume." },
    { role: "Currency", patterns: [/\bcurrency\b/, /\bcurrency_code\b/, /\biso_currency\b/], valueTypes: ["Currency"], explanation: "Column name identifies a currency code." },
    { role: "SKU", patterns: [/\bsku\b/, /\bbarcode\b/, /\bitem_code\b/], valueTypes: ["SKU"], explanation: "Column name identifies SKU or item-code values." },
    { role: "Invoice", patterns: [/\binvoice\b/, /\binvoice_no\b/, /\breceipt\b/], valueTypes: ["Invoice"], explanation: "Column name identifies invoice or receipt references." },
    { role: "Order", patterns: [/\border\b/, /\border_id\b/, /\btransaction\b/, /\btransaction_id\b/], valueTypes: ["Invoice", "UUID", "Text"], explanation: "Column name identifies orders or transactions." },
    { role: "Email", patterns: [/\bemail\b/, /\be_mail\b/], valueTypes: ["Email"], explanation: "Column name identifies email addresses." },
    { role: "Phone", patterns: [/\bphone\b/, /\bmobile\b/, /\btel\b/], valueTypes: ["Phone"], explanation: "Column name identifies phone numbers." },
    { role: "UUID", patterns: [/\buuid\b/, /\bguid\b/], valueTypes: ["UUID"], explanation: "Column name identifies UUID values." },
    { role: "Boolean", patterns: [/\bis_/, /\bhas_/, /\bflag\b/, /\bactive\b/], valueTypes: ["Boolean"], explanation: "Column name identifies a boolean flag." },
    { role: "Percentage", patterns: [/\bpercent\b/, /\bpct\b/, /\brate\b/, /\bratio\b/], valueTypes: ["Percentage", "Number"], explanation: "Column name identifies a rate, ratio, or percentage." },
    { role: "Employee", patterns: [/\bemployee\b/, /\bstaff\b/, /\bworker\b/, /\bheadcount\b/], valueTypes: ["Text", "Number"], explanation: "Column name identifies employee or workforce data." },
    { role: "Account", patterns: [/\baccount\b/, /\bledger\b/, /\bgl_account\b/], valueTypes: ["Text"], explanation: "Column name identifies account or ledger data." },
  ];

const SAAS_CONCEPT_ALIASES: Record<SaasCanonicalConcept, string[]> = {
  period: ["date", "month", "period", "billing_month", "invoice_date", "event_date", "transaction_date", "signup_date", "start_date", "renewal_date"],
  movement_event_date: ["event_date", "movement_date", "change_date"],
  customer_id: ["customer_id", "account_id", "client_id", "organization_id", "tenant_id"],
  customer_count: ["customers", "customer_count", "total_customers", "active_customers", "ending_customers", "subscriber_count", "subscribers", "subscriptions_count"],
  subscription_id: ["subscription_id", "sub_id", "contract_id"],
  company: ["company", "company_name", "account_name", "organization", "org", "tenant"],
  plan: ["plan", "tier", "subscription_plan", "pricing_plan", "package", "product_plan"],
  subscription_status: ["status", "subscription_status", "customer_status", "account_status", "lifecycle_status"],
  users: ["users", "user_count", "paid_users"],
  active_users: ["active_users", "active_user_count", "mau", "monthly_active_users", "usage"],
  seats_before: ["seats_before", "previous_seats", "starting_seats", "opening_seats"],
  seats: ["seats", "seat_count", "seats_after", "current_seats", "ending_seats"],
  licenses: ["licenses", "licence_count", "license_count", "licensed_users"],
  price_per_user: ["price_per_user", "price_per_seat", "revenue_per_user", "arpu", "arpa"],
  unit_price: ["unit_price", "unit_amount"],
  revenue: ["revenue", "sales_amount", "sales", "amount", "turnover"],
  subscription_revenue: ["subscription_revenue", "recurring_revenue", "subscription_amount", "billing_amount"],
  mrr: ["mrr", "monthly_recurring_revenue"],
  mrr_before: ["mrr_before", "starting_mrr", "opening_mrr"],
  mrr_after: ["mrr_after", "ending_mrr", "closing_mrr"],
  mrr_delta: ["mrr_delta", "mrr_change", "mrr_movement", "net_mrr_change"],
  movement_type: ["movement_type", "movement", "mrr_movement_type", "change_type"],
  arr: ["arr", "annual_recurring_revenue"],
  expansion_mrr: ["expansion_mrr", "expansion", "expansion_recurring", "upsell", "upgrade_mrr"],
  contraction_mrr: ["contraction_mrr", "contraction", "contraction_recurring", "downsell", "downgrade_mrr"],
  cost: ["cost", "expense", "expenses", "cogs", "spend"],
  profit: ["profit", "gross_profit", "net_profit", "operating_profit"],
  profit_margin: ["profit_margin", "gross_margin", "net_margin", "margin"],
  cac: ["cac", "customer_acquisition_cost", "acquisition_cost"],
  ltv: ["ltv", "customer_lifetime_value", "lifetime_value"],
  new_customers: ["new_customers", "new_customer_count", "new_logo_count", "new_logos"],
  churned_customers: ["churned_customers", "churned_customer_count", "cancelled_customers", "canceled_customers", "cancellations"],
  churn_rate: ["churn_rate", "customer_churn_rate", "churn_pct", "churn_percent"],
  churn: ["churn", "churned", "cancelled", "canceled", "cancellation", "churn_date"],
  retention: ["retention", "retained", "renewal", "renewed"],
  burn: ["burn", "burn_rate", "cash_burn"],
  cash_balance: ["cash_balance", "cash", "bank_balance"],
  runway: ["runway", "runway_months"],
  channel: ["channel", "acquisition_channel", "source", "marketing_channel"],
  country: ["country", "country_code", "nation"],
  region: ["region", "territory", "state", "province"],
  startup_stage: ["startup_stage", "funding_stage"],
};

const MODEL_PATTERNS: Record<Exclude<SemanticBusinessModel, "Generic">, RegExp[]> = {
  Retail: [/\bretail\b|\bstore\b|\bshop\b/, /\bsku\b|\bproduct\b|\bitem\b/, /\binventory\b|\bstock\b|\breorder\b/, /\bsupplier\b|\bvendor\b/],
  Marketplace: [/\bmarketplace\b|\bgmv\b|\bgross_merchandise_value\b|\bgross_merchandise\b/, /\bseller\b|\bbuyer\b/, /\bplatform_fee\b|\bcommission\b|\btake_rate\b/, /\blisting\b/],
  POS: [/\bpos\b|\btill\b|\bcashier\b/, /\breceipt\b|\btransaction\b/, /\bstore\b|\bterminal\b/],
  Inventory: [/\binventory\b|\bstock\b|\bwarehouse\b/, /\breorder\b|\blead_time\b/, /\bsku\b|\bitem\b/],
  Accounting: [/\bledger\b|\bjournal\b|\bdebit\b|\bcredit\b/, /\binvoice\b|\bpayment\b/, /\btax\b|\bvat\b|\bgst\b/],
  CRM: [/\bcustomer\b|\bclient\b|\bcontact\b|\blead\b/, /\bemail\b|\bphone\b/, /\bpipeline\b|\bopportunity\b/],
  SaaS: [/\bsaas\b|\bmrr\b|\barr\b|\brecurring\b|\bsubscription\b/, /\bchurn\b|\bretention\b|\brenewal\b/, /\bplan\b|\bseat\b|\busers\b|\bprice_per_user\b|\baccount\b/],
  Manufacturing: [/\bmanufacturing\b|\bproduction\b|\bwork_order\b/, /\bbom\b|\bmaterial\b/, /\bmachine\b|\bdowntime\b/],
  Healthcare: [/\bpatient\b|\bclinical\b|\bappointment\b/, /\bprovider\b|\bdiagnosis\b/, /\bclaim\b|\binsurance\b/],
  Finance: [/\brevenue\b|\bprofit\b|\bloss\b|\bexpense\b/, /\bcash\b|\bbalance\b|\bbudget\b/, /\btransaction\b|\bpayment\b/],
  HR: [/\bemployee\b|\bstaff\b|\bheadcount\b/, /\bsalary\b|\bpayroll\b|\bbonus\b/, /\bhire\b|\bturnover\b|\bdepartment\b/],
};

const COUNTRY_CODES = new Set(["US", "GB", "UK", "NL", "DE", "FR", "ES", "IT", "CA", "AU", "BE", "SE", "NO", "DK", "FI", "IE", "CH", "AT", "PL", "PT"]);
const CURRENCY_CODES = new Set(["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "SEK", "NOK", "DKK", "PLN"]);

const fileStructureScanner: Detector<FileStructureScan> = {
  id: "file-structure-scanner.v1",
  detect(input) {
    const sourceType = detectSourceType(input);
    const delimiter = detectDelimiter(input.rawText);
    const columns = getColumns(input);
    const rows = input.rows;
    const emptyRegions = detectEmptyRegions(columns, rows);
    const explanations = [
      input.rawText ? "Raw text is available, so delimiter detection uses the first non-empty lines." : "Parsed rows are available, so structure detection uses the normalized table.",
      columns.length > 0 ? "The first parsed field list is treated as the header row." : "No parsed columns were available.",
    ];

    return {
      sourceType,
      encoding: detectEncoding(input.rawText),
      delimiter,
      workbook: {
        detected: sourceType === "excel",
        sheets: input.sheetNames || [],
      },
      mergedCells: sourceType === "excel" ? "unknown" : "none",
      hiddenRows: sourceType === "excel" ? "unknown" : "none",
      emptyRegions,
      headerRow: columns.length > 0 ? 1 : 0,
      dataStartRow: rows.length > 0 ? 2 : 0,
      confidence: roundConfidence(columns.length > 0 ? 0.9 : 0.35),
      explanations,
    };
  },
};

const columnScanner: Detector<SemanticColumnScan[]> = {
  id: "semantic-column-scanner.v1",
  detect(input) {
    const columns = getColumns(input);
    return columns.map((column) => scanColumn(column, input.rows));
  },
};

const relationshipScanner: Detector<RelationshipDetection[]> = {
  id: "relationship-engine.v1",
  detect(input) {
    const semanticColumns = columnScanner.detect(input);
    return detectRelationships(semanticColumns);
  },
};

const businessModelScanner: Detector<BusinessModelDetection> = {
  id: "business-model-detector.v1",
  detect(input) {
    return detectBusinessModel(input, columnScanner.detect(input));
  },
};

export const datasetIntelligenceDetectorRegistry = {
  fileStructure: fileStructureScanner,
  semanticColumns: columnScanner,
  relationships: relationshipScanner,
  businessModel: businessModelScanner,
};

export function buildDatasetIntelligenceEngine(input: DatasetIntelligenceEngineInput): DatasetIntelligenceEngineResult {
  const rows = input.rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  const normalizedInput = { ...input, rows, columns: input.columns?.length ? input.columns : getColumns({ ...input, rows }) };
  const generatedAt = new Date().toISOString();
  const fileStructure = datasetIntelligenceDetectorRegistry.fileStructure.detect(normalizedInput);
  const columns = datasetIntelligenceDetectorRegistry.semanticColumns.detect(normalizedInput);
  const relationships = detectRelationships(columns);
  const businessModel = detectBusinessModel(normalizedInput, columns);
  const saas = businessModel.model === "SaaS" ? resolveSaasSemanticProfile({ rows, columns: normalizedInput.columns, fileName: normalizedInput.fileName }) : null;
  const kpis = generateKpis(rows, columns, businessModel, saas);
  const dashboard = generateDashboard({ businessModel, columns, relationships, kpis, generatedAt });

  return {
    version: "die.v1",
    generatedAt,
    fileStructure,
    columns,
    relationships,
    businessModel,
    saas,
    kpis,
    dashboard,
    aiContext: buildAiContext({ businessModel, saas, columns, relationships, kpis }),
  };
}

export function findSemanticColumn(
  die: DatasetIntelligenceEngineResult,
  roles: CanonicalSemanticRole[],
  valueTypes: SemanticValueType[] = [],
): SemanticColumnScan | null {
  const roleSet = new Set(roles.flatMap((role) => compatibleRoles(role)));
  const typeSet = new Set(valueTypes);
  const candidates = die.columns
    .filter((column) => roleSet.has(column.canonicalRole) || column.valueTypes.some((type) => typeSet.has(type)))
    .sort((a, b) => b.confidence - a.confidence);
  return candidates[0] || null;
}

function compatibleRoles(role: CanonicalSemanticRole): CanonicalSemanticRole[] {
  if (role === "Revenue") return ["Revenue", "GMV", "Marketplace Revenue"];
  if (role === "Commission") return ["Commission", "Marketplace Revenue"];
  if (role === "Cost") return ["Cost", "Merchant Payout"];
  if (role === "Seller") return ["Seller", "Merchant"];
  if (role === "Buyer") return ["Buyer", "Customer"];
  if (role === "Category") return ["Category", "Product Category"];
  if (role === "Country") return ["Country", "Geography"];
  return [role];
}

function getColumns(input: Pick<DatasetIntelligenceEngineInput, "rows" | "columns">) {
  if (input.columns?.length) return input.columns;
  return Object.keys(input.rows[0] || {});
}

function detectSourceType(input: DatasetIntelligenceEngineInput): DatasetSourceType {
  const text = `${input.fileName || ""} ${input.mimeType || ""}`.toLowerCase();
  if (/\.(xlsx|xlsm|xls)\b|spreadsheet|excel/.test(text)) return "excel";
  if (/\.csv\b|text\/csv/.test(text)) return "csv";
  if (/\.pdf\b|application\/pdf/.test(text)) return "pdf";
  if (/\.(png|jpg|jpeg|webp|tif|tiff)\b|image\//.test(text)) return "image";
  if (/snowflake/.test(text)) return "snowflake";
  if (/sql|database/.test(text)) return "sql";
  if (/api|json/.test(text)) return "api";
  return input.rawText ? "csv" : "unknown";
}

function detectEncoding(rawText?: string) {
  if (!rawText) return "utf-8";
  if (rawText.charCodeAt(0) === 0xfeff) return "utf-8-bom";
  return "utf-8";
}

function detectDelimiter(rawText?: string) {
  if (!rawText) return null;
  const lines = rawText.split(/\r?\n/).filter((line) => line.trim()).slice(0, 5);
  const delimiters = [",", ";", "\t", "|"];
  const scored = delimiters.map((delimiter) => ({
    delimiter,
    score: lines.reduce((total, line) => total + line.split(delimiter).length - 1, 0),
  })).sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].delimiter : null;
}

function detectEmptyRegions(columns: string[], rows: Record<string, unknown>[]) {
  const emptyColumns = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => rows.every((row) => row[column] === null || row[column] === undefined || row[column] === ""));
  return emptyColumns.map(({ index }) => ({
    rowStart: 2,
    rowEnd: rows.length + 1,
    columnStart: index + 1,
    columnEnd: index + 1,
  }));
}

function scanColumn(columnName: string, rows: Record<string, unknown>[]): SemanticColumnScan {
  const normalizedName = normalizeName(columnName);
  const values = rows.map((row) => row[columnName]);
  const nonEmptyValues = values.filter((value) => value !== null && value !== undefined && value !== "");
  const sampleValues = Array.from(new Set(nonEmptyValues.map((value) => String(value)).filter(Boolean))).slice(0, 8);
  const valueTypes = detectValueTypes(nonEmptyValues);
  const primaryValueType = valueTypes[0] || "Empty";
  const evidence: ConfidenceEvidence[] = [];
  const synonym = COLUMN_SYNONYMS.find((entry) => entry.patterns.some((pattern) => pattern.test(normalizedName)));

  let canonicalRole: CanonicalSemanticRole = "Unknown";
  let confidence = 0.2;
  if (synonym) {
    canonicalRole = synonym.role;
    confidence += 0.55;
    evidence.push({ signal: "column_name", weight: 0.55, explanation: synonym.explanation });
  }

  const valueRole = roleFromValueTypes(valueTypes, sampleValues);
  if (!synonym && valueRole.role !== "Unknown") {
    canonicalRole = valueRole.role;
    confidence += valueRole.confidence;
    evidence.push({ signal: "value_pattern", weight: valueRole.confidence, explanation: valueRole.explanation });
  } else if (synonym?.valueTypes?.some((type) => valueTypes.includes(type))) {
    confidence += 0.18;
    evidence.push({ signal: "value_pattern", weight: 0.18, explanation: `Values look like ${primaryValueType.toLowerCase()} data, matching the inferred business role.` });
  }

  const uniqueness = new Set(nonEmptyValues.map(String)).size;
  if (/_?id$|uuid|guid/i.test(normalizedName) && uniqueness / Math.max(1, nonEmptyValues.length) > 0.8) {
    confidence += 0.12;
    evidence.push({ signal: "uniqueness", weight: 0.12, explanation: "Most non-empty values are unique, consistent with an identifier." });
  }

  if (canonicalRole === "Unknown" && primaryValueType === "Number") canonicalRole = "Metric";
  if (canonicalRole === "Unknown" && primaryValueType === "Text") canonicalRole = "Text";

  return {
    columnName,
    normalizedName,
    canonicalRole,
    valueTypes,
    primaryValueType,
    confidence: roundConfidence(Math.min(confidence, 0.98)),
    nullable: nonEmptyValues.length < values.length,
    uniqueValues: uniqueness,
    sampleValues,
    evidence,
    explanation: evidence.length > 0
      ? evidence.map((item) => item.explanation).join(" ")
      : "No strong business semantic signal was detected; column is retained as generic data.",
  };
}

function detectValueTypes(values: unknown[]): SemanticValueType[] {
  if (values.length === 0) return ["Empty"];
  const sample = values.slice(0, 100).map((value) => String(value).trim()).filter(Boolean);
  const detectors: Array<{ type: SemanticValueType; count: number }> = [
    { type: "Email", count: sample.filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).length },
    { type: "Phone", count: sample.filter((value) => /^\+?[\d\s().-]{7,}$/.test(value) && /[\s().-]/.test(value) && !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value)).length },
    { type: "UUID", count: sample.filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)).length },
    { type: "Boolean", count: sample.filter((value) => /^(true|false|yes|no|0|1)$/i.test(value)).length },
    { type: "Date", count: sample.filter((value) => !/^\d+(\.\d+)?$/.test(value) && !Number.isNaN(Date.parse(value)) && (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value) || /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(value) || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(value))).length },
    { type: "Money", count: sample.filter((value) => /^[€$£]|[€$£]$/.test(value) || /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)).length },
    { type: "Percentage", count: sample.filter((value) => /%$/.test(value) || (/^-?\d+(\.\d+)?$/.test(value) && Number(value) >= -100 && Number(value) <= 100)).length },
    { type: "Currency", count: sample.filter((value) => CURRENCY_CODES.has(value.toUpperCase())).length },
    { type: "Country", count: sample.filter((value) => COUNTRY_CODES.has(value.toUpperCase()) || /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(value)).length },
    { type: "SKU", count: sample.filter((value) => /^[A-Z0-9][A-Z0-9_-]{3,}$/i.test(value) && /[a-z]/i.test(value) && /\d/.test(value)).length },
    { type: "Invoice", count: sample.filter((value) => /^(inv|invoice|ord|order|txn|tx)-?[a-z0-9-]+$/i.test(value)).length },
    { type: "Number", count: sample.filter((value) => Number.isFinite(toNumber(value))).length },
  ];

  const threshold = Math.max(1, Math.ceil(sample.length * 0.6));
  const detected = detectors
    .filter((detector) => detector.count >= threshold)
    .sort((a, b) => b.count - a.count)
    .map((detector) => detector.type);
  if (detected.length > 0) return Array.from(new Set(detected));
  return ["Text"];
}

function roleFromValueTypes(valueTypes: SemanticValueType[], sampleValues: string[]) {
  if (valueTypes.includes("Email")) return { role: "Email" as const, confidence: 0.65, explanation: "Values match email-address patterns." };
  if (valueTypes.includes("Phone")) return { role: "Phone" as const, confidence: 0.6, explanation: "Values match phone-number patterns." };
  if (valueTypes.includes("UUID")) return { role: "UUID" as const, confidence: 0.65, explanation: "Values match UUID patterns." };
  if (valueTypes.includes("Currency")) return { role: "Currency" as const, confidence: 0.65, explanation: "Values match currency-code patterns." };
  if (valueTypes.includes("Boolean")) return { role: "Boolean" as const, confidence: 0.55, explanation: "Values match boolean patterns." };
  if (valueTypes.includes("Date")) return { role: "Date" as const, confidence: 0.55, explanation: "Values parse consistently as dates." };
  if (valueTypes.includes("Country") && sampleValues.length > 0) return { role: "Country" as const, confidence: 0.42, explanation: "Values look like countries or country codes." };
  if (valueTypes.includes("Percentage")) return { role: "Percentage" as const, confidence: 0.35, explanation: "Values look like rates or percentages." };
  return { role: "Unknown" as const, confidence: 0, explanation: "" };
}

export function resolveSaasSemanticProfile(input: Pick<DatasetIntelligenceEngineInput, "rows" | "columns" | "fileName">): SaasSemanticResolution {
  const columns = getColumns({ rows: input.rows, columns: input.columns });
  const mappings: Partial<Record<SaasCanonicalConcept, string>> = {};
  const evidence: ConfidenceEvidence[] = [];
  const valueSignals = collectSaasValueSignals(input.rows, columns);

  for (const concept of Object.keys(SAAS_CONCEPT_ALIASES) as SaasCanonicalConcept[]) {
    const column = findSaasConceptColumn(columns, concept);
    if (column) {
      mappings[concept] = column;
      evidence.push({
        signal: `saas_${concept}`,
        weight: 1,
        explanation: `${humanizeColumnName(column)} maps to SaaS ${concept.replace(/_/g, " ")}.`,
      });
    }
  }

  for (const [concept, column] of Object.entries(valueSignals) as Array<[SaasCanonicalConcept, string]>) {
    if (!mappings[concept]) {
      mappings[concept] = column;
      evidence.push({
        signal: `saas_value_${concept}`,
        weight: 0.65,
        explanation: `${humanizeColumnName(column)} maps to SaaS ${concept.replace(/_/g, " ")} from value profiling.`,
      });
    }
  }

  const has = (...concepts: SaasCanonicalConcept[]) => concepts.some((concept) => Boolean(mappings[concept]));
  const groups = {
    subscription_mrr_movements: scoreSaasGroup(mappings, ["period", "movement_event_date", "customer_id", "plan", "seats_before", "seats", "mrr_before", "mrr_after", "mrr_delta", "movement_type", "subscription_status"]),
    subscription_snapshot: scoreSaasGroup(mappings, ["customer_id", "customer_count", "subscription_id", "plan", "subscription_status", "mrr", "arr", "period", "churned_customers", "churn_rate", "churn"]),
    transactional_saas: scoreSaasGroup(mappings, ["period", "plan", "users", "seats", "licenses", "price_per_user", "unit_price", "revenue", "cost", "profit", "channel", "country"]),
    customer_cohort: scoreSaasGroup(mappings, ["customer_id", "customer_count", "period", "plan", "mrr", "new_customers", "churned_customers", "churn_rate", "churn", "expansion_mrr", "contraction_mrr", "country"]),
    saas_financial: scoreSaasGroup(mappings, ["period", "revenue", "cost", "profit", "burn", "cash_balance", "runway"]),
  };
  const capabilities = {
    recurringRevenue: has("mrr", "mrr_after", "mrr_delta", "arr", "subscription_revenue"),
    unitEconomics: has("revenue", "users", "seats", "licenses", "price_per_user", "unit_price", "cac", "ltv"),
    cohortRetention: has("customer_id", "customer_count") && has("period", "new_customers", "churned_customers", "churn_rate", "churn", "retention", "expansion_mrr", "contraction_mrr"),
    subscriptionLifecycle: has("subscription_id", "subscription_status", "churned_customers", "churn_rate", "churn", "retention"),
    financialRunway: has("burn", "cash_balance", "runway"),
    segmentation: has("plan", "channel", "startup_stage", "company"),
    geography: has("country", "region"),
  };
  const strongGroups = Object.entries(groups).filter(([, score]) => score >= 0.7).map(([profile]) => profile as Exclude<SaasProfileId, "hybrid_saas" | "generic_saas">);
  const hasHybridCapabilities = capabilities.financialRunway && capabilities.recurringRevenue && capabilities.unitEconomics;
  const best = Object.entries(groups).sort((a, b) => b[1] - a[1])[0] as [Exclude<SaasProfileId, "hybrid_saas" | "generic_saas">, number] | undefined;
  const profile: SaasProfileId = strongGroups.length >= 2 || hasHybridCapabilities
    ? "hybrid_saas"
    : best && best[1] >= 0.35
      ? best[0]
      : "generic_saas";
  const metrics = buildSaasResolvedMetrics(input.rows, mappings);
  const capabilityDetails = buildSaasCapabilityDetails(mappings, metrics);
  const availableCapabilities = Object.values(capabilityDetails)
    .filter((capability) => capability.available)
    .map((capability) => capability.id);
  const unavailableCapabilities = Object.values(capabilityDetails)
    .filter((capability) => !capability.available)
    .map(({ id, reason, missingRequirements }) => ({ id, reason, missingRequirements }));
  const periodComparability = evaluateSaasPeriodComparability(input.rows, mappings.period);
  const dataGaps = unavailableCapabilities
    .filter((capability) => capability.missingRequirements.length > 0)
    .flatMap((capability) => capability.missingRequirements)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 12);

  const semanticConfidence = Object.keys(mappings).length >= 12
    ? 1
    : roundConfidence(Math.min(0.98, Math.max(best?.[1] || 0.35, Object.keys(mappings).length / 14)));

  return {
    profile,
    confidence: semanticConfidence,
    evidence: evidence.slice(0, 12),
    mappings,
    capabilities,
    capabilityDetails,
    availableCapabilities,
    unavailableCapabilities,
    capabilityCoverage: roundConfidence(availableCapabilities.length / Object.keys(capabilityDetails).length),
    metrics,
    suggestedQuestions: buildSaasSuggestedQuestions(availableCapabilities),
    periodComparability,
    dataGaps,
    explanation: profile === "generic_saas"
      ? "SaaS evidence is present, but no specialized SaaS profile has enough complete field groups."
      : `${profile.replace(/_/g, " ")} has the strongest SaaS semantic evidence.`,
  };
}

function findSaasConceptColumn(columns: string[], concept: SaasCanonicalConcept) {
  return findColumnByNormalizedAlias(columns, SAAS_CONCEPT_ALIASES[concept]);
}

function findColumnByNormalizedAlias(columns: string[], aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeName));
  return columns.find((column) => aliasSet.has(normalizeName(column)));
}

function collectSaasValueSignals(rows: Record<string, unknown>[], columns: string[]) {
  const signals: Partial<Record<SaasCanonicalConcept, string>> = {};
  for (const column of columns) {
    const values = rows.map((row) => String(row[column] ?? "").trim().toLowerCase()).filter(Boolean).slice(0, 100);
    if (values.length === 0) continue;
    const statusMatches = values.filter((value) => /^(active|trial|past_due|paused|cancelled|canceled|churned|expired|renewed)$/.test(value)).length;
    const planMatches = values.filter((value) => /^(free|basic|starter|pro|business|growth|enterprise|team|premium)$/.test(value)).length;
    if (!signals.subscription_status && statusMatches >= Math.ceil(values.length * 0.5)) signals.subscription_status = column;
    if (!signals.plan && planMatches >= Math.ceil(values.length * 0.5)) signals.plan = column;
  }
  return signals;
}

function scoreSaasGroup(mappings: Partial<Record<SaasCanonicalConcept, string>>, concepts: SaasCanonicalConcept[]) {
  const matches = concepts.filter((concept) => Boolean(mappings[concept])).length;
  return roundConfidence(matches / concepts.length);
}

function buildSaasCapabilityDetails(
  mappings: Partial<Record<SaasCanonicalConcept, string>>,
  metrics: Record<string, SaasResolvedMetric>,
): Record<SaasCapabilityId, SaasCapabilityDetail> {
  const has = (...concepts: SaasCanonicalConcept[]) => concepts.some((concept) => Boolean(mappings[concept]));
  const source = (...concepts: SaasCanonicalConcept[]) => concepts.map((concept) => mappings[concept]).filter((value): value is string => Boolean(value));
  const metricAvailable = (...ids: string[]) => ids.some((id) => metrics[id]?.status === "available");
  const details = [
    capability("revenue_analysis", has("revenue", "subscription_revenue"), source("revenue", "subscription_revenue"), ["revenue or subscription_revenue"], "Revenue analysis requires a source revenue field."),
    capability("profitability", metricAvailable("profit", "profit_margin"), source("profit", "revenue", "cost"), ["profit or revenue plus cost"], "Profitability requires source profit or both revenue and cost."),
    capability("unit_economics", metricAvailable("average_revenue_per_user") || has("price_per_user", "unit_price"), source("revenue", "users", "seats", "licenses", "price_per_user", "unit_price"), ["revenue plus users/seats/licenses or price_per_user"], "Unit economics requires additive user or seat quantities and revenue, or a source price-per-user field."),
    capability("plan_performance", has("plan") && metricAvailable("revenue", "mrr", "arr", "profit", "users"), source("plan", "revenue", "mrr", "arr", "profit", "users"), ["plan plus revenue, MRR, ARR, profit, or users"], "Plan performance requires a plan field and at least one compatible SaaS metric."),
    capability("customer_analysis", has("customer_id", "customer_count"), source("customer_id", "customer_count"), ["customer_id or customer_count"], "Customer analysis requires a customer identifier or explicit customer count."),
    capability("subscription_metrics", has("subscription_id", "subscription_status", "mrr", "mrr_after", "mrr_delta", "movement_type", "arr"), source("subscription_id", "subscription_status", "mrr", "mrr_after", "mrr_delta", "movement_type", "arr"), ["subscription_id, subscription_status, MRR, MRR movement, or ARR"], "Subscription metrics require subscription lifecycle or recurring revenue fields."),
    capability("mrr_analysis", has("mrr", "mrr_after", "mrr_delta"), source("mrr", "mrr_after", "mrr_delta"), ["mrr or mrr_after/mrr_delta"], "MRR analysis requires source MRR or SaaS MRR movement fields."),
    capability("arr_analysis", has("arr") || has("mrr", "mrr_after"), source("arr", "mrr", "mrr_after"), ["arr, mrr, or mrr_after"], "ARR analysis requires a source ARR field or source MRR that can be annualized."),
    capability("churn_analysis", has("churn_rate", "churned_customers", "churn", "movement_type"), source("churn_rate", "churned_customers", "churn", "movement_type"), ["churn_rate, churned_customers, churn status, or movement_type"], "Churn analysis requires source churn semantics."),
    capability("retention_analysis", has("retention"), source("retention"), ["retention"], "Retention analysis requires a source retention field."),
    capability("cac_analysis", has("cac"), source("cac"), ["cac"], "CAC analysis requires a source CAC field."),
    capability("ltv_analysis", has("ltv"), source("ltv"), ["ltv"], "LTV analysis requires a source LTV field."),
    capability("growth_analysis", has("period") && metricAvailable("revenue", "mrr", "arr", "customers", "users"), source("period", "revenue", "mrr", "mrr_after", "mrr_delta", "arr", "customer_id", "customer_count", "users"), ["period plus revenue, MRR, ARR, customers, or users"], "Growth analysis requires a period field and a compatible SaaS metric."),
    capability("cohort_analysis", has("period") && has("customer_id", "customer_count") && has("new_customers", "churned_customers", "churn", "retention", "movement_type"), source("period", "customer_id", "customer_count", "new_customers", "churned_customers", "churn", "retention", "movement_type"), ["period plus customers plus cohort movement"], "Cohort analysis requires period, customer, and cohort movement fields."),
    capability("channel_analysis", has("channel") && metricAvailable("revenue", "mrr", "arr", "customers", "users"), source("channel", "revenue", "mrr", "mrr_after", "arr", "customer_id", "customer_count", "users"), ["channel plus a compatible SaaS metric"], "Channel analysis requires channel and a compatible SaaS metric."),
    capability("geography_analysis", has("country", "region") && metricAvailable("revenue", "mrr", "arr", "customers", "users"), source("country", "region", "revenue", "mrr", "mrr_after", "arr", "customer_id", "customer_count", "users"), ["country or region plus a compatible SaaS metric"], "Geography analysis requires geography and a compatible SaaS metric."),
    capability("startup_stage_analysis", has("startup_stage") && metricAvailable("revenue", "mrr", "arr", "profit", "users"), source("startup_stage", "revenue", "mrr", "mrr_after", "arr", "profit", "users"), ["startup_stage plus a compatible SaaS metric"], "Startup-stage analysis requires startup stage and a compatible SaaS metric."),
    capability("cash_analysis", has("cash_balance"), source("cash_balance"), ["cash_balance"], "Cash analysis requires a source cash balance field."),
    capability("burn_analysis", has("burn"), source("burn"), ["burn"], "Burn analysis requires a source burn field."),
    capability("runway_analysis", has("runway"), source("runway"), ["runway"], "Runway analysis requires a source runway field."),
  ];
  return Object.fromEntries(details.map((detail) => [detail.id, detail])) as Record<SaasCapabilityId, SaasCapabilityDetail>;
}

function capability(id: SaasCapabilityId, available: boolean, evidence: string[], missingRequirements: string[], unavailableReason: string): SaasCapabilityDetail {
  return {
    id,
    available,
    confidence: available ? roundConfidence(Math.min(0.98, 0.68 + evidence.length * 0.05)) : 0,
    evidence,
    missingRequirements: available ? [] : missingRequirements,
    reason: available ? `Available from ${evidence.join(", ")}.` : unavailableReason,
  };
}

function buildSaasResolvedMetrics(rows: Record<string, unknown>[], mappings: Partial<Record<SaasCanonicalConcept, string>>) {
  const sourceRows = latestRowsByPeriod(rows, mappings.period);
  const revenueField = mappings.revenue || mappings.subscription_revenue;
  const usersField = mappings.users || mappings.seats || mappings.licenses;
  const revenue = resolvedSum(rows, revenueField, "Revenue uses only source revenue or subscription revenue fields.");
  const cost = resolvedSum(rows, mappings.cost, "Cost uses only source cost fields.");
  const sourceProfit = resolvedSum(rows, mappings.profit, "Profit uses the source profit field.");
  const profit = sourceProfit.status === "available"
    ? sourceProfit
    : revenue.status === "available" && cost.status === "available"
      ? resolvedValue(round((revenue.value || 0) - (cost.value || 0)), [revenueField, mappings.cost].filter((value): value is string => Boolean(value)), "Profit is derived only when revenue and cost are both available.")
      : unavailableMetric("Profit requires source profit or both revenue and cost.");
  const profitMargin = revenue.status === "available" && revenue.value && profit.status === "available" && profit.value !== null
    ? resolvedValue(round((profit.value / revenue.value) * 100), profit.sourceColumns.includes(revenue.sourceColumns[0]) ? profit.sourceColumns : [...profit.sourceColumns, revenue.sourceColumns[0]].filter(Boolean), "Profit margin is profit divided by revenue.")
    : unavailableMetric("Profit margin requires revenue and profit.");
  const users = resolvedSum(rows, usersField, "Users use only additive users, seats, or licenses fields.");
  const averageRevenuePerUser = revenue.status === "available" && revenue.value && users.status === "available" && users.value && users.value > 0
    ? resolvedValue(round(revenue.value / users.value), [revenueField, usersField].filter((value): value is string => Boolean(value)), "Average revenue per user is revenue divided by additive users, seats, or licenses.")
    : unavailableMetric("Average revenue per user requires revenue and additive users, seats, or licenses.");
  const movementSnapshotRows = mappings.mrr_after ? latestActiveRowsByCustomer(sourceRows, mappings.customer_id, mappings.subscription_status, mappings.movement_event_date) : sourceRows;
  const mrr = mappings.mrr
    ? resolvedSum(sourceRows, mappings.mrr, "MRR uses only source MRR fields.")
    : resolvedSum(movementSnapshotRows, mappings.mrr_after, "MRR uses latest-period active customer MRR after movement values.");
  const arr = mappings.arr
    ? resolvedSum(sourceRows, mappings.arr, "ARR uses only source ARR fields.")
    : mrr.status === "available" && mrr.value !== null
      ? resolvedValue(round(mrr.value * 12), mrr.sourceColumns, "ARR is annualized only from source MRR when ARR is not present.")
      : unavailableMetric("ARR requires source ARR or source MRR.");
  const customers = mappings.customer_count
    ? resolvedSum(sourceRows, mappings.customer_count, "Customers use the latest-period explicit customer count.")
    : mappings.customer_id
      ? resolvedValue(uniqueCountFromRows(mappings.mrr_after && movementSnapshotRows.length > 0 ? movementSnapshotRows : rows, mappings.customer_id), [mappings.customer_id], mappings.mrr_after && movementSnapshotRows.length > 0 ? "Customers count latest-period active source customer identifiers." : "Customers count distinct source customer identifiers.")
      : unavailableMetric("Customers require customer_id or explicit customer_count; rows, orders, and plans are not customer proxies.");
  const movementMetrics = aggregateMrrMovements(sourceRows, mappings.movement_type, mappings.mrr_delta);

  return {
    revenue,
    cost,
    profit,
    profit_margin: profitMargin,
    users,
    average_revenue_per_user: averageRevenuePerUser,
    price_per_user: resolvedAverage(sourceRows, mappings.price_per_user || mappings.unit_price, "Price per user uses the source price-per-user or unit-price field."),
    mrr,
    arr,
    expansion_mrr: movementMetrics.expansion_mrr ?? resolvedSum(sourceRows, mappings.expansion_mrr, "Expansion MRR uses only source expansion MRR fields."),
    contraction_mrr: movementMetrics.contraction_mrr ?? resolvedSum(sourceRows, mappings.contraction_mrr, "Contraction MRR uses only source contraction MRR fields."),
    customers,
    new_customers: resolvedSum(sourceRows, mappings.new_customers, "New customers use source new-customer fields."),
    churned_customers: resolvedSum(sourceRows, mappings.churned_customers, "Churned customers use source churned-customer fields."),
    new_mrr: movementMetrics.new_mrr ?? unavailableMetric("New MRR requires movement_type and mrr_delta source fields."),
    churned_mrr: movementMetrics.churned_mrr ?? unavailableMetric("Churned MRR requires movement_type and mrr_delta source fields."),
    churn_rate: resolvedRate(sourceRows, mappings.churn_rate, "Churn rate uses source churn-rate fields and never row counts."),
    cac: resolvedAverage(sourceRows, mappings.cac, "CAC uses source CAC fields."),
    ltv: resolvedAverage(sourceRows, mappings.ltv, "LTV uses source LTV fields."),
    active_users: resolvedSum(sourceRows, mappings.active_users, "Active users use source active-user fields."),
    burn: resolvedAverage(sourceRows, mappings.burn, "Burn uses source burn fields."),
    cash_balance: resolvedAverage(sourceRows, mappings.cash_balance, "Cash balance uses source cash balance fields and is not summed across periods."),
    runway: resolvedAverage(sourceRows, mappings.runway, "Runway uses source runway fields."),
  };
}

function latestActiveRowsByCustomer(rows: Record<string, unknown>[], customerColumn?: string, statusColumn?: string, eventDateColumn?: string) {
  if (!customerColumn) return rows;
  const activeByCustomer = new Map<string, { row: Record<string, unknown>; time: number; index: number }>();
  rows.forEach((row, index) => {
    const customer = String(row[customerColumn] ?? "").trim();
    if (!customer) return;
    const status = statusColumn ? String(row[statusColumn] ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_") : "active";
    if (["churn", "churned", "cancelled", "canceled", "inactive", "expired"].includes(status)) return;
    const time = eventDateColumn ? new Date(String(row[eventDateColumn] ?? "")).getTime() : NaN;
    const previous = activeByCustomer.get(customer);
    if (!previous || (Number.isFinite(time) && time > previous.time) || (!Number.isFinite(previous.time) && index > previous.index)) {
      activeByCustomer.set(customer, { row, time: Number.isFinite(time) ? time : -Infinity, index });
    }
  });
  return Array.from(activeByCustomer.values()).map((item) => item.row);
}

function aggregateMrrMovements(rows: Record<string, unknown>[], movementColumn?: string, deltaColumn?: string) {
  if (!movementColumn || !deltaColumn) return {};
  const totals = {
    new_mrr: 0,
    expansion_mrr: 0,
    contraction_mrr: 0,
    churned_mrr: 0,
  };
  let matched = 0;
  rows.forEach((row) => {
    const movement = String(row[movementColumn] ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    const rawDelta = toNumber(row[deltaColumn]);
    if (rawDelta === null) return;
    const delta = Math.abs(rawDelta);
    if (movement === "new") {
      totals.new_mrr += delta;
      matched += 1;
    } else if (movement === "expansion") {
      totals.expansion_mrr += delta;
      matched += 1;
    } else if (movement === "contraction") {
      totals.contraction_mrr += delta;
      matched += 1;
    } else if (movement === "churn" || movement === "churned") {
      totals.churned_mrr += delta;
      matched += 1;
    }
  });
  if (matched === 0) return {};
  return {
    new_mrr: resolvedValue(round(totals.new_mrr), [movementColumn, deltaColumn], "New MRR sums latest-period mrr_delta rows with movement_type new."),
    expansion_mrr: resolvedValue(round(totals.expansion_mrr), [movementColumn, deltaColumn], "Expansion MRR sums latest-period mrr_delta rows with movement_type expansion."),
    contraction_mrr: resolvedValue(round(totals.contraction_mrr), [movementColumn, deltaColumn], "Contraction MRR sums latest-period mrr_delta rows with movement_type contraction."),
    churned_mrr: resolvedValue(round(totals.churned_mrr), [movementColumn, deltaColumn], "Churned MRR sums latest-period mrr_delta rows with movement_type churn."),
  };
}

function resolvedSum(rows: Record<string, unknown>[], column: string | undefined, reason: string): SaasResolvedMetric {
  if (!column) return unavailableMetric(reason.replace(/^.*uses .*?\./, "A source field is required."));
  const values = rows.map((row) => toNumber(row[column])).filter((value): value is number => value !== null);
  return values.length > 0
    ? resolvedValue(round(values.reduce((total, value) => total + value, 0)), [column], reason)
    : unavailableMetric(`${column} has no numeric values.`);
}

function resolvedAverage(rows: Record<string, unknown>[], column: string | undefined, reason: string): SaasResolvedMetric {
  if (!column) return unavailableMetric(reason.replace(/^.*uses .*?\./, "A source field is required."));
  const values = rows.map((row) => toNumber(row[column])).filter((value): value is number => value !== null);
  return values.length > 0
    ? resolvedValue(round(values.reduce((total, value) => total + value, 0) / values.length), [column], reason)
    : unavailableMetric(`${column} has no numeric values.`);
}

function resolvedRate(rows: Record<string, unknown>[], column: string | undefined, reason: string): SaasResolvedMetric {
  if (!column) return unavailableMetric("A source rate field is required.");
  const values = rows.map((row) => toNumber(row[column])).filter((value): value is number => value !== null).map(normalizePercentValue).filter((value): value is number => value !== null);
  return values.length > 0
    ? resolvedValue(round(values.reduce((total, value) => total + value, 0) / values.length), [column], reason)
    : unavailableMetric(`${column} has no valid rate values.`);
}

function resolvedValue(value: number, sourceColumns: string[], reason: string): SaasResolvedMetric {
  return { value, sourceColumns, status: "available", reason };
}

function unavailableMetric(reason: string): SaasResolvedMetric {
  return { value: null, sourceColumns: [], status: "unavailable", reason };
}

function uniqueCountFromRows(rows: Record<string, unknown>[], column: string) {
  return new Set(rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean)).size;
}

function evaluateSaasPeriodComparability(rows: Record<string, unknown>[], periodColumn?: string): SaasPeriodComparability {
  if (!periodColumn) {
    return { periodField: null, latestPeriod: null, latestPeriodComparable: false, reason: "No source period field is available." };
  }
  const periods = rows
    .map((row) => normalizePeriodKey(row[periodColumn]))
    .filter((value): value is string => Boolean(value))
    .sort();
  if (periods.length < 2) {
    return { periodField: periodColumn, latestPeriod: periods[0] || null, latestPeriodComparable: false, reason: "At least two valid period values are required." };
  }
  const latestPeriod = periods.at(-1) || null;
  const previousPeriod = [...new Set(periods)].at(-2) || null;
  if (!latestPeriod || !previousPeriod) {
    return { periodField: periodColumn, latestPeriod, latestPeriodComparable: false, reason: "At least two distinct periods are required." };
  }
  const latestCount = periods.filter((period) => period === latestPeriod).length;
  const previousCount = periods.filter((period) => period === previousPeriod).length;
  const latestPeriodComparable = previousCount === 0 || latestCount / previousCount >= 0.5;
  return {
    periodField: periodColumn,
    latestPeriod,
    latestPeriodComparable,
    reason: latestPeriodComparable ? null : "The latest period has substantially fewer rows than the previous period, so period-over-period scoring is withheld.",
  };
}

function buildSaasSuggestedQuestions(capabilities: SaasCapabilityId[]) {
  const has = (capability: SaasCapabilityId) => capabilities.includes(capability);
  const questions: string[] = [];
  if (has("mrr_analysis")) questions.push("What is the current MRR?");
  if (has("mrr_analysis")) questions.push("What changed in MRR across the available periods?");
  if (has("arr_analysis")) questions.push("What is the current ARR?");
  if (has("mrr_analysis")) questions.push("How much New MRR is in the data?");
  if (has("mrr_analysis")) questions.push("How much Expansion MRR is in the data?");
  if (has("mrr_analysis")) questions.push("How much Contraction MRR is in the data?");
  if (has("churn_analysis")) questions.push("How much Churned MRR is in the data?");
  if (has("mrr_analysis")) questions.push("What is the net MRR movement?");
  if (has("customer_analysis")) questions.push("How many active customers are represented?");
  if (has("plan_performance")) questions.push("Which plan contributes the most SaaS revenue or users?");
  if (has("customer_analysis") && has("mrr_analysis")) questions.push("Which customers or accounts are highest value?");
  if (has("churn_analysis")) questions.push("What churn signal is visible in the source data?");
  if (has("unit_economics")) questions.push("How does revenue per user compare across the dataset?");
  if (has("cash_analysis") || has("burn_analysis") || has("runway_analysis")) questions.push("What does the cash, burn, and runway data show?");
  if (has("geography_analysis")) questions.push("Which country or region performs best?");
  if (questions.length === 0) questions.push("Which SaaS fields are available and which metrics need additional source data?");
  return questions.slice(0, 12);
}

export function buildSaasAssistantSummary(input: Pick<DatasetIntelligenceEngineInput, "rows" | "columns" | "fileName">): SaasAssistantSummary {
  const rows = input.rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  const columns = input.columns?.length ? input.columns : getColumns({ rows, columns: input.columns });
  const saas = resolveSaasSemanticProfile({ rows, columns, fileName: input.fileName });
  const sourceRows = latestRowsByPeriod(rows, saas.mappings.period);
  const snapshotRows = saas.mappings.mrr_after
    ? latestActiveRowsByCustomer(sourceRows, saas.mappings.customer_id, saas.mappings.subscription_status, saas.mappings.movement_event_date)
    : sourceRows;
  const valueColumn = saas.mappings.mrr_after || saas.mappings.mrr || saas.mappings.arr || saas.mappings.subscription_revenue || saas.mappings.revenue || saas.mappings.users;
  const latestPeriod = saas.periodComparability.latestPeriod ?? latestRowsByPeriodKey(rows, saas.mappings.period);

  return {
    profile: saas.profile,
    confidence: saas.confidence,
    mappings: saas.mappings,
    metrics: saas.metrics,
    suggestedQuestions: saas.suggestedQuestions,
    latestPeriod,
    periodRows: summarizeSaasAssistantPeriods(rows, saas.mappings),
    planRows: summarizeSaasAssistantDimension(snapshotRows, saas.mappings.plan, valueColumn),
    customerRows: summarizeSaasAssistantDimension(snapshotRows, saas.mappings.customer_id, valueColumn, saas.mappings.company),
    movementRows: summarizeSaasAssistantMovements(saas.metrics),
    dataGaps: saas.dataGaps,
  };
}

function summarizeSaasAssistantPeriods(rows: Record<string, unknown>[], mappings: Partial<Record<SaasCanonicalConcept, string>>): SaasAssistantPeriodRow[] {
  const periodColumn = mappings.period;
  if (!periodColumn) return [];
  const periodKeys = Array.from(new Set(rows
    .map((row) => normalizePeriodKey(row[periodColumn]))
    .filter((value): value is string => Boolean(value))))
    .sort();
  return periodKeys.map((period) => {
    const periodRows = rows.filter((row) => normalizePeriodKey(row[periodColumn]) === period);
    const snapshotRows = mappings.mrr_after
      ? latestActiveRowsByCustomer(periodRows, mappings.customer_id, mappings.subscription_status, mappings.movement_event_date)
      : periodRows;
    const mrrColumn = mappings.mrr_after || mappings.mrr;
    const mrr = mrrColumn ? round(sumColumn(snapshotRows, mrrColumn)) : null;
    const movement = aggregateMrrMovements(periodRows, mappings.movement_type, mappings.mrr_delta);
    const netMovement = netMrrMovementValue(movement);
    const activeCustomers = mappings.customer_id
      ? uniqueCountFromRows(snapshotRows, mappings.customer_id)
      : mappings.customer_count
        ? round(sumColumn(periodRows, mappings.customer_count))
        : null;
    return {
      period,
      mrr,
      netMovement,
      activeCustomers,
      rows: periodRows.length,
    };
  });
}

function summarizeSaasAssistantDimension(
  rows: Record<string, unknown>[],
  dimensionColumn: string | undefined,
  valueColumn: string | undefined,
  labelColumn?: string,
): SaasAssistantSummaryRow[] {
  if (!dimensionColumn || !valueColumn) return [];
  const total = sumColumn(rows, valueColumn);
  const groups = new Map<string, { value: number; rows: number; labels: Map<string, number> }>();
  for (const row of rows) {
    const key = String(row[dimensionColumn] ?? "").trim();
    if (!key) continue;
    const value = toNumber(row[valueColumn]) ?? 0;
    const current = groups.get(key) ?? { value: 0, rows: 0, labels: new Map<string, number>() };
    current.value += value;
    current.rows += 1;
    if (labelColumn) {
      const label = String(row[labelColumn] ?? "").trim();
      if (label) current.labels.set(label, (current.labels.get(label) ?? 0) + 1);
    }
    groups.set(key, current);
  }
  return Array.from(groups.entries())
    .map(([key, value]) => {
      const label = Array.from(value.labels.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || key;
      return {
        label,
        value: round(value.value),
        sharePct: total > 0 ? round((value.value / total) * 100) : 0,
        rows: value.rows,
        sourceColumns: [dimensionColumn, valueColumn, labelColumn].filter((column): column is string => Boolean(column)),
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function summarizeSaasAssistantMovements(metrics: Record<string, SaasResolvedMetric>): SaasAssistantSummaryRow[] {
  return [
    ["New MRR", metrics.new_mrr],
    ["Expansion MRR", metrics.expansion_mrr],
    ["Contraction MRR", metrics.contraction_mrr],
    ["Churned MRR", metrics.churned_mrr],
  ].flatMap(([label, metric]) => {
    const item = metric as SaasResolvedMetric | undefined;
    return item?.status === "available" && item.value !== null
      ? [{ label: String(label), value: item.value, sourceColumns: item.sourceColumns }]
      : [];
  });
}

function latestRowsByPeriodKey(rows: Record<string, unknown>[], periodColumn?: string) {
  if (!periodColumn) return null;
  return rows
    .map((row) => normalizePeriodKey(row[periodColumn]))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function netMrrMovementValue(metrics: Partial<Record<"new_mrr" | "expansion_mrr" | "contraction_mrr" | "churned_mrr", SaasResolvedMetric>>) {
  const newMrr = metricNumber(metrics.new_mrr);
  const expansionMrr = metricNumber(metrics.expansion_mrr);
  const contractionMrr = metricNumber(metrics.contraction_mrr);
  const churnedMrr = metricNumber(metrics.churned_mrr);
  if ([newMrr, expansionMrr, contractionMrr, churnedMrr].every((value) => value === null)) return null;
  return round((newMrr ?? 0) + (expansionMrr ?? 0) - (contractionMrr ?? 0) - (churnedMrr ?? 0));
}

function metricNumber(metric?: SaasResolvedMetric) {
  return metric?.status === "available" && metric.value !== null ? metric.value : null;
}

function detectRelationships(columns: SemanticColumnScan[]): RelationshipDetection[] {
  const byRole = (role: CanonicalSemanticRole) => columns.find((column) => compatibleRoles(role).includes(column.canonicalRole));
  const allByRole = (role: CanonicalSemanticRole) => columns.filter((column) => compatibleRoles(role).includes(column.canonicalRole));
  const relationships: RelationshipDetection[] = [];
  const revenue = byRole("Revenue");
  const cost = byRole("Cost");
  const profit = byRole("Profit");
  const commission = byRole("Commission");
  const margin = byRole("Margin");
  const quantity = byRole("Quantity");
  const buyer = byRole("Buyer") || byRole("Customer");
  const users = byRole("Users");

  if (revenue && cost && profit) {
    relationships.push({
      id: "profit_from_revenue_cost",
      label: "Profit = Revenue - Cost",
      kind: "formula",
      confidence: 0.86,
      leftRole: "Profit",
      outputRole: "Profit",
      inputRoles: [revenue.canonicalRole, cost.canonicalRole],
      columns: [profit.columnName, revenue.columnName, cost.columnName],
      formula: `${profit.columnName} = ${revenue.columnName} - ${cost.columnName}`,
      explanation: "Revenue, cost, and profit columns are present, so profit can be validated as revenue minus cost.",
    });
  }

  if (revenue && commission && cost && /gmv|gross_merchandise/.test(revenue.normalizedName)) {
    relationships.push({
      id: "gmv_from_seller_payout_platform_fee",
      label: "GMV = Seller Payout + Platform Fee",
      kind: "identity",
      confidence: 0.82,
      leftRole: revenue.canonicalRole,
      outputRole: revenue.canonicalRole,
      inputRoles: [cost.canonicalRole, commission.canonicalRole],
      columns: [revenue.columnName, cost.columnName, commission.columnName],
      formula: `${revenue.columnName} = ${cost.columnName} + ${commission.columnName}`,
      explanation: "Marketplace GMV, payout, and platform fee semantics indicate a GMV identity relationship.",
    });
  }

  if (margin && profit && revenue) {
    relationships.push({
      id: "margin_percentage",
      label: "Margin %",
      kind: "ratio",
      confidence: 0.78,
      leftRole: "Margin",
      outputRole: "Margin",
      inputRoles: ["Profit", revenue.canonicalRole],
      columns: [margin.columnName, profit.columnName, revenue.columnName],
      formula: `${margin.columnName} = ${profit.columnName} / ${revenue.columnName}`,
      explanation: "Margin and monetary columns are present, enabling margin-rate validation.",
    });
  }

  const refundRate = columns.find((column) => /refund|return/.test(column.normalizedName) && (column.canonicalRole === "Percentage" || column.primaryValueType === "Percentage"));
  if (refundRate) {
    relationships.push({
      id: "refund_rate",
      label: "Refund Rate",
      kind: "ratio",
      confidence: 0.72,
      leftRole: "Percentage",
      outputRole: "Percentage",
      inputRoles: ["Order"],
      columns: [refundRate.columnName],
      formula: `${refundRate.columnName} = refunded orders / total orders`,
      explanation: "Refund or return rate column is present and can drive revenue leakage analysis.",
    });
  }

  if (revenue && (quantity || buyer || allByRole("Order").length > 0)) {
    relationships.push({
      id: "average_order_value",
      label: "Average Order Value",
      kind: "ratio",
      confidence: quantity ? 0.72 : buyer ? 0.68 : 0.62,
      leftRole: revenue.canonicalRole,
      outputRole: revenue.canonicalRole,
      inputRoles: quantity ? [revenue.canonicalRole, "Quantity"] : buyer ? [revenue.canonicalRole, buyer.canonicalRole] : [revenue.canonicalRole, "Order"],
      columns: [revenue.columnName, quantity?.columnName || buyer?.columnName].filter((value): value is string => Boolean(value)),
      formula: quantity ? `${revenue.columnName} / ${quantity.columnName}` : `${revenue.columnName} / order count`,
      explanation: "Revenue plus order, buyer, customer, or quantity semantics support average-order-value analysis.",
    });
  }

  if (revenue && users) {
    relationships.push({
      id: "average_revenue_per_user",
      label: "Average Revenue per User",
      kind: "ratio",
      confidence: Math.min(revenue.confidence, users.confidence),
      leftRole: revenue.canonicalRole,
      outputRole: "Price per User",
      inputRoles: [revenue.canonicalRole, "Users"],
      columns: [revenue.columnName, users.columnName],
      formula: `${revenue.columnName} / ${users.columnName}`,
      explanation: "Revenue and users columns are present, enabling average revenue per user analysis.",
    });
  }

  return relationships;
}

function detectBusinessModel(input: DatasetIntelligenceEngineInput, columns: SemanticColumnScan[]): BusinessModelDetection {
  const text = [input.fileName || "", ...columns.map((column) => `${column.normalizedName} ${column.canonicalRole}`)].join(" ").toLowerCase();
  const evidenceByModel = Object.entries(MODEL_PATTERNS).map(([model, patterns]) => {
    const evidence = patterns
      .filter((pattern) => pattern.test(text))
      .map((pattern) => ({
        signal: "semantic_schema",
        weight: 1,
        explanation: `${model} pattern matched ${pattern.source.replace(/\\b/g, "")}.`,
      }));
    return { model: model as Exclude<SemanticBusinessModel, "Generic">, score: evidence.length, evidence };
  });

  const roleBoosts = scoreModelFromRoles(columns);
  const ranked = evidenceByModel
    .map((entry) => ({ ...entry, score: entry.score + (roleBoosts[entry.model] || 0) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const saasRank = ranked.find((entry) => entry.model === "SaaS");
  if (/\bsaas\b/.test(text) && saasRank && saasRank.score > 0 && best?.model === "Finance") {
    return {
      model: "SaaS",
      confidence: roundConfidence(Math.min(0.98, Math.max(0.65, saasRank.score / 6))),
      evidence: saasRank.evidence,
      alternatives: ranked.filter((entry) => entry.model !== "SaaS").slice(0, 3).map((entry) => ({
        model: entry.model as SemanticBusinessModel,
        confidence: roundConfidence(Math.min(0.95, entry.score / 6)),
      })),
      explanation: "SaaS has explicit dataset evidence, so SaaS financial fields are analyzed with SaaS semantics instead of generic finance semantics.",
    };
  }
  const model: SemanticBusinessModel = best && best.score > 0 ? best.model : "Generic";
  const confidence = model === "Generic" ? 0.35 : roundConfidence(Math.min(0.98, best.score / 6));
  const alternatives = ranked.slice(1, 4).map((entry) => ({
    model: entry.model as SemanticBusinessModel,
    confidence: roundConfidence(Math.min(0.95, entry.score / 6)),
  }));

  return {
    model,
    confidence,
    evidence: best?.evidence || [],
    alternatives,
    explanation: model === "Generic"
      ? "No specific business model reached the semantic confidence threshold."
      : `${model} has the strongest combination of semantic column and value signals.`,
  };
}

function scoreModelFromRoles(columns: SemanticColumnScan[]) {
  const has = (role: CanonicalSemanticRole) => columns.some((column) => compatibleRoles(role).includes(column.canonicalRole));
  const hasName = (pattern: RegExp) => columns.some((column) => pattern.test(column.normalizedName));
  const scores: Partial<Record<Exclude<SemanticBusinessModel, "Generic">, number>> = {};
  if (has("Seller") && has("Buyer") && (has("Revenue") || has("Commission"))) scores.Marketplace = 2.5;
  if (has("Users") && has("Category") && has("Revenue")) scores.SaaS = 2.5;
  if (hasName(/(^|_)mrr($|_)|(^|_)arr($|_)|subscription|recurring|churn|renewal/)) {
    scores.SaaS = Math.max(scores.SaaS || 0, 3);
  }
  if (has("SKU") && has("Quantity") && (has("Product") || has("Category"))) scores.Inventory = 1.5;
  if (has("Invoice") && (has("Cost") || has("Revenue") || has("Account"))) scores.Accounting = 1.5;
  if (has("Customer") && (has("Email") || has("Phone") || has("Status"))) scores.CRM = 1.5;
  if (has("Employee")) scores.HR = 1.5;
  if (has("Revenue") && has("Date") && has("Category")) scores.Finance = 0.8;
  return scores;
}

function generateKpis(
  rows: Record<string, unknown>[],
  columns: SemanticColumnScan[],
  businessModel: BusinessModelDetection,
  saas: SaasSemanticResolution | null = null,
): DynamicKpi[] {
  const kpis: DynamicKpi[] = [{ id: "record_count", title: "Records", value: rows.length, format: "number", sourceColumns: [], confidence: 0.99, explanation: "Record count is computed directly from parsed rows." }];
  const exactRole = (role: CanonicalSemanticRole) => columns.find((column) => column.canonicalRole === role);
  const byRole = (role: CanonicalSemanticRole) => columns.find((column) => compatibleRoles(role).includes(column.canonicalRole));
  const allByRole = (role: CanonicalSemanticRole) => columns.filter((column) => compatibleRoles(role).includes(column.canonicalRole));
  const gmv = exactRole("GMV");
  const marketplaceRevenue = exactRole("Marketplace Revenue");
  const merchantPayout = exactRole("Merchant Payout");
  const refund = exactRole("Refund");
  const revenue = byRole("Revenue");
  const commission = byRole("Commission");
  const cost = byRole("Cost");
  const profit = byRole("Profit");
  const quantity = byRole("Quantity");
  const users = byRole("Users");
  const pricePerUser = byRole("Price per User");
  const customer = byRole("Customer") || byRole("Buyer");
  const seller = byRole("Seller");
  const buyer = byRole("Buyer");
  const order = byRole("Order");

  if (gmv) kpis.push(sumKpi("total_gmv", gmv, rows, "GMV"));
  if (revenue) kpis.push(sumKpi("total_revenue", revenue, rows, revenue.canonicalRole === "GMV" ? "Total Revenue / GMV" : "Total Revenue"));
  if (marketplaceRevenue) kpis.push(sumKpi("marketplace_revenue", marketplaceRevenue, rows, "Marketplace Revenue"));
  if (commission) kpis.push(sumKpi("commission", commission, rows, commission.canonicalRole === "Marketplace Revenue" ? "Commission / Platform Fee" : "Commission"));
  if (merchantPayout) kpis.push(sumKpi("merchant_payout", merchantPayout, rows, "Merchant Payout"));
  if (refund) kpis.push(sumKpi("refunds", refund, rows, "Refunds"));
  if (cost) kpis.push(sumKpi("total_cost", cost, rows, "Total Cost"));
  if (profit) kpis.push(sumKpi("total_profit", profit, rows, "Total Profit"));
  if (!profit && revenue && cost) {
    kpis.push({
      id: "total_profit",
      title: "Total Profit",
      value: round(sumColumn(rows, revenue.columnName) - sumColumn(rows, cost.columnName)),
      format: "currency",
      sourceColumns: [revenue.columnName, cost.columnName],
      confidence: Math.min(revenue.confidence, cost.confidence),
      explanation: "Total Profit is computed from revenue minus cost because no source profit column was detected.",
    });
  }
  if (quantity) kpis.push(sumKpi("quantity", quantity, rows, "Quantity", "number"));
  if (users) kpis.push(sumKpi("total_users", users, rows, "Total Users", "number"));
  if (pricePerUser) kpis.push(averageKpi("price_per_user", pricePerUser, rows, "Price per User"));
  if (revenue && users && sumColumn(rows, users.columnName) > 0) {
    kpis.push({
      id: "average_revenue_per_user",
      title: "Average Revenue per User",
      value: round(sumColumn(rows, revenue.columnName) / sumColumn(rows, users.columnName)),
      format: "currency",
      sourceColumns: [revenue.columnName, users.columnName],
      confidence: Math.min(revenue.confidence, users.confidence),
      explanation: "Average Revenue per User is computed from total revenue divided by total users.",
    });
  }
  if (revenue && order) {
    const orderCount = order
      ? new Set(rows.map((row) => String(row[order.columnName] ?? "").trim()).filter(Boolean)).size
      : rows.length;
    kpis.push({
      id: "average_order_value",
      title: "Average Order Value",
      value: orderCount > 0 ? round(sumColumn(rows, revenue.columnName) / orderCount) : null,
      format: "currency",
      sourceColumns: [revenue.columnName, order.columnName],
      confidence: revenue.confidence,
      explanation: "Average order value is computed from the detected revenue metric divided by the number of distinct orders.",
    });
  }
  if (customer) kpis.push(uniqueKpi("customers", customer, rows, customer.canonicalRole === "Customer" && /buyer/.test(customer.normalizedName) ? "Buyers / Customers" : "Customers"));
  if (buyer) kpis.push(uniqueKpi("buyers", buyer, rows, "Buyers"));
  if (seller) kpis.push(uniqueKpi("sellers", seller, rows, seller.canonicalRole === "Merchant" ? "Merchants" : "Sellers"));
  if (revenue && commission && sumColumn(rows, revenue.columnName) > 0) {
    kpis.push({
      id: "take_rate",
      title: "Take Rate",
      value: round((sumColumn(rows, commission.columnName) / sumColumn(rows, revenue.columnName)) * 100),
      format: "percentage",
      sourceColumns: [commission.columnName, revenue.columnName],
      confidence: Math.min(commission.confidence, revenue.confidence),
      explanation: "Take rate is computed from commission divided by revenue or GMV.",
    });
  }
  const profitValue = profit ? sumColumn(rows, profit.columnName) : revenue && cost ? sumColumn(rows, revenue.columnName) - sumColumn(rows, cost.columnName) : null;
  if (revenue && profitValue !== null && sumColumn(rows, revenue.columnName) > 0) {
    kpis.push({
      id: "profit_margin",
      title: "Profit Margin",
      value: round((profitValue / sumColumn(rows, revenue.columnName)) * 100),
      format: "percentage",
      sourceColumns: [revenue.columnName, ...(profit ? [profit.columnName] : cost ? [cost.columnName] : [])],
      confidence: profit ? Math.min(revenue.confidence, profit.confidence) : cost ? Math.min(revenue.confidence, cost.confidence) : revenue.confidence,
      explanation: profit
        ? "Profit Margin is computed from source profit divided by revenue."
        : "Profit Margin is computed from derived profit divided by revenue.",
    });
  }
  if (businessModel.model === "SaaS") {
    if (saas?.mappings.mrr) kpis.push(sumMappedKpi("mrr", saas.mappings.mrr, rows, "MRR", "currency", saas.confidence));
    if (saas?.mappings.arr) kpis.push(sumMappedKpi("arr", saas.mappings.arr, rows, "ARR", "currency", saas.confidence));
    if (saas?.mappings.subscription_revenue && !saas.mappings.revenue) kpis.push(sumMappedKpi("subscription_revenue", saas.mappings.subscription_revenue, rows, "Subscription Revenue", "currency", saas.confidence));
    if (saas?.mappings.expansion_mrr) kpis.push(sumMappedKpi("expansion_mrr", saas.mappings.expansion_mrr, rows, "Expansion MRR", "currency", saas.confidence));
    if (saas?.mappings.contraction_mrr) kpis.push(sumMappedKpi("contraction_mrr", saas.mappings.contraction_mrr, rows, "Contraction MRR", "currency", saas.confidence));
    if (saas?.mappings.customer_id) kpis.push(uniqueMappedKpi("customers", saas.mappings.customer_id, rows, "Customers", saas.confidence));
    if (saas?.mappings.customer_count) kpis.push(latestMappedKpi("customers", saas.mappings.customer_count, rows, "Customers", "number", saas.confidence, saas.mappings.period));
    if (saas?.mappings.subscription_id) kpis.push(uniqueMappedKpi("subscriptions", saas.mappings.subscription_id, rows, "Subscriptions", saas.confidence));
    if (saas?.mappings.new_customers) kpis.push(latestMappedKpi("new_customers", saas.mappings.new_customers, rows, "New Customers", "number", saas.confidence, saas.mappings.period));
    if (saas?.mappings.churned_customers) kpis.push(latestMappedKpi("churned_customers", saas.mappings.churned_customers, rows, "Churned Customers", "number", saas.confidence, saas.mappings.period));
    if (saas?.mappings.churn_rate) kpis.push(latestMappedRateKpi("churn_rate", saas.mappings.churn_rate, rows, "Churn Rate", saas.confidence, saas.mappings.period));
    if (!saas?.mappings.churned_customers && !saas?.mappings.churn_rate && saas?.mappings.churn) {
      const churned = countSaasPositiveRows(rows, saas.mappings.churn, saas.mappings.customer_id);
      kpis.push({
        id: "churned_customers",
        title: "Churned Customers",
        value: churned,
        format: "number",
        sourceColumns: [saas.mappings.churn],
        confidence: saas.confidence,
        explanation: "Churned Customers counts normalized churn-positive values from the detected SaaS churn field.",
      });
      if (saas.mappings.customer_id) {
        const customers = uniqueCountFromRows(rows, saas.mappings.customer_id);
        kpis.push({
          id: "churn_rate",
          title: "Churn Rate",
          value: customers > 0 ? round((churned / customers) * 100) : null,
          format: "percentage",
          sourceColumns: [saas.mappings.churn, saas.mappings.customer_id],
          confidence: saas.confidence,
          explanation: "Churn Rate is computed from churn-positive customers divided by distinct source customer identifiers.",
        });
      }
    }
    const plans = columns.find((column) => /plan|tier|subscription/.test(column.normalizedName)) || allByRole("Category")[0];
    if (plans) kpis.push(uniqueKpi("plans", plans, rows, "Plans"));
  }

  return kpis.slice(0, 14);
}

function latestMappedKpi(id: string, column: string, rows: Record<string, unknown>[], title: string, format: KpiFormat, confidence: number, periodColumn?: string): DynamicKpi {
  const value = latestMappedValue(rows, column, periodColumn);
  return {
    id,
    title,
    value: value === null ? null : round(value),
    format,
    sourceColumns: [column],
    confidence,
    explanation: periodColumn
      ? `${title} uses the latest-period source SaaS snapshot field "${column}".`
      : `${title} uses the source SaaS snapshot field "${column}" when the dataset has a single defensible snapshot row.`,
  };
}

function latestMappedRateKpi(id: string, column: string, rows: Record<string, unknown>[], title: string, confidence: number, periodColumn?: string): DynamicKpi {
  const sourceRows = latestRowsByPeriod(rows, periodColumn);
  const values = sourceRows.map((row) => toNumber(row[column])).filter((value): value is number => value !== null).map(normalizePercentValue).filter((value): value is number => value !== null);
  return {
    id,
    title,
    value: values.length > 0 ? round(values.reduce((total, value) => total + value, 0) / values.length) : null,
    format: "percentage",
    sourceColumns: [column],
    confidence,
    explanation: periodColumn
      ? `${title} uses the latest-period SaaS rate field "${column}" and never sums percentage values.`
      : `${title} averages the SaaS rate field "${column}" and never sums percentage values.`,
  };
}

function latestMappedValue(rows: Record<string, unknown>[], column: string, periodColumn?: string) {
  if (!periodColumn && rows.length > 1) return null;
  const sourceRows = latestRowsByPeriod(rows, periodColumn);
  const values = sourceRows.map((row) => toNumber(row[column])).filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0);
}

function latestRowsByPeriod(rows: Record<string, unknown>[], periodColumn?: string) {
  if (!periodColumn) return rows;
  const keyed = rows
    .map((row) => ({ row, key: normalizePeriodKey(row[periodColumn]) }))
    .filter((item): item is { row: Record<string, unknown>; key: string } => Boolean(item.key));
  if (keyed.length === 0) return rows;
  const latest = keyed.map((item) => item.key).sort().at(-1);
  return latest ? keyed.filter((item) => item.key === latest).map((item) => item.row) : rows;
}

function normalizePeriodKey(value: unknown) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return formatCalendarDate(value);
  const raw = String(value).trim();
  if (!raw) return null;
  const dateOnly = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2].padStart(2, "0")}-${dateOnly[3].padStart(2, "0")}`;
  const month = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (month) return `${month[1]}-${month[2].padStart(2, "0")}-01`;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  const year = raw.match(/^(\d{4})$/);
  if (year) return `${year[1]}-01-01`;
  return raw.toLowerCase();
}

function formatCalendarDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizePercentValue(value: number) {
  if (!Number.isFinite(value) || value < 0) return null;
  if (value <= 1) return round(value * 100);
  if (value <= 100) return round(value);
  return null;
}

function sumMappedKpi(id: string, column: string, rows: Record<string, unknown>[], title: string, format: KpiFormat, confidence: number): DynamicKpi {
  return {
    id,
    title,
    value: round(sumColumn(rows, column)),
    format,
    sourceColumns: [column],
    confidence,
    explanation: `${title} is computed from the SaaS semantic field "${column}".`,
  };
}

function uniqueMappedKpi(id: string, column: string, rows: Record<string, unknown>[], title: string, confidence: number): DynamicKpi {
  return {
    id,
    title,
    value: new Set(rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean)).size,
    format: "number",
    sourceColumns: [column],
    confidence,
    explanation: `${title} counts unique values from the SaaS semantic field "${column}".`,
  };
}

function countSaasPositiveRows(rows: Record<string, unknown>[], column: string, idColumn?: string) {
  if (!idColumn) {
    return rows.filter((row) => /^(true|yes|1|churned|cancelled|canceled|lost)$/i.test(String(row[column] ?? "").trim())).length;
  }
  return new Set(rows
    .filter((row) => /^(true|yes|1|churned|cancelled|canceled|lost)$/i.test(String(row[column] ?? "").trim()))
    .map((row) => String(row[idColumn] ?? "").trim())
    .filter(Boolean)).size;
}

function sumKpi(id: string, column: SemanticColumnScan, rows: Record<string, unknown>[], title: string, format: KpiFormat = "currency"): DynamicKpi {
  return {
    id,
    title,
    value: round(sumColumn(rows, column.columnName)),
    format,
    sourceColumns: [column.columnName],
    confidence: column.confidence,
    explanation: `${title} is computed from the detected ${column.canonicalRole.toLowerCase()} column "${column.columnName}".`,
  };
}

function uniqueKpi(id: string, column: SemanticColumnScan, rows: Record<string, unknown>[], title: string): DynamicKpi {
  return {
    id,
    title,
    value: new Set(rows.map((row) => String(row[column.columnName] ?? "").trim()).filter(Boolean)).size,
    format: "number",
    sourceColumns: [column.columnName],
    confidence: column.confidence,
    explanation: `${title} counts unique values from the detected ${column.canonicalRole.toLowerCase()} column "${column.columnName}".`,
  };
}

function averageKpi(id: string, column: SemanticColumnScan, rows: Record<string, unknown>[], title: string, format: KpiFormat = "currency"): DynamicKpi {
  const values = rows.map((row) => toNumber(row[column.columnName])).filter((value): value is number => value !== null);
  return {
    id,
    title,
    value: values.length > 0 ? round(values.reduce((total, value) => total + value, 0) / values.length) : null,
    format,
    sourceColumns: [column.columnName],
    confidence: column.confidence,
    explanation: `${title} is averaged from the detected ${column.canonicalRole.toLowerCase()} column "${column.columnName}".`,
  };
}

function generateDashboard(input: {
  businessModel: BusinessModelDetection;
  columns: SemanticColumnScan[];
  relationships: RelationshipDetection[];
  kpis: DynamicKpi[];
  generatedAt: string;
}): DynamicDashboardDefinition {
  const widgets: DynamicDashboardWidget[] = input.kpis.slice(0, 6).map((kpi) => ({
    id: `kpi_${kpi.id}`,
    type: "kpi",
    title: kpi.title,
    sourceColumns: kpi.sourceColumns,
    confidence: kpi.confidence,
    explanation: kpi.explanation,
  }));
  const revenue = input.columns.find((column) => compatibleRoles("Revenue").includes(column.canonicalRole));
  const date = input.columns.find((column) => column.canonicalRole === "Date");
  const dimensions = input.columns.filter((column) => ["Category", "Product Category", "Country", "Geography", "Region", "City", "Product", "Seller", "Merchant", "Customer", "Buyer", "Company"].includes(column.canonicalRole));
  if (revenue && date) {
    widgets.push({ id: "revenue_over_time", type: "line", title: `${revenue.canonicalRole} over time`, xAxis: date.columnName, yAxis: revenue.columnName, sourceColumns: [date.columnName, revenue.columnName], confidence: Math.min(date.confidence, revenue.confidence), explanation: "A time-series chart is generated because date and revenue semantics are both present." });
  }
  for (const dimension of dimensions.slice(0, 3)) {
    const metric = revenue || input.columns.find((column) => column.canonicalRole === "Quantity" || column.canonicalRole === "Profit");
    if (!metric) continue;
    widgets.push({ id: `${metric.normalizedName}_by_${dimension.normalizedName}`, type: "bar", title: `${metric.canonicalRole} by ${humanizeColumnName(dimension.columnName)}`, xAxis: dimension.columnName, yAxis: metric.columnName, sourceColumns: [dimension.columnName, metric.columnName], confidence: Math.min(dimension.confidence, metric.confidence), explanation: "A grouped chart is generated from semantic dimension and metric roles." });
  }
  if (input.relationships.length > 0) {
    widgets.push({ id: "semantic_relationships", type: "table", title: "Detected Relationships", sourceColumns: Array.from(new Set(input.relationships.flatMap((relationship) => relationship.columns))), confidence: Math.max(...input.relationships.map((relationship) => relationship.confidence)), explanation: "A relationship table explains formulas and dependencies detected in the dataset." });
  }

  return {
    businessModel: input.businessModel.model,
    kpis: input.kpis,
    widgets,
    generatedFrom: "semantic-dataset-intelligence-engine",
    generatedAt: input.generatedAt,
  };
}

function buildAiContext(input: {
  businessModel: BusinessModelDetection;
  saas: SaasSemanticResolution | null;
  columns: SemanticColumnScan[];
  relationships: RelationshipDetection[];
  kpis: DynamicKpi[];
}): DatasetIntelligenceEngineResult["aiContext"] {
  const averageColumnConfidence = input.columns.length > 0
    ? roundConfidence(input.columns.reduce((total, column) => total + column.confidence, 0) / input.columns.length)
    : 0;
  return {
    businessModel: input.businessModel,
    saas: input.saas,
    semanticColumns: input.columns.map((column) => ({
      columnName: column.columnName,
      canonicalRole: column.canonicalRole,
      primaryValueType: column.primaryValueType,
      confidence: column.confidence,
      explanation: column.explanation,
    })),
    relationships: input.relationships,
    kpis: input.kpis,
    confidenceSummary: {
      averageColumnConfidence,
      modelConfidence: input.businessModel.confidence,
      lowConfidenceColumns: input.columns.filter((column) => column.confidence < 0.55).map((column) => column.columnName),
    },
    governance: {
      confidence: roundConfidence((averageColumnConfidence + input.businessModel.confidence) / 2),
      evidence: [
        input.businessModel.explanation,
        ...input.columns.slice(0, 8).map((column) => `${column.columnName}: ${column.explanation}`),
        ...input.relationships.slice(0, 4).map((relationship) => relationship.explanation),
        ...input.kpis.slice(0, 6).map((kpi) => `${kpi.title}: ${kpi.explanation}`),
      ].filter(Boolean),
      calculationSource: "deterministic_dataset_intelligence_engine",
      datasetSource: "selected_dataset_rows",
      providerSource: "none",
      providerDisclosure: "No provider-generated values were used.",
    },
  };
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function humanizeColumnName(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function sumColumn(rows: Record<string, unknown>[], column: string) {
  return rows.reduce((total, row) => total + (toNumber(row[column]) ?? 0), 0);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function roundConfidence(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}
