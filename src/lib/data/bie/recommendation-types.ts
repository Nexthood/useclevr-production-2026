import type {
  BusinessMaturityProfile,
  EntityDatasetProfile,
  RelationshipDatasetProfile,
  SemanticCategory,
  SemanticDatasetProfile,
  PipelineContext,
} from "../edie";
import type { BusinessInsight, InsightProfile, InsightType } from "./insight-types";
import type { DetectedKPI, KPIDatasetProfile, KPICategory } from "./kpi-types";

export type RecommendationCategory =
  | "Revenue Growth"
  | "Profit Optimization"
  | "Cost Reduction"
  | "Inventory Optimization"
  | "Pricing Optimization"
  | "Promotion Optimization"
  | "Customer Retention"
  | "Customer Acquisition"
  | "Marketing Optimization"
  | "Sales Optimization"
  | "Cash Flow Improvement"
  | "Accounting Improvements"
  | "Tax Preparation"
  | "Supplier Optimization"
  | "Procurement Optimization"
  | "Employee Productivity"
  | "Warehouse Optimization"
  | "Store Optimization"
  | "Forecast Improvement"
  | "Business Health"
  | "AI Readiness"
  | "Automation Opportunities"
  | "Data Quality Improvements"
  | "Risk Reduction"
  | "Compliance Improvements";

export type RecommendationType =
  | "Immediate Action"
  | "Short-Term Improvement"
  | "Long-Term Improvement"
  | "Quick Win"
  | "Strategic Improvement"
  | "Operational Improvement"
  | "Financial Improvement"
  | "Growth Opportunity"
  | "Cost Saving Opportunity"
  | "Risk Mitigation"
  | "Compliance Improvement"
  | "Automation Suggestion"
  | "Missing Data Suggestion"
  | "Business Process Improvement";

export type RecommendationPriority = "Critical" | "High" | "Medium" | "Low" | "Informational";

export type RecommendationDifficulty = "Low" | "Medium" | "High";

export type RecommendationBenefit = "Low" | "Medium" | "High" | "Very High";

export type RecommendationEvidenceType =
  | "recommendation-rule"
  | "supporting-insight"
  | "supporting-kpi"
  | "business-impact"
  | "business-maturity"
  | "relationship-graph"
  | "entity-statistics"
  | "semantic-coverage"
  | "dataset-quality"
  | "risk-indicator"
  | "missing-data"
  | "dependency";

export interface RecommendationEvidence {
  type: RecommendationEvidenceType;
  score: number;
  weight: number;
  reason: string;
  source: string;
}

export interface RecommendationRuleDefinition {
  id: string;
  version: string;
  titleTemplate: string;
  descriptionTemplate: string;
  category: RecommendationCategory;
  type: RecommendationType;
  supportedInsightTypes: InsightType[];
  supportedInsightCategories: string[];
  supportedKpiCategories: KPICategory[];
  supportedKpiIds: string[];
  requiredSemanticCategories: SemanticCategory[];
  businessModels: string[];
  baseImpact: number;
  baseDifficulty: RecommendationDifficulty;
  baseBenefit: RecommendationBenefit;
  estimatedTimeToImplement: string;
  dependsOn: string[];
  priority: number;
  maxPerRule: number;
  evidenceSignals: RecommendationEvidenceType[];
}

export interface RecommendationLibraryPlugin {
  id: string;
  version: string;
  register(library: RecommendationLibraryRegistry): void;
}

export interface RecommendationLibrary {
  version: "bie.recommendation-library.v1";
  definitions: RecommendationRuleDefinition[];
  plugins: Array<{ id: string; version: string }>;
}

export interface RecommendationLibraryRegistry {
  version: "bie.recommendation-library-registry.v1";
  registerDefinition(definition: RecommendationRuleDefinition): void;
  registerPlugin(plugin: RecommendationLibraryPlugin): void;
  listDefinitions(): RecommendationRuleDefinition[];
  getDefinition(id: string): RecommendationRuleDefinition | undefined;
  toLibrary(): RecommendationLibrary;
}

export interface BusinessRecommendation {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  type: RecommendationType;
  priority: RecommendationPriority;
  confidence: number;
  businessImpact: number;
  estimatedDifficulty: RecommendationDifficulty;
  estimatedBenefit: RecommendationBenefit;
  requiredData: SemanticCategory[];
  missingData: SemanticCategory[];
  supportingKPIs: string[];
  supportingInsights: string[];
  supportingEntities: string[];
  supportingRelationships: string[];
  estimatedTimeToImplement: string;
  affectedDepartments: string[];
  warnings: string[];
  evidence: RecommendationEvidence[];
  executionTime: string;
  ruleId: string;
  duplicateOf: string | null;
  overlapWith: string[];
  conflictWith: string[];
}

