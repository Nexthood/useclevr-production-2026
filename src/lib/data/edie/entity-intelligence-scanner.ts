import {
  DefaultEntityRegistry,
  createDefaultEntityRegistry,
  type EntityPatternMatch,
} from "./entity-registry";
import { buildSemanticDatasetProfile } from "./semantic-intelligence-scanner";
import { buildDatasetStructureProfile } from "./universal-structure-scanner";
import type {
  EntityColumnBundle,
  EntityColumnReference,
  EntityDatasetProfile,
  EntityDuplicateCandidate,
  EntityEvidence,
  EntityPatternType,
  EntityProfile,
  EntityRegistry,
  EntityRegistryEntry,
  EntityScannerInput,
  EntityScannerLog,
  EntityStatistics,
  EntityType,
} from "./entity-types";
import type { SemanticColumnProfile, SemanticDatasetProfile } from "./semantic-types";
import type { DatasetColumnProfile, DatasetStructureProfile } from "./structure-types";
import type { AnalysisResult, PipelineContext, Scanner, ScannerExecutionOptions } from "./types";

const DEFAULT_MINIMUM_CONFIDENCE = 0.62;
const UNKNOWN_ENTITY_THRESHOLD = 0.35;

interface EntityScore {
  entry: EntityRegistryEntry;
  confidence: number;
  evidence: EntityEvidence[];
  columns: EntityColumnReference[];
  relatedColumns: EntityColumnReference[];
  patternMatches: EntityPatternMatch[];
  dictionaryHits: string[];
  qualityScore: number;
  warnings: string[];
}

interface EntitySourceProfiles {
  structureProfile: DatasetStructureProfile;
  semanticProfile: SemanticDatasetProfile;
}

export class UniversalEntityIntelligenceScanner implements Scanner {
  id(): string {
    return "edie.entity-scanner.v1";
  }

  name(): string {
    return "Universal Entity Intelligence Scanner";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 30;
  }

  supports(context: PipelineContext): boolean {
    return Boolean(
      context.schema.structureProfile ||
      context.semanticMap.semanticProfile ||
      context.dataset.rawText ||
      context.dataset.rawBuffer ||
      context.dataset.rows?.length,
    );
  }

  validate(context: PipelineContext) {
    const valid = this.supports(context);
    const warnings: string[] = [];

    if (!context.schema.structureProfile) {
      warnings.push("Entity scanner will build a structure profile before entity analysis.");
    }

    if (!context.semanticMap.semanticProfile) {
      warnings.push("Entity scanner will build a semantic profile before entity analysis.");
    }

    return {
      valid,
      warnings,
      errors: valid
        ? []
        : ["Entity scanner requires structure, semantic, or dataset source content."],
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
        errors: ["Scanner execution was cancelled before entity analysis."],
        metadata: {},
        executionTime: new Date().toISOString(),
        scannerVersion: this.version(),
      };
    }

    const { structureProfile, semanticProfile } = resolveSourceProfiles(context);
    const entityProfile = buildEntityDatasetProfile({ structureProfile, semanticProfile });

    return {
      scannerId: this.id(),
      status: "completed",
      confidence: entityProfile.confidence,
      duration: Date.now() - startedAtMs,
      warnings: entityProfile.warnings,
      errors: entityProfile.errors,
      metadata: {
        entityProfile,
        entityCount: entityProfile.statistics.entityCount,
        entityCoveragePercent: entityProfile.coveragePercent,
        duplicateCandidateCount: entityProfile.statistics.duplicateCandidates.length,
      },
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
      contextPatch: {
        schema: { structureProfile },
        semanticMap: { semanticProfile, entityProfile },
        entities: entityProfile.entities,
        confidence: { [this.id()]: entityProfile.confidence },
        warnings: entityProfile.warnings,
      },
    };
  }
}

