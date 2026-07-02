import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";

import {
  generateWithUniversalAiAdapter,
  getAiMode,
  isLocalAiUnavailableError,
  logDefaultCloudFallback,
  logUniversalAiResponse,
} from "@/lib/ai/universal-ai-adapter";
import { auditInputFromAdapterResult, recordAiRequestAudit } from "@/lib/ai/ai-request-audit";
import { detectBusinessColumns } from "@/lib/business/business-columns";
import { detectDatasetTypeFromColumns } from "@/lib/data/dataset-intelligence";
import { db } from "@/lib/db";
import { datasetRows, datasets } from "@/lib/db/schema";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HybridProviderStatus = {
  label: string;
  state: "connection_healthy" | "fallback_active" | "provider_unavailable" | "offline_active" | "local_unavailable";
  message: string;
  fallbackActive: boolean;
  route: "local" | "cloud" | "none";
};

type DatasetContextSummary = {
  dataset: {
    id: string;
    name: string;
    rowCount: number;
    columnCount: number;
    columns: string[];
    datasetType: string;
  };
  sample: {
    rowsAnalyzed: number;
    sampleRowsSent: number;
    fullDatasetSent: false;
  };
  detectedColumns: Record<string, unknown>;
  columnProfiles: Array<{
    name: string;
    type: string;
    nonEmpty: number;
    missing: number;
    unique: number;
    sum?: number;
    average?: number;
    min?: number;
    max?: number;
    sampleValues: string[];
  }>;
  kpis: Record<string, unknown>;
  topGroups: Array<{
    dimension: string;
    metric: string;
    rows: Array<{ label: string; value: number; count: number }>;
  }>;
  sampleRows: Record<string, unknown>[];
};

const MAX_PROFILE_ROWS = 1000;
const MAX_SAMPLE_ROWS_SENT = 8;
const MAX_COLUMNS_IN_CONTEXT = 30;

const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]).default("user"),
  content: z.string().min(1),
});

const datasetChatSchema = z.object({
  datasetId: z.string().min(1),
  message: z.string().optional(),
  messages: z.array(chatMessageSchema).optional(),
});

