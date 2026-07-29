import {
  compactSemanticTerm,
  createSemanticDictionaryIndex,
  defaultSemanticDictionary,
  normalizeSemanticTerm,
  type SemanticDictionaryAliasHit,
  type SemanticDictionaryIndex,
} from "./semantic-dictionary";
import { buildDatasetStructureProfile } from "./universal-structure-scanner";
import type {
  SemanticCategory,
  SemanticColumnProfile,
  SemanticDatasetProfile,
  SemanticDictionary,
  SemanticEvidence,
  SemanticScannerInput,
  SemanticScannerLog,
  UnknownSemanticField,
} from "./semantic-types";
import type {
  DatasetColumnProfile,
  DatasetStructureProfile,
  StructureDataType,
  WorksheetStructureProfile,
} from "./structure-types";
import type { AnalysisResult, PipelineContext, Scanner, ScannerExecutionOptions } from "./types";

const DEFAULT_MINIMUM_CONFIDENCE = 0.62;
const MAX_ALTERNATIVES = 4;
const semanticProfileCache = new Map<string, SemanticDatasetProfile>();

interface CategoryScore {
  category: Exclude<SemanticCategory, "Unknown">;
  score: number;
  reason: string;
  aliases: string[];
  dictionaryHits: Array<{ alias: string; language: string; weight: number }>;
  evidence: SemanticEvidence[];
  alternatives?: CategoryScore[];
}

interface WorksheetColumnPair {
  worksheet: WorksheetStructureProfile;
  column: DatasetColumnProfile;
}

export class UniversalSemanticIntelligenceScanner implements Scanner {
  id(): string {
    return "edie.semantic-scanner.v1";
  }

  name(): string {
    return "Universal Semantic Intelligence Scanner";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 20;
  }

  supports(context: PipelineContext): boolean {
    return (
      hasStructureProfile(context) ||
      Boolean(context.dataset.rawText || context.dataset.rawBuffer || context.dataset.rows?.length)
    );
  }

  validate(context: PipelineContext) {
    const valid = this.supports(context);

    return {
      valid,
      warnings: hasStructureProfile(context)
        ? []
        : ["Semantic scanner will build a structure profile before semantic analysis."],
      errors: valid
        ? []
        : ["Semantic scanner requires a structure profile or dataset source content."],
    };
  }

  execute(context: PipelineContext, options: ScannerExecutionOptions): AnalysisResult {
    const startedAtMs = Date.now();

    if (options.signal.aborted) {
      return {
        scannerId: this.id(),
        status: "cancelled",
        confidence: 0,
        duration: Date.now() - startedAtMs,
        warnings: [],
        errors: ["Scanner execution was cancelled before semantic analysis."],
        metadata: {},
        executionTime: new Date().toISOString(),
        scannerVersion: this.version(),
      };
    }

    const structureProfile = getStructureProfile(context) ?? buildDatasetStructureProfile(context);
    const semanticProfile = buildSemanticDatasetProfile({ structureProfile });

    return {
      scannerId: this.id(),
      status: "completed",
      confidence: semanticProfile.confidence,
      duration: Date.now() - startedAtMs,
      warnings: semanticProfile.warnings,
      errors: semanticProfile.errors,
      metadata: {
        semanticProfile,
        semanticCoveragePercent: semanticProfile.coveragePercent,
        semanticQualityScore: semanticProfile.qualityScore,
        unknownFieldCount: semanticProfile.unknownFields.length,
      },
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
      contextPatch: {
        schema: { structureProfile },
        semanticMap: { semanticProfile },
        confidence: { [this.id()]: semanticProfile.confidence },
        warnings: semanticProfile.warnings,
      },
    };
  }
}

