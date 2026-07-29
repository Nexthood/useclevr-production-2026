import assert from "node:assert/strict";

import {
  DatasetAnalysisPipeline,
  ScannerRegistry,
  createPipelineContext,
  type AnalysisResult,
  type PipelineContext,
  type Scanner,
  type ScannerExecutionOptions,
  type StructuredPipelineEvent,
} from "../../src/lib/data/edie";

class TestScanner implements Scanner {
  constructor(
    private readonly scannerId: string,
    private readonly scannerPriority: number,
    private readonly behavior: {
      confidence?: number;
      duration?: number;
      fail?: boolean;
      supports?: boolean;
      warning?: string;
      onExecute?: (context: PipelineContext, options: ScannerExecutionOptions) => void;
    } = {},
  ) {}

  id(): string {
    return this.scannerId;
  }

  name(): string {
    return `Scanner ${this.scannerId}`;
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return this.scannerPriority;
  }

  supports(): boolean {
    return this.behavior.supports ?? true;
  }

  validate() {
    return { valid: true, warnings: [], errors: [] };
  }

  execute(context: PipelineContext, options: ScannerExecutionOptions): AnalysisResult {
    this.behavior.onExecute?.(context, options);

    if (this.behavior.fail) {
      throw new Error(`Scanner ${this.scannerId} failed`);
    }

    return {
      scannerId: this.scannerId,
      status: "completed",
      confidence: this.behavior.confidence ?? 0.9,
      duration: this.behavior.duration ?? 7,
      warnings: this.behavior.warning ? [this.behavior.warning] : [],
      errors: [],
      metadata: { scannerId: this.scannerId },
      executionTime: new Date().toISOString(),
      scannerVersion: "1.0.0",
      contextPatch: {
        metadata: { [this.scannerId]: "complete" },
        confidence: { [this.scannerId]: this.behavior.confidence ?? 0.9 },
        warnings: this.behavior.warning ? [this.behavior.warning] : [],
      },
    };
  }
}

class CancellingScanner extends TestScanner {
  constructor(private readonly getPipeline: () => DatasetAnalysisPipeline) {
    super("cancel", 20);
  }

  execute(context: PipelineContext, options: ScannerExecutionOptions): AnalysisResult {
    this.getPipeline().cancel();
    assert.equal(options.signal.aborted, true);

    return {
      scannerId: this.id(),
      status: "cancelled",
      confidence: 0,
      duration: 1,
      warnings: [],
      errors: ["Cancelled during scanner execution."],
      metadata: {},
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
    };
  }
}

async function testRegistryOperations() {
  const registry = new ScannerRegistry();
  const second = new TestScanner("second", 20);
  const first = new TestScanner("first", 10);

  registry.register(second);
  registry.register(first);

  assert.equal(registry.get("first"), first);
  assert.deepEqual(registry.sort().map((scanner) => scanner.id()), ["first", "second"]);
  assert.throws(() => registry.register(first), /already registered/);
  assert.equal(registry.unregister("first"), true);
  assert.equal(registry.get("first"), undefined);
}

async function testPipelineExecutionOrderAndReport() {
  const executionOrder: string[] = [];
  const logs: StructuredPipelineEvent[] = [];
  const context = createPipelineContext({ id: "dataset_1", rowCount: 3, columnCount: 2 });
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "pipeline_order_test",
    context,
    scanners: [
      new TestScanner("third", 30, { onExecute: () => executionOrder.push("third"), confidence: 0.6 }),
      new TestScanner("first", 10, { onExecute: () => executionOrder.push("first"), confidence: 0.8 }),
      new TestScanner("second", 20, { onExecute: () => executionOrder.push("second"), confidence: 1 }),
    ],
    logger: { log: (event) => logs.push(event) },
  });

  assert.equal(pipeline.getStatus(), "idle");
  assert.equal(pipeline.getProgress().percentage, 0);

  const result = await pipeline.run();

  assert.deepEqual(executionOrder, ["first", "second", "third"]);
  assert.equal(result.context.metadata.first, "complete");
  assert.equal(Object.isFrozen(result.context), true);
  assert.equal(pipeline.getStatus(), "completed");
  assert.equal(pipeline.getProgress().percentage, 100);
  assert.equal(result.report.failedScanners.length, 0);
  assert.equal(result.report.executedScanners.length, 3);
  assert.equal(result.report.confidenceSummary.averageConfidence, 0.8);
  assert.deepEqual(Object.keys(result.report.timings), ["first", "second", "third"]);
  assert.ok(logs.some((event) => event.event === "pipeline.started"));
  assert.ok(logs.some((event) => event.event === "scanner.started" && event.scannerId === "first"));
  assert.ok(logs.some((event) => event.event === "pipeline.completed"));
}

