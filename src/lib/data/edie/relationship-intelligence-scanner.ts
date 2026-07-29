import {
  DefaultRelationshipRegistry,
  createDefaultRelationshipRegistry,
} from "./relationship-registry";
import { buildEntityDatasetProfile } from "./entity-intelligence-scanner";
import { buildSemanticDatasetProfile } from "./semantic-intelligence-scanner";
import { buildDatasetStructureProfile } from "./universal-structure-scanner";
import type { EntityDatasetProfile, EntityProfile, EntityType } from "./entity-types";
import type { SemanticColumnProfile, SemanticDatasetProfile } from "./semantic-types";
import type { DatasetColumnProfile, DatasetStructureProfile } from "./structure-types";
import type { AnalysisResult, PipelineContext, Scanner, ScannerExecutionOptions } from "./types";
import type {
  CardinalityType,
  KeyProfile,
  KeyType,
  RelationshipColumnBundle,
  RelationshipColumnReference,
  RelationshipConfidenceBand,
  RelationshipDatasetProfile,
  RelationshipEvidence,
  RelationshipGraph,
  RelationshipGraphEdge,
  RelationshipGraphNode,
  RelationshipProfile,
  RelationshipRegistry,
  RelationshipRegistryEntry,
  RelationshipScannerInput,
  RelationshipScannerLog,
  RelationshipStatistics,
} from "./relationship-types";

const DEFAULT_MINIMUM_CONFIDENCE = 0.62;
const REVIEW_CONFIDENCE_THRESHOLD = 0.42;

interface RelationshipSourceProfiles {
  structureProfile: DatasetStructureProfile;
  semanticProfile: SemanticDatasetProfile;
  entityProfile: EntityDatasetProfile;
}

interface RelationshipScore {
  entry: RelationshipRegistryEntry;
  confidence: number;
  evidence: RelationshipEvidence[];
  matchedKeys: KeyProfile[];
  relatedColumns: RelationshipColumnReference[];
  cardinality: RelationshipProfile["cardinality"];
  warnings: string[];
}

export class UniversalRelationshipIntelligenceScanner implements Scanner {
  id(): string {
    return "edie.relationship-scanner.v1";
  }

  name(): string {
    return "Universal Relationship Intelligence Engine";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 40;
  }

  supports(context: PipelineContext): boolean {
    return Boolean(
      context.semanticMap.entityProfile ||
      context.entities.length ||
      context.semanticMap.semanticProfile ||
      context.schema.structureProfile ||
      context.dataset.rawText ||
      context.dataset.rawBuffer ||
      context.dataset.rows?.length,
    );
  }

  validate(context: PipelineContext) {
    const valid = this.supports(context);
    const warnings: string[] = [];

    if (!context.schema.structureProfile) {
      warnings.push(
        "Relationship scanner will build a structure profile before relationship analysis.",
      );
    }

    if (!context.semanticMap.semanticProfile) {
      warnings.push(
        "Relationship scanner will build a semantic profile before relationship analysis.",
      );
    }

    if (!context.semanticMap.entityProfile) {
      warnings.push(
        "Relationship scanner will build an entity profile before relationship analysis.",
      );
    }

    return {
      valid,
      warnings,
      errors: valid
        ? []
        : ["Relationship scanner requires entity, semantic, structure, or dataset source content."],
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
        errors: ["Scanner execution was cancelled before relationship analysis."],
        metadata: {},
        executionTime: new Date().toISOString(),
        scannerVersion: this.version(),
      };
    }

    const { structureProfile, semanticProfile, entityProfile } = resolveSourceProfiles(context);
    const relationshipProfile = buildRelationshipDatasetProfile({
      structureProfile,
      semanticProfile,
      entityProfile,
      rows: resolveRows(context),
    });

    return {
      scannerId: this.id(),
      status: "completed",
      confidence: relationshipProfile.confidence,
      duration: Date.now() - startedAtMs,
      warnings: relationshipProfile.warnings,
      errors: relationshipProfile.errors,
      metadata: {
        relationshipProfile,
        relationshipCount: relationshipProfile.statistics.totalRelationships,
        coveragePercent: relationshipProfile.coveragePercent,
        graphHealthScore: relationshipProfile.statistics.graphHealthScore,
      },
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
      contextPatch: {
        schema: { structureProfile },
        semanticMap: { semanticProfile, entityProfile, relationshipProfile },
        entities: entityProfile.entities,
        relationships: relationshipProfile.relationshipGraph.edges,
        confidence: { [this.id()]: relationshipProfile.confidence },
        warnings: relationshipProfile.warnings,
      },
    };
  }
}

