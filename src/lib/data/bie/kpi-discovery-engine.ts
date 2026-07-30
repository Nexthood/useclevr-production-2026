import {
  buildBusinessMaturityProfile,
  buildDatasetStructureProfile,
  buildEntityDatasetProfile,
  buildRelationshipDatasetProfile,
  buildSemanticDatasetProfile,
  type BusinessMaturityProfile,
  type EntityDatasetProfile,
  type RelationshipDatasetProfile,
  type SemanticCategory,
  type SemanticColumnProfile,
  type SemanticDatasetProfile,
  type DatasetStructureProfile,
  type AnalysisResult,
  type PipelineContext,
  type Scanner,
  type ScannerExecutionOptions,
} from "../edie";
import { DefaultKPILibraryRegistry } from "./kpi-library";
import type {
  DetectedKPI,
  KPIAvailability,
  KPICalculationComplexity,
  KPIDatasetProfile,
  KPIDefinition,
  KPIDependencyGraph,
  KPIEvidence,
  KPILibrary,
  KPILibraryRegistry,
  KPIDiscoveryInput,
  KPIStatistics,
  KPICategory,
} from "./kpi-types";

const DEFAULT_MINIMUM_CONFIDENCE = 0.45;

const KPI_CATEGORIES: KPICategory[] = [
  "Financial KPIs",
  "Sales KPIs",
  "Customer KPIs",
  "Inventory KPIs",
  "Marketing KPIs",
  "Operational KPIs",
  "Product KPIs",
  "Accounting KPIs",
  "Supply Chain KPIs",
  "HR KPIs",
  "Manufacturing KPIs",
  "Restaurant KPIs",
  "Healthcare KPIs",
  "Hospitality KPIs",
  "Logistics KPIs",
  "SaaS KPIs",
  "Startup KPIs",
  "Executive KPIs",
  "Risk KPIs",
  "Compliance KPIs",
  "AI Readiness KPIs",
  "Business Health KPIs",
];

interface SourceProfiles {
  structureProfile: DatasetStructureProfile;
  semanticProfile: SemanticDatasetProfile;
  entityProfile: EntityDatasetProfile;
  relationshipProfile: RelationshipDatasetProfile;
  businessMaturityProfile: BusinessMaturityProfile;
}

interface DiscoverySignals {
  semanticCategories: Set<SemanticCategory>;
  semanticColumnsByCategory: Map<SemanticCategory, SemanticColumnProfile[]>;
  entityTypes: Set<string>;
  relationshipTypes: Set<string>;
  businessModels: Set<string>;
  industries: Set<string>;
  maturityDimensions: Set<string>;
  vocabulary: Set<string>;
  qualityScore: number;
  maturityScore: number;
  aiReadiness: number;
  biReadiness: number;
}

interface ScoredKPI {
  definition: KPIDefinition;
  detected: DetectedKPI;
}

export class UniversalKPIDiscoveryEngine implements Scanner {
  constructor(private readonly library: KPILibraryRegistry | KPILibrary = new DefaultKPILibraryRegistry()) {}

  id(): string {
    return "bie.kpi-discovery-engine.v1";
  }

  name(): string {
    return "Universal KPI Discovery Engine";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 60;
  }