export async function GET() {
  const gate = await requireHybridAiFeature("datasetAwareChat");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      rowCount: datasets.rowCount,
      columnCount: datasets.columnCount,
      columns: datasets.columns,
      createdAt: datasets.createdAt,
    })
    .from(datasets)
    .where(eq(datasets.userId, userId))
    .orderBy(desc(datasets.createdAt));

  return NextResponse.json({
    success: true,
    datasets: rows.map((dataset) => ({
      ...dataset,
      columns: Array.isArray(dataset.columns) ? dataset.columns : [],
      createdAt: dataset.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireHybridAiFeature("datasetAwareChat");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof datasetChatSchema>;
  try {
    parsed = datasetChatSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: "Select a dataset and send a question." }, { status: 400 });
  }

  const messages = normalizeMessages(parsed);
  if (messages.length === 0) {
    return NextResponse.json({ success: false, error: "Send a dataset question to Hybrid AI." }, { status: 400 });
  }

  const dataset = await db.query.datasets.findFirst({
    where: and(eq(datasets.id, parsed.datasetId), eq(datasets.userId, userId)),
    columns: {
      id: true,
      name: true,
      rowCount: true,
      columnCount: true,
      columns: true,
      data: true,
      precomputedMetrics: true,
      detectedColumns: true,
      analysis: true,
    },
  });

  if (!dataset) {
    return NextResponse.json({ success: false, error: "Dataset not found." }, { status: 404 });
  }

  const storedRows = await db.query.datasetRows.findMany({
    where: eq(datasetRows.datasetId, parsed.datasetId),
    columns: { data: true },
    orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
    limit: MAX_PROFILE_ROWS,
  });

  const profileRows = normalizeRows(
    storedRows.length > 0 ? storedRows.map((row) => row.data) : Array.isArray(dataset.data) ? dataset.data.slice(0, MAX_PROFILE_ROWS) : [],
  );
  const columns = normalizeColumns(dataset.columns, profileRows);
  const context = buildDatasetContext({
    id: dataset.id,
    name: dataset.name,
    rowCount: dataset.rowCount || profileRows.length,
    columnCount: dataset.columnCount || columns.length,
    columns,
    rows: profileRows,
    detectedColumns: dataset.detectedColumns,
    precomputedMetrics: dataset.precomputedMetrics,
    analysis: dataset.analysis,
  });
  const prompt = buildDatasetChatPrompt(messages, context);
  const aiMode = await getAiMode(userId);
  let userProviderFailed = false;

  try {
    const result = await generateWithUniversalAiAdapter(userId, prompt, { mode: aiMode });
    if (result) {
      logUniversalAiResponse(result);
      recordAiRequestAudit(auditInputFromAdapterResult(userId, result, "dataset_analysis", parsed.datasetId));
      debugLog("[HYBRID_AI_DATASET_CHAT] User provider response generated", {
        userId,
        datasetId: parsed.datasetId,
        providerName: result.providerName,
        providerType: result.providerType,
        modelName: result.modelName,
        fallbackUsed: result.fallbackUsed,
        mode: result.mode,
        route: result.route,
      });

      return NextResponse.json({
        success: true,
        answer: result.text,
        content: result.text,
        providerName: result.providerName,
        modelName: result.modelName,
        mode: result.mode,
        route: result.route,
        datasetContext: contextForClient(context),
        privacyWarning: result.route === "cloud" && result.fallbackUsed
          ? "Cloud fallback is active. UseClevr sent summarized dataset context, not the full dataset."
          : null,
        providerStatus: providerStatusFromAdapterResult(
          result.providerType,
          result.providerName,
          result.fallbackUsed,
          result.mode,
          result.route,
        ),
      });
    }
  } catch (error) {
    if (isLocalAiUnavailableError(error)) {
      const message = "Offline mode is enabled, but your local AI provider is not reachable.";
      recordAiRequestAudit({
        userId,
        datasetId: parsed.datasetId,
        providerName: "Offline mode",
        providerType: "offline-mode",
        modelName: "none",
        mode: aiMode,
        executionLocation: "none",
        fallbackUsed: false,
        purpose: "dataset_analysis",
        success: false,
        errorReason: error instanceof Error ? error.message : String(error),
      });
      debugWarn("[HYBRID_AI_DATASET_CHAT] Offline mode blocked cloud fallback", {
        userId,
        datasetId: parsed.datasetId,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({
        success: false,
        error: message,
        answer: message,
        content: message,
        providerName: "Offline mode",
        modelName: "",
        mode: "local-only",
        route: "none",
        datasetContext: contextForClient(context),
        privacyWarning: null,
        providerStatus: {
          label: "Offline mode",
          state: "local_unavailable",
          message: "Local provider unavailable",
          fallbackActive: false,
          route: "none",
        } satisfies HybridProviderStatus,
      }, { status: 503 });
    }

    logDefaultCloudFallback(userId, error);
    userProviderFailed = true;
    debugWarn("[HYBRID_AI_DATASET_CHAT] User provider failed; trying default cloud AI", {
      userId,
      datasetId: parsed.datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });
    const answer = text.trim();
    if (!answer) throw new Error("Default cloud AI returned an empty response.");
    recordAiRequestAudit({
      userId,
      datasetId: parsed.datasetId,
      providerName: "UseClevr Cloud Analysis",
      providerType: "default-cloud",
      modelName: "gemini-2.5-flash",
      mode: aiMode,
      executionLocation: "cloud",
      fallbackUsed: userProviderFailed,
      purpose: "dataset_analysis",
      success: true,
    });

    return NextResponse.json({
      success: true,
      answer,
      content: answer,
      providerName: "UseClevr Cloud Analysis",
      modelName: "gemini-2.5-flash",
      mode: "auto",
      route: "cloud",
      datasetContext: contextForClient(context),
      privacyWarning: "Cloud fallback is active. UseClevr sent summarized dataset context, not the full dataset.",
      providerStatus: {
        label: "UseClevr Cloud Analysis",
        state: "fallback_active",
        message: "Cloud fallback active",
        fallbackActive: true,
        route: "cloud",
      } satisfies HybridProviderStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hybrid AI dataset chat failed.";
    recordAiRequestAudit({
      userId,
      datasetId: parsed.datasetId,
      providerName: "UseClevr Cloud Analysis",
      providerType: "default-cloud",
      modelName: "gemini-2.5-flash",
      mode: aiMode,
      executionLocation: "cloud",
      fallbackUsed: userProviderFailed,
      purpose: "dataset_analysis",
      success: false,
      errorReason: message,
    });
    debugError("[HYBRID_AI_DATASET_CHAT] Default cloud AI failed", { userId, datasetId: parsed.datasetId, message });
    return NextResponse.json({
      success: false,
      error: message,
      datasetContext: contextForClient(context),
      privacyWarning: null,
      providerStatus: {
        label: "Hybrid AI",
        state: "provider_unavailable",
        message: "Provider unavailable",
        fallbackActive: false,
        route: "none",
      } satisfies HybridProviderStatus,
    }, { status: 500 });
  }
}

function normalizeMessages(input: z.infer<typeof datasetChatSchema>) {
  if (Array.isArray(input.messages) && input.messages.length > 0) return input.messages;
  const message = input.message?.trim();
  return message ? [{ role: "user" as const, content: message }] : [];
}

function buildDatasetChatPrompt(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  context: DatasetContextSummary,
) {
  const transcript = messages
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.content.trim()}`)
    .join("\n\n");

  return [
    "You are UseClevr Hybrid AI, a dataset-aware business analyst.",
    "Answer only from the dataset context below. Do not invent rows, totals, products, customers, or dates.",
    "Use backend-derived KPIs and grouped summaries as the source of truth. If a metric is sample-based, say that clearly.",
    "For risks, best performers, and next actions, cite the columns or KPI extracts that support the answer.",
    "Do not ask for the full dataset unless the provided summary cannot answer the question.",
    "",
    "SAFE DATASET CONTEXT",
    JSON.stringify(context, null, 2),
    "",
    "CHAT",
    transcript,
    "",
    "ASSISTANT:",
  ].join("\n");
}

function buildDatasetContext(input: {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
  detectedColumns: unknown;
  precomputedMetrics: unknown;
  analysis: unknown;
}): DatasetContextSummary {
  const columns = input.columns.slice(0, MAX_COLUMNS_IN_CONTEXT);
  const detectedColumns = normalizeRecord(input.detectedColumns) ?? detectBusinessColumns(input.rows);
  const datasetType = detectDatasetTypeFromColumns(columns, input.name);
  const columnProfiles = columns.map((column) => profileColumn(column, input.rows));
  const kpis = buildKpiExtract(input.rows, columns, input.precomputedMetrics, input.analysis);
  const topGroups = buildTopGroups(input.rows, columns);

  return {
    dataset: {
      id: input.id,
      name: input.name,
      rowCount: input.rowCount,
      columnCount: input.columnCount,
      columns,
      datasetType,
    },
    sample: {
      rowsAnalyzed: input.rows.length,
      sampleRowsSent: Math.min(input.rows.length, MAX_SAMPLE_ROWS_SENT),
      fullDatasetSent: false,
    },
    detectedColumns: normalizeRecord(detectedColumns) ?? {},
    columnProfiles,
    kpis,
    topGroups,
    sampleRows: input.rows.slice(0, MAX_SAMPLE_ROWS_SENT).map((row) => pickColumns(row, columns.slice(0, 12))),
  };
}

function contextForClient(context: DatasetContextSummary) {
  return {
    dataset: context.dataset,
    sample: context.sample,
    detectedColumns: context.detectedColumns,
    kpis: context.kpis,
  };
}

function normalizeRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row));
}

function normalizeColumns(columns: unknown, rows: Record<string, unknown>[]) {
  const stored = Array.isArray(columns) ? columns.filter((column): column is string => typeof column === "string") : [];
  if (stored.length > 0) return stored;
  return Object.keys(rows[0] || {});
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function profileColumn(column: string, rows: Record<string, unknown>[]) {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "");
  const numericValues = values.map(toNumber).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const sampleValues = Array.from(new Set(values.map((value) => String(value)).filter(Boolean))).slice(0, 5);
  const isNumeric = values.length > 0 && numericValues.length / values.length >= 0.6;

  if (isNumeric) {
    const sum = numericValues.reduce((total, value) => total + value, 0);
    return {
      name: column,
      type: "numeric",
      nonEmpty: values.length,
      missing: Math.max(0, rows.length - values.length),
      unique: new Set(values.map(String)).size,
      sum: round(sum),
      average: round(sum / Math.max(1, numericValues.length)),
      min: round(Math.min(...numericValues)),
      max: round(Math.max(...numericValues)),
      sampleValues,
    };
  }

  return {
    name: column,
    type: inferTextType(values),
    nonEmpty: values.length,
    missing: Math.max(0, rows.length - values.length),
    unique: new Set(values.map(String)).size,
    sampleValues,
  };
}

function buildKpiExtract(rows: Record<string, unknown>[], columns: string[], precomputedMetrics: unknown, analysis: unknown) {
  const detected = detectBusinessColumns(rows);
  const revenueColumn = stringOrNull(detected.revenueColumn);
  const costColumn = stringOrNull(detected.costColumn);
  const profitColumn = stringOrNull(detected.profitColumn);
  const quantityColumn = stringOrNull(detected.quantityColumn);
  const kpis: Record<string, unknown> = {
    rowSampleSize: rows.length,
    precomputedMetrics: normalizeRecord(precomputedMetrics),
    precomputedAnalysis: normalizeRecord(analysis),
    detectedRevenueColumn: revenueColumn,
    detectedCostColumn: costColumn,
    detectedProfitColumn: profitColumn,
    detectedQuantityColumn: quantityColumn,
  };

  if (revenueColumn) kpis.sampleRevenueTotal = round(sumColumn(rows, revenueColumn));
  if (costColumn) kpis.sampleCostTotal = round(sumColumn(rows, costColumn));
  if (profitColumn) kpis.sampleProfitTotal = round(sumColumn(rows, profitColumn));
  if (quantityColumn) kpis.sampleQuantityTotal = round(sumColumn(rows, quantityColumn));

  if (typeof kpis.sampleRevenueTotal === "number" && typeof kpis.sampleCostTotal === "number") {
    kpis.sampleGrossProfit = round(kpis.sampleRevenueTotal - kpis.sampleCostTotal);
    kpis.sampleGrossMarginPct = kpis.sampleRevenueTotal > 0
      ? round(((kpis.sampleGrossProfit as number) / kpis.sampleRevenueTotal) * 100)
      : null;
  }

  if (!revenueColumn) {
    const numericColumn = columns.find((column) => profileColumn(column, rows).type === "numeric");
    if (numericColumn) kpis.primaryNumericColumn = numericColumn;
  }

  return kpis;
}

function buildTopGroups(rows: Record<string, unknown>[], columns: string[]) {
  const detected = detectBusinessColumns(rows);
  const metric = stringOrNull(detected.revenueColumn) || stringOrNull(detected.profitColumn) || stringOrNull(detected.quantityColumn);
  if (!metric) return [];

  const candidateDimensions = [
    detected.productColumn,
    detected.regionColumn,
    detected.fallbackRegionColumn,
    columns.find((column) => /customer|client|account/i.test(column)),
    columns.find((column) => /category|segment|channel|supplier|vendor/i.test(column)),
  ].filter((value): value is string => typeof value === "string" && value !== metric);

  return Array.from(new Set(candidateDimensions)).slice(0, 4).map((dimension) => ({
    dimension,
    metric,
    rows: groupTopRows(rows, dimension, metric),
  }));
}

function groupTopRows(rows: Record<string, unknown>[], dimension: string, metric: string) {
  const groups = new Map<string, { value: number; count: number }>();
  for (const row of rows) {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const current = groups.get(label) ?? { value: 0, count: 0 };
    current.value += toNumber(row[metric]) ?? 0;
    current.count += 1;
    groups.set(label, current);
  }
  return Array.from(groups.entries())
    .map(([label, value]) => ({ label, value: round(value.value), count: value.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function pickColumns(row: Record<string, unknown>, columns: string[]) {
  return columns.reduce<Record<string, unknown>>((picked, column) => {
    picked[column] = row[column];
    return picked;
  }, {});
}

function inferTextType(values: unknown[]) {
  const dateCount = values.filter((value) => !Number.isNaN(Date.parse(String(value)))).length;
  if (values.length > 0 && dateCount / values.length >= 0.6) return "date";
  if (values.every((value) => typeof value === "boolean" || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "false")) {
    return "boolean";
  }
  return "categorical";
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function sumColumn(rows: Record<string, unknown>[], column: string) {
  return rows.reduce((total, row) => total + (toNumber(row[column]) ?? 0), 0);
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function providerStatusFromAdapterResult(
  providerType: string,
  providerName: string,
  fallbackUsed: boolean,
  mode?: string,
  route?: string,
): HybridProviderStatus {
  const isLocalRoute = route === "local";
  return {
    label: providerStatusLabel(providerType, providerName),
    state: mode === "local-only" ? "offline_active" : fallbackUsed ? "fallback_active" : "connection_healthy",
    message: mode === "local-only" ? "Offline mode active" : isLocalRoute ? "Local AI active" : fallbackUsed ? "Cloud fallback active" : "Connected",
    fallbackActive: fallbackUsed,
    route: isLocalRoute ? "local" : "cloud",
  };
}

function providerStatusLabel(providerType: string, providerName: string) {
  if (providerType === "ollama") return "Ollama";
  if (providerType === "lm-studio") return "LM Studio";
  if (providerType === "openai-compatible") return "OpenAI Compatible";
  if (providerType === "azure-openai") return "Azure OpenAI";
  if (providerType === "google-gemini") return "Google Gemini";
  if (providerType === "openai") return "OpenAI";
  if (providerType === "anthropic") return "Anthropic";
  return providerName || "AI Provider";
}
