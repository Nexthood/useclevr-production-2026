import type {
  BusinessMaturityProfile,
  EntityDatasetProfile,
  RelationshipDatasetProfile,
  SemanticCategory,
  SemanticDatasetProfile,
  DatasetStructureProfile,
} from "../edie";

export type KPICategory =
  | "Financial KPIs"
  | "Sales KPIs"
  | "Customer KPIs"
  | "Inventory KPIs"
  | "Marketing KPIs"
  | "Operational KPIs"
  | "Product KPIs"
  | "Accounting KPIs"
  | "Supply Chain KPIs"
  | "HR KPIs"
  | "Manufacturing KPIs"
  | "Restaurant KPIs"
  | "Healthcare KPIs"
  | "Hospitality KPIs"
  | "Logistics KPIs"
  | "SaaS KPIs"
  | "Startup KPIs"
  | "Executive KPIs"
  | "Risk KPIs"
  | "Compliance KPIs"
  | "AI Readiness KPIs"
  | "Business Health KPIs";

export type KPIAvailability =
  | "Available"
  | "Partially Available"
  | "Unavailable"
  | "Needs User Input";

export type KPICalculationComplexity = "Low" | "Medium" | "High" | "Not Supported";

export type KPIEvidenceType =
  | "semantic-field"
  | "entity-presence"
  | "relationship-dependency"
  | "business-model-fit"
  | "business-maturity-fit"
  | "dataset-quality"
  | "library-definition"
  | "dependency-availability"
  | "missing-field";

export interface KPIEvidence {
  type: KPIEvidenceType;
  score: number;
  weight: number;
  reason: string;
  source: string;
}

export interface KPIFormulaDefinition {
  expression: string;
  dependsOn: string[];
  requiredSemanticCategories: SemanticCategory[];
  optionalSemanticCategories: SemanticCategory[];
  requiresUserInput?: boolean;
}

export interface KPIDefinition {
  id: string;
  name: string;
  category: KPICategory;
  description: string;
  businessModels: string[];
  industries: string[];
  formula: KPIFormulaDefinition;
  dependencies: string[];
  requiredFields: SemanticCategory[];
  optionalFields: SemanticCategory[];
  visualizationRecommendations: string[];
  thresholds: Array<{ label: string; operator: "<" | "<=" | ">" | ">=" | "="; value: number; severity: "info" | "warning" | "critical" }>;
  units: Array<"money" | "percentage" | "count" | "ratio" | "days" | "currency" | "score">;
  supportedCurrencies: string[];
  version: string;
  relevanceSignals: {
    semanticCategories: SemanticCategory[];
    entityTypes: string[];
    relationshipTypes: string[];
    maturityDimensions: string[];
    vocabulary: string[];
  };
}

export interface KPILibraryPlugin {
  id: string;
  version: string;
  register(library: KPILibraryRegistry): void;
}

export interface KPILibrary {
  version: "bie.kpi-library.v1";
  definitions: KPIDefinition[];
  plugins: Array<{ id: string; version: string }>;
}

export interface KPILibraryRegistry {
  version: "bie.kpi-library-registry.v1";
  registerDefinition(definition: KPIDefinition): void;
  registerPlugin(plugin: KPILibraryPlugin): void;
  listDefinitions(): KPIDefinition[];
  getDefinition(id: string): KPIDefinition | undefined;
  toLibrary(): KPILibrary;
}

export interface KPIDependencyNode {
  kpiId: string;
  name: string;
  dependencies: string[];
  dependents: string[];
  availability: KPIAvailability;
  confidence: number;
}

export interface KPIDependencyGraph {
  version: "bie.kpi-dependency-graph.v1";
  nodes: KPIDependencyNode[];
  edges: Array<{ from: string; to: string; available: boolean; confidence: number }>;
  missingDependencyChains: Array<{ kpiId: string; missingDependencies: string[]; reason: string }>;
  confidence: number;
}

