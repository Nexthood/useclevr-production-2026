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
import { buildInsightProfile } from "./insight-generation-engine";
import { buildKPIDatasetProfile } from "./kpi-discovery-engine";
import { DefaultRecommendationLibraryRegistry } from "./recommendation-library";
import type { BusinessInsight, InsightProfile } from "./insight-types";
import type { DetectedKPI, KPIDatasetProfile } from "./kpi-types";
import type {
  BusinessRecommendation,
  ConflictingRecommendationRecord,
  DuplicateRecommendationRecord,
  OverlappingRecommendationRecord,
  RecommendationCandidate,
  RecommendationCategory,
  RecommendationConfidenceSummary,
  RecommendationDependency,
  RecommendationDifficulty,
  RecommendationEvidence,
  RecommendationGenerationInput,
  RecommendationGenerationLog,
  RecommendationLibrary,
  RecommendationLibraryRegistry,
  RecommendationPriority,
  RecommendationProfile,
  RecommendationRuleDefinition,
  RecommendationStatistics,
  RecommendationSummary,
} from "./recommendation-types";

const DEFAULT_MINIMUM_CONFIDENCE = 0.5;

const allPriorities: RecommendationPriority[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
];

const allCategories: RecommendationCategory[] = [
  "Revenue Growth",
  "Profit Optimization",
  "Cost Reduction",
  "Inventory Optimization",
  "Pricing Optimization",
  "Promotion Optimization",
  "Customer Retention",
  "Customer Acquisition",
  "Marketing Optimization",
  "Sales Optimization",
  "Cash Flow Improvement",
  "Accounting Improvements",
  "Tax Preparation",
  "Supplier Optimization",
  "Procurement Optimization",
  "Employee Productivity",
  "Warehouse Optimization",
  "Store Optimization",
  "Forecast Improvement",
  "Business Health",
  "AI Readiness",
  "Automation Opportunities",
  "Data Quality Improvements",
  "Risk Reduction",
  "Compliance Improvements",
];

interface ResolvedRecommendationProfiles {
  kpiProfile: KPIDatasetProfile;
  insightProfile: InsightProfile;
  semanticProfile: SemanticDatasetProfile;
  entityProfile: EntityDatasetProfile;
  relationshipProfile: RelationshipDatasetProfile;
  businessMaturityProfile: BusinessMaturityProfile;
}

export class UniversalBusinessRecommendationEngine implements Scanner {
  constructor(
    private readonly library: RecommendationLibraryRegistry | RecommendationLibrary =
      new DefaultRecommendationLibraryRegistry(),
  ) {}

  id(): string {
    return "bie.business-recommendation-engine.v1";
  }

  name(): string {
    return "Universal Business Recommendation Engine";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 90;
  }

  supports(context: PipelineContext): boolean {
    return Boolean(
      context.semanticMap.insightProfile ||
        context.semanticMap.kpiProfile ||
        context.kpis.length ||
        context.dataset.rawText ||
        context.dataset.rawBuffer ||
        context.dataset.rows?.length,
    );
  }

  validate(context: PipelineContext) {
    const valid = this.supports(context);
    const warnings: string[] = [];

    if (!context.semanticMap.insightProfile) {
      warnings.push("Recommendation generation will build insight output before recommending actions.");
    }

    if (!context.semanticMap.kpiProfile) {
      warnings.push("Recommendation generation will build KPI output before evidence scoring.");
    }

    return {
      valid,
      warnings,
      errors: valid ? [] : ["Recommendation generation requires BIE/EDIE profiles or dataset source content."],
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
        errors: ["Scanner execution was cancelled before recommendation generation."],
        metadata: {},
        executionTime: new Date().toISOString(),
        scannerVersion: this.version(),
      };
    }

    const profiles = resolveProfiles(context);
    const recommendationProfile = buildRecommendationProfile({
      context,
      ...profiles,
      businessModel: context.businessModel,
      library: this.library,
    });

