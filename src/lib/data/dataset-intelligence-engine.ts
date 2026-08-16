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
  kpis: DynamicKpi[];
  dashboard: DynamicDashboardDefinition;
  aiContext: {
    businessModel: BusinessModelDetection;
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

const MODEL_PATTERNS: Record<Exclude<SemanticBusinessModel, "Generic">, RegExp[]> = {
  Retail: [/\bretail\b|\bstore\b|\bshop\b/, /\bsku\b|\bproduct\b|\bitem\b/, /\binventory\b|\bstock\b|\breorder\b/, /\bsupplier\b|\bvendor\b/],
  Marketplace: [/\bmarketplace\b|\bgmv\b|\bgross_merchandise_value\b|\bgross_merchandise\b/, /\bseller\b|\bbuyer\b/, /\bplatform_fee\b|\bcommission\b|\btake_rate\b/, /\blisting\b/],
  POS: [/\bpos\b|\btill\b|\bcashier\b/, /\breceipt\b|\btransaction\b/, /\bstore\b|\bterminal\b/],
  Inventory: [/\binventory\b|\bstock\b|\bwarehouse\b/, /\breorder\b|\blead_time\b/, /\bsku\b|\bitem\b/],
  Accounting: [/\bledger\b|\bjournal\b|\bdebit\b|\bcredit\b/, /\binvoice\b|\bpayment\b/, /\btax\b|\bvat\b|\bgst\b/],
  CRM: [/\bcustomer\b|\bclient\b|\bcontact\b|\blead\b/, /\bemail\b|\bphone\b/, /\bpipeline\b|\bopportunity\b/],
  SaaS: [/\bmrr\b|\barr\b|\brecurring\b|\bsubscription\b/, /\bchurn\b|\bretention\b|\brenewal\b/, /\bplan\b|\bseat\b|\baccount\b/],
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
  const kpis = generateKpis(rows, columns, businessModel);
  const dashboard = generateDashboard({ businessModel, columns, relationships, kpis, generatedAt });

  return {
    version: "die.v1",
    generatedAt,
    fileStructure,
    columns,
    relationships,
    businessModel,
    kpis,
    dashboard,
    aiContext: buildAiContext({ businessModel, columns, relationships, kpis }),
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
    { type: "Phone", count: sample.filter((value) => /^\+?[\d\s().-]{7,}$/.test(value) && /[\s().-]/.test(value)).length },
    { type: "UUID", count: sample.filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)).length },
    { type: "Boolean", count: sample.filter((value) => /^(true|false|yes|no|0|1)$/i.test(value)).length },
    { type: "Date", count: sample.filter((value) => !Number.isNaN(Date.parse(value)) && /[-/]\d{1,2}[-/]|\d{4}/.test(value)).length },
    { type: "Money", count: sample.filter((value) => /^[€$£]|[€$£]$/.test(value) || /^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(value)).length },
    { type: "Percentage", count: sample.filter((value) => /%$/.test(value) || (/^-?\d+(\.\d+)?$/.test(value) && Number(value) >= -100 && Number(value) <= 100)).length },
    { type: "Currency", count: sample.filter((value) => CURRENCY_CODES.has(value.toUpperCase())).length },
    { type: "Country", count: sample.filter((value) => COUNTRY_CODES.has(value.toUpperCase()) || /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(value)).length },
    { type: "SKU", count: sample.filter((value) => /^[A-Z0-9][A-Z0-9_-]{3,}$/i.test(value) && /\d/.test(value)).length },
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

function detectRelationships(columns: SemanticColumnScan[]): RelationshipDetection[] {
  const byRole = (role: CanonicalSemanticRole) => columns.find((column) => compatibleRoles(role).includes(column.canonicalRole));
  const allByRole = (role: CanonicalSemanticRole) => columns.filter((column) => compatibleRoles(role).includes(column.canonicalRole));
  const relationships: RelationshipDetection[] = [];
  const revenue = byRole("Revenue");
  const cost = byRole("Cost");
  const profit = byRole("Profit");
  const commission = byRole("Commission");
  const margin = byRole("Margin") || byRole("Percentage");
  const quantity = byRole("Quantity");
  const buyer = byRole("Buyer") || byRole("Customer");

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
  const scores: Partial<Record<Exclude<SemanticBusinessModel, "Generic">, number>> = {};
  if (has("Seller") && has("Buyer") && (has("Revenue") || has("Commission"))) scores.Marketplace = 2.5;
  if (has("SKU") && has("Quantity") && (has("Product") || has("Category"))) scores.Inventory = 1.5;
  if (has("Invoice") && (has("Cost") || has("Revenue") || has("Account"))) scores.Accounting = 1.5;
  if (has("Customer") && (has("Email") || has("Phone") || has("Status"))) scores.CRM = 1.5;
  if (has("Employee")) scores.HR = 1.5;
  if (has("Revenue") && has("Date") && has("Category")) scores.Finance = 0.8;
  return scores;
}

function generateKpis(rows: Record<string, unknown>[], columns: SemanticColumnScan[], businessModel: BusinessModelDetection): DynamicKpi[] {
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
  if (quantity) kpis.push(sumKpi("quantity", quantity, rows, "Quantity", "number"));
  if (revenue) {
    const orderCount = order
      ? new Set(rows.map((row) => String(row[order.columnName] ?? "").trim()).filter(Boolean)).size
      : rows.length;
    kpis.push({
      id: "average_order_value",
      title: "Average Order Value",
      value: orderCount > 0 ? round(sumColumn(rows, revenue.columnName) / orderCount) : null,
      format: "currency",
      sourceColumns: [revenue.columnName, ...(order ? [order.columnName] : [])],
      confidence: revenue.confidence,
      explanation: order
        ? "Average order value is computed from the detected revenue metric divided by the number of distinct orders."
        : "Average order value is computed from the detected revenue metric divided by record count because no order ID column was detected.",
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
  if (revenue && cost && sumColumn(rows, revenue.columnName) > 0) {
    kpis.push({
      id: "gross_margin",
      title: "Gross Margin",
      value: round(((sumColumn(rows, revenue.columnName) - sumColumn(rows, cost.columnName)) / sumColumn(rows, revenue.columnName)) * 100),
      format: "percentage",
      sourceColumns: [revenue.columnName, cost.columnName],
      confidence: Math.min(revenue.confidence, cost.confidence),
      explanation: "Gross margin is computed from detected revenue and cost metrics.",
    });
  }
  if (businessModel.model === "SaaS") {
    const plans = columns.find((column) => /plan|tier|subscription/.test(column.normalizedName)) || allByRole("Category")[0];
    if (plans) kpis.push(uniqueKpi("plans", plans, rows, "Plans"));
  }

  return kpis.slice(0, 14);
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
  const dimensions = input.columns.filter((column) => ["Category", "Product Category", "Country", "Geography", "Region", "City", "Product", "Seller", "Merchant", "Customer", "Buyer"].includes(column.canonicalRole));
  if (revenue && date) {
    widgets.push({ id: "revenue_over_time", type: "line", title: `${revenue.canonicalRole} over time`, xAxis: date.columnName, yAxis: revenue.columnName, sourceColumns: [date.columnName, revenue.columnName], confidence: Math.min(date.confidence, revenue.confidence), explanation: "A time-series chart is generated because date and revenue semantics are both present." });
  }
  for (const dimension of dimensions.slice(0, 3)) {
    const metric = revenue || input.columns.find((column) => column.canonicalRole === "Quantity" || column.canonicalRole === "Profit");
    if (!metric) continue;
    widgets.push({ id: `${metric.normalizedName}_by_${dimension.normalizedName}`, type: "bar", title: `${metric.canonicalRole} by ${dimension.canonicalRole}`, xAxis: dimension.columnName, yAxis: metric.columnName, sourceColumns: [dimension.columnName, metric.columnName], confidence: Math.min(dimension.confidence, metric.confidence), explanation: "A grouped chart is generated from semantic dimension and metric roles." });
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
  columns: SemanticColumnScan[];
  relationships: RelationshipDetection[];
  kpis: DynamicKpi[];
}): DatasetIntelligenceEngineResult["aiContext"] {
  const averageColumnConfidence = input.columns.length > 0
    ? roundConfidence(input.columns.reduce((total, column) => total + column.confidence, 0) / input.columns.length)
    : 0;
  return {
    businessModel: input.businessModel,
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
