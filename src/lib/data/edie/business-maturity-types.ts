import type { EntityDatasetProfile, EntityType } from "./entity-types";
import type { RelationshipDatasetProfile } from "./relationship-types";
import type { SemanticCategory, SemanticDatasetProfile } from "./semantic-types";
import type { DatasetStructureProfile } from "./structure-types";

export type BusinessMaturityDimension =
  | "Company Size"
  | "Business Complexity"
  | "Operational Complexity"
  | "Financial Maturity"
  | "Sales Maturity"
  | "Inventory Maturity"
  | "Accounting Maturity"
  | "Reporting Maturity"
  | "Digital Maturity"
  | "Automation Maturity"
  | "Data Quality Maturity"
  | "Business Intelligence Maturity"
  | "AI Adoption Readiness"
  | "Growth Stage"
  | "International Presence"
  | "Organizational Complexity"
  | "Risk Level";

export type CompanyGrowthStage =
  | "Idea Stage"
  | "Pre-Revenue Startup"
  | "MVP"
  | "Early Customers"
  | "Product-Market Fit"
  | "Growth"
  | "Scaling"
  | "Expansion"
  | "Multi-Location"
  | "Regional Enterprise"
  | "National Enterprise"
  | "International Enterprise"
  | "Global Enterprise"
  | "Holding Company"
  | "Franchise"
  | "Corporate Group"
  | "Unknown";

export type MaturityEvidenceType =
  | "business-model-context"
  | "dataset-size"
  | "entity-count"
  | "relationship-density"
  | "financial-complexity"
  | "inventory-complexity"
  | "store-count"
  | "warehouse-count"
  | "department-count"
  | "currency-usage"
  | "country-presence"
  | "business-vocabulary"
  | "historical-data"
  | "data-quality";

export interface MaturityEvidence {
  type: MaturityEvidenceType;
  score: number;
  weight: number;
  reason: string;
  source: string;
}

export interface MaturityDimensionScore {
  dimension: BusinessMaturityDimension;
  score: number;
  confidence: number;
  evidence: MaturityEvidence[];
  reason: string;
  warnings: string[];
  unknown: boolean;
}

export interface ComplexityIndicators {
  numberOfProducts: number;
  numberOfCustomers: number;
  numberOfEmployees: number;
  numberOfStores: number;
  numberOfWarehouses: number;
  numberOfDepartments: number;
  numberOfInvoices: number;
  transactionVolume: number;
  relationshipDensity: number;
  businessRuleComplexity: number;
  reportingComplexity: number;
  automationLevel: number;
  confidence: number;
  evidence: MaturityEvidence[];
}

export interface BusinessHealthIndicators {
  operationalStability: number;
  dataCompleteness: number;
  reportingReadiness: number;
  forecastReadiness: number;
  aiReadiness: number;
  biReadiness: number;
  automationOpportunities: number;
  dataQualityRisk: number;
  reportingRisk: number;
  decisionConfidence: number;
  confidence: number;
  evidence: MaturityEvidence[];
}

export interface BusinessMaturityStatistics {
  overallMaturityScore: number;
  dimensionScores: Record<BusinessMaturityDimension, number>;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  unknownAreas: BusinessMaturityDimension[];
  coveragePercent: number;
  businessHealthScore: number;
  operationalReadiness: number;
  aiReadiness: number;
  biReadiness: number;
}

export interface BusinessMaturityLog {
  detectedStage: CompanyGrowthStage;
  confidence: number;
  evidence: MaturityEvidence[];
  warnings: string[];
  executionTime: string;
  dimensionScores: Record<BusinessMaturityDimension, number>;
}

export interface BusinessMaturityProfile {
  version: "edie.business-maturity.v1";
  structureFingerprint: string;
  semanticProfileVersion: SemanticDatasetProfile["version"];
  entityProfileVersion: EntityDatasetProfile["version"];
  relationshipProfileVersion: RelationshipDatasetProfile["version"];
  generatedAt: string;
  growthStage: {
    stage: CompanyGrowthStage;
    confidence: number;
    evidence: MaturityEvidence[];
    reason: string;
    alternatives: Array<{ stage: CompanyGrowthStage; confidence: number; reason: string }>;
  };
  companySize: MaturityDimensionScore;
  operationalComplexity: MaturityDimensionScore;
  financialComplexity: MaturityDimensionScore;
  reportingMaturity: MaturityDimensionScore;
  aiReadiness: MaturityDimensionScore;
  biReadiness: MaturityDimensionScore;
  automationScore: MaturityDimensionScore;
  dimensionScores: MaturityDimensionScore[];
  complexityIndicators: ComplexityIndicators;
  healthIndicators: BusinessHealthIndicators;
  statistics: BusinessMaturityStatistics;
  qualityScore: number;
  confidence: number;
  evidence: MaturityEvidence[];
  warnings: string[];
  errors: string[];
  unknownAreas: BusinessMaturityDimension[];
  logs: BusinessMaturityLog[];
  extensionPoints: {
    kpiDiscovery: boolean;
    dashboardPersonalization: boolean;
    recommendationEngine: boolean;
    forecastEngine: boolean;
    aiContextBuilder: boolean;
    investorReadinessAssessment: boolean;
    operationalBenchmarking: boolean;
    industryBenchmarking: boolean;
    esgReadiness: boolean;
    ipoReadiness: boolean;
    mergerAcquisitionReadiness: boolean;
    complianceReadiness: boolean;
    businessRiskEngine: boolean;
    businessOpportunityEngine: boolean;
    activeLearning: boolean;
    humanReviewWorkflow: boolean;
  };
}

export interface BusinessMaturityScannerInput {
  structureProfile: DatasetStructureProfile;
  semanticProfile: SemanticDatasetProfile;
  entityProfile: EntityDatasetProfile;
  relationshipProfile: RelationshipDatasetProfile;
  businessModel?: Readonly<Record<string, unknown>> | null;
  rows?: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

export interface MaturitySignalSummary {
  rowCount: number;
  columnCount: number;
  entityCount: number;
  relationshipDensity: number;
  products: number;
  customers: number;
  employees: number;
  stores: number;
  warehouses: number;
  departments: number;
  invoices: number;
  countries: number;
  currencies: number;
  dateSpanMonths: number;
  semanticCategories: Set<SemanticCategory>;
  entityTypes: Set<EntityType>;
  vocabulary: Set<string>;
  dataQualityScore: number;
  relationshipQualityScore: number;
}