export function buildSemanticDatasetProfile(input: SemanticScannerInput): SemanticDatasetProfile {
  const dictionary = input.dictionary ?? defaultSemanticDictionary;
  const minimumConfidence = input.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;
  const cacheKey = buildSemanticCacheKey(input.structureProfile, dictionary, minimumConfidence);
  const cached = semanticProfileCache.get(cacheKey);

  if (cached) {
    return cloneSemanticProfile({
      ...cached,
      generatedAt: new Date().toISOString(),
      cache: { key: cacheKey, hit: true },
    });
  }

  const index = createSemanticDictionaryIndex(dictionary);
  const columns = flattenWorksheetColumns(input.structureProfile);
  const preliminary = columns.map(({ worksheet, column }) =>
    scoreColumn(column, worksheet, index, []),
  );
  const confidentNeighborCategories = preliminary
    .filter((score) => score.score >= minimumConfidence)
    .map((score) => score.category);
  const semanticColumns = columns.map(({ worksheet, column }) =>
    buildColumnProfile(
      column,
      worksheet,
      scoreColumn(column, worksheet, index, confidentNeighborCategories),
      minimumConfidence,
    ),
  );
  const unknownFields = semanticColumns.filter((column) => column.needsReview).map(toUnknownField);
  const warnings = buildSemanticWarnings(semanticColumns, input.structureProfile);
  const dictionaryHits = semanticColumns.flatMap((column) =>
    column.dictionaryHits.map((alias) => ({
      columnName: column.columnName,
      category: column.semanticCategory,
      alias,
      language: findAliasLanguage(alias, column.semanticCategory, index),
      weight: findAliasWeight(alias, column.semanticCategory, index),
    })),
  );
  const evidence = Object.fromEntries(
    semanticColumns.map((column) => [
      `${column.worksheetName}:${column.position}:${column.columnName}`,
      column.evidence,
    ]),
  );
  const knownColumns = semanticColumns.filter((column) => column.semanticCategory !== "Unknown");
  const coveragePercent =
    semanticColumns.length === 0
      ? 0
      : roundScore((knownColumns.length / semanticColumns.length) * 100);
  const qualityScore = roundScore(
    coveragePercent * 0.55 +
      average(semanticColumns.map((column) => column.confidence)) * 100 * 0.45,
  );
  const confidence = average(semanticColumns.map((column) => column.confidence));
  const profile: SemanticDatasetProfile = {
    version: "edie.semantic.v1",
    dictionaryVersion: dictionary.version,
    structureFingerprint: input.structureProfile.fingerprint,
    generatedAt: new Date().toISOString(),
    semanticColumns,
    unknownFields,
    warnings,
    errors: [],
    dictionaryHits,
    evidence,
    coveragePercent,
    qualityScore,
    confidence,
    cache: {
      key: cacheKey,
      hit: false,
    },
    logs: semanticColumns.map((column) => buildSemanticLog(column)),
  };

  semanticProfileCache.set(cacheKey, cloneSemanticProfile(profile));
  return profile;
}

export function clearSemanticProfileCache(): void {
  semanticProfileCache.clear();
}

