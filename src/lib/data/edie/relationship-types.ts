import type { EntityDatasetProfile, EntityProfile, EntityType } from "./entity-types";
import type { SemanticCategory, SemanticDatasetProfile } from "./semantic-types";
import type { DatasetColumnProfile, DatasetStructureProfile } from "./structure-types";

export type RelationshipType =
  | "Customer -> Order"
  | "Order -> Order Item"
  | "Order -> Invoice"
  | "Invoice -> Payment"
  | "Customer -> Invoice"
  | "Customer -> Payment"
  | "Customer -> Address"
  | "Supplier -> Product"
  | "Supplier -> Invoice"
  | "Product -> Category"
  | "Product -> Brand"
  | "Product -> Warehouse"
  | "Warehouse -> Inventory"
  | "Store -> Inventory"
  | "Store -> Employee"
  | "Employee -> Department"
  | "Invoice -> Tax"
  | "Invoice -> Currency"
  | "Expense -> Department"
  | "Project -> Employee"
  | "Project -> Expense"
  | "Shipment -> Order"
  | "Shipment -> Carrier"
  | "Refund -> Invoice"
  | "Subscription -> Customer"
  | "Asset -> Department";

export type RelationshipEvidenceType =
  | "detected-entity"
  | "semantic-cooccurrence"
  | "column-position"
  | "shared-key"
  | "matching-id"
  | "value-distribution"
  | "dataset-structure"
  | "business-vocabulary"
  | "cross-validation";

export type KeyType =
  | "Primary Key"
  | "Foreign Key"
  | "Composite Key"
  | "Natural Key"
  | "Candidate Key"
  | "Generated Key"
  | "Unknown Key";

export type CardinalityType =
  | "One-to-One"
  | "One-to-Many"
  | "Many-to-One"
  | "Many-to-Many"
  | "Unknown";

export type RelationshipConfidenceBand = "high" | "medium" | "low" | "unknown";

export interface RelationshipEvidence {
  type: RelationshipEvidenceType;
  score: number;
  weight: number;
  reason: string;
  source: string;
}

export interface RelationshipRegistryEntry {
  relationshipType: RelationshipType;
  version: string;
  priority: number;
  sourceEntity: Exclude<EntityType, "Unknown">;
  targetEntity: Exclude<EntityType, "Unknown">;
  sourceSemanticCategories: SemanticCategory[];
  targetSemanticCategories: SemanticCategory[];
  requiredSignals: number;
  aliases: string[];
  metadata: Readonly<Record<string, unknown>>;
}

export interface RelationshipRegistryPlugin {
  id: string;
  version: string;
  register(registry: RelationshipRegistry): void;
}

export interface RelationshipRegistry {
  version: "edie.relationship-registry.v1";
  relationshipTypes: RelationshipRegistryEntry[];
  plugins: RelationshipRegistryPlugin[];
}

export interface KeyProfile {
  keyId: string;
  keyType: KeyType;
  entityType: EntityType;
  confidence: number;
  columns: string[];
  semanticCategories: SemanticCategory[];
  uniquenessPercent: number;
  nullPercent: number;
  sampleValues: unknown[];
  reason: string;
  warnings: string[];
}

export interface RelationshipColumnReference {
  columnName: string;
  position: number;
  worksheetName: string;
  semanticCategory: SemanticCategory;
  entityType: EntityType;
  confidence: number;
  sampleValues: unknown[];
}

export interface RelationshipProfile {
  relationshipId: string;
  relationshipType: RelationshipType;
  sourceEntity: EntityType;
  targetEntity: EntityType;
  confidence: number;
  confidenceBand: RelationshipConfidenceBand;
  status: "Accepted" | "Needs Review";
  evidence: RelationshipEvidence[];
  matchedKeys: KeyProfile[];
  relatedColumns: RelationshipColumnReference[];
  cardinality: {
    type: CardinalityType;
    confidence: number;
    reason: string;
  };
  reason: string;
  warnings: string[];
  executionTime: string;
}

export interface RelationshipGraphNode {
  id: string;
  entityType: EntityType;
  label: string;
  confidence: number;
  columnCount: number;
}

export interface RelationshipGraphEdge {
  id: string;
  relationshipType: RelationshipType;
  source: string;
  target: string;
  confidence: number;
  cardinality: CardinalityType;
  matchedKeys: string[];
  status: "Accepted" | "Needs Review";
}

export interface RelationshipGraphExport {
  format: "edie.relationship-graph.v1";
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
  metadata: {
    generatedAt: string;
    relationshipCount: number;
    qualityScore: number;
  };
}

export interface RelationshipGraph {
  version: "edie.relationship-graph.v1";
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
  confidence: number;
  relationshipCount: number;
  coveragePercent: number;
  disconnectedEntities: EntityType[];
  warnings: string[];
  qualityScore: number;
  export: RelationshipGraphExport;
}

export interface RelationshipStatistics {
  totalRelationships: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  unknown: number;
  disconnectedEntities: EntityType[];
  coveragePercent: number;
  averageConfidence: number;
  relationshipDensity: number;
  graphHealthScore: number;
}

export interface RelationshipScannerLog {
  relationshipType: RelationshipType;
  confidence: number;
  evidence: RelationshipEvidence[];
  matchedKeys: string[];
  warnings: string[];
  errors: string[];
  executionTime: string;
}

export interface RelationshipDatasetProfile {
  version: "edie.relationship.v1";
  registryVersion: RelationshipRegistry["version"];
  structureFingerprint: string;
  semanticProfileVersion: SemanticDatasetProfile["version"];
  entityProfileVersion: EntityDatasetProfile["version"];
  generatedAt: string;
  relationshipGraph: RelationshipGraph;
  graph: RelationshipGraph;
  statistics: RelationshipStatistics;
  relationshipProfiles: RelationshipProfile[];
  keyProfiles: KeyProfile[];
  warnings: string[];
  errors: string[];
  coveragePercent: number;
  confidenceSummary: {
    averageConfidence: number;
    minConfidence: number;
    maxConfidence: number;
    relationshipCount: number;
  };
  qualityScore: number;
  confidence: number;
  logs: RelationshipScannerLog[];
  extensionPoints: {
    knowledgeGraph: boolean;
    aiReasoning: boolean;
    automaticKpiGeneration: boolean;
    rootCauseAnalysis: boolean;
    recommendationEngine: boolean;
    forecastEngine: boolean;
    businessModelDetector: boolean;
    industryDetector: boolean;
    graphDatabase: boolean;
    neo4j: boolean;
    rdfExport: boolean;
    graphqlApi: boolean;
    crossDatasetRelationships: boolean;
    streamingRelationships: boolean;
    incrementalGraphUpdates: boolean;
    eventDrivenUpdates: boolean;
    activeLearning: boolean;
    humanValidation: boolean;
    semanticMemory: boolean;
    vectorSearch: boolean;
    embeddingProviders: boolean;
  };
}

export interface RelationshipScannerInput {
  structureProfile: DatasetStructureProfile;
  semanticProfile: SemanticDatasetProfile;
  entityProfile: EntityDatasetProfile;
  rows?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  registry?: RelationshipRegistry;
  minimumConfidence?: number;
}

export interface RelationshipColumnBundle {
  structureColumn: DatasetColumnProfile;
  semanticColumn: SemanticDatasetProfile["semanticColumns"][number];
  entityProfile?: EntityProfile;
}
