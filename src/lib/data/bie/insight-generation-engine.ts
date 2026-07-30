import {
  buildBusinessMaturityProfile,
  buildDatasetStructureProfile,
  buildEntityDatasetProfile,
  buildRelationshipDatasetProfile,
  buildSemanticDatasetProfile,
  type AnalysisResult,
  type BusinessMaturityProfile,
  type EntityDatasetProfile,
  type PipelineContext,
  type RelationshipDatasetProfile,
  type Scanner,
  type ScannerExecutionOptions,
  type SemanticCategory,
  type SemanticDatasetProfile,
} from "../edie";
import { buildKPIDatasetProfile } from "./kpi-discovery-engine";
import { DefaultInsightLibraryRegistry } from "./insight-library";
import type {
  BusinessInsight,
  ContradictingInsightRecord,
  DuplicateInsightRecord,
  InsightCandidate,
  InsightEvidence,
  InsightGenerationInput,
  InsightGenerationLog,
  InsightGroup,
  InsightLibrary,
  InsightLibraryRegistry,
  InsightPriority,
  InsightProfile,
  InsightRuleDefinition,
  InsightSeverity,
  InsightStatistics,
  InsightType,
  OverlappingInsightRecord,
} from "./insight-types";
import type { DetectedKPI, KPIDatasetProfile, KPICategory } from "./kpi-types";

const DEFAULT_MINIMUM_CONFIDENCE = 0.45;

const allInsightGroups: InsightGroup[] = [
  "Financial",
  "Operational",
  "Commercial",
  "Inventory",
  "Customer",
  "Marketing",
  "Accounting",
  "Executive",
  "Risk",
  "Forecast",
  "Compliance",
  "AI",
];

const categoryFallbackRules: Record<KPICategory, string> = {
  "Financial KPIs": "revenue-visibility",
  "Sales KPIs": "sales-performance",
  "Customer KPIs": "customer-signal",
  "Inventory KPIs": "inventory-risk",
  "Marketing KPIs": "marketing-efficiency",
  "Operational KPIs": "operational-health",
  "Product KPIs": "product-performance",
  "Accounting KPIs": "accounting-control",
  "Supply Chain KPIs": "inventory-risk",
  "HR KPIs": "employee-operational-signal",
  "Manufacturing KPIs": "operational-health",
  "Restaurant KPIs": "operational-health",
  "Healthcare KPIs": "operational-health",
  "Hospitality KPIs": "operational-health",
  "Logistics KPIs": "operational-health",
  "SaaS KPIs": "customer-signal",
  "Startup KPIs": "growth-signal",
  "Executive KPIs": "executive-focus",
  "Risk KPIs": "risk-indicator",
  "Compliance KPIs": "accounting-control",
  "AI Readiness KPIs": "business-health",
  "Business Health KPIs": "business-health",
};

interface ResolvedInsightProfiles {
  kpiProfile: KPIDatasetProfile;
  semanticProfile: SemanticDatasetProfile;
  entityProfile: EntityDatasetProfile;
  relationshipProfile: RelationshipDatasetProfile;
  businessMaturityProfile: BusinessMaturityProfile;
}

export class UniversalInsightGenerationEngine implements Scanner {
  constructor(private readonly library: InsightLibraryRegistry | InsightLibrary = new DefaultInsightLibraryRegistry()) {}

  id(): string {
    return "bie.insight-generation-engine.v1";
  }

  name(): string {
    return "Universal Insight Generation Engine";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 80;
  }

  supports(context: PipelineContext): boolean {
    return Boolean(
      context.semanticMap.kpiProfile ||
        context.semanticMap.businessMaturityProfile ||
        context.kpis.length ||
        context.dataset.rawText ||
        context.dataset.rawBuffer ||
        context.dataset.rows?.length,
    );
  }

  validate(context: PipelineContext) {
    const valid = this.supports(context);
    const warnings: string[] = [];

    if (!context.semanticMap.kpiProfile) {
      warnings.push("Insight generation will build KPI discovery output before insight generation.");
    }

    if (!context.semanticMap.relationshipProfile) {
      warnings.push("Insight generation will build relationship metadata before evidence scoring.");
    }

    return {
      valid,
      warnings,
      errors: valid ? [] : ["Insight generation requires BIE/EDIE profiles or dataset source content."],
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
        errors: ["Scanner execution was cancelled before insight generation."],
        metadata: {},
        executionTime: new Date().toISOString(),
        scannerVersion: this.version(),
      };
    }

