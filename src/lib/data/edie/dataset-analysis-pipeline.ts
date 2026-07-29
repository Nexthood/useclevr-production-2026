import { ScannerRegistry } from "./scanner-registry";
import type {
  AnalysisResult,
  DatasetAnalysisPipelineOptions,
  PipelineContext,
  PipelineContextPatch,
  PipelineExecutionMode,
  PipelineExecutionReport,
  PipelineLogger,
  PipelineProgress,
  PipelineRunResult,
  PipelineRunStatus,
  Scanner,
  ScannerExecutionRecord,
  ScannerRunStatus,
  StructuredPipelineEvent,
  StructuredPipelineEventType,
} from "./types";

const emptyConfidenceSummary = {
  averageConfidence: 0,
  minConfidence: 0,
  maxConfidence: 0,
  scannerCount: 0,
};

export class DatasetAnalysisPipeline {
  private readonly pipelineId: string;
  private readonly registry: ScannerRegistry;
  private readonly logger?: PipelineLogger;
  private readonly executionMode: PipelineExecutionMode;
  private context: PipelineContext;
  private status: PipelineRunStatus = "idle";
  private currentScannerId: string | null = null;
  private currentScannerName: string | null = null;
  private startedAt: string | null = null;
  private completedAt: string | null = null;
  private runStartedAtMs: number | null = null;
  private abortController: AbortController | null = null;
  private readonly results = new Map<string, AnalysisResult>();
  private readonly records = new Map<string, ScannerExecutionRecord>();
  private readonly logs: StructuredPipelineEvent[] = [];

  constructor(options: DatasetAnalysisPipelineOptions) {
    this.pipelineId = options.pipelineId ?? createPipelineId();
    this.registry = options.registry
      ? new ScannerRegistry(options.registry.list())
      : new ScannerRegistry(options.scanners ?? []);
    this.logger = options.logger;
    this.executionMode = options.executionMode ?? "sequential";
    this.context = freezePipelineContext(options.context);
  }

  async run(): Promise<PipelineRunResult> {
    this.prepareRun("pipeline.started", "running");

    await this.executePendingScanners();

    if (this.status !== "cancelled") {
      this.finishRun("pipeline.completed", "completed");
    }

    return this.buildRunResult();
  }

  cancel(): void {
    if (this.status !== "running") {
      return;
    }

    this.status = "cancelling";
    this.logEvent("pipeline.cancel.requested");
    this.abortController?.abort();
  }

  async resume(): Promise<PipelineRunResult> {
    if (this.status !== "cancelled") {
      return this.buildRunResult();
    }

    this.prepareRun("pipeline.resume.started", "running", false);
    await this.executePendingScanners();

    if (this.status !== "cancelled") {
      this.finishRun("pipeline.completed", "completed");
    }

    return this.buildRunResult();
  }

  async retry(scannerIds?: string[]): Promise<PipelineRunResult> {
    const failedScannerIds = scannerIds ?? this.getExecutionReport().failedScanners.map((record) => record.scannerId);

    if (failedScannerIds.length === 0) {
      return this.buildRunResult();
    }

    for (const scannerId of failedScannerIds) {
      this.results.delete(scannerId);
      const existingRecord = this.records.get(scannerId);

      if (existingRecord) {
        this.records.set(scannerId, {
          ...existingRecord,
          status: "pending",
          startedAt: undefined,
          finishedAt: undefined,
          duration: undefined,
          confidence: undefined,
          warnings: [],
          errors: [],
          attempt: existingRecord.attempt + 1,
        });
      }
    }

    this.prepareRun("pipeline.retry.started", "running", false);
    await this.executePendingScanners(failedScannerIds);

    if (this.status !== "cancelled") {
      this.finishRun("pipeline.completed", "completed");
    }

    return this.buildRunResult();
  }

  getStatus(): PipelineRunStatus {
    return this.status;
  }

  getProgress(): PipelineProgress {
    const runnableScanners = this.getRunnableScanners();
    const completedScanners = this.getTerminalScannerCount();
    const totalScanners = runnableScanners.length;
    const percentage = totalScanners === 0 ? (this.status === "completed" ? 100 : 0) : Math.round((completedScanners / totalScanners) * 100);

    return {
      status: this.status,
      currentScannerId: this.currentScannerId,
      currentScannerName: this.currentScannerName,
      completedScanners,
      totalScanners,
      percentage,
      message: this.getProgressMessage(completedScanners, totalScanners),
    };
  }