function scoreColumn(
  column: DatasetColumnProfile,
  worksheet: WorksheetStructureProfile,
  index: SemanticDictionaryIndex,
  neighborCategories: SemanticCategory[],
): CategoryScore {
  const scores = new Map<Exclude<SemanticCategory, "Unknown">, CategoryScore>();
  const headerEvidence = collectHeaderEvidence(column.name, index);

  for (const evidence of headerEvidence) {
    addScore(
      scores,
      evidence.category,
      evidence.score,
      evidence.alias,
      evidence.language,
      evidence.weight,
      {
        type: evidence.type,
        score: evidence.score,
        weight: evidence.weight,
        reason: evidence.reason,
        source: evidence.alias,
      },
    );
  }

  for (const entry of index.dictionary.entries) {
    const dataTypeScore = scoreDataType(column.detectedDataType.value, entry.expectedDataTypes);

    if (dataTypeScore > 0) {
      addEvidenceOnly(scores, entry.category, {
        type: "data-type",
        score: dataTypeScore,
        weight: directDataTypeCategoryWeight(column.detectedDataType.value, entry.category),
        reason: `${column.detectedDataType.value} values match expected ${entry.category} data types.`,
        source: column.detectedDataType.value,
      });
    }

    const valueScore = scoreValues(
      column,
      entry.valuePatterns.map((pattern) => pattern.id),
    );

    if (valueScore > 0) {
      addEvidenceOnly(scores, entry.category, {
        type: "value-similarity",
        score: valueScore,
        weight: entry.valuePatterns[0]?.weight ?? 0.14,
        reason: `Sample values resemble ${entry.category} values.`,
        source: column.sampleValues.slice(0, 3).map(String).join(", "),
      });
    }

    const neighborScore = scoreNeighbors(entry.neighborCategories, neighborCategories);

    if (neighborScore > 0) {
      addEvidenceOnly(scores, entry.category, {
        type: "neighbor-column",
        score: neighborScore,
        weight: 0.08,
        reason: `Nearby detected categories support ${entry.category} semantics.`,
        source: neighborCategories
          .filter((candidate) => entry.neighborCategories.includes(candidate))
          .join(", "),
      });
    }

    const statisticalScore = scoreStatistics(column, entry.category);

    if (statisticalScore > 0) {
      addEvidenceOnly(scores, entry.category, {
        type: "statistical-profile",
        score: statisticalScore,
        weight: 0.06,
        reason: `Column statistics are compatible with ${entry.category}.`,
        source: `missing=${column.missingPercent}, unique=${column.uniquePercent}`,
      });
    }
  }

  const ranked = Array.from(scores.values())
    .map(finalizeCategoryScore)
    .sort((left, right) => right.score - left.score);

  const best = ranked[0] ?? {
    category: "Revenue",
    score: 0,
    reason: "No semantic evidence matched this column.",
    aliases: [],
    dictionaryHits: [],
    evidence: [],
  };

  return { ...best, alternatives: ranked.slice(1, MAX_ALTERNATIVES + 1) };
}

function buildColumnProfile(
  column: DatasetColumnProfile,
  worksheet: WorksheetStructureProfile,
  bestScore: CategoryScore,
  minimumConfidence: number,
): SemanticColumnProfile {
  const allScores = [bestScore, ...(bestScore.alternatives ?? [])]
    .filter(
      (score, index, array) =>
        array.findIndex((candidate) => candidate.category === score.category) === index,
    )
    .sort((left, right) => right.score - left.score);
  const alternatives = allScores
    .filter((score) => score.category !== bestScore.category)
    .slice(0, MAX_ALTERNATIVES)
    .map((score) => ({ category: score.category, confidence: score.score, reason: score.reason }));
  const needsReview = bestScore.score < minimumConfidence;

  return {
    columnName: column.name,
    position: column.position,
    worksheetName: worksheet.name,
    semanticCategory: needsReview ? "Unknown" : bestScore.category,
    confidence: roundScore(bestScore.score),
    reason: needsReview
      ? `Confidence ${roundScore(bestScore.score)} is below threshold ${minimumConfidence}; field needs review.`
      : bestScore.reason,
    aliases: bestScore.aliases,
    needsReview,
    alternativeMatches: alternatives,
    evidence: bestScore.evidence,
    dictionaryHits: bestScore.dictionaryHits.map((hit) => hit.alias),
    detectedDataType: column.detectedDataType.value,
    warnings: needsReview ? ["Semantic confidence is below the review threshold."] : [],
  };
}

