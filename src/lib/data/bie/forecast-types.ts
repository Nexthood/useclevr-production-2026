import type {
  BusinessMaturityProfile,
  EntityDatasetProfile,
  PipelineContext,
  RelationshipDatasetProfile,
  SemanticCategory,
  SemanticDatasetProfile,
} from "../edie";
import type { InsightProfile } from "./insight-types";
import type { DetectedKPI, KPIDatasetProfile, KPICategory } from "./kpi-types";
import type { RecommendationProfile } from "./recommendation-types";

export type ForecastCategory =
  | "Revenue Forecast"
  | "Profit Forecast"
  | "Sales Forecast"
  | "Demand Forecast"
  | "Inventory Forecast"
  | "Cash Flow Forecast"
  | "Expense Forecast"
  | "Payroll Forecast"
  | "Growth Forecast"
  | "Customer Forecast"
  | "Subscription Forecast"
  | "Churn Forecast"
  | "Supplier Forecast"
  | "Warehouse Forecast"
  | "Marketing Forecast"
  | "Business Health Forecast"
  | "Risk Forecast"
  | "AI Readiness Forecast";

export type ForecastModelType =
  | "Linear Trend"
  | "Moving Average"
  | "Exponential Smoothing"
  | "Regression"
  | "Machine Learning"
  | "AI-assisted Forecasting"
  | "Hybrid Model";

export type ScenarioType =
  | "Price Increase"
  | "Demand Drop"
  | "Inventory Increase"
  | "Payroll Increase"
  | "Marketing Budget Change"
  | "Supplier Cost Increase"
  | "New Store"
  | "Additional Warehouse"
  | "Employee Count Change"
  | "Churn Decrease";

export type ForecastEvidenceType =
  | "historical-data"
  | "supporting-kpi"
  | "business-model"
  | "business-maturity"
  | "supporting-insight"
  | "supporting-recommendation"
  | "relationship-graph"
  | "seasonality"
  | "business-rule"
  | "model-fit"
  | "scenario-rule";

export interface ForecastEvidence {
  type: ForecastEvidenceType;
  score: number;
  weight: number;
  reason: string;
  source: string;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number;
}

export interface ForecastModelDefinition {
  id: string;
  version: string;
  name: ForecastModelType;
  description: string;
  supportedCategories: ForecastCategory[];
  supportedKpiCategories: KPICategory[];
  supportedKpiIds: string[];
  requiredSemanticCategories: SemanticCategory[];
  businessModels: string[];
  minimumPeriods: number;
  horizonPeriods: number;
  smoothingFactor?: number;
  baseConfidence: number;
  priority: number;
}

export interface ScenarioDefinition {
  id: string;
  version: string;
  name: string;
  type: ScenarioType;
  changedVariables: Record<string, number>;
  supportedForecastCategories: ForecastCategory[];
  affectedKpiIds: string[];
  requiredSemanticCategories: SemanticCategory[];
  businessModels: string[];
  baseRiskScore: number;
  priority: number;
}

export interface ForecastLibraryPlugin {
  id: string;
  version: string;
  register(library: ForecastLibraryRegistry): void;
}

export interface ForecastLibrary {
  version: "bie.forecast-library.v1";
  models: ForecastModelDefinition[];
  scenarios: ScenarioDefinition[];
  plugins: Array<{ id: string; version: string }>;
}

export interface ForecastLibraryRegistry {
  version: "bie.forecast-library-registry.v1";
  registerModel(model: ForecastModelDefinition): void;
  registerScenario(scenario: ScenarioDefinition): void;
  registerPlugin(plugin: ForecastLibraryPlugin): void;
  listModels(): ForecastModelDefinition[];
  listScenarios(): ScenarioDefinition[];
  getModel(id: string): ForecastModelDefinition | undefined;
  getScenario(id: string): ScenarioDefinition | undefined;
  toLibrary(): ForecastLibrary;
}

export interface HistoricalPoint {
  period: string;
  value: number;
}