  getExecutionReport(): PipelineExecutionReport {
    const records = Array.from(this.records.values());
    const failedScanners = records.filter((record) => record.status === "failed");
    const skippedScanners = records.filter((record) => record.status === "skipped");
    const completedRecords = records.filter((record) => record.status === "completed" && typeof record.confidence === "number");
    const confidenceValues = completedRecords.map((record) => record.confidence ?? 0);
    const warnings = records.flatMap((record) => record.warnings);
    const errors = records.flatMap((record) => record.errors);
    const timings = Object.fromEntries(records.filter((record) => typeof record.duration === "number").map((record) => [record.scannerId, record.duration ?? 0]));

    return {
      pipelineId: this.pipelineId,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.getPipelineDuration(),
      executionMode: this.executionMode,
      executedScanners: records,
      failedScanners,
      skippedScanners,
      warnings,
      errors,
      confidenceSummary: buildConfidenceSummary(confidenceValues),
      timings,
      logs: [...this.logs],
    };
  }

  private async executePendingScanners(allowedScannerIds?: string[]): Promise<void> {
    const allowed = allowedScannerIds ? new Set(allowedScannerIds) : null;
    const scanners = this.getRunnableScanners().filter((scanner) => !allowed || allowed.has(scanner.id()));

    for (const scanner of scanners) {
      if (this.status === "cancelling" || this.abortController?.signal.aborted) {
        this.markPipelineCancelled();
        break;
      }

      if (this.results.has(scanner.id())) {
        continue;
      }

      await this.executeScanner(scanner);
    }
  }

  private async executeScanner(scanner: Scanner): Promise<void> {
    const scannerId = scanner.id();
    const scannerName = scanner.name();
    const scannerVersion = scanner.version();
    const attempt = this.records.get(scannerId)?.attempt ?? 1;
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();

    this.currentScannerId = scannerId;
    this.currentScannerName = scannerName;
    this.records.set(scannerId, {
      scannerId,
      scannerName,
      scannerVersion,
      status: "running",
      priority: scanner.priority(),
      startedAt,
      warnings: [],
      errors: [],
      attempt,
    });
    this.logEvent("scanner.started", scanner);

    try {
      const supported = await scanner.supports(this.context);

      if (!supported) {
        this.recordScannerResult(scanner, {
          scannerId,
          status: "skipped",
          confidence: 0,
          duration: Date.now() - startedAtMs,
          warnings: [],
          errors: [],
          metadata: { reason: "Scanner does not support the current pipeline context." },
          executionTime: new Date().toISOString(),
          scannerVersion,
        });
        return;
      }

      const validation = await scanner.validate(this.context);

      if (!validation.valid) {
        this.recordScannerResult(scanner, {
          scannerId,
          status: "failed",
          confidence: 0,
          duration: Date.now() - startedAtMs,
          warnings: validation.warnings,
          errors: validation.errors.length > 0 ? validation.errors : ["Scanner validation failed."],
          metadata: { phase: "validate" },
          executionTime: new Date().toISOString(),
          scannerVersion,
        });
        return;
      }

      const result = await scanner.execute(this.context, {
        signal: this.abortController?.signal ?? new AbortController().signal,
        attempt,
      });

      if (this.abortController?.signal.aborted) {
        this.recordScannerResult(scanner, {
          ...normalizeAnalysisResult(result, scanner),
          status: "cancelled",
          duration: Date.now() - startedAtMs,
          executionTime: new Date().toISOString(),
        });
        this.status = "cancelled";
        this.logEvent("pipeline.cancelled");
        return;
      }

      this.recordScannerResult(scanner, normalizeAnalysisResult(result, scanner));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scanner failed with an unknown error.";

      if (this.abortController?.signal.aborted) {
        this.recordScannerResult(scanner, {
          scannerId,
          status: "cancelled",
          confidence: 0,
          duration: Date.now() - startedAtMs,
          warnings: [],
          errors: [message],
          metadata: { phase: "execute" },
          executionTime: new Date().toISOString(),
          scannerVersion,
        });
        this.status = "cancelled";
        this.logEvent("pipeline.cancelled");
        return;
      }

      this.recordScannerResult(scanner, {
        scannerId,
        status: "failed",
        confidence: 0,
        duration: Date.now() - startedAtMs,
        warnings: [],
        errors: [message],
        metadata: { phase: "execute" },
        executionTime: new Date().toISOString(),
        scannerVersion,
      });
    } finally {
      this.currentScannerId = null;
      this.currentScannerName = null;
    }
  }