function collectHeaderEvidence(columnName: string, index: SemanticDictionaryIndex) {
  const normalized = normalizeSemanticTerm(columnName);
  const compact = compactSemanticTerm(columnName);
  const exactHits = index.aliasesByNormalizedTerm.get(normalized) ?? [];
  const evidence: Array<{
    category: Exclude<SemanticCategory, "Unknown">;
    alias: string;
    language: string;
    weight: number;
    score: number;
    type: "dictionary" | "header-similarity";
    reason: string;
  }> = [];

  for (const hit of exactHits) {
    evidence.push({
      category: hit.category,
      alias: hit.alias.term,
      language: hit.alias.language,
      weight: 1.1,
      score: Math.min(1, hit.alias.weight),
      type: "dictionary",
      reason: `Header exactly matches ${hit.category} dictionary alias "${hit.alias.term}".`,
    });
  }

  const tokens = normalized.split(" ").filter(Boolean);

  for (const token of tokens) {
    const tokenHits = index.aliasesByToken.get(token) ?? [];

    for (const hit of tokenHits) {
      evidence.push({
        category: hit.category,
        alias: hit.alias.term,
        language: hit.alias.language,
        weight: 0.55,
        score: Math.min(0.92, hit.alias.weight * 0.82),
        type: "dictionary",
        reason: `Header token "${token}" matches ${hit.category} dictionary alias "${hit.alias.term}".`,
      });
    }
  }

  for (const entry of index.dictionary.entries) {
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeSemanticTerm(alias.term);
      const aliasCompact = compactSemanticTerm(alias.term);
      const similarity = Math.max(
        similarityRatio(normalized, normalizedAlias),
        similarityRatio(compact, aliasCompact),
      );

      if (
        similarity >= 0.82 &&
        !exactHits.some((hit) => hit.category === entry.category && hit.alias.term === alias.term)
      ) {
        evidence.push({
          category: entry.category,
          alias: alias.term,
          language: alias.language,
          weight: 0.36,
          score: Math.min(0.88, similarity * alias.weight),
          type: "header-similarity",
          reason: `Header is similar to ${entry.category} alias "${alias.term}".`,
        });
      }
    }
  }

  return evidence;
}

function scoreDataType(
  dataType: StructureDataType,
  expectedDataTypes: StructureDataType[],
): number {
  if (expectedDataTypes.includes(dataType)) {
    return 0.88;
  }

  if (dataType === "Integer" && expectedDataTypes.includes("Decimal")) {
    return 0.68;
  }

  if (dataType === "Decimal" && expectedDataTypes.includes("Currency")) {
    return 0.58;
  }

  if (
    dataType === "Text" &&
    expectedDataTypes.some((type) => ["Email", "Phone", "URL", "UUID"].includes(type))
  ) {
    return 0.42;
  }

  return 0;
}

function directDataTypeCategoryWeight(
  dataType: StructureDataType,
  category: SemanticCategory,
): number {
  if (
    (dataType === "Email" && category === "Email") ||
    (dataType === "Phone" && category === "Phone") ||
    (dataType === "URL" && category === "Website") ||
    (dataType === "Date" && category === "Date") ||
    (dataType === "DateTime" && (category === "Date" || category === "Time")) ||
    (dataType === "Time" && category === "Time") ||
    (dataType === "Percentage" && category === "Margin") ||
    (dataType === "Boolean" && category === "Boolean Flag")
  ) {
    return 0.5;
  }

  return 0.16;
}

function scoreValues(column: DatasetColumnProfile, patternIds: string[]): number {
  const values = column.sampleValues.map((value) => String(value ?? "").trim()).filter(Boolean);

  if (values.length === 0 || patternIds.length === 0) {
    return 0;
  }

  const matches = values.filter((value) =>
    patternIds.some((patternId) => valueMatchesPattern(value, patternId)),
  ).length;
  return matches === 0 ? 0 : roundScore(matches / values.length);
}

function valueMatchesPattern(value: string, patternId: string): boolean {
  if (patternId === "Money") {
    return /^[$€£]|^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(value) || /^-?\d+(\.\d{2})?$/.test(value);
  }

  if (patternId === "Percentage") {
    return /^-?\d+([.,]\d+)?%$/.test(value);
  }

  if (patternId === "Date") {
    return !Number.isNaN(Date.parse(value)) && /[-/]\d{1,2}[-/]/.test(value);
  }

  if (patternId === "Time") {
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(value);
  }

  if (patternId === "Email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  if (patternId === "Phone") {
    return /^\+?[\d\s().-]{7,}$/.test(value);
  }

  if (patternId === "URL") {
    return /^https?:\/\/\S+$/i.test(value);
  }

  if (patternId === "Identifier") {
    return /^[A-Z]{0,6}[-_ ]?\d{2,}$/i.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
  }

  if (patternId === "Boolean") {
    return /^(true|false|yes|no|y|n|0|1)$/i.test(value);
  }

  if (patternId === "Country") {
    return /^(united states|usa|us|germany|de|netherlands|nl|france|fr|spain|es|hungary|hu|romania|ro|italy|it|portugal|pt)$/i.test(
      value,
    );
  }

  if (patternId === "CurrencyCode") {
    return /^(usd|eur|gbp|cad|aud|huf|ron|chf|sek|nok|dkk)$/i.test(value);
  }

  if (patternId === "Latitude") {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= -90 && numeric <= 90;
  }

  if (patternId === "Longitude") {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= -180 && numeric <= 180;
  }

  if (patternId === "PostalCode") {
    return /^[A-Z0-9][A-Z0-9 -]{2,12}$/i.test(value);
  }

  if (patternId === "Text") {
    return /[A-Za-zÀ-ž]/.test(value);
  }

  if (patternId === "Number") {
    return /^-?\d+([.,]\d+)?$/.test(value);
  }

  return false;
}