export interface RecommendationDependency {
  fromRecommendationId: string;
  toRecommendationId: string;
  dependencyType: "prerequisite" | "enables" | "blocks" | "sequence";
  confidence: number;
  reason: string;
}

export interface DuplicateRecommendationRecord {
  recommendationId: string;
  duplicateOf: string;
  confidence: number;
  reason: string;
}

export interface OverlappingRecommendationRecord {
  recommendationIds: [string, string];
  confidence: number;
  sharedEvidence: string[];
  reason: string;
}

export interface ConflictingRecommendationRecord {
  recommendationIds: [string, string];
  confidence: number;
  reason: string;
}

export interface RecommendationStatistics {
  recommendationCount: number;
  criticalRecommendations: number;
  quickWins: number;
  strategicRecommendations: number;
  financialRecommendations: number;
  operationalRecommendations: number;
  growthRecommendations: number;
  riskRecommendations: number;
  averageConfidence: number;
  estimatedBusinessValue: number;
  coveragePercent: number;
  qualityScore: number;
  priorityDistribution: Record<RecommendationPriority, number>;
  categoryDistribution: Record<RecommendationCategory, number>;
  duplicateRecommendations: number;
  overlappingRecommendations: number;
  conflictingRecommendations: number;
}

export interface RecommendationSummary {
  priority: RecommendationPriority;
  count: number;
  recommendationIds: string[];
}

export interface RecommendationConfidenceSummary {
  averageConfidence: number;
  high: number;
  medium: number;
  low: number;
}

export interface RecommendationGenerationLog {
  generatedRecommendation: string | null;
  ruleId: string | null;
  priority: RecommendationPriority | null;
  confidence: number;
  businessImpact: number;
  evidence: RecommendationEvidence[];
  executionTime: string;
  durationMs: number;
  warnings: string[];
  errors: string[];
}

export interface RecommendationProfile {
  version: "bie.recommendation-profile.v1";
  generatedAt: string;
  kpiProfileVersion: KPIDatasetProfile["version"];
  insightProfileVersion: InsightProfile["version"];
  semanticProfileVersion: SemanticDatasetProfile["version"] | null;
  entityProfileVersion: EntityDatasetProfile["version"] | null;
  relationshipProfileVersion: RelationshipDatasetProfile["version"] | null;
  businessMaturityProfileVersion: BusinessMaturityProfile["version"] | null;
  recommendations: BusinessRecommendation[];
  dependencies: RecommendationDependency[];
  duplicates: DuplicateRecommendationRecord[];
  overlaps: OverlappingRecommendationRecord[];
  conflicts: ConflictingRecommendationRecord[];
  statistics: RecommendationStatistics;
  prioritySummary: RecommendationSummary[];
  confidenceSummary: RecommendationConfidenceSummary;
  confidence: number;
  coveragePercent: number;
  qualityScore: number;
  warnings: string[];
  errors: string[];
  logs: RecommendationGenerationLog[];
  extensionPoints: {
    aiDecisionEngine: boolean;
    automatedBusinessAdvisor: boolean;
    workflowAutomation: boolean;
    erpIntegration: boolean;
    crmIntegration: boolean;
    posIntegration: boolean;
    emailRecommendations: boolean;
    slackTeamsNotifications: boolean;
    scheduledRecommendations: boolean;
    recommendationLearning: boolean;
    userFeedbackLearning: boolean;
    roiTracking: boolean;
    recommendationSuccessTracking: boolean;
    actionConfirmation: boolean;
    continuousOptimization: boolean;
    benchmarkComparison: boolean;
    industryBenchmarkEngine: boolean;
  };
}

export interface RecommendationGenerationInput {
  context?: PipelineContext;
  kpiProfile: KPIDatasetProfile;
  insightProfile: InsightProfile;
  semanticProfile?: SemanticDatasetProfile | null;
  entityProfile?: EntityDatasetProfile | null;
  relationshipProfile?: RelationshipDatasetProfile | null;
  businessMaturityProfile?: BusinessMaturityProfile | null;
  businessModel?: Readonly<Record<string, unknown>> | null;
  library?: RecommendationLibraryRegistry | RecommendationLibrary;
  minimumConfidence?: number;
}

export interface RecommendationCandidate {
  rule: RecommendationRuleDefinition;
  insight: BusinessInsight | null;
  kpis: DetectedKPI[];
  confidence: number;
  businessImpact: number;
  evidence: RecommendationEvidence[];
  missingData: SemanticCategory[];
  warnings: string[];
}
