import type {
  BusinessMaturityProfile,
  EntityDatasetProfile,
  RelationshipDatasetProfile,
  SemanticCategory,
  SemanticDatasetProfile,
  PipelineContext,
} from "../edie";
import type { DetectedKPI, KPIDatasetProfile, KPICategory } from "./kpi-types";

export type InsightCategory =
  | "Revenue Insights"
  | "Profit Insights"
  | "Cost Insights"
  | "Customer Insights"
  | "Inventory Insights"
  | "Sales Insights"
  | "Product Insights"
  | "Marketing Insights"
  | "Accounting Insights"
  | "Cash Flow Insights"
  | "Employee Insights"
  | "Department Insights"
  | "Operational Insights"
  | "Business Health Insights"
  | "Risk Insights"
  | "Growth Insights"
  | "Forecast Insights"
  | "Executive Insights";

export type InsightGroup =
  | "Financial"
  | "Operational"
  | "Commercial"
  | "Inventory"
  | "Customer"
  | "Marketing"
  | "Accounting"
  | "Executive"
  | "Risk"
  | "Forecast"
  | "Compliance"
  | "AI";

export type InsightType =
  | "Positive Finding"
  | "Negative Finding"
  | "Unexpected Change"
  | "Emerging Trend"
  | "Anomaly"
  | "Outlier"
  | "Seasonality"
  | "Correlation"
  | "Business Opportunity"
  | "Performance Improvement"
  | "Operational Bottleneck"
  | "Potential Risk"
  | "Missing Information"
  | "Data Quality Warning";

export type InsightPriority = "Critical" | "High" | "Medium" | "Low" | "Informational";

export type InsightSeverity = "critical" | "warning" | "notice" | "positive" | "info";

export type InsightEvidenceType =
  | "kpi"
  | "kpi-warning"
  | "kpi-missing-field"
  | "business-model"
  | "business-maturity"
  | "relationship-graph"
  | "entity-statistics"
  | "semantic-coverage"
  | "dataset-quality"
  | "historical-trend"
  | "duplicate-detection"
  | "insight-rule";

export interface InsightEvidence {
  type: InsightEvidenceType;
  score: number;
  weight: number;
  reason: string;
  source: string;
}

export interface InsightRuleDefinition {
  id: string;
  version: string;
  titleTemplate: string;
  descriptionTemplate: string;
  category: InsightCategory;
  group: InsightGroup;
  insightType: InsightType;
  supportedKpiCategories: KPICategory[];
  supportedKpiIds: string[];
  requiredSemanticCategories: SemanticCategory[];
  businessModels: string[];
  baseImpact: number;
  baseSeverity: InsightSeverity;
  priority: number;
  maxPerRule: number;
  evidenceSignals: InsightEvidenceType[];
}

export interface InsightLibraryPlugin {
  id: string;
  version: string;
  register(library: InsightLibraryRegistry): void;
}

export interface InsightLibrary {
  version: "bie.insight-library.v1";
  definitions: InsightRuleDefinition[];
  plugins: Array<{ id: string; version: string }>;
}

export interface InsightLibraryRegistry {
  version: "bie.insight-library-registry.v1";
  registerDefinition(definition: InsightRuleDefinition): void;
  registerPlugin(plugin: InsightLibraryPlugin): void;
  listDefinitions(): InsightRuleDefinition[];
  getDefinition(id: string): InsightRuleDefinition | undefined;
  toLibrary(): InsightLibrary;
}

export interface BusinessInsight {
  id: string;
  title: string;
  description: string;
  category: InsightCategory;
  group: InsightGroup;
  type: InsightType;
  priority: InsightPriority;
  severity: InsightSeverity;
  confidence: number;
  evidence: InsightEvidence[];
  supportingKPIs: string[];
  supportingEntities: string[];
  supportingRelationships: string[];
  affectedDepartments: string[];
  businessImpact: number;
  recommendedInvestigation: string;
  warnings: string[];
  executionTime: string;
  ruleId: string;
  duplicateOf: string | null;
  overlapWith: string[];
  contradictionWith: string[];
}