function scoreNeighbors(expected: SemanticCategory[], available: SemanticCategory[]): number {
  if (expected.length === 0 || available.length === 0) {
    return 0;
  }

  const matches = available.filter((category) => expected.includes(category)).length;
  return matches === 0 ? 0 : Math.min(1, matches / Math.max(2, expected.length));
}

function scoreStatistics(column: DatasetColumnProfile, category: SemanticCategory): number {
  if (column.nullPercent >= 90 || column.missingPercent >= 90) {
    return 0;
  }

  if (
    ["SKU", "Customer", "Supplier", "Order", "Invoice", "Employee"].includes(category) &&
    column.uniquePercent >= 80
  ) {
    return 0.75;
  }

  if (
    ["Revenue", "Cost", "Profit", "Quantity", "Inventory", "Expense"].includes(category) &&
    column.uniquePercent >= 30
  ) {
    return 0.52;
  }

  if (
    [
      "Category",
      "Brand",
      "Country",
      "Region",
      "Store",
      "Warehouse",
      "Department",
      "Status",
    ].includes(category) &&
    column.uniquePercent < 80
  ) {
    return 0.48;
  }

  return column.sampleValues.length > 0 ? 0.2 : 0;
}

function addScore(
  scores: Map<Exclude<SemanticCategory, "Unknown">, CategoryScore>,
  category: Exclude<SemanticCategory, "Unknown">,
  score: number,
  alias: string,
  language: string,
  weight: number,
  evidence: SemanticEvidence,
): void {
  const existing = scores.get(category) ?? createEmptyScore(category);
  existing.evidence.push(evidence);
  existing.aliases.push(alias);
  existing.dictionaryHits.push({ alias, language, weight });
  existing.score += score * weight;
  scores.set(category, existing);
}

function addEvidenceOnly(
  scores: Map<Exclude<SemanticCategory, "Unknown">, CategoryScore>,
  category: Exclude<SemanticCategory, "Unknown">,
  evidence: SemanticEvidence,
): void {
  const existing = scores.get(category) ?? createEmptyScore(category);
  existing.evidence.push(evidence);
  existing.score += evidence.score * evidence.weight;
  scores.set(category, existing);
}

function createEmptyScore(category: Exclude<SemanticCategory, "Unknown">): CategoryScore {
  return {
    category,
    score: 0,
    reason: "",
    aliases: [],
    dictionaryHits: [],
    evidence: [],
  };
}

function finalizeCategoryScore(score: CategoryScore): CategoryScore {
  const totalWeight = score.evidence.reduce((sum, evidence) => sum + evidence.weight, 0);
  const weightedScore =
    totalWeight === 0
      ? 0
      : score.evidence.reduce((sum, evidence) => sum + evidence.score * evidence.weight, 0) /
        totalWeight;
  const hasHeaderEvidence = score.evidence.some(
    (evidence) => evidence.type === "dictionary" || evidence.type === "header-similarity",
  );
  const confidence = Math.min(
    hasHeaderEvidence ? 1 : 0.58,
    weightedScore + Math.min(0.18, score.evidence.length * 0.025),
  );
  const strongestEvidence = [...score.evidence].sort(
    (left, right) => right.score * right.weight - left.score * left.weight,
  )[0];

  return {
    ...score,
    score: roundScore(confidence),
    aliases: uniqueStrings(score.aliases),
    dictionaryHits: dedupeDictionaryHits(score.dictionaryHits),
    reason: strongestEvidence?.reason ?? `Evidence supports ${score.category}.`,
  };
}