    return {
      scannerId: this.id(),
      status: "completed",
      confidence: recommendationProfile.confidence,
      duration: Date.now() - startedAtMs,
      warnings: recommendationProfile.warnings,
      errors: recommendationProfile.errors,
      metadata: {
        recommendationProfile,
        recommendationCount: recommendationProfile.statistics.recommendationCount,
        criticalRecommendations: recommendationProfile.statistics.criticalRecommendations,
        quickWins: recommendationProfile.statistics.quickWins,
        estimatedBusinessValue: recommendationProfile.statistics.estimatedBusinessValue,
        coveragePercent: recommendationProfile.coveragePercent,
        qualityScore: recommendationProfile.qualityScore,
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
          insightProfile: profiles.insightProfile,
          recommendationProfile,
        },
        entities: profiles.entityProfile.entities,
        relationships: profiles.relationshipProfile.relationshipGraph.edges,
        kpis: profiles.kpiProfile.detectedKPIs,
        confidence: { [this.id()]: recommendationProfile.confidence },
        warnings: recommendationProfile.warnings,
      },
    };
  }
}

export function buildRecommendationProfile(input: RecommendationGenerationInput): RecommendationProfile {
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
  const rawRecommendations = candidates.map((candidate, index) =>
    buildRecommendation(candidate, input, semanticCategories, executionTime, index),
  );
  const { recommendations, duplicates, overlaps, conflicts } =
    analyzeRecommendationRelationships(rawRecommendations);
  const dependencies = buildDependencies(recommendations, library);
  const statistics = buildStatistics(recommendations, duplicates, overlaps, conflicts, input);
  const prioritySummary = buildPrioritySummary(recommendations);
  const confidenceSummary = buildConfidenceSummary(recommendations);
  const confidence = roundConfidence(average(recommendations.map((recommendation) => recommendation.confidence)));
  const qualityScore = roundScore(
    statistics.qualityScore * 0.45 +
      statistics.coveragePercent * 0.25 +
      confidence * 100 * 0.3,
  );
  const warnings = buildWarnings(input, recommendations, duplicates, conflicts);
  const logs = buildLogs(recommendations, duplicates, executionTime, Date.now() - startedAt);

  return {
    version: "bie.recommendation-profile.v1",
    generatedAt: new Date().toISOString(),
    kpiProfileVersion: input.kpiProfile.version,
    insightProfileVersion: input.insightProfile.version,
    semanticProfileVersion: input.semanticProfile?.version ?? null,
    entityProfileVersion: input.entityProfile?.version ?? null,
    relationshipProfileVersion: input.relationshipProfile?.version ?? null,
    businessMaturityProfileVersion: input.businessMaturityProfile?.version ?? null,
    recommendations,
    dependencies,
    duplicates,
    overlaps,
    conflicts,
    statistics,
    prioritySummary,
    confidenceSummary,
    confidence,
    coveragePercent: statistics.coveragePercent,
    qualityScore,
    warnings,
    errors: [],
    logs,
    extensionPoints: {
      aiDecisionEngine: true,
      automatedBusinessAdvisor: true,
      workflowAutomation: true,
      erpIntegration: true,
      crmIntegration: true,
      posIntegration: true,
      emailRecommendations: true,
      slackTeamsNotifications: true,
      scheduledRecommendations: true,
      recommendationLearning: true,
      userFeedbackLearning: true,
      roiTracking: true,
      recommendationSuccessTracking: true,
      actionConfirmation: true,
      continuousOptimization: true,
      benchmarkComparison: true,
      industryBenchmarkEngine: true,
    },
  };
}

function buildCandidates(
  input: RecommendationGenerationInput,
  library: RecommendationLibrary,
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];

  for (const rule of library.definitions) {
    const matchedInsights = input.insightProfile.insights
      .filter((insight) => supportsInsight(rule, insight, input.kpiProfile.detectedKPIs, semanticCategories, businessModel))
      .sort((first, second) => second.businessImpact - first.businessImpact || second.confidence - first.confidence)
      .slice(0, rule.maxPerRule);

    for (const insight of matchedInsights) {
      const kpis = input.kpiProfile.detectedKPIs.filter((kpi) => insight.supportingKPIs.includes(kpi.id));
      const missingData = rule.requiredSemanticCategories.filter((category) => !semanticCategories.has(category));
      const evidence = buildEvidence(rule, insight, kpis, input, businessModel, missingData);
      const confidence = roundConfidence(weightedAverage(evidence));

      candidates.push({
        rule,
        insight,
        kpis,
        confidence,
        businessImpact: buildBusinessImpact(rule, insight, kpis, input),
        evidence,
        missingData,
        warnings: buildCandidateWarnings(rule, insight, missingData),
      });
    }
  }

  candidates.push(...buildProfileLevelCandidates(input, library, semanticCategories, businessModel));

  return candidates;
}