    const profiles = resolveProfiles(context);
    const insightProfile = buildInsightProfile({
      context,
      ...profiles,
      businessModel: context.businessModel,
      library: this.library,
    });

    return {
      scannerId: this.id(),
      status: "completed",
      confidence: insightProfile.confidence,
      duration: Date.now() - startedAtMs,
      warnings: insightProfile.warnings,
      errors: insightProfile.errors,
      metadata: {
        insightProfile,
        insightCount: insightProfile.statistics.insightCount,
        criticalInsights: insightProfile.statistics.criticalInsights,
        risks: insightProfile.statistics.risks,
        opportunities: insightProfile.statistics.opportunities,
        coveragePercent: insightProfile.coveragePercent,
        qualityScore: insightProfile.qualityScore,
      },
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
      contextPatch: {
        semanticMap: {
          semanticProfile: profiles.semanticProfile,
          entityProfile: profiles.entityProfile,
          relationshipProfile: profiles.relationshipProfile,
          businessMaturityProfile: profiles.businessMaturityProfile,
          kpiProfile: profiles.kpiProfile,
          insightProfile,
        },
        entities: profiles.entityProfile.entities,
        relationships: profiles.relationshipProfile.relationshipGraph.edges,
        kpis: profiles.kpiProfile.detectedKPIs,
        confidence: { [this.id()]: insightProfile.confidence },
        warnings: insightProfile.warnings,
      },
    };
  }
}

export function buildInsightProfile(input: InsightGenerationInput): InsightProfile {
  const startedAt = Date.now();
  const executionTime = new Date(startedAt).toISOString();
  const library = normalizeLibrary(input.library);
  const minimumConfidence = input.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;
  const businessModel = extractBusinessModel(input.businessModel);
  const semanticCategories = new Set(
    input.semanticProfile?.semanticColumns
      .filter((column) => column.semanticCategory !== "Unknown" && !column.needsReview)
      .map((column) => column.semanticCategory) ?? [],
  );
  const candidates = buildCandidates(input, library, semanticCategories, businessModel)
    .filter((candidate) => candidate.confidence >= minimumConfidence)
    .sort((first, second) => second.rule.priority - first.rule.priority || second.confidence - first.confidence);
  const rawInsights = candidates.map((candidate, index) =>
    buildInsight(candidate, input, semanticCategories, executionTime, index),
  );
  const { insights, duplicates, overlaps, contradictions } = analyzeInsightRelationships(rawInsights);
  const groups = buildGroups(insights);
  const statistics = buildStatistics(insights, duplicates, overlaps, contradictions, input);
  const warnings = buildWarnings(input, insights, duplicates);
  const confidence = roundConfidence(average(insights.map((insight) => insight.confidence)));
  const qualityScore = roundScore(
    statistics.qualityScore * 0.45 +
      statistics.coveragePercent * 0.25 +
      confidence * 100 * 0.3,
  );
  const logs = buildLogs(insights, duplicates, executionTime, Date.now() - startedAt);

  return {
    version: "bie.insight-profile.v1",
    generatedAt: new Date().toISOString(),
    kpiProfileVersion: input.kpiProfile.version,
    semanticProfileVersion: input.semanticProfile?.version ?? null,
    entityProfileVersion: input.entityProfile?.version ?? null,
    relationshipProfileVersion: input.relationshipProfile?.version ?? null,
    businessMaturityProfileVersion: input.businessMaturityProfile?.version ?? null,
    insights,
    groups,
    duplicates,
    overlaps,
    contradictions,
    statistics,
    confidence,
    warnings,
    errors: [],
    coveragePercent: statistics.coveragePercent,
    qualityScore,
    logs,
    extensionPoints: {
      aiExecutiveSummaries: true,
      naturalLanguageReports: true,
      personalizedInsights: true,
      scheduledInsightDelivery: true,
      predictiveInsights: true,
      rootCauseAnalysis: true,
      whatIfAnalysis: true,
      businessSimulations: true,
      decisionEngine: true,
      recommendationEngine: true,
      alertEngine: true,
      mobileNotifications: true,
      slackTeamsIntegration: true,
      emailSummaries: true,
      voiceAssistant: true,
      multiLanguageInsightGeneration: true,
      historicalInsightTracking: true,
      trendComparison: true,
      insightHistory: true,
      insightEvolution: true,
    },
  };
}