export function buildRelationshipDatasetProfile(
  input: RelationshipScannerInput,
): RelationshipDatasetProfile {
  const registry = new DefaultRelationshipRegistry(input.registry ?? undefined);
  const minimumConfidence = input.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;
  const rows = input.rows ?? [];
  const bundles = buildColumnBundles(
    input.structureProfile,
    input.semanticProfile,
    input.entityProfile,
  );
  const keyProfiles = detectKeyProfiles(bundles, rows, input.structureProfile.fingerprint);
  const scores = registry
    .listRelationshipTypes()
    .map((entry) =>
      scoreRelationship(entry, input.entityProfile.entities, bundles, keyProfiles, rows),
    );
  const relationshipProfiles = scores
    .filter((score) => score.confidence >= REVIEW_CONFIDENCE_THRESHOLD)
    .sort(
      (left, right) =>
        right.confidence - left.confidence || left.entry.priority - right.entry.priority,
    )
    .map((score, index) =>
      toRelationshipProfile(score, input.structureProfile.fingerprint, index, minimumConfidence),
    );
  const acceptedProfiles = relationshipProfiles.filter((profile) => profile.status === "Accepted");
  const graph = buildRelationshipGraph(input.entityProfile.entities, acceptedProfiles);
  const statistics = buildRelationshipStatistics(
    input.entityProfile.entities,
    relationshipProfiles,
    graph,
  );
  const warnings = uniqueStrings([
    ...graph.warnings,
    ...relationshipProfiles.flatMap((profile) => profile.warnings),
    ...detectBrokenRelationshipWarnings(relationshipProfiles, keyProfiles),
  ]);
  const confidenceValues = relationshipProfiles.map((profile) => profile.confidence);
  const confidence = average(confidenceValues);
  const qualityScore = roundScore(
    graph.qualityScore * 0.6 + statistics.graphHealthScore * 0.25 + confidence * 100 * 0.15,
  );

  return {
    version: "edie.relationship.v1",
    registryVersion: registry.version(),
    structureFingerprint: input.structureProfile.fingerprint,
    semanticProfileVersion: input.semanticProfile.version,
    entityProfileVersion: input.entityProfile.version,
    generatedAt: new Date().toISOString(),
    relationshipGraph: graph,
    graph,
    statistics: { ...statistics, graphHealthScore: qualityScore },
    relationshipProfiles,
    keyProfiles,
    warnings,
    errors: [],
    coveragePercent: graph.coveragePercent,
    confidenceSummary: {
      averageConfidence: confidence,
      minConfidence: confidenceValues.length === 0 ? 0 : Math.min(...confidenceValues),
      maxConfidence: confidenceValues.length === 0 ? 0 : Math.max(...confidenceValues),
      relationshipCount: relationshipProfiles.length,
    },
    qualityScore,
    confidence,
    logs: relationshipProfiles.map(toRelationshipLog),
    extensionPoints: {
      knowledgeGraph: true,
      aiReasoning: true,
      automaticKpiGeneration: true,
      rootCauseAnalysis: true,
      recommendationEngine: true,
      forecastEngine: true,
      businessModelDetector: true,
      industryDetector: true,
      graphDatabase: true,
      neo4j: true,
      rdfExport: true,
      graphqlApi: true,
      crossDatasetRelationships: true,
      streamingRelationships: true,
      incrementalGraphUpdates: true,
      eventDrivenUpdates: true,
      activeLearning: true,
      humanValidation: true,
      semanticMemory: true,
      vectorSearch: true,
      embeddingProviders: true,
    },
  };
}

function resolveSourceProfiles(context: PipelineContext): RelationshipSourceProfiles {
  const structureProfile = isStructureProfile(context.schema.structureProfile)
    ? context.schema.structureProfile
    : buildDatasetStructureProfile(context);
  const semanticProfile = isSemanticProfile(context.semanticMap.semanticProfile)
    ? context.semanticMap.semanticProfile
    : buildSemanticDatasetProfile({ structureProfile });
  const entityProfile = isEntityProfile(context.semanticMap.entityProfile)
    ? context.semanticMap.entityProfile
    : buildEntityDatasetProfile({ structureProfile, semanticProfile });

  return { structureProfile, semanticProfile, entityProfile };
}

function buildColumnBundles(
  structureProfile: DatasetStructureProfile,
  semanticProfile: SemanticDatasetProfile,
  entityProfile: EntityDatasetProfile,
): RelationshipColumnBundle[] {
  return semanticProfile.semanticColumns
    .map((semanticColumn) => {
      const structureColumn = findStructureColumn(structureProfile, semanticColumn);
      const matchingEntity = entityProfile.entityProfiles.find((entity) =>
        entity.columns.some(
          (column) =>
            column.worksheetName === semanticColumn.worksheetName &&
            column.position === semanticColumn.position &&
            column.columnName === semanticColumn.columnName,
        ),
      );

      if (!structureColumn) {
        return null;
      }

      return matchingEntity
        ? { structureColumn, semanticColumn, entityProfile: matchingEntity }
        : { structureColumn, semanticColumn };
    })
    .filter(isRelationshipColumnBundle);
}