function supportsInsight(
  rule: RecommendationRuleDefinition,
  insight: BusinessInsight,
  kpis: DetectedKPI[],
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): boolean {
  const modelFit = rule.businessModels.includes("generic") || (businessModel ? rule.businessModels.includes(businessModel) : false);
  const insightTypeFit = rule.supportedInsightTypes.includes(insight.type);
  const insightCategoryFit =
    rule.supportedInsightCategories.length === 0 ||
    rule.supportedInsightCategories.includes(insight.category);
  const supportingKpis = kpis.filter((kpi) => insight.supportingKPIs.includes(kpi.id));
  const kpiFit =
    supportingKpis.length === 0
      ? rule.supportedKpiIds.length === 0
      : supportingKpis.some(
          (kpi) => rule.supportedKpiIds.includes(kpi.id) || rule.supportedKpiCategories.includes(kpi.category),
        );
  const requiredFit =
    rule.requiredSemanticCategories.length === 0 ||
    rule.requiredSemanticCategories.some((category) => semanticCategories.has(category)) ||
    rule.type === "Missing Data Suggestion" ||
    rule.category === "Data Quality Improvements";

  return modelFit && insightTypeFit && insightCategoryFit && kpiFit && requiredFit;
}

function buildProfileLevelCandidates(
  input: RecommendationGenerationInput,
  library: RecommendationLibrary,
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];
  const dataQualityRule = library.definitions.find((definition) => definition.id === "data-quality-action");
  const aiRule = library.definitions.find((definition) => definition.id === "ai-readiness-action");
  const businessHealthRule = library.definitions.find((definition) => definition.id === "business-health-action");

  if (dataQualityRule && ((input.semanticProfile?.unknownFields.length ?? 0) > 0 || input.kpiProfile.qualityScore < 70)) {
    candidates.push(profileCandidate(dataQualityRule, "Dataset quality limits recommendation confidence.", input, semanticCategories, businessModel));
  }

  if (aiRule && (input.businessMaturityProfile?.statistics.aiReadiness ?? 0) < 70) {
    candidates.push(profileCandidate(aiRule, "AI readiness is below the preferred threshold.", input, semanticCategories, businessModel));
  }

  if (businessHealthRule && input.insightProfile.statistics.businessHealthImpact >= 55) {
    candidates.push(profileCandidate(businessHealthRule, "Insight profile contains business-health evidence.", input, semanticCategories, businessModel));
  }

  return candidates;
}

function profileCandidate(
  rule: RecommendationRuleDefinition,
  reason: string,
  input: RecommendationGenerationInput,
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): RecommendationCandidate {
  const missingData = rule.requiredSemanticCategories.filter((category) => !semanticCategories.has(category));
  const evidence = [
    evidenceItem("recommendation-rule", rule.priority / 115, 0.18, `${rule.id} selected a profile-level recommendation.`, rule.id),
    evidenceItem("dataset-quality", input.kpiProfile.qualityScore / 100, 0.2, `KPI profile quality is ${input.kpiProfile.qualityScore}.`, "KPI profile"),
    evidenceItem("supporting-insight", input.insightProfile.confidence, 0.22, reason, "insight profile"),
    evidenceItem("business-maturity", (input.businessMaturityProfile?.confidence ?? 0.5), 0.16, "Business maturity supports recommendation scoring.", "business maturity profile"),
    evidenceItem("semantic-coverage", (input.semanticProfile?.coveragePercent ?? input.kpiProfile.coveragePercent) / 100, 0.12, "Semantic coverage supports required data evaluation.", "semantic profile"),
    evidenceItem("business-impact", input.insightProfile.statistics.businessHealthImpact / 100, 0.12, "Insight profile business impact supports action generation.", "insight profile"),
    evidenceItem("missing-data", missingData.length === 0 ? 0.7 : 0.45, 0.1, missingData.length === 0 ? "Required data is present." : `Missing data: ${missingData.join(", ")}.`, rule.id),
    evidenceItem("risk-indicator", input.insightProfile.statistics.risks > 0 ? 0.72 : 0.42, 0.08, "Risk evidence contributes to recommendation priority.", "insight profile"),
    evidenceItem("relationship-graph", input.relationshipProfile?.confidence ?? 0.45, 0.08, "Relationship evidence supports action scope.", "relationship profile"),
    evidenceItem("entity-statistics", (input.entityProfile?.coveragePercent ?? 40) / 100, 0.08, "Entity coverage supports affected business objects.", "entity profile"),
    evidenceItem("recommendation-rule", businessModel ? 0.72 : 0.42, 0.06, businessModel ? `Business model signal is ${businessModel}.` : "No business model signal is available.", businessModel ?? "unknown"),
  ];

  return {
    rule,
    insight: null,
    kpis: [],
    confidence: roundConfidence(weightedAverage(evidence)),
    businessImpact: roundScore(rule.baseImpact * 0.65 + input.insightProfile.statistics.businessHealthImpact * 0.35),
    evidence,
    missingData,
    warnings: missingData.map((category) => `${rule.id} has no detected ${category} semantic field.`),
  };
}