  private recordScannerResult(scanner: Scanner, result: AnalysisResult): void {
    const scannerId = scanner.id();
    const finishedAt = new Date().toISOString();
    const eventType = getScannerEventType(result.status);
    const existingRecord = this.records.get(scannerId);

    this.results.set(scannerId, result);
    this.records.set(scannerId, {
      scannerId,
      scannerName: scanner.name(),
      scannerVersion: scanner.version(),
      status: result.status,
      priority: scanner.priority(),
      startedAt: existingRecord?.startedAt,
      finishedAt,
      duration: result.duration,
      confidence: result.confidence,
      warnings: result.warnings,
      errors: result.errors,
      attempt: existingRecord?.attempt ?? 1,
    });

    if (result.contextPatch && result.status === "completed") {
      this.context = mergeContext(this.context, result.contextPatch);
    }

    this.logEvent(eventType, scanner, {
      duration: result.duration,
      confidence: result.confidence,
      warnings: result.warnings,
      errors: result.errors,
      metadata: result.metadata,
    });
  }

  private prepareRun(event: StructuredPipelineEventType, status: PipelineRunStatus, resetTime = true): void {
    if (resetTime || !this.startedAt) {
      this.startedAt = new Date().toISOString();
      this.runStartedAtMs = Date.now();
    }

    this.completedAt = null;
    this.abortController = new AbortController();
    this.status = status;
    this.logEvent(event);
  }

  private finishRun(event: StructuredPipelineEventType, status: PipelineRunStatus): void {
    this.status = status;
    this.completedAt = new Date().toISOString();
    this.abortController = null;
    this.logEvent(event, undefined, {
      duration: this.getPipelineDuration(),
      warnings: this.getExecutionReport().warnings,
      errors: this.getExecutionReport().errors,
    });
  }

  private markPipelineCancelled(): void {
    const wasCancelled = this.status === "cancelled";

    this.status = "cancelled";

    if (!wasCancelled) {
      this.logEvent("pipeline.cancelled");
    }
  }

  private getRunnableScanners(): Scanner[] {
    return this.registry.sort(this.registry.list());
  }

  private getTerminalScannerCount(): number {
    return Array.from(this.records.values()).filter((record) => isTerminalScannerStatus(record.status)).length;
  }

  private getPipelineDuration(): number {
    if (!this.runStartedAtMs) {
      return 0;
    }

    if (this.completedAt) {
      return Math.max(0, new Date(this.completedAt).getTime() - new Date(this.startedAt ?? this.completedAt).getTime());
    }

    return Date.now() - this.runStartedAtMs;
  }

  private getProgressMessage(completedScanners: number, totalScanners: number): string {
    if (this.status === "idle") {
      return "Initializing...";
    }

    if (this.status === "running" && this.currentScannerName) {
      return `Running ${this.currentScannerName}...`;
    }

    if (this.status === "cancelled") {
      return "Cancelled.";
    }

    if (this.status === "completed") {
      return "Completed.";
    }

    return `${completedScanners} of ${totalScanners} scanners completed.`;
  }

  private buildRunResult(): PipelineRunResult {
    return {
      context: this.context,
      results: Array.from(this.results.values()),
      report: this.getExecutionReport(),
    };
  }

  private logEvent(event: StructuredPipelineEventType, scanner?: Scanner, details: Partial<StructuredPipelineEvent> = {}): void {
    const entry: StructuredPipelineEvent = {
      timestamp: new Date().toISOString(),
      pipelineId: this.pipelineId,
      event,
      scannerId: scanner?.id(),
      scannerName: scanner?.name(),
      scannerVersion: scanner?.version(),
      ...details,
    };

    this.logs.push(entry);
    this.context = freezePipelineContext({
      ...this.context,
      executionLog: [...this.context.executionLog, entry],
    });
    this.logger?.log(entry);
  }
}