  supports(context: PipelineContext): boolean {
    return Boolean(
      context.semanticMap.businessMaturityProfile ||
        context.semanticMap.relationshipProfile ||
        context.semanticMap.entityProfile ||
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

    if (!context.semanticMap.semanticProfile) {
      warnings.push("KPI discovery will build semantic metadata before selecting KPIs.");
    }

    if (!context.semanticMap.businessMaturityProfile) {
      warnings.push("KPI discovery will build business maturity metadata before readiness-aware KPI scoring.");
    }

    return {
      valid,
      warnings,
      errors: valid ? [] : ["KPI discovery requires EDIE profiles or dataset source content."],
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
        errors: ["Scanner execution was cancelled before KPI discovery."],
        metadata: {},
        executionTime: new Date().toISOString(),
        scannerVersion: this.version(),
      };
    }

    const profiles = resolveSourceProfiles(context);
    const profile = buildKPIDatasetProfile({
      ...profiles,
      businessModel: context.businessModel,
      industry: context.industry,
      library: this.library,
    });

    return {
      scannerId: this.id(),
      status: "completed",
      confidence: profile.confidence,
      duration: Date.now() - startedAtMs,
      warnings: profile.warnings,
      errors: profile.errors,
      metadata: {
        kpiProfile: profile,
        detectedKPIs: profile.statistics.detectedKPIs,
        availableKPIs: profile.statistics.availableKPIs,
        coveragePercent: profile.coveragePercent,
        qualityScore: profile.qualityScore,
      },
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
      contextPatch: {
        schema: { structureProfile: profiles.structureProfile },
        semanticMap: {
          semanticProfile: profiles.semanticProfile,
          entityProfile: profiles.entityProfile,
          relationshipProfile: profiles.relationshipProfile,
          businessMaturityProfile: profiles.businessMaturityProfile,
          kpiProfile: profile,
        },
        entities: profiles.entityProfile.entities,
        relationships: profiles.relationshipProfile.relationshipGraph.edges,
        kpis: profile.detectedKPIs,
        confidence: { [this.id()]: profile.confidence },
        warnings: profile.warnings,
      },
    };
  }
}

export function buildKPIDatasetProfile(input: KPIDiscoveryInput): KPIDatasetProfile {
  const startedAt = Date.now();
  const library = normalizeLibrary(input.library);
  const minimumConfidence = input.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;
  const signals = summarizeSignals(input);
  const discovered = library.definitions
    .map((definition) => scoreDefinition(definition, signals))
    .filter(
      (score) =>
        score.detected.confidence >= minimumConfidence ||
        score.detected.calculationAvailability !== "Unavailable" ||
        score.detected.businessRelevance >= 30,
    )
    .sort((first, second) => second.detected.confidence - first.detected.confidence);
  const dependencyGraph = buildDependencyGraph(discovered, library.definitions);
  const detectedKPIs = discovered.map((score) => ({
    ...score.detected,
    warnings: [
      ...score.detected.warnings,
      ...dependencyWarnings(score.detected, dependencyGraph),
    ],
  }));
  const evidence = Object.fromEntries(detectedKPIs.map((kpi) => [kpi.id, kpi.evidence]));
  const categories = unique(detectedKPIs.map((kpi) => kpi.category));
  const missingData = detectedKPIs
    .filter((kpi) => kpi.missingFields.length > 0)
    .map((kpi) => ({
      kpiId: kpi.id,
      kpiName: kpi.name,
      missingFields: kpi.missingFields,
      alternatives: kpi.alternativeKPIs,
    }));
  const statistics = buildStatistics(detectedKPIs, signals);
  const warnings = buildWarnings(detectedKPIs, signals);
  const confidence = roundConfidence(average(detectedKPIs.map((kpi) => kpi.confidence)));
  const qualityScore = roundScore(
    statistics.qualityScore * 0.45 +
      statistics.coveragePercent * 0.25 +
      confidence * 100 * 0.3,
  );

  return {
    version: "bie.kpi-profile.v1",
    libraryVersion: library.version,
    generatedAt: new Date().toISOString(),
    structureFingerprint: input.structureProfile.fingerprint,
    semanticProfileVersion: input.semanticProfile.version,
    entityProfileVersion: input.entityProfile.version,
    relationshipProfileVersion: input.relationshipProfile.version,
    businessMaturityProfileVersion: input.businessMaturityProfile?.version ?? null,
    detectedKPIs,
    categories,
    confidence,
    evidence,
    dependencies: dependencyGraph,
    missingData,
    qualityScore,
    coveragePercent: statistics.coveragePercent,
    warnings,
    errors: [],
    statistics,
    logs: detectedKPIs.map((kpi) => ({
      kpiId: kpi.id,
      name: kpi.name,
      confidence: kpi.confidence,
      evidence: kpi.evidence,
      dependencies: dependencyGraph.nodes.find((node) => node.kpiId === kpi.id)?.dependencies ?? [],
      availability: kpi.calculationAvailability,
      executionTime: new Date(startedAt).toISOString(),
      warnings: kpi.warnings,
      errors: [],
    })),
    extensionPoints: {
      dashboardIntelligenceEngine: true,
      aiInsightEngine: true,
      recommendationEngine: true,
      forecastEngine: true,
      whatIfAnalysis: true,
      scenarioPlanning: true,
      industryBenchmarks: true,
      companyBenchmarks: true,
      esgKpis: true,
      investorKpis: true,
      bankingKpis: true,
      ipoKpis: true,
      riskKpis: true,
      complianceKpis: true,
      kpiLearningEngine: true,
      activeLearning: true,
      humanValidation: true,
      graphAnalytics: true,
      timeSeriesAnalysis: true,
      streamingKpis: true,
      incrementalKpiUpdates: true,
    },
  };
}