function detectKeyProfiles(
  bundles: RelationshipColumnBundle[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  fingerprint: string,
): KeyProfile[] {
  const rowCount = rows.length || maxSampleCount(bundles);
  const singleColumnKeys = bundles.map((bundle, index) =>
    keyProfileFromColumn(bundle, rowCount, fingerprint, index),
  );
  const compositeKeys = detectCompositeKeys(bundles, rows, fingerprint, singleColumnKeys.length);

  return [...singleColumnKeys, ...compositeKeys];
}

function keyProfileFromColumn(
  bundle: RelationshipColumnBundle,
  rowCount: number,
  fingerprint: string,
  index: number,
): KeyProfile {
  const semanticCategory = bundle.semanticColumn.semanticCategory;
  const columnName = bundle.semanticColumn.columnName;
  const normalized = normalizeTerm(columnName);
  const entityType = inferEntityType(bundle);
  const uniqueness = bundle.structureColumn.uniquePercent;
  const nullPercent = bundle.structureColumn.nullPercent;
  const identifierName = /\b(id|uuid|number|no|code|key)\b/.test(normalized);
  const generatedShape = identifierName && bundle.structureColumn.detectedDataType.value === "UUID";
  const naturalKeyCategory = ["Email", "Phone", "SKU", "Invoice", "Order", "Currency"].includes(
    semanticCategory,
  );
  let keyType: KeyType = "Unknown Key";
  let confidence = 0.22;
  let reason = "Column lacks enough identity evidence.";

  if (generatedShape) {
    keyType = "Generated Key";
    confidence = 0.9;
    reason = "Column uses a generated identifier format.";
  } else if (identifierName && uniqueness >= 92 && nullPercent <= 5) {
    keyType = "Primary Key";
    confidence = 0.9;
    reason = "Column has identifier naming, high uniqueness, and low null ratio.";
  } else if (identifierName && uniqueness >= 50) {
    keyType = "Foreign Key";
    confidence = 0.76;
    reason = "Column has identifier naming and repeatable referenced values.";
  } else if (
    naturalKeyCategory &&
    (uniqueness >= 85 || semanticCategory === "SKU") &&
    nullPercent <= 10
  ) {
    keyType = "Natural Key";
    confidence = 0.82;
    reason = "Column has a natural business identifier with high uniqueness.";
  } else if (uniqueness >= 92 && nullPercent <= 5 && rowCount > 0) {
    keyType = "Candidate Key";
    confidence = 0.72;
    reason = "Column values are mostly unique and complete.";
  }

  return {
    keyId: `key_${fingerprint.slice(0, 10)}_${index + 1}`,
    keyType,
    entityType,
    confidence: roundScore(confidence),
    columns: [columnName],
    semanticCategories: [semanticCategory],
    uniquenessPercent: uniqueness,
    nullPercent,
    sampleValues: bundle.structureColumn.sampleValues,
    reason,
    warnings: keyType === "Unknown Key" ? ["Key role needs review."] : [],
  };
}

function detectCompositeKeys(
  bundles: RelationshipColumnBundle[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  fingerprint: string,
  startIndex: number,
): KeyProfile[] {
  if (rows.length === 0) {
    return [];
  }

  const candidates = bundles.filter((bundle) =>
    [
      "Order",
      "Invoice",
      "SKU",
      "Product Name",
      "Customer",
      "Supplier",
      "Store",
      "Warehouse",
    ].includes(bundle.semanticColumn.semanticCategory),
  );
  const compositeKeys: KeyProfile[] = [];

  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      const pairValues = rows.map(
        (row) =>
          `${normalizeValue(row[left.semanticColumn.columnName])}:${normalizeValue(row[right.semanticColumn.columnName])}`,
      );
      const completeness =
        pairValues.filter((value) => value !== ":").length / Math.max(1, rows.length);
      const uniquePercent =
        (new Set(pairValues.filter((value) => value !== ":")).size / Math.max(1, rows.length)) *
        100;

      if (completeness >= 0.9 && uniquePercent >= 92) {
        compositeKeys.push({
          keyId: `key_${fingerprint.slice(0, 10)}_${startIndex + compositeKeys.length + 1}`,
          keyType: "Composite Key",
          entityType: inferEntityType(left),
          confidence: 0.84,
          columns: [left.semanticColumn.columnName, right.semanticColumn.columnName],
          semanticCategories: [
            left.semanticColumn.semanticCategory,
            right.semanticColumn.semanticCategory,
          ],
          uniquenessPercent: roundScore(uniquePercent),
          nullPercent: roundScore((1 - completeness) * 100),
          sampleValues: pairValues.slice(0, 8),
          reason: "Column pair is complete and uniquely identifies rows.",
          warnings: [],
        });
      }
    }
  }

  return compositeKeys.slice(0, 6);
}