function toUnknownField(column: SemanticColumnProfile): UnknownSemanticField {
  return {
    columnName: column.columnName,
    position: column.position,
    worksheetName: column.worksheetName,
    confidence: column.confidence,
    needsReview: true,
    potentialMatches: column.alternativeMatches,
    evidence: column.evidence,
  };
}

function buildSemanticWarnings(
  columns: SemanticColumnProfile[],
  structureProfile: DatasetStructureProfile,
): string[] {
  const warnings: string[] = [];
  const unknownCount = columns.filter((column) => column.semanticCategory === "Unknown").length;

  if (unknownCount > 0) {
    warnings.push(`${unknownCount} column${unknownCount === 1 ? "" : "s"} need semantic review.`);
  }

  if (structureProfile.confidence < 0.5) {
    warnings.push("Structure confidence is low; semantic predictions may require review.");
  }

  return warnings;
}

function buildSemanticLog(column: SemanticColumnProfile): SemanticScannerLog {
  return {
    columnName: column.columnName,
    worksheetName: column.worksheetName,
    detectedSemanticCategory: column.semanticCategory,
    confidence: column.confidence,
    evidence: column.evidence,
    dictionaryHits: column.dictionaryHits,
    unknown: column.semanticCategory === "Unknown",
    executionTime: new Date().toISOString(),
    warnings: column.warnings,
    errors: [],
  };
}

function flattenWorksheetColumns(profile: DatasetStructureProfile): WorksheetColumnPair[] {
  return profile.worksheets.flatMap((worksheet) =>
    worksheet.columns.map((column) => ({ worksheet, column })),
  );
}

function buildSemanticCacheKey(
  profile: DatasetStructureProfile,
  dictionary: SemanticDictionary,
  minimumConfidence: number,
): string {
  return [
    profile.fingerprint,
    dictionary.version,
    minimumConfidence.toFixed(2),
    profile.columns.map((column) => column.name).join("|"),
  ].join("::");
}

function findAliasLanguage(
  alias: string,
  category: SemanticCategory,
  index: SemanticDictionaryIndex,
): string {
  if (category === "Unknown") {
    return "unknown";
  }

  return findAliasHit(alias, category, index)?.alias.language ?? "unknown";
}

function findAliasWeight(
  alias: string,
  category: SemanticCategory,
  index: SemanticDictionaryIndex,
): number {
  if (category === "Unknown") {
    return 0;
  }

  return findAliasHit(alias, category, index)?.alias.weight ?? 0;
}

function findAliasHit(
  alias: string,
  category: Exclude<SemanticCategory, "Unknown">,
  index: SemanticDictionaryIndex,
): SemanticDictionaryAliasHit | undefined {
  const normalized = normalizeSemanticTerm(alias);
  return (index.aliasesByNormalizedTerm.get(normalized) ?? []).find(
    (hit) => hit.category === category,
  );
}

function getStructureProfile(context: PipelineContext): DatasetStructureProfile | null {
  const profile = context.schema.structureProfile;
  return isStructureProfile(profile) ? profile : null;
}

function hasStructureProfile(context: PipelineContext): boolean {
  return isStructureProfile(context.schema.structureProfile);
}

function isStructureProfile(value: unknown): value is DatasetStructureProfile {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as DatasetStructureProfile).version === "edie.structure.v1",
  );
}

function cloneSemanticProfile(profile: SemanticDatasetProfile): SemanticDatasetProfile {
  return structuredClone(profile) as SemanticDatasetProfile;
}

function dedupeDictionaryHits(
  hits: CategoryScore["dictionaryHits"],
): CategoryScore["dictionaryHits"] {
  const seen = new Set<string>();
  const unique: CategoryScore["dictionaryHits"] = [];

  for (const hit of hits) {
    const key = `${hit.alias}:${hit.language}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(hit);
    }
  }

  return unique;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function similarityRatio(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const distance = levenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const substitution = previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, substitution);
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length] ?? 0;
}

function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value));

  if (valid.length === 0) {
    return 0;
  }

  return roundScore(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000;
}
