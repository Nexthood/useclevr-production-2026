export type PipelineExecutionMode = "sequential" | "parallel-ready";

export type PipelineRunStatus = "idle" | "running" | "cancelling" | "cancelled" | "completed";

export type ScannerRunStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";

export type AnalysisResultStatus = "completed" | "failed" | "skipped" | "cancelled";

export type StructuredPipelineEventType =
  | "pipeline.started"
  | "pipeline.completed"
  | "pipeline.cancel.requested"
  | "pipeline.cancelled"
  | "pipeline.resume.started"
  | "pipeline.retry.started"
  | "scanner.started"
  | "scanner.finished"
  | "scanner.failed"
  | "scanner.skipped"
  | "scanner.cancelled";

export interface PipelineDatasetInput {
  id?: string;
  name?: string;
  fileName?: string;
  rowCount?: number;
  columnCount?: number;
  sourceType?: string;
  mimeType?: string;
  fileSize?: number;
  rawText?: string;
  rawBuffer?: Uint8Array | ArrayBuffer;
  importedAt?: string;
  createdAt?: string;
  rows?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  columns?: ReadonlyArray<string>;
}

export interface PipelineContext {
  dataset: Readonly<PipelineDatasetInput>;
  schema: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
  semanticMap: Readonly<Record<string, unknown>>;
  entities: ReadonlyArray<unknown>;
  relationships: ReadonlyArray<unknown>;
  businessModel: Readonly<Record<string, unknown>> | null;
  industry: Readonly<Record<string, unknown>> | null;
  kpis: ReadonlyArray<unknown>;
  warnings: ReadonlyArray<string>;
  confidence: Readonly<Record<string, number>>;
  executionLog: ReadonlyArray<StructuredPipelineEvent>;
}

export interface PipelineContextPatch {
  schema?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
  semanticMap?: Readonly<Record<string, unknown>>;
  entities?: ReadonlyArray<unknown>;
  relationships?: ReadonlyArray<unknown>;
  businessModel?: Readonly<Record<string, unknown>> | null;
  industry?: Readonly<Record<string, unknown>> | null;
  kpis?: ReadonlyArray<unknown>;
  warnings?: ReadonlyArray<string>;
  confidence?: Readonly<Record<string, number>>;
}

export interface ScannerValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface ScannerExecutionOptions {
  signal: AbortSignal;
  attempt: number;
}

export interface AnalysisResult {
  scannerId: string;
  status: AnalysisResultStatus;
  confidence: number;
  duration: number;
  warnings: string[];
  errors: string[];
  metadata: Readonly<Record<string, unknown>>;
  executionTime: string;
  scannerVersion: string;
  contextPatch?: PipelineContextPatch;
}

export interface Scanner {
  id(): string;
  name(): string;
  version(): string;
  priority(): number;
  supports(context: PipelineContext): boolean | Promise<boolean>;
  validate(context: PipelineContext): ScannerValidationResult | Promise<ScannerValidationResult>;
  execute(context: PipelineContext, options: ScannerExecutionOptions): AnalysisResult | Promise<AnalysisResult>;
}

export interface ScannerExecutionRecord {
  scannerId: string;
  scannerName: string;
  scannerVersion: string;
  status: ScannerRunStatus;
  priority: number;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  confidence?: number;
  warnings: string[];
  errors: string[];
  attempt: number;
}

export interface PipelineProgress {
  status: PipelineRunStatus;
  currentScannerId: string | null;
  currentScannerName: string | null;
  completedScanners: number;
  totalScanners: number;
  percentage: number;
  message: string;
}

export interface StructuredPipelineEvent {
  timestamp: string;
  pipelineId: string;
  event: StructuredPipelineEventType;
  scannerId?: string;
  scannerName?: string;
  scannerVersion?: string;
  duration?: number;
  confidence?: number;
  warnings?: string[];
  errors?: string[];
  metadata?: Readonly<Record<string, unknown>>;
}

export interface PipelineExecutionReport {
  pipelineId: string;
  status: PipelineRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  duration: number;
  executionMode: PipelineExecutionMode;
  executedScanners: ScannerExecutionRecord[];
  failedScanners: ScannerExecutionRecord[];
  skippedScanners: ScannerExecutionRecord[];
  warnings: string[];
  errors: string[];
  confidenceSummary: {
    averageConfidence: number;
    minConfidence: number;
    maxConfidence: number;
    scannerCount: number;
  };
  timings: Record<string, number>;
  logs: StructuredPipelineEvent[];
}

export interface PipelineRunResult {
  context: PipelineContext;
  results: AnalysisResult[];
  report: PipelineExecutionReport;
}

export interface PipelineLogger {
  log(event: StructuredPipelineEvent): void;
}

export interface DatasetAnalysisPipelineOptions {
  pipelineId?: string;
  context: PipelineContext;
  scanners?: Scanner[];
  registry?: ScannerRegistryLike;
  logger?: PipelineLogger;
  executionMode?: PipelineExecutionMode;
}

export interface ScannerRegistryLike {
  list(): Scanner[];
  sort(scanners?: Scanner[]): Scanner[];
}
