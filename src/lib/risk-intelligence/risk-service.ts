import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { isSuperadmin } from "@/lib/auth/builtin-users"
import { canAccessAllDatasets, loadDatasetData } from "@/lib/data/dataset-access"
import { normalizeDatasetCategory, resolveDatasetType, type DatasetCategory } from "@/lib/data/dataset-category"
import { formatCanonicalIsoTimestamp } from "@/lib/data/canonical-date"
import { getDatasetSourceLabel } from "@/lib/data/dataset-source"
import {
  calculateRiskIntelligence,
  getRiskDatasetEligibility,
  getDatasetTypeLabel,
  isSupportedRiskDatasetType,
  type RiskIntelligenceResult,
} from "@/lib/risk-intelligence/risk-engine"
import { and, desc, eq, ne } from "drizzle-orm"

export type RiskUserContext = {
  id: string
  role?: string | null
  email?: string | null
}

export type RiskDatasetSummary = {
  id: string
  name: string
  fileName: string | null
  datasetType: string
  datasetTypeLabel: string
  semanticDatasetType: string | null
  semanticDatasetTypeLabel: string | null
  semanticConfidence: string | null
  source: string | null
  sourceLabel: string
  applicableModules: string[]
  applicableRuleCount: number
  rowCount: number
  columnCount: number
  /** ISO timestamp or null when the stored value is not a valid date. */
  createdAt: string | null
  /** ISO timestamp or null when the stored value is not a valid date. */
  updatedAt: string | null
  supported: boolean
}

export type RiskModuleScope = DatasetCategory

export type RiskDatasetListOptions = {
  scope?: string | null
  datasetId?: string | null
}

export type RiskDatasetSelection = {
  selectedDatasetId: string | null
  staleSelection: boolean
}

export type RiskDatasetRow = {
  id: string
  name: string | null
  fileName: string | null
  rowCount: number | null
  columnCount: number | null
  columns?: string[] | null
  data?: Record<string, unknown>[] | null
  datasetType: string | null
  analysis: unknown
  status: string
  source?: string | null
  createdAt: Date | string | null
  updatedAt: Date | string | null
}

export type RiskCalculationOptions = {
  scope?: string | null
}

export type RiskAccessResult =
  | { success: true; result: RiskIntelligenceResult }
  | { success: false; status: 400 | 403 | 404 | 503; error: string; code: string }

export function canAccessRiskDataset(user: RiskUserContext, datasetOwnerId: string) {
  return user.id === datasetOwnerId || canAccessAllDatasets(user.role) || isSuperadmin(user)
}

/**
 * Map one stored dataset row to a Risk dataset summary without throwing.
 * Metadata timestamps go through canonical validation; invalid or missing
 * timestamps become null so one bad candidate row can never break the
 * workspace listing that determines the initial dataset.
 *
 * This mapping never decides eligibility: only the canonical capability
 * helper (`getRiskDatasetEligibility`) may exclude a dataset, so user-authored
 * names — including ClevrSync spreadsheet titles that contain words like
 * "test" or "sample" — can never veto a capable dataset.
 */
export function toRiskDatasetSummary(row: RiskDatasetRow): RiskDatasetSummary | null {
  const datasetType = resolveDatasetType(row.datasetType, row.analysis)
  const source = row.source || analysisString(row.analysis, "source")
  return {
    id: row.id,
    name: row.name || row.id,
    fileName: row.fileName || null,
    datasetType,
    datasetTypeLabel: getDatasetTypeLabel(datasetType),
    semanticDatasetType: null,
    semanticDatasetTypeLabel: null,
    semanticConfidence: null,
    source,
    sourceLabel: riskDatasetSourceLabel(source, row.analysis),
    applicableModules: [],
    applicableRuleCount: 0,
    rowCount: row.rowCount || 0,
    columnCount: row.columnCount || 0,
    createdAt: formatCanonicalIsoTimestamp(row.createdAt),
    updatedAt: formatCanonicalIsoTimestamp(row.updatedAt),
    supported: isSupportedRiskDatasetType(datasetType),
  }
}