export function buildEntityDatasetProfile(input: EntityScannerInput): EntityDatasetProfile {
  const registry = new DefaultEntityRegistry(input.registry ?? undefined);
  const minimumConfidence = input.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;
  const bundles = buildColumnBundles(input.structureProfile, input.semanticProfile);
  const scores = registry.listEntityTypes().map((entry) => scoreEntity(entry, bundles, registry));
  const entities = scores
    .filter((score) => score.confidence >= minimumConfidence)
    .sort(
      (left, right) =>
        right.confidence - left.confidence || left.entry.priority - right.entry.priority,
    )
    .map((score, index) => toEntityProfile(score, input.structureProfile.fingerprint, index));
  const unknownEntities = scores
    .filter(
      (score) =>
        score.confidence >= UNKNOWN_ENTITY_THRESHOLD && score.confidence < minimumConfidence,
    )
    .map((score, index) =>
      toUnknownEntityProfile(score, input.structureProfile.fingerprint, index),
    );
  const duplicateCandidates = detectDuplicateCandidates(entities);
  const allProfiles = [...entities, ...unknownEntities];
  const statistics = buildStatistics(allProfiles, bundles, duplicateCandidates);
  const warnings = buildEntityWarnings(allProfiles, duplicateCandidates);
  const confidenceValues = allProfiles.map((profile) => profile.confidence);
  const confidence = average(confidenceValues);

  return {
    version: "edie.entity.v1",
    registryVersion: registry.version(),
    structureFingerprint: input.structureProfile.fingerprint,
    semanticProfileVersion: input.semanticProfile.version,
    generatedAt: new Date().toISOString(),
    entities,
    entityProfiles: allProfiles,
    statistics,
    confidenceSummary: {
      averageConfidence: confidence,
      minConfidence: confidenceValues.length === 0 ? 0 : Math.min(...confidenceValues),
      maxConfidence: confidenceValues.length === 0 ? 0 : Math.max(...confidenceValues),
      entityCount: allProfiles.length,
    },
    warnings,
    errors: [],
    coveragePercent: statistics.coveragePercent,
    qualityScore: statistics.qualityScore,
    confidence,
    logs: allProfiles.map(toEntityLog),
    extensionPoints: {
      knowledgeGraph: true,
      relationshipIntelligence: true,
      crossDatasetResolution: true,
      customerPlugins: true,
      industryEntityPacks: true,
      extractionSources: ["ocr", "pdf", "api", "sql", "snowflake"],
      vectorSearch: true,
      activeLearning: true,
      humanReview: true,
    },
  };
}

function resolveSourceProfiles(context: PipelineContext): EntitySourceProfiles {
  const structureProfile = isStructureProfile(context.schema.structureProfile)
    ? context.schema.structureProfile
    : buildDatasetStructureProfile(context);
  const semanticProfile = isSemanticProfile(context.semanticMap.semanticProfile)
    ? context.semanticMap.semanticProfile
    : buildSemanticDatasetProfile({ structureProfile });

  return { structureProfile, semanticProfile };
}

function buildColumnBundles(
  structureProfile: DatasetStructureProfile,
  semanticProfile: SemanticDatasetProfile,
): EntityColumnBundle[] {
  const structureByKey = new Map(
    structureProfile.worksheets.flatMap((worksheet) =>
      worksheet.columns.map(
        (column) => [`${worksheet.name}:${column.position}:${column.name}`, column] as const,
      ),
    ),
  );

  return semanticProfile.semanticColumns
    .map((semanticColumn) => {
      const structureColumn =
        structureByKey.get(
          `${semanticColumn.worksheetName}:${semanticColumn.position}:${semanticColumn.columnName}`,
        ) ?? findStructureColumn(structureProfile, semanticColumn);

      return structureColumn ? { structureColumn, semanticColumn } : null;
    })
    .filter(isEntityColumnBundle);
}