function buildCandidates(
  input: InsightGenerationInput,
  library: InsightLibrary,
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];

  for (const rule of library.definitions) {
    const matchingKpis = matchingKpisForRule(rule, input.kpiProfile.detectedKPIs, semanticCategories, businessModel)
      .sort((first, second) => second.businessRelevance - first.businessRelevance || second.confidence - first.confidence)
      .slice(0, rule.maxPerRule);

    for (const kpi of matchingKpis) {
      const evidence = buildEvidence(rule, kpi, input, semanticCategories, businessModel);
      candidates.push({
        rule,
        kpi,
        confidence: roundConfidence(weightedAverage(evidence)),
        evidence,
        businessImpact: buildBusinessImpact(rule, kpi, input),
        severity: severityFor(rule, kpi),
        warnings: buildCandidateWarnings(rule, kpi, semanticCategories),
      });
    }
  }

  candidates.push(...buildProfileLevelCandidates(input, library, semanticCategories, businessModel));

  return candidates;
}

function matchingKpisForRule(
  rule: InsightRuleDefinition,
  kpis: DetectedKPI[],
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): DetectedKPI[] {
  const modelFit = rule.businessModels.includes("generic") || (businessModel ? rule.businessModels.includes(businessModel) : false);
  const requiredFit =
    rule.requiredSemanticCategories.length === 0 ||
    rule.requiredSemanticCategories.some((category) => semanticCategories.has(category));

  return kpis.filter((kpi) => {
    const idFit = rule.supportedKpiIds.length === 0 || rule.supportedKpiIds.includes(kpi.id);
    const categoryFit = rule.supportedKpiCategories.includes(kpi.category);
    const availabilityFit = kpi.calculationAvailability !== "Unavailable" || rule.insightType === "Missing Information";

    return availabilityFit && requiredFit && (idFit || categoryFit) && (modelFit || categoryFit);
  });
}

function buildProfileLevelCandidates(
  input: InsightGenerationInput,
  library: InsightLibrary,
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];
  const healthRule = library.definitions.find((definition) => definition.id === "business-health");
  const riskRule = library.definitions.find((definition) => definition.id === "risk-indicator");
  const qualityRule = library.definitions.find((definition) => definition.id === "forecast-readiness");

  if (healthRule && input.businessMaturityProfile) {
    candidates.push(profileCandidate(healthRule, "Business maturity profile supports executive business health review.", input.businessMaturityProfile.confidence, input, semanticCategories, businessModel));
  }

  if (riskRule && (input.kpiProfile.missingData.length > 0 || (input.semanticProfile?.unknownFields.length ?? 0) > 0)) {
    candidates.push(profileCandidate(riskRule, "Missing KPI dependencies or unknown fields create investigation risk.", 0.68, input, semanticCategories, businessModel));
  }

  if (qualityRule && input.kpiProfile.qualityScore < 70) {
    candidates.push(profileCandidate(qualityRule, "Dataset quality limits confidence for forecast-style insight generation.", input.kpiProfile.qualityScore / 100, input, semanticCategories, businessModel));
  }

  return candidates;
}

function profileCandidate(
  rule: InsightRuleDefinition,
  reason: string,
  score: number,
  input: InsightGenerationInput,
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): InsightCandidate {
  const evidence = [
    evidenceItem("insight-rule", 0.72, 0.2, `${rule.id} selected a profile-level insight.`, rule.id),
    evidenceItem("dataset-quality", input.kpiProfile.qualityScore / 100, 0.22, `KPI profile quality is ${input.kpiProfile.qualityScore}.`, "KPI profile"),
    evidenceItem("business-maturity", (input.businessMaturityProfile?.confidence ?? score), 0.24, reason, "business maturity profile"),
    evidenceItem("semantic-coverage", (input.semanticProfile?.coveragePercent ?? input.kpiProfile.coveragePercent) / 100, 0.18, "Semantic coverage supports profile-level insight evidence.", "semantic profile"),
    evidenceItem("business-model", businessModel ? 0.72 : 0.42, 0.16, businessModel ? `Business model signal is ${businessModel}.` : "No business model signal is available.", businessModel ?? "unknown"),
  ];

  return {
    rule,
    kpi: null,
    confidence: roundConfidence(weightedAverage(evidence)),
    evidence,
    businessImpact: roundScore(rule.baseImpact * 0.65 + (input.businessMaturityProfile?.statistics.businessHealthScore ?? 50) * 0.35),
    severity: rule.baseSeverity,
    warnings: rule.requiredSemanticCategories
      .filter((category) => !semanticCategories.has(category))
      .map((category) => `${rule.id} has no detected ${category} semantic field.`),
  };
}