export interface DuplicateInsightRecord {
  insightId: string;
  duplicateOf: string;
  confidence: number;
  reason: string;
}

export interface OverlappingInsightRecord {
  insightIds: [string, string];
  confidence: number;
  sharedEvidence: string[];
  reason: string;
}

export interface ContradictingInsightRecord {
  insightIds: [string, string];
  confidence: number;
  reason: string;
}

export interface InsightStatistics {
  insightCount: number;
  criticalInsights: number;
  positiveInsights: number;
  negativeInsights: number;
  opportunities: number;
  risks: number;
  averageConfidence: number;
  coveragePercent: number;
  businessHealthImpact: number;
  priorityDistribution: Record<InsightPriority, number>;
  groupDistribution: Record<InsightGroup, number>;
  duplicateInsights: number;
  overlappingInsights: number;
  contradictingInsights: number;
  qualityScore: number;
}

export interface InsightGenerationLog {
  generatedInsight: string | null;
  ruleId: string | null;
  priority: InsightPriority | null;
  confidence: number;
  evidence: InsightEvidence[];
  executionTime: string;
  durationMs: number;
  warnings: string[];
  errors: string[];
}

export interface InsightProfile {
  version: "bie.insight-profile.v1";
  generatedAt: string;
  kpiProfileVersion: KPIDatasetProfile["version"];
  semanticProfileVersion: SemanticDatasetProfile["version"] | null;
  entityProfileVersion: EntityDatasetProfile["version"] | null;
  relationshipProfileVersion: RelationshipDatasetProfile["version"] | null;
  businessMaturityProfileVersion: BusinessMaturityProfile["version"] | null;
  insights: BusinessInsight[];
  groups: Array<{ group: InsightGroup; insightIds: string[]; confidence: number; reason: string }>;
  duplicates: DuplicateInsightRecord[];
  overlaps: OverlappingInsightRecord[];
  contradictions: ContradictingInsightRecord[];
  statistics: InsightStatistics;
  confidence: number;
  warnings: string[];
  errors: string[];
  coveragePercent: number;
  qualityScore: number;
  logs: InsightGenerationLog[];
  extensionPoints: {
    aiExecutiveSummaries: boolean;
    naturalLanguageReports: boolean;
    personalizedInsights: boolean;
    scheduledInsightDelivery: boolean;
    predictiveInsights: boolean;
    rootCauseAnalysis: boolean;
    whatIfAnalysis: boolean;
    businessSimulations: boolean;
    decisionEngine: boolean;
    recommendationEngine: boolean;
    alertEngine: boolean;
    mobileNotifications: boolean;
    slackTeamsIntegration: boolean;
    emailSummaries: boolean;
    voiceAssistant: boolean;
    multiLanguageInsightGeneration: boolean;
    historicalInsightTracking: boolean;
    trendComparison: boolean;
    insightHistory: boolean;
    insightEvolution: boolean;
  };
}

export interface InsightGenerationInput {
  context?: PipelineContext;
  kpiProfile: KPIDatasetProfile;
  semanticProfile?: SemanticDatasetProfile | null;
  entityProfile?: EntityDatasetProfile | null;
  relationshipProfile?: RelationshipDatasetProfile | null;
  businessMaturityProfile?: BusinessMaturityProfile | null;
  businessModel?: Readonly<Record<string, unknown>> | null;
  library?: InsightLibraryRegistry | InsightLibrary;
  minimumConfidence?: number;
}

export interface InsightCandidate {
  rule: InsightRuleDefinition;
  kpi: DetectedKPI | null;
  confidence: number;
  evidence: InsightEvidence[];
  businessImpact: number;
  severity: InsightSeverity;
  warnings: string[];
}