function scoreEntity(
  entry: EntityRegistryEntry,
  bundles: EntityColumnBundle[],
  registry: DefaultEntityRegistry,
): EntityScore {
  const semanticMatches = bundles.filter((bundle) =>
    entry.semanticCategories.includes(bundle.semanticColumn.semanticCategory),
  );
  const relatedMatches = bundles.filter((bundle) =>
    entry.relatedSemanticCategories.includes(bundle.semanticColumn.semanticCategory),
  );
  const patternMatches = bundles.flatMap((bundle) =>
    bundle.structureColumn.sampleValues
      .flatMap((value) => registry.matchPatterns(value))
      .filter((match) => entry.patternTypes.includes(match.patternType))
      .map((match) => ({ ...match, columnName: bundle.semanticColumn.columnName })),
  );
  const dictionaryHits = bundles.flatMap((bundle) =>
    registry
      .findDictionaryHits(bundle.semanticColumn.columnName)
      .filter((hit) => hit.entityType === entry.entityType)
      .map((hit) => hit.alias),
  );
  const evidence: EntityEvidence[] = [];

  if (semanticMatches.length > 0) {
    evidence.push({
      type: "semantic-column",
      score: Math.min(1, semanticMatches.length / Math.max(1, entry.requiredSignals)),
      weight: 0.35,
      reason: `${entry.entityType} has matching semantic columns.`,
      source: semanticMatches.map((match) => match.semanticColumn.columnName).join(", "),
    });
  }

  if (patternMatches.length > 0) {
    evidence.push({
      type: "sample-pattern",
      score: average(patternMatches.map((match) => match.confidence)),
      weight: 0.18,
      reason: `${entry.entityType} has matching value patterns.`,
      source: uniqueStrings(patternMatches.map((match) => match.patternType)).join(", "),
    });
  }

  if (relatedMatches.length > 0) {
    evidence.push({
      type: "neighbor-column",
      score: Math.min(
        1,
        relatedMatches.length / Math.max(1, entry.relatedSemanticCategories.length),
      ),
      weight: 0.14,
      reason: `Related columns support ${entry.entityType}.`,
      source: relatedMatches.map((match) => match.semanticColumn.columnName).join(", "),
    });
  }

  if (dictionaryHits.length > 0) {
    evidence.push({
      type: "dictionary-match",
      score: Math.min(1, dictionaryHits.length / Math.max(1, entry.aliases.length)),
      weight: 0.16,
      reason: `${entry.entityType} dictionary aliases matched column names.`,
      source: uniqueStrings(dictionaryHits).join(", "),
    });
  }

  const crossColumnScore = scoreCrossColumnValidation(entry, semanticMatches, relatedMatches);

  if (crossColumnScore > 0) {
    evidence.push({
      type: "cross-column-validation",
      score: crossColumnScore,
      weight: 0.2,
      reason: `${entry.entityType} columns form a coherent entity bundle.`,
      source: semanticMatches.map((match) => match.semanticColumn.semanticCategory).join(", "),
    });
  }

  const statisticalScore = scoreEntityStatistics(entry, semanticMatches);

  if (statisticalScore > 0) {
    evidence.push({
      type: "statistical-analysis",
      score: statisticalScore,
      weight: 0.1,
      reason: `${entry.entityType} columns have compatible cardinality and completeness.`,
      source: semanticMatches.map((match) => match.semanticColumn.columnName).join(", "),
    });
  }

  const confidence = finalizeEntityConfidence(evidence);
  const columns = semanticMatches.map(toColumnReference);
  const relatedColumns = relatedMatches.map(toColumnReference);

  return {
    entry,
    confidence,
    evidence,
    columns,
    relatedColumns,
    patternMatches,
    dictionaryHits: uniqueStrings(dictionaryHits),
    qualityScore: roundScore(
      confidence * 75 + Math.min(25, (columns.length + relatedColumns.length) * 4),
    ),
    warnings:
      confidence < DEFAULT_MINIMUM_CONFIDENCE && confidence >= UNKNOWN_ENTITY_THRESHOLD
        ? ["Entity confidence is below the review threshold."]
        : [],
  };
}

function scoreCrossColumnValidation(
  entry: EntityRegistryEntry,
  semanticMatches: EntityColumnBundle[],
  relatedMatches: EntityColumnBundle[],
): number {
  const categories = new Set(semanticMatches.map((match) => match.semanticColumn.semanticCategory));

  if (
    entry.entityType === "Customer" &&
    categories.has("Customer") &&
    (categories.has("Email") || categories.has("Phone"))
  ) {
    return 0.96;
  }

  if (
    entry.entityType === "Product" &&
    categories.has("SKU") &&
    (categories.has("Product Name") || categories.has("Category"))
  ) {
    return 0.95;
  }

  if (
    entry.entityType === "Invoice" &&
    categories.has("Invoice") &&
    (categories.has("Customer") || categories.has("Date"))
  ) {
    return 0.92;
  }

  if (
    entry.entityType === "Order" &&
    categories.has("Order") &&
    (categories.has("Customer") || categories.has("Date"))
  ) {
    return 0.92;
  }

  if (
    entry.entityType === "Employee" &&
    categories.has("Employee") &&
    (categories.has("Email") ||
      relatedMatches.some((match) => match.semanticColumn.semanticCategory === "Department"))
  ) {
    return 0.9;
  }

  if (
    entry.entityType === "Store" &&
    categories.has("Store") &&
    relatedMatches.some((match) =>
      ["Region", "Country"].includes(match.semanticColumn.semanticCategory),
    )
  ) {
    return 0.86;
  }

  if (
    entry.entityType === "Warehouse" &&
    categories.has("Warehouse") &&
    relatedMatches.some((match) =>
      ["Region", "Country"].includes(match.semanticColumn.semanticCategory),
    )
  ) {
    return 0.86;
  }

  return semanticMatches.length >= entry.requiredSignals ? 0.76 : 0;
}