export interface KPIRecommendationStub {
  requiredData: SemanticCategory[];
  missingColumns: SemanticCategory[];
  alternativeKpiIds: string[];
  potentialImprovement: string;
  status: "identified-not-generated";
}

export interface DetectedKPI {
  id: string;
  name: string;
  category: KPICategory;
  confidence: number;
  evidence: KPIEvidence[];
  requiredFields: SemanticCategory[];
  missingFields: SemanticCategory[];
  optionalFields: SemanticCategory[];
  availableFields: SemanticCategory[];
  calculationAvailability: KPIAvailability;
  calculationComplexity: KPICalculationComplexity;
  businessRelevance: number;
  warnings: string[];
  alternativeKPIs: string[];
  recommendation: KPIRecommendationStub | null;
  visualizationRecommendations: string[];
  units: KPIDefinition["units"];
  thresholds: KPIDefinition["thresholds"];
  definitionVersion: string;
}

export interface KPIStatistics {
  detectedKPIs: number;
  availableKPIs: number;
  partiallyAvailableKPIs: number;
  unavailableKPIs: number;
  needsUserInputKPIs: number;
  coveragePercent: number;
  averageConfidence: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  categoryDistribution: Record<KPICategory, number>;
  businessHealthCoverage: number;
  qualityScore: number;
}

export interface KPIDatasetProfile {
  version: "bie.kpi-profile.v1";
  libraryVersion: KPILibrary["version"];
  generatedAt: string;
  structureFingerprint: string;
  semanticProfileVersion: SemanticDatasetProfile["version"];
  entityProfileVersion: EntityDatasetProfile["version"];
  relationshipProfileVersion: RelationshipDatasetProfile["version"];
  businessMaturityProfileVersion: BusinessMaturityProfile["version"] | null;
  detectedKPIs: DetectedKPI[];
  categories: KPICategory[];
  confidence: number;
  evidence: Record<string, KPIEvidence[]>;
  dependencies: KPIDependencyGraph;
  missingData: Array<{ kpiId: string; kpiName: string; missingFields: SemanticCategory[]; alternatives: string[] }>;
  qualityScore: number;
  coveragePercent: number;
  warnings: string[];
  errors: string[];
  statistics: KPIStatistics;
  logs: KPIDiscoveryLog[];
  extensionPoints: {
    dashboardIntelligenceEngine: boolean;
    aiInsightEngine: boolean;
    recommendationEngine: boolean;
    forecastEngine: boolean;
    whatIfAnalysis: boolean;
    scenarioPlanning: boolean;
    industryBenchmarks: boolean;
    companyBenchmarks: boolean;
    esgKpis: boolean;
    investorKpis: boolean;
    bankingKpis: boolean;
    ipoKpis: boolean;
    riskKpis: boolean;
    complianceKpis: boolean;
    kpiLearningEngine: boolean;
    activeLearning: boolean;
    humanValidation: boolean;
    graphAnalytics: boolean;
    timeSeriesAnalysis: boolean;
    streamingKpis: boolean;
    incrementalKpiUpdates: boolean;
  };
}

export interface KPIDiscoveryLog {
  kpiId: string;
  name: string;
  confidence: number;
  evidence: KPIEvidence[];
  dependencies: string[];
  availability: KPIAvailability;
  executionTime: string;
  warnings: string[];
  errors: string[];
}

export interface KPIDiscoveryInput {
  structureProfile: DatasetStructureProfile;
  semanticProfile: SemanticDatasetProfile;
  entityProfile: EntityDatasetProfile;
  relationshipProfile: RelationshipDatasetProfile;
  businessMaturityProfile?: BusinessMaturityProfile | null;
  businessModel?: Readonly<Record<string, unknown>> | null;
  industry?: Readonly<Record<string, unknown>> | null;
  library?: KPILibraryRegistry | KPILibrary;
  minimumConfidence?: number;
}