function buildInsight(
  candidate: InsightCandidate,
  input: InsightGenerationInput,
  semanticCategories: Set<SemanticCategory>,
  executionTime: string,
  order: number,
): BusinessInsight {
  const kpi = candidate.kpi;
  const title = renderTemplate(candidate.rule.titleTemplate, kpi);
  const description = renderTemplate(candidate.rule.descriptionTemplate, kpi);
  const supportingEntities = entityIdsFor(candidate.rule, input.entityProfile);
  const supportingRelationships = relationshipIdsFor(candidate.rule, input.relationshipProfile);
  const affectedDepartments = departmentNamesFor(input.entityProfile, semanticCategories);
  const priority = classifyPriority(candidate.businessImpact, candidate.confidence, candidate.severity, input);

  return {
    id: stableInsightId(candidate.rule.id, kpi?.id ?? "profile", order),
    title,
    description,
    category: candidate.rule.category,
    group: candidate.rule.group,
    type: candidate.rule.insightType,
    priority,
    severity: candidate.severity,
    confidence: candidate.confidence,
    evidence: candidate.evidence,
    supportingKPIs: kpi ? [kpi.id] : topKpisForRule(candidate.rule, input.kpiProfile.detectedKPIs).map((item) => item.id),
    supportingEntities,
    supportingRelationships,
    affectedDepartments,
    businessImpact: candidate.businessImpact,
    recommendedInvestigation: buildRecommendedInvestigation(candidate.rule, kpi),
    warnings: unique([...candidate.warnings, ...(kpi?.warnings ?? [])]),
    executionTime,
    ruleId: candidate.rule.id,
    duplicateOf: null,
    overlapWith: [],
    contradictionWith: [],
  };
}

