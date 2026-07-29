import type {
  SemanticCategory,
  SemanticColumnProfile,
  SemanticDatasetProfile,
} from "./semantic-types";
import type { DatasetColumnProfile, DatasetStructureProfile } from "./structure-types";

export type EntityType =
  | "Customer"
  | "Supplier"
  | "Lead"
  | "Company"
  | "Employee"
  | "Department"
  | "Product"
  | "Product Variant"
  | "SKU"
  | "Category"
  | "Brand"
  | "Order"
  | "Order Item"
  | "Invoice"
  | "Invoice Line"
  | "Payment"
  | "Refund"
  | "Subscription"
  | "Store"
  | "Location"
  | "Warehouse"
  | "Inventory Item"
  | "Shipment"
  | "Carrier"
  | "Expense"
  | "Asset"
  | "Tax"
  | "Currency"
  | "Project"
  | "Task"
  | "Unknown";

export type EntityEvidenceType =
  | "semantic-column"
  | "sample-pattern"
  | "neighbor-column"
  | "dataset-context"
  | "business-vocabulary"
  | "dictionary-match"
  | "statistical-analysis"
  | "cross-column-validation"
  | "duplicate-analysis";

export type EntityPatternType =
  | "Email"
  | "Phone"
  | "IBAN"
  | "SWIFT"
  | "VAT Number"
  | "Tax ID"
  | "UUID"
  | "Invoice Number"
  | "Order Number"
  | "SKU Pattern"
  | "Barcode"
  | "EAN"
  | "GTIN"
  | "ZIP Code"
  | "Country Code"
  | "ISO Currency"
  | "GPS Coordinates"
  | "License Plate";

export interface EntityPatternDefinition {
  id: EntityPatternType;
  version: string;
  priority: number;
  pattern: RegExp;
  validator?: (value: string) => boolean;
  metadata: Readonly<Record<string, unknown>>;
}

export interface EntityRegistryEntry {
  entityType: Exclude<EntityType, "Unknown">;
  version: string;
  priority: number;
  semanticCategories: SemanticCategory[];
  requiredSignals: number;
  aliases: string[];
  patternTypes: EntityPatternType[];
  relatedSemanticCategories: SemanticCategory[];
  metadata: Readonly<Record<string, unknown>>;
}

export interface EntityRegistryPlugin {
  id: string;
  version: string;
  register(registry: EntityRegistry): void;
}

export interface EntityRegistry {
  version: "edie.entity-registry.v1";
  entityTypes: EntityRegistryEntry[];
  patterns: EntityPatternDefinition[];
  plugins: EntityRegistryPlugin[];
}

export interface EntityEvidence {
  type: EntityEvidenceType;
  score: number;
  weight: number;
  reason: string;
  source: string;
}

export interface EntityColumnReference {
  columnName: string;
  position: number;
  worksheetName: string;
  semanticCategory: SemanticCategory;
  confidence: number;
  sampleValues: unknown[];
}

export interface EntityDuplicateCandidate {
  entityType: EntityType;
  confidence: number;
  key: string;
  rowIndexes: number[];
  columns: string[];
  reason: string;
}

export interface EntityProfile {
  entityId: string;
  entityType: EntityType;
  confidence: number;
  evidence: EntityEvidence[];
  columns: EntityColumnReference[];
  relatedColumns: EntityColumnReference[];
  sampleValues: unknown[];
  detectedPatterns: EntityPatternType[];
  warnings: string[];
  qualityScore: number;
}

export interface EntityScannerLog {
  entityType: EntityType;
  entityId: string;
  confidence: number;
  evidence: EntityEvidence[];
  executionTime: string;
  warnings: string[];
  errors: string[];
  patternMatches: EntityPatternType[];
  dictionaryHits: string[];
}

export interface EntityStatistics {
  entityCount: number;
  coveragePercent: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  unknownEntities: number;
  duplicateCandidates: EntityDuplicateCandidate[];
  qualityScore: number;
}

export interface EntityDatasetProfile {
  version: "edie.entity.v1";
  registryVersion: EntityRegistry["version"];
  structureFingerprint: string;
  semanticProfileVersion: SemanticDatasetProfile["version"];
  generatedAt: string;
  entities: EntityProfile[];
  entityProfiles: EntityProfile[];
  statistics: EntityStatistics;
  confidenceSummary: {
    averageConfidence: number;
    minConfidence: number;
    maxConfidence: number;
    entityCount: number;
  };
  warnings: string[];
  errors: string[];
  coveragePercent: number;
  qualityScore: number;
  confidence: number;
  logs: EntityScannerLog[];
  extensionPoints: {
    knowledgeGraph: boolean;
    relationshipIntelligence: boolean;
    crossDatasetResolution: boolean;
    customerPlugins: boolean;
    industryEntityPacks: boolean;
    extractionSources: string[];
    vectorSearch: boolean;
    activeLearning: boolean;
    humanReview: boolean;
  };
}

export interface EntityScannerInput {
  structureProfile: DatasetStructureProfile;
  semanticProfile: SemanticDatasetProfile;
  registry?: EntityRegistry;
  minimumConfidence?: number;
}

export interface EntityResolutionCandidate {
  entityType: EntityType;
  localEntityId: string;
  externalEntityId?: string;
  confidence: number;
  evidence: EntityEvidence[];
  status: "prepared" | "not-implemented";
}

export interface EntityColumnBundle {
  structureColumn: DatasetColumnProfile;
  semanticColumn: SemanticColumnProfile;
}