export async function listRiskIntelligenceDatasets(
  user: RiskUserContext,
  options: RiskDatasetListOptions = {},
): Promise<RiskDatasetSummary[]> {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const canReadAll = canAccessAllDatasets(user.role) || isSuperadmin(user)
  const scope = normalizeRiskModuleScope(options.scope)
  const datasetId = normalizeId(options.datasetId)
  const whereConditions = [
    canReadAll ? undefined : eq(datasets.userId, user.id),
    datasetId ? eq(datasets.id, datasetId) : undefined,
    ne(datasets.status, "deleted"),
    ne(datasets.status, "archived"),
  ].filter(Boolean) as Parameters<typeof and>

  const rows = await db.query.datasets.findMany({
    where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    columns: {
      id: true,
      name: true,
      fileName: true,
      rowCount: true,
      columnCount: true,
      columns: true,
      data: true,
      datasetType: true,
      analysis: true,
      source: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [desc(datasets.createdAt)],
    limit: datasetId ? 1 : 100,
  })

  const summaries: RiskDatasetSummary[] = []
  for (const row of dedupeByDatasetId(rows as RiskDatasetRow[])) {
    if (!isVisibleRiskDataset(row.id, row.name, row.fileName)) continue
    const summary = toRiskDatasetSummary(row)
    if (!summary) continue
    const rowsForDataset = await loadDatasetData(row.id, row as typeof datasets.$inferSelect)
    const eligibility = getRiskDatasetEligibility(
      {
        id: row.id,
        name: row.name || row.id,
        fileName: row.fileName || null,
        datasetType: summary.datasetType,
        rowCount: row.rowCount,
        columns: Array.isArray((row as { columns?: unknown }).columns) ? ((row as { columns: string[] }).columns) : null,
        analysis: row.analysis,
      },
      rowsForDataset,
    )

    if (!eligibility.eligible) continue
    if (scope && eligibility.semanticDatasetType !== scope) continue

    summaries.push({
      ...summary,
      semanticDatasetType: eligibility.semanticDatasetType,
      semanticDatasetTypeLabel: eligibility.semanticDatasetType
        ? getDatasetTypeLabel(eligibility.semanticDatasetType)
        : null,
      semanticConfidence: eligibility.semanticConfidence,
      applicableModules: eligibility.applicableModuleLabels,
      applicableRuleCount: eligibility.applicableRuleCount,
      supported: eligibility.eligible,
    })
  }

  return summaries
}

export async function calculateRiskIntelligenceForDataset(
  datasetId: string,
  user: RiskUserContext,
  options: RiskCalculationOptions = {},
): Promise<RiskAccessResult> {
  const db = getDb()
  if (!db) {
    return {
      success: false,
      status: 503,
      error: "Database connection is unavailable.",
      code: "database_unavailable",
    }
  }

  const scope = normalizeRiskModuleScope(options.scope)
  const canReadAll = canAccessAllDatasets(user.role) || isSuperadmin(user)
  const whereConditions = [
    eq(datasets.id, datasetId),
    canReadAll ? undefined : eq(datasets.userId, user.id),
    ne(datasets.status, "deleted"),
    ne(datasets.status, "archived"),
  ].filter(Boolean) as Parameters<typeof and>
  const dataset = await db.query.datasets.findFirst({
    where: and(...whereConditions),
  })

  if (!dataset) {
    return { success: false, status: 404, error: "Dataset not found.", code: "dataset_not_found" }
  }

  if (!canAccessRiskDataset(user, dataset.userId)) {
    return { success: false, status: 403, error: "Dataset access denied.", code: "dataset_access_denied" }
  }

  const datasetType = resolveDatasetType(dataset.datasetType, dataset.analysis)

  const rows = await loadDatasetData(dataset.id, dataset)
  const eligibility = getRiskDatasetEligibility({ ...dataset, datasetType }, rows)

  if (!isVisibleRiskDataset(dataset.id, dataset.name, dataset.fileName)) {
    // Known internal synthetic-record markers stay hidden even when the stored
    // data would be computable; real user datasets never carry them.
    return {
      success: false,
      status: 404,
      error: "Dataset not found.",
      code: "dataset_not_found",
    }
  }
  if (!eligibility.eligible) {
    return {
      success: false,
      status: 400,
      error: "Dataset type is not supported for Risk Intelligence.",
      code: "unsupported_dataset_type",
    }
  }

  if (scope && eligibility.semanticDatasetType !== scope) {
    return {
      success: false,
      status: 404,
      error: `No ${getDatasetTypeLabel(scope)} dataset is available for this Risk Intelligence scope.`,
      code: "dataset_scope_mismatch",
    }
  }

  const result = calculateRiskIntelligence({ ...dataset, datasetType }, rows)

  if (!result) {
    return {
      success: false,
      status: 400,
      error: "No supported business data is available yet. Upload or connect a dataset to generate risk intelligence.",
      code: "no_supported_business_data",
    }
  }

  return { success: true, result }
}

export function resolveRiskDatasetSelection(
  eligibleDatasets: Array<Pick<RiskDatasetSummary, "id">>,
  requestedDatasetId?: string | null,
): RiskDatasetSelection {
  const requested = normalizeId(requestedDatasetId)
  if (requested) {
    const selected = eligibleDatasets.find((dataset) => dataset.id === requested)
    return {
      selectedDatasetId: selected?.id || null,
      staleSelection: !selected,
    }
  }

  return {
    selectedDatasetId: eligibleDatasets.length === 1 ? eligibleDatasets[0]?.id || null : null,
    staleSelection: false,
  }
}

export function normalizeRiskModuleScope(value?: string | null): RiskModuleScope | null {
  return normalizeDatasetCategory(value)
}

export function riskScopeEmptyMessage(scope?: string | null) {
  const normalized = normalizeRiskModuleScope(scope)
  if (normalized === "prebookkeeping") return "No Pre-bookkeeping dataset available. Upload an accounting file first."
  if (normalized === "accountancy") return "No Accountancy dataset available. Upload an accounting file first."
  if (normalized === "retail") return "No Retail dataset available. Upload or connect retail data first."
  if (normalized === "profitability") return "No Profitability dataset available. Upload a profitability file first."
  if (normalized === "standard") return "No Standard dataset available. Upload a dataset first."
  return "No supported business data is available yet. Upload or connect a dataset to generate risk intelligence."
}

function normalizeId(value?: string | null) {
  const text = value?.trim()
  return text || null
}

function dedupeByDatasetId<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })
}

/**
 * Visibility guard for known internal synthetic-record identities, not a
 * dataset-content veto. Synthetic QA identity markers (provider-path and
 * dashboard-check records) stay hidden from production selectors and
 * calculations. Ordinary name words can never hide a dataset: Risk
 * eligibility is decided only by owner scope, dataset status, and the
 * canonical semantic capability helper.
 */
function isVisibleRiskDataset(id: string, name: string | null | undefined, fileName: string | null | undefined) {
  const text = [id, name, fileName].filter(Boolean).join(" ").toLowerCase()
  if (text.includes("provider_path_dataset")) return false
  if (text.includes("codex-selected-dashboard-check")) return false
  return true
}

function riskDatasetSourceLabel(source: string | null | undefined, analysis: unknown) {
  const base = getDatasetSourceLabel(source)
  const uploadSource = analysisString(analysis, "uploadSource")
  if (uploadSource === "clevrsync" && base !== "ClevrSync") return `${base} / ClevrSync`
  return base
}

function analysisString(analysis: unknown, key: string) {
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) return null
  const value = (analysis as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}