function analyzeInsightRelationships(insights: BusinessInsight[]): {
  insights: BusinessInsight[];
  duplicates: DuplicateInsightRecord[];
  overlaps: OverlappingInsightRecord[];
  contradictions: ContradictingInsightRecord[];
} {
  const duplicates: DuplicateInsightRecord[] = [];
  const overlaps: OverlappingInsightRecord[] = [];
  const contradictions: ContradictingInsightRecord[] = [];
  const canonicalByKey = new Map<string, BusinessInsight>();
  const nextInsights: BusinessInsight[] = [];

  for (const insight of insights) {
    const duplicateKey = `${slug(insight.title)}:${insight.category}:${insight.supportingKPIs.join("|") || "profile"}`;
    const existing = canonicalByKey.get(duplicateKey);

    if (existing) {
      duplicates.push({
        insightId: insight.id,
        duplicateOf: existing.id,
        confidence: roundConfidence(Math.min(existing.confidence, insight.confidence)),
        reason: "Insights share the same rule and supporting KPI evidence.",
      });
      continue;
    }

    canonicalByKey.set(duplicateKey, insight);
    nextInsights.push(insight);
  }

  for (let index = 0; index < nextInsights.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < nextInsights.length; otherIndex += 1) {
      const first = nextInsights[index];
      const second = nextInsights[otherIndex];
      const sharedKpis = first.supportingKPIs.filter((kpi) => second.supportingKPIs.includes(kpi));

      if (sharedKpis.length > 0 || first.group === second.group) {
        overlaps.push({
          insightIds: [first.id, second.id],
          confidence: roundConfidence(sharedKpis.length > 0 ? 0.78 : 0.56),
          sharedEvidence: sharedKpis,
          reason: sharedKpis.length > 0 ? "Insights share supporting KPI evidence." : "Insights belong to the same business group.",
        });
      }

      if (isPositive(first.type) !== isPositive(second.type) && sharedKpis.length > 0) {
        contradictions.push({
          insightIds: [first.id, second.id],
          confidence: roundConfidence(Math.min(first.confidence, second.confidence) * 0.8),
          reason: "Positive and risk-oriented insights reference the same supporting KPI.",
        });
      }
    }
  }

  const duplicateLookup = new Map(duplicates.map((record) => [record.insightId, record.duplicateOf]));
  const overlapLookup = new Map<string, string[]>();
  const contradictionLookup = new Map<string, string[]>();

  for (const overlap of overlaps) {
    overlapLookup.set(overlap.insightIds[0], [...(overlapLookup.get(overlap.insightIds[0]) ?? []), overlap.insightIds[1]]);
    overlapLookup.set(overlap.insightIds[1], [...(overlapLookup.get(overlap.insightIds[1]) ?? []), overlap.insightIds[0]]);
  }

  for (const contradiction of contradictions) {
    contradictionLookup.set(contradiction.insightIds[0], [...(contradictionLookup.get(contradiction.insightIds[0]) ?? []), contradiction.insightIds[1]]);
    contradictionLookup.set(contradiction.insightIds[1], [...(contradictionLookup.get(contradiction.insightIds[1]) ?? []), contradiction.insightIds[0]]);
  }

  return {
    insights: nextInsights.map((insight) => ({
      ...insight,
      duplicateOf: duplicateLookup.get(insight.id) ?? null,
      overlapWith: unique(overlapLookup.get(insight.id) ?? []),
      contradictionWith: unique(contradictionLookup.get(insight.id) ?? []),
    })),
    duplicates,
    overlaps,
    contradictions,
  };
}

function buildEvidence(
  rule: InsightRuleDefinition,
  kpi: DetectedKPI,
  input: InsightGenerationInput,
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): InsightEvidence[] {
  const requiredFields = rule.requiredSemanticCategories.length > 0 ? rule.requiredSemanticCategories : kpi.requiredFields;
  const missingRequired = requiredFields.filter((category) => !semanticCategories.has(category));
  const relationshipConfidence = input.relationshipProfile?.confidence ?? input.relationshipProfile?.statistics.averageConfidence ?? 0.4;
  const entityCoverage = (input.entityProfile?.coveragePercent ?? 40) / 100;
  const maturityScore = (input.businessMaturityProfile?.statistics.businessHealthScore ?? 50) / 100;

  return [
    evidenceItem("kpi", kpi.confidence, 0.24, `${kpi.name} is detected as ${kpi.calculationAvailability}.`, kpi.id),
    evidenceItem("insight-rule", rule.priority / 110, 0.14, `${rule.id} supports ${rule.category}.`, rule.id),
    evidenceItem("dataset-quality", input.kpiProfile.qualityScore / 100, 0.14, `KPI profile quality is ${input.kpiProfile.qualityScore}.`, "KPI profile"),
    evidenceItem("semantic-coverage", (input.semanticProfile?.coveragePercent ?? input.kpiProfile.coveragePercent) / 100, 0.12, "Semantic metadata supports this insight.", "semantic profile"),
    evidenceItem("entity-statistics", entityCoverage, 0.1, "Entity coverage supports affected business object detection.", "entity profile"),
    evidenceItem("relationship-graph", relationshipConfidence, 0.1, "Relationship graph supports dependency context.", "relationship profile"),
    evidenceItem("business-maturity", maturityScore, 0.09, "Business maturity profile supports priority scoring.", "business maturity profile"),
    evidenceItem("business-model", businessModel ? 0.72 : 0.42, 0.07, businessModel ? `Business model signal is ${businessModel}.` : "No business model signal is available.", businessModel ?? "unknown"),
    ...(missingRequired.length > 0
      ? [evidenceItem("kpi-missing-field", 0.35, 0.12, `Missing semantic fields: ${missingRequired.join(", ")}.`, kpi.id)]
      : []),
    ...kpi.warnings.slice(0, 2).map((warning) => evidenceItem("kpi-warning", 0.42, 0.06, warning, kpi.id)),
  ];
}