function buildRecommendation(
  candidate: RecommendationCandidate,
  input: RecommendationGenerationInput,
  semanticCategories: Set<SemanticCategory>,
  executionTime: string,
  order: number,
): BusinessRecommendation {
  const title = renderTemplate(candidate.rule.titleTemplate, candidate.insight);
  const description = renderTemplate(candidate.rule.descriptionTemplate, candidate.insight);
  const supportingInsights = candidate.insight ? [candidate.insight.id] : topInsightsForRule(candidate.rule, input.insightProfile).map((insight) => insight.id);
  const supportingKPIs = unique([
    ...candidate.kpis.map((kpi) => kpi.id),
    ...(candidate.insight?.supportingKPIs ?? []),
  ]);
  const supportingEntities = unique(candidate.insight?.supportingEntities ?? []);
  const supportingRelationships = unique(candidate.insight?.supportingRelationships ?? []);
  const priority = classifyPriority(candidate.businessImpact, candidate.confidence, candidate.rule.baseDifficulty, candidate, input);

  return {
    id: stableRecommendationId(candidate.rule.id, candidate.insight?.id ?? "profile", order),
    title,
    description,
    category: candidate.rule.category,
    type: candidate.rule.type,
    priority,
    confidence: candidate.confidence,
    businessImpact: candidate.businessImpact,
    estimatedDifficulty: candidate.rule.baseDifficulty,
    estimatedBenefit: candidate.rule.baseBenefit,
    requiredData: candidate.rule.requiredSemanticCategories,
    missingData: candidate.missingData,
    supportingKPIs,
    supportingInsights,
    supportingEntities,
    supportingRelationships,
    estimatedTimeToImplement: candidate.rule.estimatedTimeToImplement,
    affectedDepartments: unique([
      ...(candidate.insight?.affectedDepartments ?? []),
      ...departmentNamesFor(input.entityProfile, semanticCategories),
    ]),
    warnings: unique(candidate.warnings),
    evidence: candidate.evidence,
    executionTime,
    ruleId: candidate.rule.id,
    duplicateOf: null,
    overlapWith: [],
    conflictWith: [],
  };
}

