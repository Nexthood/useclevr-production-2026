import type { DatasetStructureProfile, StructureDataType } from "./structure-types";

export type SemanticCategory =
  | "Revenue"
  | "Cost"
  | "Profit"
  | "Margin"
  | "Quantity"
  | "Inventory"
  | "SKU"
  | "Product Name"
  | "Category"
  | "Brand"
  | "Customer"
  | "Supplier"
  | "Order"
  | "Invoice"
  | "Payment"
  | "Discount"
  | "Tax"
  | "Currency"
  | "Country"
  | "Region"
  | "Store"
  | "Warehouse"
  | "Employee"
  | "Department"
  | "Expense"
  | "Date"
  | "Time"
  | "Email"
  | "Phone"
  | "Website"
  | "Latitude"
  | "Longitude"
  | "City"
  | "Postal Code"
  | "Status"
  | "Boolean Flag"
  | "Unknown";

export type SemanticEvidenceType =
  | "dictionary"
  | "header-similarity"
  | "value-similarity"
  | "data-type"
  | "neighbor-column"
  | "frequency"
  | "business-pattern"
  | "statistical-profile";

export interface SemanticDictionaryAlias {
  term: string;
  weight: number;
  language: string;
  industries: string[];
}

export interface SemanticDictionaryEntry {
  category: Exclude<SemanticCategory, "Unknown">;
  aliases: SemanticDictionaryAlias[];
  expectedDataTypes: StructureDataType[];
  valuePatterns: Array<{ id: string; pattern: string; weight: number; reason: string }>;
  neighborCategories: SemanticCategory[];
  statisticalHints: Array<{ id: string; weight: number; reason: string }>;
}

export interface SemanticDictionary {
  version: "edie.semantic-dictionary.v1";
  languages: string[];
  entries: SemanticDictionaryEntry[];
}

export interface SemanticEvidence {
  type: SemanticEvidenceType;
  score: number;
  weight: number;
  reason: string;
  source: string;
}

export interface SemanticAlternative {
  category: SemanticCategory;
  confidence: number;
  reason: string;
}

export interface SemanticColumnProfile {
  columnName: string;
  position: number;
  worksheetName: string;
  semanticCategory: SemanticCategory;
  confidence: number;
  reason: string;
  aliases: string[];
  needsReview: boolean;
  alternativeMatches: SemanticAlternative[];
  evidence: SemanticEvidence[];
  dictionaryHits: string[];
  detectedDataType: StructureDataType;
  warnings: string[];
}

export interface UnknownSemanticField {
  columnName: string;
  position: number;
  worksheetName: string;
  confidence: number;
  needsReview: true;
  potentialMatches: SemanticAlternative[];
  evidence: SemanticEvidence[];
}

export interface SemanticScannerLog {
  columnName: string;
  worksheetName: string;
  detectedSemanticCategory: SemanticCategory;
  confidence: number;
  evidence: SemanticEvidence[];
  dictionaryHits: string[];
  unknown: boolean;
  executionTime: string;
  warnings: string[];
  errors: string[];
}

export interface SemanticDatasetProfile {
  version: "edie.semantic.v1";
  dictionaryVersion: SemanticDictionary["version"];
  structureFingerprint: string;
  generatedAt: string;
  semanticColumns: SemanticColumnProfile[];
  unknownFields: UnknownSemanticField[];
  warnings: string[];
  errors: string[];
  dictionaryHits: Array<{
    columnName: string;
    category: SemanticCategory;
    alias: string;
    language: string;
    weight: number;
  }>;
  evidence: Record<string, SemanticEvidence[]>;
  coveragePercent: number;
  qualityScore: number;
  confidence: number;
  cache: {
    key: string;
    hit: boolean;
  };
  logs: SemanticScannerLog[];
}

export interface SemanticScannerInput {
  structureProfile: DatasetStructureProfile;
  dictionary?: SemanticDictionary;
  minimumConfidence?: number;
}