function classifyPriority(
  businessImpact: number,
  confidence: number,
  severity: InsightSeverity,
  input: InsightGenerationInput,
): InsightPriority {
  const dataQualityRisk = Math.max(0, 100 - input.kpiProfile.qualityScore);
  const healthRisk = Math.max(0, 100 - (input.businessMaturityProfile?.statistics.businessHealthScore ?? 60));
  const severityBonus = severity === "critical" ? 22 : severity === "warning" ? 14 : severity === "notice" ? 6 : 0;
  const score = businessImpact * 0.42 + confidence * 100 * 0.3 + dataQualityRisk * 0.12 + healthRisk * 0.1 + severityBonus;

  if (score >= 88 || severity === "critical") {
    return "Critical";
  }

  if (score >= 74) {
    return "High";
  }

  if (score >= 58) {
    return "Medium";
  }

  if (score >= 42) {
    return "Low";
  }

  return "Informational";
}

function buildStatistics(
  insights: BusinessInsight[],
  duplicates: DuplicateInsightRecord[],
  overlaps: OverlappingInsightRecord[],
  contradictions: ContradictingInsightRecord[],
  input: InsightGenerationInput,
): InsightStatistics {
  const totalSupportedKpis = input.kpiProfile.detectedKPIs.filter((kpi) => kpi.calculationAvailability !== "Unavailable").length;
  const coveredKpis = new Set(insights.flatMap((insight) => insight.supportingKPIs)).size;
  const coveragePercent = totalSupportedKpis === 0 ? 0 : roundScore((coveredKpis / totalSupportedKpis) * 100);
  const averageConfidence = roundConfidence(average(insights.map((insight) => insight.confidence)));
  const businessHealthImpact = roundScore(average(insights.map((insight) => insight.businessImpact)));
  const qualityScore = roundScore(
    averageConfidence * 100 * 0.28 +
      coveragePercent * 0.24 +
      input.kpiProfile.qualityScore * 0.22 +
      (input.businessMaturityProfile?.statistics.businessHealthScore ?? 50) * 0.16 +
      Math.max(0, 100 - duplicates.length * 5 - contradictions.length * 8) * 0.1,
  );

  return {
    insightCount: insights.length,
    criticalInsights: insights.filter((insight) => insight.priority === "Critical").length,
    positiveInsights: insights.filter((insight) => isPositive(insight.type)).length,
    negativeInsights: insights.filter((insight) => isNegative(insight.type)).length,
    opportunities: insights.filter((insight) => insight.type === "Business Opportunity" || insight.type === "Performance Improvement").length,
    risks: insights.filter((insight) => insight.type === "Potential Risk" || insight.type === "Data Quality Warning").length,
    averageConfidence,
    coveragePercent,
    businessHealthImpact,
    priorityDistribution: countByPriority(insights),
    groupDistribution: countByGroup(insights),
    duplicateInsights: duplicates.length,
    overlappingInsights: overlaps.length,
    contradictingInsights: contradictions.length,
    qualityScore,
  };
}

function resolveProfiles(context: PipelineContext): ResolvedInsightProfiles {
  const structureProfile = buildDatasetStructureProfile(context);
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
  const kpiProfile = isKpiProfile(context.semanticMap.kpiProfile)
    ? context.semanticMap.kpiProfile
    : buildKPIDatasetProfile({
        structureProfile,
        semanticProfile,
        entityProfile,
        relationshipProfile,
        businessMaturityProfile,
        businessModel: context.businessModel,
        industry: context.industry,
      });

  return {
    kpiProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
  };
}

function buildGroups(insights: BusinessInsight[]): InsightProfile["groups"] {
  return allInsightGroups
    .map((group) => {
      const groupInsights = insights.filter((insight) => insight.group === group);

      return {
        group,
        insightIds: groupInsights.map((insight) => insight.id),
        confidence: roundConfidence(average(groupInsights.map((insight) => insight.confidence))),
        reason: `${group} insights share business purpose and evidence scope.`,
      };
    })
    .filter((group) => group.insightIds.length > 0);
}