function buildEvidence(
  rule: RecommendationRuleDefinition,
  insight: BusinessInsight,
  kpis: DetectedKPI[],
  input: RecommendationGenerationInput,
  businessModel: string | null,
  missingData: SemanticCategory[],
): RecommendationEvidence[] {
  return [
    evidenceItem("recommendation-rule", rule.priority / 115, 0.16, `${rule.id} supports ${rule.category}.`, rule.id),
    evidenceItem("supporting-insight", insight.confidence, 0.22, `${insight.title} supports this recommendation.`, insight.id),
    evidenceItem("supporting-kpi", average(kpis.map((kpi) => kpi.confidence)), 0.16, supportingKpiReason(kpis), kpis.map((kpi) => kpi.id).join(", ") || "none"),
    evidenceItem("business-impact", insight.businessImpact / 100, 0.14, `Supporting insight business impact is ${insight.businessImpact}.`, insight.id),
    evidenceItem("dataset-quality", input.kpiProfile.qualityScore / 100, 0.1, `KPI profile quality is ${input.kpiProfile.qualityScore}.`, "KPI profile"),
    evidenceItem("business-maturity", (input.businessMaturityProfile?.confidence ?? 0.5), 0.08, "Business maturity supports implementation readiness.", "business maturity profile"),
    evidenceItem("relationship-graph", input.relationshipProfile?.confidence ?? 0.45, 0.06, "Relationship graph supports action dependencies.", "relationship profile"),
    evidenceItem("entity-statistics", (input.entityProfile?.coveragePercent ?? 40) / 100, 0.06, "Entity coverage supports affected business objects.", "entity profile"),
    evidenceItem("semantic-coverage", (input.semanticProfile?.coveragePercent ?? input.kpiProfile.coveragePercent) / 100, 0.06, "Semantic coverage supports required data matching.", "semantic profile"),
    evidenceItem("risk-indicator", input.insightProfile.statistics.risks > 0 ? 0.72 : 0.42, 0.04, "Risk indicators influence recommendation priority.", "insight profile"),
    evidenceItem("missing-data", missingData.length === 0 ? 0.7 : 0.38, 0.08, missingData.length === 0 ? "Required data is present." : `Missing data: ${missingData.join(", ")}.`, rule.id),
    evidenceItem("recommendation-rule", businessModel ? 0.72 : 0.42, 0.04, businessModel ? `Business model signal is ${businessModel}.` : "No business model signal is available.", businessModel ?? "unknown"),
  ];
}

function classifyPriority(
  businessImpact: number,
  confidence: number,
  difficulty: RecommendationDifficulty,
  candidate: RecommendationCandidate,
  input: RecommendationGenerationInput,
): RecommendationPriority {
  const revenueImpact = candidate.kpis.some((kpi) => kpi.requiredFields.includes("Revenue")) ? 14 : 0;
  const profitImpact = candidate.kpis.some((kpi) => kpi.requiredFields.includes("Profit") || kpi.requiredFields.includes("Cost")) ? 12 : 0;
  const riskLevel = candidate.rule.type === "Risk Mitigation" || candidate.rule.category === "Risk Reduction" ? 16 : 0;
  const complexityPenalty = difficulty === "High" ? 12 : difficulty === "Medium" ? 6 : 0;
  const score =
    businessImpact * 0.36 +
    confidence * 100 * 0.28 +
    revenueImpact +
    profitImpact +
    riskLevel -
    complexityPenalty +
    (input.businessMaturityProfile?.statistics.businessHealthScore ?? 50) * 0.08;

  if (score >= 88) {
    return "Critical";
  }

  if (score >= 72) {
    return "High";
  }

  if (score >= 56) {
    return "Medium";
  }

  if (score >= 40) {
    return "Low";
  }

  return "Informational";
}