function scoreEntityStatistics(
  entry: EntityRegistryEntry,
  semanticMatches: EntityColumnBundle[],
): number {
  if (semanticMatches.length === 0) {
    return 0;
  }

  const averageCompleteness = average(
    semanticMatches.map((match) => 1 - Math.min(1, match.structureColumn.missingPercent / 100)),
  );
  const hasIdentifierShape = semanticMatches.some(
    (match) =>
      ["Customer", "Supplier", "Employee", "SKU", "Order", "Invoice"].includes(
        match.semanticColumn.semanticCategory,
      ) && match.structureColumn.uniquePercent >= 60,
  );

  if (
    hasIdentifierShape ||
    ["Category", "Brand", "Department", "Currency", "Tax"].includes(entry.entityType)
  ) {
    return Math.max(0.55, averageCompleteness);
  }

  return averageCompleteness >= 0.7 ? 0.68 : averageCompleteness;
}

function finalizeEntityConfidence(evidence: EntityEvidence[]): number {
  if (evidence.length === 0) {
    return 0;
  }

  const totalWeight = evidence.reduce((sum, item) => sum + item.weight, 0);
  const weighted = evidence.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
  const hasPrimaryEvidence = evidence.some(
    (item) => item.type === "semantic-column" || item.type === "dictionary-match",
  );
  const confidence = Math.min(
    hasPrimaryEvidence ? 1 : 0.56,
    weighted + Math.min(0.12, evidence.length * 0.02),
  );
  return roundScore(confidence);
}

function toEntityProfile(score: EntityScore, fingerprint: string, index: number): EntityProfile {
  return {
    entityId: buildEntityId(fingerprint, score.entry.entityType, index),
    entityType: score.entry.entityType,
    confidence: score.confidence,
    evidence: score.evidence,
    columns: score.columns,
    relatedColumns: score.relatedColumns,
    sampleValues: collectSampleValues(score.columns, score.relatedColumns),
    detectedPatterns: uniqueStrings(
      score.patternMatches.map((match) => match.patternType),
    ) as EntityPatternType[],
    warnings: score.warnings,
    qualityScore: score.qualityScore,
  };
}

function toUnknownEntityProfile(
  score: EntityScore,
  fingerprint: string,
  index: number,
): EntityProfile {
  return {
    ...toEntityProfile(score, fingerprint, index),
    entityId: buildEntityId(fingerprint, "Unknown", index),
    entityType: "Unknown",
    warnings: uniqueStrings([
      ...score.warnings,
      `Potential ${score.entry.entityType} entity needs review.`,
    ]),
  };
}

function detectDuplicateCandidates(entities: EntityProfile[]): EntityDuplicateCandidate[] {
  return entities
    .filter((entity) =>
      ["Customer", "Supplier", "Order", "Product", "Invoice"].includes(entity.entityType),
    )
    .flatMap((entity) => {
      const identifyingColumns = entity.columns.filter((column) =>
        ["Customer", "Supplier", "Order", "Invoice", "SKU", "Product Name", "Email"].includes(
          column.semanticCategory,
        ),
      );
      const duplicateGroups = new Map<string, number[]>();

      for (const column of identifyingColumns) {
        column.sampleValues.forEach((value, index) => {
          const normalized = normalizeDuplicateValue(value);

          if (!normalized) {
            return;
          }

          const key = `${column.semanticCategory}:${normalized}`;
          const existing = duplicateGroups.get(key) ?? [];
          existing.push(index + 1);
          duplicateGroups.set(key, existing);
        });
      }

      return Array.from(duplicateGroups.entries())
        .filter(([, rowIndexes]) => rowIndexes.length > 1)
        .map(([key, rowIndexes]) => ({
          entityType: entity.entityType,
          confidence: 0.72,
          key,
          rowIndexes,
          columns: identifyingColumns.map((column) => column.columnName),
          reason: `${entity.entityType} contains repeated identifying values.`,
        }));
    });
}