function buildWarnings(
  input: InsightGenerationInput,
  insights: BusinessInsight[],
  duplicates: DuplicateInsightRecord[],
): string[] {
  const warnings: string[] = [];

  if (insights.length === 0) {
    warnings.push("Insight generation found no evidence-backed insights.");
  }

  if (input.kpiProfile.coveragePercent < 40) {
    warnings.push("KPI coverage limits insight completeness.");
  }

  if ((input.semanticProfile?.unknownFields.length ?? 0) > 0) {
    warnings.push("Unknown semantic fields limit insight certainty.");
  }

  if (duplicates.length > 0) {
    warnings.push("Duplicate insight candidates were merged.");
  }

  return warnings;
}

function buildLogs(
  insights: BusinessInsight[],
  duplicates: DuplicateInsightRecord[],
  executionTime: string,
  durationMs: number,
): InsightGenerationLog[] {
  return [
    ...insights.map((insight) => ({
      generatedInsight: insight.title,
      ruleId: insight.ruleId,
      priority: insight.priority,
      confidence: insight.confidence,
      evidence: insight.evidence,
      executionTime,
      durationMs,
      warnings: insight.warnings,
      errors: [],
    })),
    ...duplicates.map((duplicate) => ({
      generatedInsight: duplicate.insightId,
      ruleId: null,
      priority: null,
      confidence: duplicate.confidence,
      evidence: [evidenceItem("duplicate-detection", duplicate.confidence, 1, duplicate.reason, duplicate.duplicateOf)],
      executionTime,
      durationMs,
      warnings: [duplicate.reason],
      errors: [],
    })),
  ];
}

function buildBusinessImpact(
  rule: InsightRuleDefinition,
  kpi: DetectedKPI,
  input: InsightGenerationInput,
): number {
  const availabilityImpact =
    kpi.calculationAvailability === "Available"
      ? 10
      : kpi.calculationAvailability === "Partially Available"
        ? 2
        : kpi.calculationAvailability === "Needs User Input"
          ? -4
          : -12;
  const qualityImpact = (input.kpiProfile.qualityScore - 50) * 0.12;
  const maturityImpact = ((input.businessMaturityProfile?.statistics.businessHealthScore ?? 50) - 50) * 0.1;

  return roundScore(Math.max(5, Math.min(100, rule.baseImpact * 0.55 + kpi.businessRelevance * 0.35 + availabilityImpact + qualityImpact + maturityImpact)));
}

function severityFor(rule: InsightRuleDefinition, kpi: DetectedKPI): InsightSeverity {
  if (kpi.calculationAvailability === "Unavailable" && rule.insightType === "Missing Information") {
    return "warning";
  }

  if (kpi.warnings.length > 2 && ["Potential Risk", "Data Quality Warning", "Missing Information"].includes(rule.insightType)) {
    return "warning";
  }

  return rule.baseSeverity;
}

function buildCandidateWarnings(
  rule: InsightRuleDefinition,
  kpi: DetectedKPI,
  semanticCategories: Set<SemanticCategory>,
): string[] {
  return [
    ...rule.requiredSemanticCategories
      .filter((category) => !semanticCategories.has(category))
      .map((category) => `${rule.id} has no detected ${category} semantic field.`),
    ...kpi.missingFields.map((field) => `${kpi.name} is missing ${field}.`),
  ];
}

function buildRecommendedInvestigation(rule: InsightRuleDefinition, kpi: DetectedKPI | null): string {
  if (!kpi) {
    return `Review the ${rule.group.toLowerCase()} evidence and confirm missing dataset fields before acting.`;
  }

  if (rule.insightType === "Missing Information") {
    return `Confirm the source columns required for ${kpi.name}: ${kpi.requiredFields.join(", ")}.`;
  }

  if (rule.insightType === "Potential Risk") {
    return `Inspect rows, segments, and relationships behind ${kpi.name} before making an operational decision.`;
  }

  return `Review ${kpi.name} by period and key segment to validate the business signal.`;
}

function entityIdsFor(rule: InsightRuleDefinition, entityProfile: EntityDatasetProfile | null | undefined): string[] {
  if (!entityProfile) {
    return [];
  }

  const targetCategories = new Set(rule.requiredSemanticCategories);

  return entityProfile.entities
    .filter((entity) => entity.columns.some((column) => targetCategories.has(column.semanticCategory)))
    .map((entity) => entity.entityId)
    .slice(0, 6);
}