async function testFailedScannerRecoveryAndRetry() {
  const executionOrder: string[] = [];
  let shouldFail = true;
  const retryScanner = new TestScanner("retry", 20, {
    onExecute: () => {
      executionOrder.push("retry");

      if (shouldFail) {
        throw new Error("retry failed once");
      }
    },
  });
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "pipeline_recovery_test",
    context: createPipelineContext({ id: "dataset_2" }),
    scanners: [
      new TestScanner("before", 10, { onExecute: () => executionOrder.push("before") }),
      retryScanner,
      new TestScanner("after", 30, { onExecute: () => executionOrder.push("after") }),
    ],
  });

  const failedRun = await pipeline.run();

  assert.deepEqual(executionOrder, ["before", "retry", "after"]);
  assert.equal(failedRun.report.failedScanners.length, 1);
  assert.equal(failedRun.report.failedScanners[0].scannerId, "retry");
  assert.equal(failedRun.report.errors[0], "retry failed once");
  assert.equal(failedRun.report.status, "completed");

  shouldFail = false;
  const retryRun = await pipeline.retry();

  assert.equal(retryRun.report.failedScanners.length, 0);
  assert.equal(retryRun.report.executedScanners.find((record) => record.scannerId === "retry")?.attempt, 2);
}

async function testSkippedScannerAndWarnings() {
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "pipeline_skip_test",
    context: createPipelineContext({ id: "dataset_3" }),
    scanners: [
      new TestScanner("unsupported", 10, { supports: false }),
      new TestScanner("warning", 20, { warning: "Low source quality." }),
    ],
  });

  const result = await pipeline.run();

  assert.equal(result.report.skippedScanners.length, 1);
  assert.equal(result.report.skippedScanners[0].scannerId, "unsupported");
  assert.deepEqual(result.report.warnings, ["Low source quality."]);
  assert.ok(result.report.logs.every((event) => event.pipelineId === "pipeline_skip_test"));
}

async function testCancellationAndResume() {
  let resumablePipeline: DatasetAnalysisPipeline;
  resumablePipeline = new DatasetAnalysisPipeline({
    pipelineId: "pipeline_cancel_test",
    context: createPipelineContext({ id: "dataset_4" }),
    scanners: [
      new TestScanner("before", 10),
      new CancellingScanner(() => resumablePipeline),
      new TestScanner("after", 30),
    ],
  });

  const cancelledRun = await resumablePipeline.run();

  assert.equal(cancelledRun.report.status, "cancelled");
  assert.equal(cancelledRun.report.executedScanners.some((record) => record.status === "cancelled"), true);
  assert.ok(resumablePipeline.getProgress().percentage < 100);

  const resumedRun = await resumablePipeline.resume();

  assert.equal(resumedRun.report.status, "completed");
  assert.equal(resumedRun.report.executedScanners.some((record) => record.scannerId === "after" && record.status === "completed"), true);
}

async function main() {
  await testRegistryOperations();
  await testPipelineExecutionOrderAndReport();
  await testFailedScannerRecoveryAndRetry();
  await testSkippedScannerAndWarnings();
  await testCancellationAndResume();

  process.stdout.write("EDIE pipeline orchestration foundation tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