function scoreRelationship(
  entry: RelationshipRegistryEntry,
  entities: EntityProfile[],
  bundles: RelationshipColumnBundle[],
  keyProfiles: KeyProfile[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): RelationshipScore {
  const sourceEntity = entities.find((entity) => entity.entityType === entry.sourceEntity);
  const targetEntity = entities.find((entity) => entity.entityType === entry.targetEntity);
  const sourceColumns = matchingColumns(
    bundles,
    entry.sourceEntity,
    entry.sourceSemanticCategories,
  );
  const targetColumns = matchingColumns(
    bundles,
    entry.targetEntity,
    entry.targetSemanticCategories,
  );
  const relatedColumns = [...sourceColumns, ...targetColumns].map(toColumnReference);
  const matchedKeys = keyProfiles.filter(
    (key) =>
      key.confidence >= 0.6 &&
      (key.entityType === entry.sourceEntity ||
        key.entityType === entry.targetEntity ||
        key.semanticCategories.some((category) =>
          [...entry.sourceSemanticCategories, ...entry.targetSemanticCategories].includes(category),
        )),
  );
  const evidence: RelationshipEvidence[] = [];

  if (sourceEntity && targetEntity) {
    evidence.push({
      type: "detected-entity",
      score: average([sourceEntity.confidence, targetEntity.confidence]),
      weight: 0.26,
      reason: "Both relationship endpoints are detected entities.",
      source: `${sourceEntity.entityType}, ${targetEntity.entityType}`,
    });
  }

  if (sourceColumns.length > 0 && targetColumns.length > 0) {
    evidence.push({
      type: "semantic-cooccurrence",
      score: Math.min(1, (sourceColumns.length + targetColumns.length) / 4),
      weight: 0.22,
      reason: "Source and target semantic columns occur in the same dataset region.",
      source: relatedColumns.map((column) => column.columnName).join(", "),
    });
  }

  const positionScore = scoreColumnPosition(sourceColumns, targetColumns);

  if (positionScore > 0) {
    evidence.push({
      type: "column-position",
      score: positionScore,
      weight: 0.08,
      reason: "Source and target columns are close enough to indicate a business relationship.",
      source: relatedColumns.map((column) => `${column.columnName}@${column.position}`).join(", "),
    });
  }

  if (matchedKeys.length > 0) {
    evidence.push({
      type: "shared-key",
      score: average(matchedKeys.map((key) => key.confidence)),
      weight: 0.18,
      reason: "Detected key columns support the relationship.",
      source: matchedKeys.flatMap((key) => key.columns).join(", "),
    });
  }

  const valueDistributionScore = scoreValueDistribution(sourceColumns, targetColumns, rows);

  if (valueDistributionScore > 0) {
    evidence.push({
      type: "value-distribution",
      score: valueDistributionScore,
      weight: 0.14,
      reason: "Value distribution is compatible with related business entities.",
      source: `${entry.sourceEntity} to ${entry.targetEntity}`,
    });
  }

  const vocabularyHits = entry.aliases.filter((alias) =>
    relatedColumns.some((column) =>
      normalizeTerm(alias)
        .split(" ")
        .some((term) => normalizeTerm(column.columnName).includes(term)),
    ),
  );

  if (vocabularyHits.length > 0) {
    evidence.push({
      type: "business-vocabulary",
      score: Math.min(1, vocabularyHits.length / Math.max(1, entry.aliases.length)),
      weight: 0.08,
      reason: "Business vocabulary aligns with the relationship definition.",
      source: vocabularyHits.join(", "),
    });
  }

  const crossValidationScore = scoreCrossValidation(
    sourceEntity,
    targetEntity,
    sourceColumns,
    targetColumns,
    matchedKeys,
  );

  if (crossValidationScore > 0) {
    evidence.push({
      type: "cross-validation",
      score: crossValidationScore,
      weight: 0.18,
      reason: "Structure, semantic, and entity scanners agree on the relationship.",
      source: `${entry.relationshipType}`,
    });
  }

  const confidence = finalizeRelationshipConfidence(evidence, sourceEntity, targetEntity);
  const cardinality = detectCardinality(entry, sourceColumns, targetColumns, rows);
  const warnings = buildRelationshipWarnings(
    entry,
    sourceEntity,
    targetEntity,
    matchedKeys,
    confidence,
  );

  return {
    entry,
    confidence,
    evidence,
    matchedKeys,
    relatedColumns,
    cardinality,
    warnings,
  };
}

function matchingColumns(
  bundles: RelationshipColumnBundle[],
  entityType: EntityType,
  semanticCategories: RelationshipRegistryEntry["sourceSemanticCategories"],
): RelationshipColumnBundle[] {
  return bundles.filter(
    (bundle) =>
      inferEntityType(bundle) === entityType ||
      semanticCategories.includes(bundle.semanticColumn.semanticCategory) ||
      normalizeTerm(bundle.semanticColumn.columnName).includes(normalizeTerm(entityType)),
  );
}

function scoreColumnPosition(
  sourceColumns: RelationshipColumnBundle[],
  targetColumns: RelationshipColumnBundle[],
): number {
  if (sourceColumns.length === 0 || targetColumns.length === 0) {
    return 0;
  }

  const minDistance = Math.min(
    ...sourceColumns.flatMap((source) =>
      targetColumns.map((target) =>
        source.semanticColumn.worksheetName === target.semanticColumn.worksheetName
          ? Math.abs(source.semanticColumn.position - target.semanticColumn.position)
          : 99,
      ),
    ),
  );

  if (minDistance <= 2) {
    return 0.9;
  }

  if (minDistance <= 5) {
    return 0.72;
  }

  return 0.42;
}

function scoreValueDistribution(
  sourceColumns: RelationshipColumnBundle[],
  targetColumns: RelationshipColumnBundle[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): number {
  if (sourceColumns.length === 0 || targetColumns.length === 0) {
    return 0;
  }

  const source = bestDistributionColumn(sourceColumns);
  const target = bestDistributionColumn(targetColumns);

  if (!source || !target) {
    return 0;
  }

  const sourceValues = valuesForColumn(source, rows);
  const targetValues = valuesForColumn(target, rows);

  if (sourceValues.length === 0 || targetValues.length === 0) {
    return 0;
  }

  const sourceUnique = new Set(sourceValues).size;
  const targetUnique = new Set(targetValues).size;
  const sourceCompleteness =
    sourceValues.length / Math.max(1, rows.length || source.structureColumn.sampleValues.length);
  const targetCompleteness =
    targetValues.length / Math.max(1, rows.length || target.structureColumn.sampleValues.length);
  const uniquenessDelta =
    Math.abs(sourceUnique - targetUnique) / Math.max(sourceUnique, targetUnique, 1);

  return roundScore(
    Math.min(
      0.95,
      0.45 + uniquenessDelta * 0.25 + Math.min(sourceCompleteness, targetCompleteness) * 0.25,
    ),
  );
}

function scoreCrossValidation(
  sourceEntity: EntityProfile | undefined,
  targetEntity: EntityProfile | undefined,
  sourceColumns: RelationshipColumnBundle[],
  targetColumns: RelationshipColumnBundle[],
  matchedKeys: KeyProfile[],
): number {
  if (!sourceEntity || !targetEntity || sourceColumns.length === 0 || targetColumns.length === 0) {
    return 0;
  }

  const keyScore = matchedKeys.length > 0 ? 0.18 : 0;
  return Math.min(
    0.96,
    average([sourceEntity.confidence, targetEntity.confidence]) * 0.7 + keyScore,
  );
}

function finalizeRelationshipConfidence(
  evidence: RelationshipEvidence[],
  sourceEntity: EntityProfile | undefined,
  targetEntity: EntityProfile | undefined,
): number {
  if (evidence.length === 0 || !sourceEntity || !targetEntity) {
    return 0;
  }

  const hasPrimarySignals =
    evidence.some((item) => item.type === "detected-entity") &&
    evidence.some((item) => item.type === "semantic-cooccurrence");

  if (!hasPrimarySignals) {
    return 0;
  }

  const totalWeight = evidence.reduce((sum, item) => sum + item.weight, 0);
  const weighted = evidence.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;

  return roundScore(Math.min(1, weighted + Math.min(0.1, evidence.length * 0.015)));
}

function detectCardinality(
  entry: RelationshipRegistryEntry,
  sourceColumns: RelationshipColumnBundle[],
  targetColumns: RelationshipColumnBundle[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): RelationshipProfile["cardinality"] {
  const source = bestDistributionColumn(sourceColumns);
  const target = bestDistributionColumn(targetColumns);

  if (!source || !target) {
    return {
      type: "Unknown",
      confidence: 0,
      reason: "Cardinality requires source and target columns.",
    };
  }

  const sourceValues = valuesForColumn(source, rows);
  const targetValues = valuesForColumn(target, rows);

  if (sourceValues.length === 0 || targetValues.length === 0) {
    return {
      type: "Unknown",
      confidence: 0,
      reason: "Cardinality requires non-empty source and target values.",
    };
  }

  const sourceUnique = new Set(sourceValues).size;
  const targetUnique = new Set(targetValues).size;
  const pairUnique = new Set(
    sourceValues.map((value, index) => `${value}:${targetValues[index] ?? ""}`),
  ).size;
  const sourceRepeats = sourceUnique < sourceValues.length;
  const targetRepeats = targetUnique < targetValues.length;
  let type: CardinalityType = "Unknown";

  if (sourceRepeats && targetRepeats && pairUnique > Math.max(sourceUnique, targetUnique)) {
    type = "Many-to-Many";
  } else if (sourceUnique < targetUnique) {
    type = "One-to-Many";
  } else if (sourceUnique > targetUnique) {
    type = "Many-to-One";
  } else if (sourceUnique === targetUnique) {
    type = "One-to-One";
  }

  return {
    type: overrideKnownCardinality(entry, type),
    confidence: type === "Unknown" ? 0.35 : 0.78,
    reason: `Detected ${sourceUnique} source values, ${targetUnique} target values, and ${pairUnique} source-target pairs.`,
  };
}

function overrideKnownCardinality(
  entry: RelationshipRegistryEntry,
  detected: CardinalityType,
): CardinalityType {
  if (detected !== "One-to-One" || entry.sourceEntity === entry.targetEntity) {
    return detected;
  }

  if (
    [
      "Product -> Category",
      "Product -> Brand",
      "Employee -> Department",
      "Invoice -> Currency",
      "Invoice -> Tax",
    ].includes(entry.relationshipType)
  ) {
    return "Many-to-One";
  }

  if (
    [
      "Customer -> Order",
      "Customer -> Invoice",
      "Supplier -> Product",
      "Warehouse -> Inventory",
      "Store -> Employee",
    ].includes(entry.relationshipType)
  ) {
    return "One-to-Many";
  }

  return detected;
}

function toRelationshipProfile(
  score: RelationshipScore,
  fingerprint: string,
  index: number,
  minimumConfidence: number,
): RelationshipProfile {
  const accepted = score.confidence >= minimumConfidence;

  return {
    relationshipId: `rel_${fingerprint.slice(0, 12)}_${index + 1}`,
    relationshipType: score.entry.relationshipType,
    sourceEntity: score.entry.sourceEntity,
    targetEntity: score.entry.targetEntity,
    confidence: score.confidence,
    confidenceBand: confidenceBand(score.confidence),
    status: accepted ? "Accepted" : "Needs Review",
    evidence: score.evidence,
    matchedKeys: score.matchedKeys,
    relatedColumns: score.relatedColumns,
    cardinality: score.cardinality,
    reason: accepted
      ? `${score.entry.relationshipType} is supported by entity, semantic, key, and distribution evidence.`
      : `${score.entry.relationshipType} has partial evidence and needs review.`,
    warnings: score.warnings,
    executionTime: new Date().toISOString(),
  };
}

function buildRelationshipGraph(
  entities: EntityProfile[],
  acceptedProfiles: RelationshipProfile[],
): RelationshipGraph {
  const nodes = entities.map(toGraphNode);
  const nodeByEntity = new Map(nodes.map((node) => [node.entityType, node]));
  const edges = acceptedProfiles
    .filter(
      (profile) => nodeByEntity.has(profile.sourceEntity) && nodeByEntity.has(profile.targetEntity),
    )
    .map((profile) => toGraphEdge(profile, nodeByEntity));
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const disconnectedEntities = nodes
    .filter((node) => !connected.has(node.id))
    .map((node) => node.entityType);
  const coveragePercent =
    nodes.length === 0
      ? 0
      : roundScore(((nodes.length - disconnectedEntities.length) / nodes.length) * 100);
  const confidence = average(edges.map((edge) => edge.confidence));
  const circularWarnings = detectCircularRelationshipWarnings(edges);
  const warnings = [
    ...circularWarnings,
    ...disconnectedEntities.map(
      (entity) => `${entity} is disconnected from the accepted relationship graph.`,
    ),
  ];
  const qualityScore = roundScore(
    coveragePercent * 0.45 + confidence * 100 * 0.45 - Math.min(12, circularWarnings.length * 4),
  );
  const graph: RelationshipGraph = {
    version: "edie.relationship-graph.v1",
    nodes,
    edges,
    confidence,
    relationshipCount: edges.length,
    coveragePercent,
    disconnectedEntities,
    warnings,
    qualityScore: Math.max(0, qualityScore),
    export: {
      format: "edie.relationship-graph.v1",
      nodes,
      edges,
      metadata: {
        generatedAt: new Date().toISOString(),
        relationshipCount: edges.length,
        qualityScore: Math.max(0, qualityScore),
      },
    },
  };

  return graph;
}

function buildRelationshipStatistics(
  entities: EntityProfile[],
  profiles: RelationshipProfile[],
  graph: RelationshipGraph,
): RelationshipStatistics {
  const accepted = profiles.filter((profile) => profile.status === "Accepted");
  const relationshipDensity =
    entities.length <= 1
      ? 0
      : roundScore(accepted.length / Math.max(1, entities.length * (entities.length - 1)));
  const averageConfidence = average(profiles.map((profile) => profile.confidence));

  return {
    totalRelationships: accepted.length,
    highConfidence: profiles.filter((profile) => profile.confidenceBand === "high").length,
    mediumConfidence: profiles.filter((profile) => profile.confidenceBand === "medium").length,
    lowConfidence: profiles.filter((profile) => profile.confidenceBand === "low").length,
    unknown: profiles.filter((profile) => profile.confidenceBand === "unknown").length,
    disconnectedEntities: graph.disconnectedEntities,
    coveragePercent: graph.coveragePercent,
    averageConfidence,
    relationshipDensity,
    graphHealthScore: roundScore(
      graph.coveragePercent * 0.5 + averageConfidence * 100 * 0.4 + Math.min(10, accepted.length),
    ),
  };
}

function buildRelationshipWarnings(
  entry: RelationshipRegistryEntry,
  sourceEntity: EntityProfile | undefined,
  targetEntity: EntityProfile | undefined,
  matchedKeys: KeyProfile[],
  confidence: number,
): string[] {
  const warnings: string[] = [];

  if (!sourceEntity) {
    warnings.push(`${entry.sourceEntity} source entity is missing.`);
  }

  if (!targetEntity) {
    warnings.push(`${entry.targetEntity} target entity is missing.`);
  }

  if (matchedKeys.length === 0 && confidence >= REVIEW_CONFIDENCE_THRESHOLD) {
    warnings.push("Relationship has no detected key evidence.");
  }

  if (confidence >= REVIEW_CONFIDENCE_THRESHOLD && confidence < DEFAULT_MINIMUM_CONFIDENCE) {
    warnings.push("Relationship confidence is below the acceptance threshold.");
  }

  return warnings;
}

function detectBrokenRelationshipWarnings(
  profiles: RelationshipProfile[],
  keyProfiles: KeyProfile[],
): string[] {
  const warnings: string[] = [];
  const unknownKeys = keyProfiles.filter(
    (key) => key.keyType === "Unknown Key" && key.confidence >= 0.22,
  );

  if (unknownKeys.length > 0 && profiles.length > 0) {
    warnings.push(
      `${unknownKeys.length} possible key column${unknownKeys.length === 1 ? "" : "s"} need review.`,
    );
  }

  if (profiles.some((profile) => profile.status === "Needs Review")) {
    warnings.push("Low-confidence relationships remain outside the accepted graph.");
  }

  return warnings;
}

function detectCircularRelationshipWarnings(edges: RelationshipGraphEdge[]): string[] {
  const pairs = new Set(edges.map((edge) => `${edge.source}->${edge.target}`));

  return edges
    .filter((edge) => pairs.has(`${edge.target}->${edge.source}`))
    .map(
      (edge) =>
        `Circular relationship candidate detected between ${edge.source} and ${edge.target}.`,
    );
}

function resolveRows(context: PipelineContext): ReadonlyArray<Readonly<Record<string, unknown>>> {
  if (context.dataset.rows?.length) {
    return context.dataset.rows;
  }

  if (context.dataset.rawText) {
    return parseDelimitedRows(context.dataset.rawText);
  }

  return [];
}

function parseDelimitedRows(rawText: string): ReadonlyArray<Readonly<Record<string, unknown>>> {
  const lines = rawText.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines.slice(0, 8));
  const headers = splitDelimitedLine(lines[0], delimiter).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === delimiter && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function detectDelimiter(lines: string[]): string {
  const delimiters = [",", ";", "\t", "|"];
  return (
    delimiters
      .map((delimiter) => ({
        delimiter,
        count: lines.reduce((sum, line) => sum + line.split(delimiter).length - 1, 0),
      }))
      .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ","
  );
}

function toGraphNode(entity: EntityProfile): RelationshipGraphNode {
  return {
    id: entity.entityId,
    entityType: entity.entityType,
    label: entity.entityType,
    confidence: entity.confidence,
    columnCount: entity.columns.length,
  };
}

function toGraphEdge(
  profile: RelationshipProfile,
  nodeByEntity: Map<EntityType, RelationshipGraphNode>,
): RelationshipGraphEdge {
  return {
    id: profile.relationshipId,
    relationshipType: profile.relationshipType,
    source: nodeByEntity.get(profile.sourceEntity)?.id ?? profile.sourceEntity,
    target: nodeByEntity.get(profile.targetEntity)?.id ?? profile.targetEntity,
    confidence: profile.confidence,
    cardinality: profile.cardinality.type,
    matchedKeys: profile.matchedKeys.flatMap((key) => key.columns),
    status: profile.status,
  };
}

function toRelationshipLog(profile: RelationshipProfile): RelationshipScannerLog {
  return {
    relationshipType: profile.relationshipType,
    confidence: profile.confidence,
    evidence: profile.evidence,
    matchedKeys: profile.matchedKeys.flatMap((key) => key.columns),
    warnings: profile.warnings,
    errors: [],
    executionTime: profile.executionTime,
  };
}

function toColumnReference(bundle: RelationshipColumnBundle): RelationshipColumnReference {
  return {
    columnName: bundle.semanticColumn.columnName,
    position: bundle.semanticColumn.position,
    worksheetName: bundle.semanticColumn.worksheetName,
    semanticCategory: bundle.semanticColumn.semanticCategory,
    entityType: inferEntityType(bundle),
    confidence: Math.max(bundle.semanticColumn.confidence, bundle.entityProfile?.confidence ?? 0),
    sampleValues: bundle.structureColumn.sampleValues,
  };
}

function valuesForColumn(
  bundle: RelationshipColumnBundle,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): string[] {
  const values = rows.length
    ? rows.map((row) => row[bundle.semanticColumn.columnName])
    : bundle.structureColumn.sampleValues;

  return values.map(normalizeValue).filter(Boolean);
}

function bestDistributionColumn(
  columns: RelationshipColumnBundle[],
): RelationshipColumnBundle | undefined {
  return [...columns].sort(
    (left, right) =>
      scoreIdentifierColumn(right) - scoreIdentifierColumn(left) ||
      right.structureColumn.uniquePercent - left.structureColumn.uniquePercent,
  )[0];
}

function scoreIdentifierColumn(bundle: RelationshipColumnBundle): number {
  const normalized = normalizeTerm(bundle.semanticColumn.columnName);
  const semanticBonus = [
    "Customer",
    "Supplier",
    "Order",
    "Invoice",
    "SKU",
    "Employee",
    "Store",
    "Warehouse",
  ].includes(bundle.semanticColumn.semanticCategory)
    ? 0.4
    : 0;
  const nameBonus = /\b(id|uuid|number|no|code|key)\b/.test(normalized) ? 0.4 : 0;

  return semanticBonus + nameBonus + bundle.structureColumn.uniquePercent / 500;
}

function inferEntityType(bundle: RelationshipColumnBundle): EntityType {
  const normalizedName = normalizeTerm(bundle.semanticColumn.columnName);

  if (normalizedName.includes("payment")) {
    return "Payment";
  }

  if (
    normalizedName.includes("tax") ||
    normalizedName.includes("vat") ||
    normalizedName.includes("gst")
  ) {
    return "Tax";
  }

  if (normalizedName.includes("store") || normalizedName.includes("branch")) {
    return "Store";
  }

  if (normalizedName.includes("project")) {
    return "Project";
  }

  if (normalizedName.includes("shipment") || normalizedName.includes("tracking")) {
    return "Shipment";
  }

  if (normalizedName.includes("carrier")) {
    return "Carrier";
  }

  if (normalizedName.includes("refund")) {
    return "Refund";
  }

  if (normalizedName.includes("subscription")) {
    return "Subscription";
  }

  if (bundle.entityProfile?.entityType) {
    return bundle.entityProfile.entityType;
  }

  const category = bundle.semanticColumn.semanticCategory;
  const map: Partial<Record<typeof category, EntityType>> = {
    Customer: "Customer",
    Supplier: "Supplier",
    Order: "Order",
    Invoice: "Invoice",
    Payment: "Payment",
    SKU: "Product",
    "Product Name": "Product",
    Category: "Category",
    Brand: "Brand",
    Store: "Store",
    Warehouse: "Warehouse",
    Inventory: "Inventory Item",
    Employee: "Employee",
    Department: "Department",
    Expense: "Expense",
    Tax: "Tax",
    Currency: "Currency",
  };

  return map[category] ?? "Unknown";
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

function maxSampleCount(bundles: RelationshipColumnBundle[]): number {
  return Math.max(0, ...bundles.map((bundle) => bundle.structureColumn.sampleValues.length));
}

function confidenceBand(confidence: number): RelationshipConfidenceBand {
  if (confidence >= 0.8) {
    return "high";
  }

  if (confidence >= DEFAULT_MINIMUM_CONFIDENCE) {
    return "medium";
  }

  if (confidence >= REVIEW_CONFIDENCE_THRESHOLD) {
    return "low";
  }

  return "unknown";
}

function normalizeTerm(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "");
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

function isEntityProfile(value: unknown): value is EntityDatasetProfile {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as EntityDatasetProfile).version === "edie.entity.v1",
  );
}

function isRelationshipColumnBundle(
  value: RelationshipColumnBundle | null,
): value is RelationshipColumnBundle {
  return Boolean(value);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
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

export function createRelationshipRegistry(
  registry?: RelationshipRegistry,
): DefaultRelationshipRegistry {
  return registry ? new DefaultRelationshipRegistry(registry) : createDefaultRelationshipRegistry();
}