function relationshipIdsFor(
  rule: InsightRuleDefinition,
  relationshipProfile: RelationshipDatasetProfile | null | undefined,
): string[] {
  if (!relationshipProfile) {
    return [];
  }

  const vocabulary = new Set(rule.requiredSemanticCategories.map(String));

  return relationshipProfile.relationshipProfiles
    .filter((relationship) =>
      relationship.relatedColumns.some((column) => vocabulary.has(String(column.semanticCategory))),
    )
    .map((relationship) => relationship.relationshipId)
    .slice(0, 6);
}

function departmentNamesFor(
  entityProfile: EntityDatasetProfile | null | undefined,
  semanticCategories: Set<SemanticCategory>,
): string[] {
  if (!entityProfile || !semanticCategories.has("Department")) {
    return [];
  }

  return entityProfile.entities
    .filter((entity) => entity.entityType === "Department")
    .flatMap((entity) => entity.sampleValues.map(String))
    .filter(Boolean)
    .slice(0, 5);
}

function topKpisForRule(rule: InsightRuleDefinition, kpis: DetectedKPI[]): DetectedKPI[] {
  const fallbackRuleId = categoryFallbackRules[rule.supportedKpiCategories[0]];

  return kpis
    .filter((kpi) => rule.supportedKpiIds.includes(kpi.id) || rule.supportedKpiCategories.includes(kpi.category) || rule.id === fallbackRuleId)
    .sort((first, second) => second.businessRelevance - first.businessRelevance)
    .slice(0, 4);
}

function countByPriority(insights: BusinessInsight[]): Record<InsightPriority, number> {
  return {
    Critical: insights.filter((insight) => insight.priority === "Critical").length,
    High: insights.filter((insight) => insight.priority === "High").length,
    Medium: insights.filter((insight) => insight.priority === "Medium").length,
    Low: insights.filter((insight) => insight.priority === "Low").length,
    Informational: insights.filter((insight) => insight.priority === "Informational").length,
  };
}

function countByGroup(insights: BusinessInsight[]): Record<InsightGroup, number> {
  return Object.fromEntries(
    allInsightGroups.map((group) => [group, insights.filter((insight) => insight.group === group).length]),
  ) as Record<InsightGroup, number>;
}

function normalizeLibrary(library: InsightGenerationInput["library"]): InsightLibrary {
  if (!library) {
    return new DefaultInsightLibraryRegistry().toLibrary();
  }

  if ("toLibrary" in library) {
    return library.toLibrary();
  }

  return library;
}

function extractBusinessModel(model: Readonly<Record<string, unknown>> | null | undefined): string | null {
  if (!model) {
    return null;
  }

  const value = model.primaryModel ?? model.businessModel ?? model.model ?? model.type;

  if (typeof value === "string") {
    return value.toLowerCase();
  }

  if (Array.isArray(model.detectedModels) && typeof model.detectedModels[0] === "string") {
    return model.detectedModels[0].toLowerCase();
  }

  return null;
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

function renderTemplate(template: string, kpi: DetectedKPI | null): string {
  return template.replaceAll("{{kpiName}}", kpi?.name ?? "Dataset evidence");
}

function stableInsightId(ruleId: string, kpiId: string, order: number): string {
  return `insight-${slug(ruleId)}-${slug(kpiId)}-${order}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function isPositive(type: InsightType): boolean {
  return ["Positive Finding", "Business Opportunity", "Performance Improvement", "Emerging Trend"].includes(type);
}

function isNegative(type: InsightType): boolean {
  return ["Negative Finding", "Anomaly", "Outlier", "Operational Bottleneck", "Potential Risk", "Missing Information", "Data Quality Warning"].includes(type);
}

function evidenceItem(
  type: InsightEvidence["type"],
  score: number,
  weight: number,
  reason: string,
  source: string,
): InsightEvidence {
  return {
    type,
    score: roundConfidence(score),
    weight,
    reason,
    source,
  };
}

function weightedAverage(evidence: InsightEvidence[]): number {
  const totalWeight = evidence.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return evidence.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function isKpiProfile(value: unknown): value is KPIDatasetProfile {
  return Boolean(value && typeof value === "object" && (value as KPIDatasetProfile).version === "bie.kpi-profile.v1");
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