function resolveSourceProfiles(context: PipelineContext): SourceProfiles {
  const structureProfile = isStructureProfile(context.schema.structureProfile)
    ? context.schema.structureProfile
    : buildDatasetStructureProfile(context);
  const semanticProfile = isSemanticProfile(context.semanticMap.semanticProfile)
    ? context.semanticMap.semanticProfile
    : buildSemanticDatasetProfile({ structureProfile });
  const entityProfile = isEntityProfile(context.semanticMap.entityProfile)
    ? context.semanticMap.entityProfile
    : buildEntityDatasetProfile({ structureProfile, semanticProfile });
  const relationshipProfile = isRelationshipProfile(context.semanticMap.relationshipProfile)
    ? context.semanticMap.relationshipProfile
    : buildRelationshipDatasetProfile({
        structureProfile,
        semanticProfile,
        entityProfile,
        rows: resolveRows(context),
      });
  const businessMaturityProfile = isBusinessMaturityProfile(context.semanticMap.businessMaturityProfile)
    ? context.semanticMap.businessMaturityProfile
    : buildBusinessMaturityProfile({
        structureProfile,
        semanticProfile,
        entityProfile,
        relationshipProfile,
        businessModel: context.businessModel,
        rows: resolveRows(context),
      });

  return {
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
  };
}

function normalizeLibrary(library: KPIDiscoveryInput["library"]): KPILibrary {
  if (!library) {
    return new DefaultKPILibraryRegistry().toLibrary();
  }

  if ("toLibrary" in library) {
    return library.toLibrary();
  }

  return library;
}