export function createPipelineContext(dataset: PipelineContext["dataset"]): PipelineContext {
  return freezePipelineContext({
    dataset,
    schema: {},
    metadata: {},
    semanticMap: {},
    entities: [],
    relationships: [],
    businessModel: null,
    industry: null,
    kpis: [],
    warnings: [],
    confidence: {},
    executionLog: [],
  });
}

function normalizeAnalysisResult(result: AnalysisResult, scanner: Scanner): AnalysisResult {
  return {
    scannerId: result.scannerId || scanner.id(),
    status: result.status,
    confidence: clampConfidence(result.confidence),
    duration: Math.max(0, result.duration),
    warnings: [...result.warnings],
    errors: [...result.errors],
    metadata: Object.freeze({ ...result.metadata }),
    executionTime: result.executionTime || new Date().toISOString(),
    scannerVersion: result.scannerVersion || scanner.version(),
    contextPatch: result.contextPatch,
  };
}

function mergeContext(context: PipelineContext, patch: PipelineContextPatch): PipelineContext {
  return freezePipelineContext({
    ...context,
    schema: patch.schema ? { ...context.schema, ...patch.schema } : context.schema,
    metadata: patch.metadata ? { ...context.metadata, ...patch.metadata } : context.metadata,
    semanticMap: patch.semanticMap ? { ...context.semanticMap, ...patch.semanticMap } : context.semanticMap,
    entities: patch.entities ? [...context.entities, ...patch.entities] : context.entities,
    relationships: patch.relationships ? [...context.relationships, ...patch.relationships] : context.relationships,
    businessModel: patch.businessModel === undefined ? context.businessModel : patch.businessModel,
    industry: patch.industry === undefined ? context.industry : patch.industry,
    kpis: patch.kpis ? [...context.kpis, ...patch.kpis] : context.kpis,
    warnings: patch.warnings ? [...context.warnings, ...patch.warnings] : context.warnings,
    confidence: patch.confidence ? { ...context.confidence, ...patch.confidence } : context.confidence,
  });
}

function freezePipelineContext(context: PipelineContext): PipelineContext {
  return Object.freeze({
    ...context,
    dataset: Object.freeze({ ...context.dataset }),
    schema: Object.freeze({ ...context.schema }),
    metadata: Object.freeze({ ...context.metadata }),
    semanticMap: Object.freeze({ ...context.semanticMap }),
    entities: Object.freeze([...context.entities]),
    relationships: Object.freeze([...context.relationships]),
    businessModel: context.businessModel ? Object.freeze({ ...context.businessModel }) : null,
    industry: context.industry ? Object.freeze({ ...context.industry }) : null,
    kpis: Object.freeze([...context.kpis]),
    warnings: Object.freeze([...context.warnings]),
    confidence: Object.freeze({ ...context.confidence }),
    executionLog: Object.freeze([...context.executionLog]),
  });
}

function getScannerEventType(status: AnalysisResult["status"]): StructuredPipelineEventType {
  if (status === "failed") {
    return "scanner.failed";
  }

  if (status === "skipped") {
    return "scanner.skipped";
  }

  if (status === "cancelled") {
    return "scanner.cancelled";
  }

  return "scanner.finished";
}

function isTerminalScannerStatus(status: ScannerRunStatus): boolean {
  return status === "completed" || status === "failed" || status === "skipped" || status === "cancelled";
}

function buildConfidenceSummary(values: number[]): PipelineExecutionReport["confidenceSummary"] {
  if (values.length === 0) {
    return emptyConfidenceSummary;
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    averageConfidence: roundConfidence(total / values.length),
    minConfidence: roundConfidence(Math.min(...values)),
    maxConfidence: roundConfidence(Math.max(...values)),
    scannerCount: values.length,
  };
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return roundConfidence(Math.min(1, Math.max(0, value)));
}

function roundConfidence(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function createPipelineId(): string {
  return `edie_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