export interface BusinessForecast {
  id: string;
  name: string;
  category: ForecastCategory;
  prediction: number;
  confidence: number;
  confidenceInterval: ConfidenceInterval;
  evidence: ForecastEvidence[];
  businessAssumptions: string[];
  historicalCoverage: {
    periods: number;
    firstPeriod: string | null;
    lastPeriod: string | null;
    values: HistoricalPoint[];
  };
  predictionHorizon: number;
  modelUsed: ForecastModelType;
  modelId: string;
  supportingKPIs: string[];
  supportingInsights: string[];
  supportingRecommendations: string[];
  warnings: string[];
  executionTime: string;
}

export interface BusinessScenario {
  id: string;
  name: string;
  type: ScenarioType;
  changedVariables: Record<string, number>;
  predictedOutcome: number;
  affectedKPIs: string[];
  businessImpact: number;
  financialImpact: number;
  riskScore: number;
  confidence: number;
  comparisonWithBaseline: {
    baselineForecastId: string;
    baselinePrediction: number;
    delta: number;
    deltaPercent: number;
  };
  warnings: string[];
  evidence: ForecastEvidence[];
  executionTime: string;
}

export interface ForecastStatistics {
  forecastCount: number;
  averageConfidence: number;
  predictionHorizon: number;
  scenarioCount: number;
  businessImpact: number;
  forecastAccuracy: null;
  coveragePercent: number;
  qualityScore: number;
  modelDistribution: Record<ForecastModelType, number>;
  categoryDistribution: Record<ForecastCategory, number>;
}

export interface ForecastGenerationLog {
  generatedForecast: string | null;
  scenario: string | null;
  confidence: number;
  executionTime: string;
  durationMs: number;
  warnings: string[];
  errors: string[];
}

export interface ForecastProfile {
  version: "bie.forecast-profile.v1";
  generatedAt: string;
  kpiProfileVersion: KPIDatasetProfile["version"];
  insightProfileVersion: InsightProfile["version"] | null;
  recommendationProfileVersion: RecommendationProfile["version"] | null;
  semanticProfileVersion: SemanticDatasetProfile["version"] | null;
  entityProfileVersion: EntityDatasetProfile["version"] | null;
  relationshipProfileVersion: RelationshipDatasetProfile["version"] | null;
  businessMaturityProfileVersion: BusinessMaturityProfile["version"] | null;
  forecasts: BusinessForecast[];
  scenarios: BusinessScenario[];
  statistics: ForecastStatistics;
  confidence: number;
  coveragePercent: number;
  qualityScore: number;
  warnings: string[];
  errors: string[];
  logs: ForecastGenerationLog[];
  extensionPoints: {
    realTimeForecasting: boolean;
    monteCarloSimulation: boolean;
    digitalTwin: boolean;
    economicIndicators: boolean;
    weatherIntegration: boolean;
    competitorSignals: boolean;
    aiSelfLearning: boolean;
    externalApis: boolean;
    supplyChainEvents: boolean;
    dynamicPricing: boolean;
    investmentPlanning: boolean;
    capacityPlanning: boolean;
    workforcePlanning: boolean;
    multiYearForecasting: boolean;
    strategicPlanning: boolean;
  };
}

export interface ForecastGenerationInput {
  context?: PipelineContext;
  kpiProfile: KPIDatasetProfile;
  insightProfile?: InsightProfile | null;
  recommendationProfile?: RecommendationProfile | null;
  semanticProfile?: SemanticDatasetProfile | null;
  entityProfile?: EntityDatasetProfile | null;
  relationshipProfile?: RelationshipDatasetProfile | null;
  businessMaturityProfile?: BusinessMaturityProfile | null;
  businessModel?: Readonly<Record<string, unknown>> | null;
  rows?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  library?: ForecastLibraryRegistry | ForecastLibrary;
  minimumConfidence?: number;
}

export interface ForecastCandidate {
  model: ForecastModelDefinition;
  category: ForecastCategory;
  series: HistoricalPoint[];
  prediction: number;
  interval: ConfidenceInterval;
  confidence: number;
  evidence: ForecastEvidence[];
  supportingKPIs: DetectedKPI[];
  warnings: string[];
}