function summarizeSignals(input: KPIDiscoveryInput): DiscoverySignals {
  const semanticColumnsByCategory = new Map<SemanticCategory, SemanticColumnProfile[]>();
  const semanticCategories = new Set<SemanticCategory>();

  for (const column of input.semanticProfile.semanticColumns) {
    if (column.semanticCategory === "Unknown" || column.needsReview) {
      continue;
    }

    semanticCategories.add(column.semanticCategory);
    semanticColumnsByCategory.set(column.semanticCategory, [
      ...(semanticColumnsByCategory.get(column.semanticCategory) ?? []),
      column,
    ]);
  }

  const entityTypes = new Set(input.entityProfile.entities.map((entity) => entity.entityType));
  const relationshipTypes = new Set(
    input.relationshipProfile.relationshipProfiles.map((relationship) => relationship.relationshipType),
  );
  const businessModels = extractContextWords(input.businessModel, ["model", "businessModel", "type", "primaryModel"]);
  const industries = extractContextWords(input.industry, ["industry", "vertical", "name", "type"]);
  const vocabulary = new Set(
    [
      ...input.structureProfile.columns.map((column) => column.name),
      ...input.semanticProfile.semanticColumns.flatMap((column) => [column.columnName, ...column.aliases]),
      ...Array.from(businessModels),
      ...Array.from(industries),
    ]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

  return {
    semanticCategories,
    semanticColumnsByCategory,
    entityTypes,
    relationshipTypes,
    businessModels,
    industries,
    maturityDimensions: new Set(
      input.businessMaturityProfile?.dimensionScores
        .filter((dimension) => dimension.score >= 35 && !dimension.unknown)
        .map((dimension) => dimension.dimension) ?? [],
    ),
    vocabulary,
    qualityScore: input.structureProfile.quality.score,
    maturityScore: input.businessMaturityProfile?.statistics.overallMaturityScore ?? 0,
    aiReadiness: input.businessMaturityProfile?.statistics.aiReadiness ?? 0,
    biReadiness: input.businessMaturityProfile?.statistics.biReadiness ?? 0,
  };
}

function scoreDefinition(definition: KPIDefinition, signals: DiscoverySignals): ScoredKPI {
  const required = unique(definition.requiredFields);
  const optional = unique(definition.optionalFields);
  const availableFields = required.filter((field) => signals.semanticCategories.has(field));
  const missingFields = required.filter((field) => !signals.semanticCategories.has(field));
  const semanticCoverage = required.length === 0 ? 1 : availableFields.length / required.length;
  const businessRelevance = calculateBusinessRelevance(definition, signals);
  const calculationAvailability = classifyAvailability(definition, semanticCoverage, missingFields);
  const complexity = classifyComplexity(definition, missingFields);
  const dependencyEvidence = definition.dependencies.length > 0
    ? evidence("relationship-dependency", Math.min(1, definition.dependencies.length / 3), 0.12, `KPI depends on ${definition.dependencies.join(", ")}.`, definition.dependencies.join(", "))
    : evidence("library-definition", 0.5, 0.04, "KPI has no prerequisite KPI dependency.", definition.id);
  const semanticEvidence = evidence(
    missingFields.length === 0 ? "semantic-field" : "missing-field",
    semanticCoverage,
    0.42,
    missingFields.length === 0
      ? `All required semantic fields are present: ${required.join(", ") || "none"}.`
      : `Missing required semantic fields: ${missingFields.join(", ")}.`,
    required.join(", ") || "no required semantic fields",
  );
  const modelEvidence = evidence(
    "business-model-fit",
    businessRelevance,
    0.22,
    businessRelevance >= 0.5
      ? "KPI matches detected business model or industry signals."
      : "KPI has limited business-model evidence.",
    [...signals.businessModels, ...signals.industries, ...definition.businessModels].join(", "),
  );
  const qualityEvidence = evidence(
    "dataset-quality",
    signals.qualityScore / 100,
    0.12,
    `Dataset quality score is ${roundScore(signals.qualityScore)}.`,
    "structure profile",
  );
  const maturityEvidence = evidence(
    "business-maturity-fit",
    maturityFit(definition, signals),
    0.12,
    "KPI relevance uses maturity and readiness signals.",
    definition.relevanceSignals.maturityDimensions.join(", ") || "general maturity",
  );
  const entityEvidence = evidence(
    "entity-presence",
    entityFit(definition, signals),
    0.1,
    "KPI relevance uses detected business entities.",
    definition.relevanceSignals.entityTypes.join(", ") || "no entity requirement",
  );
  const evidenceItems = [
    semanticEvidence,
    modelEvidence,
    qualityEvidence,
    maturityEvidence,
    entityEvidence,
    dependencyEvidence,
  ];
  const confidence = roundConfidence(weightedAverage(evidenceItems));
  const alternatives = findAlternativeKpis(definition, missingFields);
  const warnings = [
    ...missingFields.map((field) => `${definition.name} requires ${field} data.`),
    ...(definition.formula.requiresUserInput ? [`${definition.name} needs user input before calculation.`] : []),
  ];

  return {
    definition,
    detected: {
      id: definition.id,
      name: definition.name,
      category: definition.category,
      confidence,
      evidence: evidenceItems,
      requiredFields: required,
      missingFields,
      optionalFields: optional,
      availableFields,
      calculationAvailability,
      calculationComplexity: complexity,
      businessRelevance: roundScore(businessRelevance * 100),
      warnings,
      alternativeKPIs: alternatives,
      recommendation:
        missingFields.length > 0
          ? {
              requiredData: required,
              missingColumns: missingFields,
              alternativeKpiIds: alternatives,
              potentialImprovement: `Add ${missingFields.join(", ")} fields to calculate ${definition.name}.`,
              status: "identified-not-generated",
            }
          : null,
      visualizationRecommendations: definition.visualizationRecommendations,
      units: definition.units,
      thresholds: definition.thresholds,
      definitionVersion: definition.version,
    },
  };
}

function buildDependencyGraph(discovered: ScoredKPI[], definitions: KPIDefinition[]): KPIDependencyGraph {
  const detectedById = new Map(discovered.map((score) => [score.definition.id, score.detected]));
  const allIds = new Set(definitions.map((definition) => definition.id));
  const nodes = discovered.map(({ definition, detected }) => {
    const dependents = definitions
      .filter((candidate) => candidate.dependencies.includes(definition.id))
      .map((candidate) => candidate.id);

    return {
      kpiId: definition.id,
      name: definition.name,
      dependencies: definition.dependencies,
      dependents,
      availability: detected.calculationAvailability,
      confidence: detected.confidence,
    };
  });
  const edges = nodes.flatMap((node) =>
    node.dependencies.map((dependency) => ({
      from: dependency,
      to: node.kpiId,
      available: detectedById.get(dependency)?.calculationAvailability === "Available",
      confidence: detectedById.get(dependency)?.confidence ?? (allIds.has(dependency) ? 0.25 : 0),
    })),
  );
  const missingDependencyChains = nodes
    .map((node) => ({
      kpiId: node.kpiId,
      missingDependencies: node.dependencies.filter(
        (dependency) => detectedById.get(dependency)?.calculationAvailability !== "Available",
      ),
      reason: "One or more prerequisite KPIs are unavailable from detected fields.",
    }))
    .filter((chain) => chain.missingDependencies.length > 0);

  return {
    version: "bie.kpi-dependency-graph.v1",
    nodes,
    edges,
    missingDependencyChains,
    confidence: roundConfidence(average(nodes.map((node) => node.confidence))),
  };
}

function buildStatistics(kpis: DetectedKPI[], signals: DiscoverySignals): KPIStatistics {
  const availableKPIs = kpis.filter((kpi) => kpi.calculationAvailability === "Available").length;
  const partiallyAvailableKPIs = kpis.filter((kpi) => kpi.calculationAvailability === "Partially Available").length;
  const unavailableKPIs = kpis.filter((kpi) => kpi.calculationAvailability === "Unavailable").length;
  const needsUserInputKPIs = kpis.filter((kpi) => kpi.calculationAvailability === "Needs User Input").length;
  const categoryDistribution = Object.fromEntries(
    KPI_CATEGORIES.map((category) => [
      category,
      kpis.filter((kpi) => kpi.category === category).length,
    ]),
  ) as Record<KPICategory, number>;
  const coveragePercent = kpis.length === 0 ? 0 : roundScore(((availableKPIs + partiallyAvailableKPIs * 0.5) / kpis.length) * 100);
  const averageConfidence = roundConfidence(average(kpis.map((kpi) => kpi.confidence)));
  const businessHealthCoverage = roundScore(
    Math.min(
      100,
      categoryDistribution["Business Health KPIs"] * 12 +
        categoryDistribution["Financial KPIs"] * 5 +
        categoryDistribution["Risk KPIs"] * 7 +
        signals.biReadiness * 0.2,
    ),
  );
  const qualityScore = roundScore(
    coveragePercent * 0.35 +
      averageConfidence * 100 * 0.25 +
      signals.qualityScore * 0.2 +
      Math.max(signals.aiReadiness, signals.biReadiness, signals.maturityScore) * 0.2,
  );

  return {
    detectedKPIs: kpis.length,
    availableKPIs,
    partiallyAvailableKPIs,
    unavailableKPIs,
    needsUserInputKPIs,
    coveragePercent,
    averageConfidence,
    confidenceDistribution: {
      high: kpis.filter((kpi) => kpi.confidence >= 0.75).length,
      medium: kpis.filter((kpi) => kpi.confidence >= 0.5 && kpi.confidence < 0.75).length,
      low: kpis.filter((kpi) => kpi.confidence < 0.5).length,
    },
    categoryDistribution,
    businessHealthCoverage,
    qualityScore,
  };
}

function calculateBusinessRelevance(definition: KPIDefinition, signals: DiscoverySignals): number {
  const modelHit = definition.businessModels.some((model) => signals.businessModels.has(normalizeToken(model)));
  const industryHit = definition.industries.some((industry) => signals.industries.has(normalizeToken(industry)));
  const semanticHits = definition.relevanceSignals.semanticCategories.filter((category) => signals.semanticCategories.has(category)).length;
  const relationshipHits = definition.relevanceSignals.relationshipTypes.filter((relationship) => signals.relationshipTypes.has(relationship)).length;
  const vocabularyHits = definition.relevanceSignals.vocabulary.filter((word) => signals.vocabulary.has(normalizeToken(word))).length;

  return Math.min(
    1,
    (modelHit ? 0.32 : 0) +
      (industryHit ? 0.24 : 0) +
      Math.min(0.28, semanticHits * 0.07) +
      Math.min(0.12, relationshipHits * 0.06) +
      Math.min(0.12, vocabularyHits * 0.04) +
      (signals.businessModels.size === 0 && signals.industries.size === 0 ? 0.22 : 0),
  );
}

function classifyAvailability(
  definition: KPIDefinition,
  semanticCoverage: number,
  missingFields: SemanticCategory[],
): KPIAvailability {
  if (definition.formula.requiresUserInput) {
    return missingFields.length === 0 ? "Needs User Input" : "Partially Available";
  }

  if (missingFields.length === 0) {
    return "Available";
  }

  if (semanticCoverage >= 0.5) {
    return "Partially Available";
  }

  return "Unavailable";
}

function classifyComplexity(definition: KPIDefinition, missingFields: SemanticCategory[]): KPICalculationComplexity {
  if (missingFields.length === definition.requiredFields.length && definition.requiredFields.length > 0) {
    return "Not Supported";
  }

  if (definition.dependencies.length >= 2 || definition.requiredFields.length >= 3) {
    return "High";
  }

  if (definition.dependencies.length === 1 || definition.requiredFields.length === 2) {
    return "Medium";
  }

  return "Low";
}

function maturityFit(definition: KPIDefinition, signals: DiscoverySignals): number {
  const maturityHits = definition.relevanceSignals.maturityDimensions.filter((dimension) =>
    signals.maturityDimensions.has(dimension),
  ).length;
  const readiness = definition.category === "AI Readiness KPIs"
    ? signals.aiReadiness
    : definition.category === "Business Health KPIs"
      ? Math.max(signals.biReadiness, signals.maturityScore)
      : signals.maturityScore;

  return Math.min(1, readiness / 100 + maturityHits * 0.12);
}

function entityFit(definition: KPIDefinition, signals: DiscoverySignals): number {
  if (definition.relevanceSignals.entityTypes.length === 0) {
    return 0.5;
  }

  return Math.min(
    1,
    definition.relevanceSignals.entityTypes.filter((entity) => signals.entityTypes.has(entity)).length /
      definition.relevanceSignals.entityTypes.length,
  );
}

function findAlternativeKpis(definition: KPIDefinition, missingFields: SemanticCategory[]): string[] {
  if (missingFields.length === 0) {
    return [];
  }

  const alternatives: Record<SemanticCategory, string[]> = {
    Revenue: ["business-health-score", "ai-readiness-score"],
    Cost: ["revenue", "sales-growth"],
    Profit: ["gross-profit", "margin"],
    Inventory: ["store-performance", "revenue"],
    Customer: ["revenue", "average-order-value"],
    Date: ["revenue", "inventory-value"],
    Status: ["revenue", "order-frequency"],
    Order: ["revenue", "sales-growth"],
    Expense: ["revenue", "cash-flow"],
    Payment: ["revenue", "accounts-receivable"],
  } as Partial<Record<SemanticCategory, string[]>> as Record<SemanticCategory, string[]>;

  return unique(missingFields.flatMap((field) => alternatives[field] ?? []).filter((id) => id !== definition.id)).slice(0, 3);
}

function dependencyWarnings(kpi: DetectedKPI, graph: KPIDependencyGraph): string[] {
  return graph.missingDependencyChains
    .filter((chain) => chain.kpiId === kpi.id)
    .map((chain) => `${kpi.name} depends on unavailable KPIs: ${chain.missingDependencies.join(", ")}.`);
}

function buildWarnings(kpis: DetectedKPI[], signals: DiscoverySignals): string[] {
  const warnings: string[] = [];

  if (kpis.length === 0) {
    warnings.push("No KPI candidates met the minimum confidence threshold.");
  }

  if (signals.qualityScore < 50) {
    warnings.push("Dataset quality limits KPI discovery confidence.");
  }

  if (kpis.some((kpi) => kpi.calculationAvailability === "Needs User Input")) {
    warnings.push("Some KPI candidates need user input before calculation.");
  }

  return warnings;
}

function evidence(type: KPIEvidence["type"], score: number, weight: number, reason: string, source: string): KPIEvidence {
  return {
    type,
    score: roundConfidence(score),
    weight,
    reason,
    source,
  };
}

function extractContextWords(
  context: Readonly<Record<string, unknown>> | null | undefined,
  keys: string[],
): Set<string> {
  if (!context) {
    return new Set();
  }

  const values = keys.flatMap((key) => extractUnknownValues(context[key]));
  return new Set(values.map((value) => normalizeToken(value)).filter(Boolean));
}

function extractUnknownValues(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractUnknownValues);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(extractUnknownValues);
  }

  return [];
}