function analyzeRecommendationRelationships(recommendations: BusinessRecommendation[]): {
  recommendations: BusinessRecommendation[];
  duplicates: DuplicateRecommendationRecord[];
  overlaps: OverlappingRecommendationRecord[];
  conflicts: ConflictingRecommendationRecord[];
} {
  const duplicates: DuplicateRecommendationRecord[] = [];
  const overlaps: OverlappingRecommendationRecord[] = [];
  const conflicts: ConflictingRecommendationRecord[] = [];
  const canonicalByKey = new Map<string, BusinessRecommendation>();
  const canonical: BusinessRecommendation[] = [];

  for (const recommendation of recommendations) {
    const key = `${slug(recommendation.title)}:${recommendation.category}:${recommendation.supportingInsights.join("|") || "profile"}`;
    const existing = canonicalByKey.get(key);

    if (existing) {
      duplicates.push({
        recommendationId: recommendation.id,
        duplicateOf: existing.id,
        confidence: roundConfidence(Math.min(existing.confidence, recommendation.confidence)),
        reason: "Recommendations share the same title, category, and supporting insight evidence.",
      });
      continue;
    }

    canonicalByKey.set(key, recommendation);
    canonical.push(recommendation);
  }

  for (let index = 0; index < canonical.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < canonical.length; otherIndex += 1) {
      const first = canonical[index];
      const second = canonical[otherIndex];
      const sharedInsights = first.supportingInsights.filter((insight) => second.supportingInsights.includes(insight));
      const sharedKpis = first.supportingKPIs.filter((kpi) => second.supportingKPIs.includes(kpi));

      if (sharedInsights.length > 0 || sharedKpis.length > 0 || first.category === second.category) {
        overlaps.push({
          recommendationIds: [first.id, second.id],
          confidence: roundConfidence(sharedInsights.length > 0 ? 0.8 : sharedKpis.length > 0 ? 0.68 : 0.52),
          sharedEvidence: unique([...sharedInsights, ...sharedKpis]),
          reason: "Recommendations share supporting business evidence.",
        });
      }

      if (recommendationsConflict(first, second)) {
        conflicts.push({
          recommendationIds: [first.id, second.id],
          confidence: 0.62,
          reason: "Recommendations require sequencing before simultaneous execution.",
        });
      }
    }
  }

  const overlapLookup = pairLookup(overlaps.map((overlap) => overlap.recommendationIds));
  const conflictLookup = pairLookup(conflicts.map((conflict) => conflict.recommendationIds));

  return {
    recommendations: canonical.map((recommendation) => ({
      ...recommendation,
      overlapWith: unique(overlapLookup.get(recommendation.id) ?? []),
      conflictWith: unique(conflictLookup.get(recommendation.id) ?? []),
    })),
    duplicates,
    overlaps,
    conflicts,
  };
}

function buildDependencies(
  recommendations: BusinessRecommendation[],
  library: RecommendationLibrary,
): RecommendationDependency[] {
  const byRule = new Map<string, BusinessRecommendation[]>();

  for (const recommendation of recommendations) {
    byRule.set(recommendation.ruleId, [...(byRule.get(recommendation.ruleId) ?? []), recommendation]);
  }

  return recommendations.flatMap((recommendation) => {
    const rule = library.definitions.find((definition) => definition.id === recommendation.ruleId);

    return (rule?.dependsOn ?? []).flatMap((dependencyRuleId) =>
      (byRule.get(dependencyRuleId) ?? []).map((dependency) => ({
        fromRecommendationId: dependency.id,
        toRecommendationId: recommendation.id,
        dependencyType: "sequence" as const,
        confidence: roundConfidence(Math.min(dependency.confidence, recommendation.confidence) * 0.9),
        reason: `${dependency.category} should inform ${recommendation.category}.`,
      })),
    );
  });
}

function buildStatistics(
  recommendations: BusinessRecommendation[],
  duplicates: DuplicateRecommendationRecord[],
  overlaps: OverlappingRecommendationRecord[],
  conflicts: ConflictingRecommendationRecord[],
  input: RecommendationGenerationInput,
): RecommendationStatistics {
  const availableInsights = input.insightProfile.insights.length;
  const coveredInsights = new Set(recommendations.flatMap((recommendation) => recommendation.supportingInsights)).size;
  const coveragePercent = availableInsights === 0 ? 0 : roundScore((coveredInsights / availableInsights) * 100);
  const averageConfidence = roundConfidence(average(recommendations.map((recommendation) => recommendation.confidence)));
  const estimatedBusinessValue = roundScore(average(recommendations.map((recommendation) => recommendation.businessImpact)));
  const qualityScore = roundScore(
    averageConfidence * 100 * 0.26 +
      coveragePercent * 0.22 +
      estimatedBusinessValue * 0.22 +
      input.insightProfile.qualityScore * 0.18 +
      Math.max(0, 100 - duplicates.length * 5 - conflicts.length * 8) * 0.12,
  );

  return {
    recommendationCount: recommendations.length,
    criticalRecommendations: recommendations.filter((recommendation) => recommendation.priority === "Critical").length,
    quickWins: recommendations.filter((recommendation) => recommendation.type === "Quick Win" || recommendation.estimatedDifficulty === "Low").length,
    strategicRecommendations: recommendations.filter((recommendation) => recommendation.type === "Strategic Improvement").length,
    financialRecommendations: recommendations.filter((recommendation) => ["Revenue Growth", "Profit Optimization", "Cost Reduction", "Cash Flow Improvement"].includes(recommendation.category)).length,
    operationalRecommendations: recommendations.filter((recommendation) => ["Inventory Optimization", "Warehouse Optimization", "Store Optimization", "Employee Productivity", "Supplier Optimization", "Procurement Optimization"].includes(recommendation.category)).length,
    growthRecommendations: recommendations.filter((recommendation) => ["Revenue Growth", "Customer Acquisition", "Sales Optimization", "Promotion Optimization"].includes(recommendation.category)).length,
    riskRecommendations: recommendations.filter((recommendation) => recommendation.category === "Risk Reduction" || recommendation.type === "Risk Mitigation").length,
    averageConfidence,
    estimatedBusinessValue,
    coveragePercent,
    qualityScore,
    priorityDistribution: countByPriority(recommendations),
    categoryDistribution: countByCategory(recommendations),
    duplicateRecommendations: duplicates.length,
    overlappingRecommendations: overlaps.length,
    conflictingRecommendations: conflicts.length,
  };
}

