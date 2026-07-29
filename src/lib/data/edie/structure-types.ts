export type DatasetPhysicalSourceType = "csv" | "excel" | "pdf" | "image" | "sql" | "snowflake" | "api" | "unknown";

export type StructureDataType =
  | "Text"
  | "Integer"
  | "Decimal"
  | "Currency"
  | "Boolean"
  | "Date"
  | "DateTime"
  | "Time"
  | "Email"
  | "Phone"
  | "UUID"
  | "URL"
  | "Percentage"
  | "JSON"
  | "Unknown"
  | "Mixed";

export interface DetectionConfidence<T> {
  value: T;
  confidence: number;
  warnings: string[];
  errors: string[];
}

export interface StructureDetectionLog {
  step: string;
  status: "started" | "finished";
  startedAt: string;
  finishedAt?: string;
  duration: number;
  confidence: number;
  warnings: string[];
  errors: string[];
}

export interface DatasetStructureMetadata {
  datasetId: string | null;
  fileHash: string;
  fingerprint: string;
  created: string | null;
  imported: string;
  source: DatasetPhysicalSourceType;
  encoding: DetectionConfidence<string>;
  language: DetectionConfidence<string>;
  timezone: DetectionConfidence<string>;
  size: number;
  rows: number;
  columns: number;
  checksum: string;
  fileName: string | null;
  mimeType: string | null;
  futureSources: DatasetPhysicalSourceType[];
}

export interface DatasetColumnProfile {
  name: string;
  position: number;
  detectedDataType: DetectionConfidence<StructureDataType>;
  missingPercent: number;
  uniquePercent: number;
  nullPercent: number;
  sampleValues: unknown[];
  exampleValues: unknown[];
  maximumLength: number;
  minimumLength: number;
  potentialProblems: string[];
}

export interface DatasetRegionProfile {
  headerRow: DetectionConfidence<number>;
  firstDataRow: DetectionConfidence<number>;
  lastDataRow: DetectionConfidence<number>;
  footerRows: DetectionConfidence<number[]>;
  dataRegion: DetectionConfidence<{
    rowStart: number;
    rowEnd: number;
    columnStart: number;
    columnEnd: number;
  }>;
}

export interface WorksheetStructureProfile {
  name: string;
  index: number;
  rowCount: number;
  columnCount: number;
  dataDensity: number;
  confidence: number;
  healthScore: number;
  duplicateColumns: string[];
  duplicateRows: number;
  mergedCells: Array<{ rowStart: number; rowEnd: number; columnStart: number; columnEnd: number }>;
  hiddenRows: number[];
  hiddenColumns: number[];
  emptyRows: number[];
  emptyColumns: number[];
  sparseRegions: Array<{ rowStart: number; rowEnd: number; columnStart: number; columnEnd: number; density: number }>;
  comments: Array<{ row: number; column: number; text: string }>;
  formulas: Array<{ row: number; column: number; formula: string }>;
  region: DatasetRegionProfile;
  columns: DatasetColumnProfile[];
  warnings: string[];
  errors: string[];
}

export interface DatasetHealthReport {
  missingValues: number;
  duplicateRows: number;
  duplicateColumns: string[];
  invalidEncoding: boolean;
  mixedDataTypes: string[];
  brokenDates: string[];
  unexpectedNullRatios: string[];
  sparseData: boolean;
  outlierColumns: string[];
  qualityScore: number;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

export interface DatasetStructureProfile {
  version: "edie.structure.v1";
  metadata: DatasetStructureMetadata;
  worksheets: WorksheetStructureProfile[];
  columns: DatasetColumnProfile[];
  types: Record<string, DetectionConfidence<StructureDataType>>;
  health: DatasetHealthReport;
  quality: {
    score: number;
    grade: "excellent" | "good" | "fair" | "poor";
  };
  fingerprint: string;
  warnings: string[];
  errors: string[];
  confidence: number;
  detectionLog: StructureDetectionLog[];
}