function resolveRows(context: PipelineContext): ReadonlyArray<Readonly<Record<string, unknown>>> {
  if (context.dataset.rows?.length) {
    return context.dataset.rows;
  }

  if (typeof context.dataset.rawText !== "string" || !context.dataset.rawText.trim()) {
    return [];
  }

  const lines = context.dataset.rawText.trim().split(/\r?\n/);
  const delimiter = lines[0]?.includes(";") ? ";" : ",";
  const headers = splitLine(lines[0] ?? "", delimiter);

  return lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function isStructureProfile(value: unknown): value is DatasetStructureProfile {
  return Boolean(value && typeof value === "object" && (value as DatasetStructureProfile).version === "edie.structure.v1");
}

function isSemanticProfile(value: unknown): value is SemanticDatasetProfile {
  return Boolean(value && typeof value === "object" && (value as SemanticDatasetProfile).version === "edie.semantic.v1");
}

function isEntityProfile(value: unknown): value is EntityDatasetProfile {
  return Boolean(value && typeof value === "object" && (value as EntityDatasetProfile).version === "edie.entity.v1");
}

function isRelationshipProfile(value: unknown): value is RelationshipDatasetProfile {
  return Boolean(value && typeof value === "object" && (value as RelationshipDatasetProfile).version === "edie.relationship.v1");
}

function isBusinessMaturityProfile(value: unknown): value is BusinessMaturityProfile {
  return Boolean(value && typeof value === "object" && (value as BusinessMaturityProfile).version === "edie.business-maturity.v1");
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function weightedAverage(items: KPIEvidence[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return items.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}