function resolveProfiles(context: PipelineContext): ResolvedRecommendationProfiles {
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
  const insightProfile = isInsightProfile(context.semanticMap.insightProfile)
    ? context.semanticMap.insightProfile
    : buildInsightProfile({
        context,
        kpiProfile,
        semanticProfile,
        entityProfile,
        relationshipProfile,
        businessMaturityProfile,
        businessModel: context.businessModel,
      });

  return {
    kpiProfile,
    insightProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
  };
}

function buildBusinessImpact(
  rule: RecommendationRuleDefinition,
  insight: BusinessInsight,
  kpis: DetectedKPI[],
  input: RecommendationGenerationInput,
): number {
  const kpiRelevance = average(kpis.map((kpi) => kpi.businessRelevance));
  const riskBoost = rule.type === "Risk Mitigation" || insight.type === "Potential Risk" ? 10 : 0;
  const readiness = (input.businessMaturityProfile?.statistics.businessHealthScore ?? 50) * 0.08;

  return roundScore(Math.min(100, rule.baseImpact * 0.45 + insight.businessImpact * 0.35 + kpiRelevance * 0.12 + readiness + riskBoost));
}

function buildCandidateWarnings(
  rule: RecommendationRuleDefinition,
  insight: BusinessInsight,
  missingData: SemanticCategory[],
): string[] {
  return unique([
    ...missingData.map((field) => `${rule.id} has no detected ${field} semantic field.`),
    ...insight.warnings,
  ]);
}

function buildPrioritySummary(recommendations: BusinessRecommendation[]): RecommendationSummary[] {
  return allPriorities
    .map((priority) => ({
      priority,
      count: recommendations.filter((recommendation) => recommendation.priority === priority).length,
      recommendationIds: recommendations
        .filter((recommendation) => recommendation.priority === priority)
        .map((recommendation) => recommendation.id),
    }))
    .filter((summary) => summary.count > 0);
}

function buildConfidenceSummary(recommendations: BusinessRecommendation[]): RecommendationConfidenceSummary {
  return {
    averageConfidence: roundConfidence(average(recommendations.map((recommendation) => recommendation.confidence))),
    high: recommendations.filter((recommendation) => recommendation.confidence >= 0.75).length,
    medium: recommendations.filter((recommendation) => recommendation.confidence >= 0.5 && recommendation.confidence < 0.75).length,
    low: recommendations.filter((recommendation) => recommendation.confidence < 0.5).length,
  };
}

function buildWarnings(
  input: RecommendationGenerationInput,
  recommendations: BusinessRecommendation[],
  duplicates: DuplicateRecommendationRecord[],
  conflicts: ConflictingRecommendationRecord[],
): string[] {
  const warnings: string[] = [];

  if (recommendations.length === 0) {
    warnings.push("Recommendation generation found no sufficiently supported actions.");
  }

  if (input.insightProfile.coveragePercent < 40) {
    warnings.push("Insight coverage limits recommendation completeness.");
  }

  if (duplicates.length > 0) {
    warnings.push("Duplicate recommendation candidates were merged.");
  }

  if (conflicts.length > 0) {
    warnings.push("Some recommendations require sequencing before execution.");
  }

  return warnings;
}