function buildStatistics(
  profiles: EntityProfile[],
  bundles: EntityColumnBundle[],
  duplicateCandidates: EntityDuplicateCandidate[],
): EntityStatistics {
  const knownProfiles = profiles.filter((profile) => profile.entityType !== "Unknown");
  const coveredColumnNames = new Set(
    knownProfiles.flatMap((profile) => profile.columns.map((column) => column.columnName)),
  );
  const coveragePercent =
    bundles.length === 0 ? 0 : roundScore((coveredColumnNames.size / bundles.length) * 100);
  const confidenceDistribution = {
    high: profiles.filter((profile) => profile.confidence >= 0.8).length,
    medium: profiles.filter((profile) => profile.confidence >= 0.62 && profile.confidence < 0.8)
      .length,
    low: profiles.filter((profile) => profile.confidence < 0.62).length,
  };
  const qualityScore = roundScore(
    coveragePercent * 0.45 +
      average(knownProfiles.map((profile) => profile.confidence)) * 100 * 0.45 -
      Math.min(10, duplicateCandidates.length * 2),
  );

  return {
    entityCount: knownProfiles.length,
    coveragePercent,
    confidenceDistribution,
    unknownEntities: profiles.length - knownProfiles.length,
    duplicateCandidates,
    qualityScore: Math.max(0, qualityScore),
  };
}

function buildEntityWarnings(
  profiles: EntityProfile[],
  duplicateCandidates: EntityDuplicateCandidate[],
): string[] {
  const warnings: string[] = [];
  const unknownCount = profiles.filter((profile) => profile.entityType === "Unknown").length;

  if (unknownCount > 0) {
    warnings.push(
      `${unknownCount} potential entity${unknownCount === 1 ? "" : "ies"} need review.`,
    );
  }

  if (duplicateCandidates.length > 0) {
    warnings.push(
      `${duplicateCandidates.length} duplicate entity candidate${duplicateCandidates.length === 1 ? "" : "s"} detected.`,
    );
  }

  return warnings;
}

function toEntityLog(profile: EntityProfile): EntityScannerLog {
  return {
    entityType: profile.entityType,
    entityId: profile.entityId,
    confidence: profile.confidence,
    evidence: profile.evidence,
    executionTime: new Date().toISOString(),
    warnings: profile.warnings,
    errors: [],
    patternMatches: profile.detectedPatterns,
    dictionaryHits: profile.evidence
      .filter((evidence) => evidence.type === "dictionary-match")
      .map((evidence) => evidence.source),
  };
}

function toColumnReference(bundle: EntityColumnBundle): EntityColumnReference {
  return {
    columnName: bundle.semanticColumn.columnName,
    position: bundle.semanticColumn.position,
    worksheetName: bundle.semanticColumn.worksheetName,
    semanticCategory: bundle.semanticColumn.semanticCategory,
    confidence: bundle.semanticColumn.confidence,
    sampleValues: bundle.structureColumn.sampleValues,
  };
}

function collectSampleValues(
  columns: EntityColumnReference[],
  relatedColumns: EntityColumnReference[],
): unknown[] {
  return uniqueUnknowns(
    [...columns, ...relatedColumns].flatMap((column) => column.sampleValues),
  ).slice(0, 12);
}

function buildEntityId(fingerprint: string, entityType: EntityType, index: number): string {
  return `entity_${fingerprint.slice(0, 12)}_${entityType.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${index + 1}`;
}

function findStructureColumn(
  structureProfile: DatasetStructureProfile,
  semanticColumn: SemanticColumnProfile,
): DatasetColumnProfile | null {
  return (
    structureProfile.worksheets
      .find((worksheet) => worksheet.name === semanticColumn.worksheetName)
      ?.columns.find(
        (column) =>
          column.position === semanticColumn.position && column.name === semanticColumn.columnName,
      ) ?? null
  );
}

function normalizeDuplicateValue(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function isStructureProfile(value: unknown): value is DatasetStructureProfile {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as DatasetStructureProfile).version === "edie.structure.v1",
  );
}

function isSemanticProfile(value: unknown): value is SemanticDatasetProfile {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as SemanticDatasetProfile).version === "edie.semantic.v1",
  );
}

function isEntityColumnBundle(value: EntityColumnBundle | null): value is EntityColumnBundle {
  return Boolean(value);
}

function uniqueStrings<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueUnknowns(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  const unique: unknown[] = [];

  for (const value of values) {
    const key = String(value ?? "");

    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }
  }

  return unique;
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

export function prepareEntityResolutionCandidate(profile: EntityProfile) {
  return {
    entityType: profile.entityType,
    localEntityId: profile.entityId,
    confidence: profile.confidence,
    evidence: profile.evidence,
    status: "not-implemented" as const,
  };
}

export function createEntityRegistry(registry?: EntityRegistry): DefaultEntityRegistry {
  return registry ? new DefaultEntityRegistry(registry) : createDefaultEntityRegistry();
}