function buildLogs(
  recommendations: BusinessRecommendation[],
  duplicates: DuplicateRecommendationRecord[],
  executionTime: string,
  durationMs: number,
): RecommendationGenerationLog[] {
  return [
    ...recommendations.map((recommendation) => ({
      generatedRecommendation: recommendation.title,
      ruleId: recommendation.ruleId,
      priority: recommendation.priority,
      confidence: recommendation.confidence,
      businessImpact: recommendation.businessImpact,
      evidence: recommendation.evidence,
      executionTime,
      durationMs,
      warnings: recommendation.warnings,
      errors: [],
    })),
    ...duplicates.map((duplicate) => ({
      generatedRecommendation: duplicate.recommendationId,
      ruleId: null,
      priority: null,
      confidence: duplicate.confidence,
      businessImpact: 0,
      evidence: [evidenceItem("recommendation-rule", duplicate.confidence, 1, duplicate.reason, duplicate.duplicateOf)],
      executionTime,
      durationMs,
      warnings: [duplicate.reason],
      errors: [],
    })),
  ];
}

function topInsightsForRule(rule: RecommendationRuleDefinition, insightProfile: InsightProfile): BusinessInsight[] {
  return insightProfile.insights
    .filter((insight) => rule.supportedInsightTypes.includes(insight.type))
    .sort((first, second) => second.businessImpact - first.businessImpact)
    .slice(0, 4);
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

function recommendationsConflict(first: BusinessRecommendation, second: BusinessRecommendation): boolean {
  const sameEvidence = first.supportingInsights.some((insight) => second.supportingInsights.includes(insight));
  const operationalSequence =
    (first.category === "Inventory Optimization" && second.category === "Pricing Optimization") ||
    (first.category === "Pricing Optimization" && second.category === "Inventory Optimization") ||
    (first.category === "Supplier Optimization" && second.category === "Inventory Optimization") ||
    (first.category === "Inventory Optimization" && second.category === "Supplier Optimization");

  return sameEvidence && operationalSequence;
}

function pairLookup(pairs: Array<[string, string]>): Map<string, string[]> {
  const lookup = new Map<string, string[]>();

  for (const [first, second] of pairs) {
    lookup.set(first, [...(lookup.get(first) ?? []), second]);
    lookup.set(second, [...(lookup.get(second) ?? []), first]);
  }

  return lookup;
}

function countByPriority(recommendations: BusinessRecommendation[]): Record<RecommendationPriority, number> {
  return Object.fromEntries(
    allPriorities.map((priority) => [priority, recommendations.filter((recommendation) => recommendation.priority === priority).length]),
  ) as Record<RecommendationPriority, number>;
}

function countByCategory(recommendations: BusinessRecommendation[]): Record<RecommendationCategory, number> {
  return Object.fromEntries(
    allCategories.map((category) => [category, recommendations.filter((recommendation) => recommendation.category === category).length]),
  ) as Record<RecommendationCategory, number>;
}

function supportingKpiReason(kpis: DetectedKPI[]): string {
  if (kpis.length === 0) {
    return "No direct KPI is attached to this recommendation.";
  }

  return `Supporting KPIs: ${kpis.map((kpi) => kpi.name).join(", ")}.`;
}

function normalizeLibrary(library: RecommendationGenerationInput["library"]): RecommendationLibrary {
  if (!library) {
    return new DefaultRecommendationLibraryRegistry().toLibrary();
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

function renderTemplate(template: string, insight: BusinessInsight | null): string {
  return template.replaceAll("{{insightTitle}}", insight?.title ?? "dataset evidence");
}

function stableRecommendationId(ruleId: string, insightId: string, order: number): string {
  return `recommendation-${slug(ruleId)}-${slug(insightId)}-${order}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function evidenceItem(
  type: RecommendationEvidence["type"],
  score: number,
  weight: number,
  reason: string,
  source: string,
): RecommendationEvidence {
  return {
    type,
    score: roundConfidence(score),
    weight,
    reason,
    source,
  };
}

function weightedAverage(evidence: RecommendationEvidence[]): number {
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

function isInsightProfile(value: unknown): value is InsightProfile {
  return Boolean(value && typeof value === "object" && (value as InsightProfile).version === "bie.insight-profile.v1");
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
