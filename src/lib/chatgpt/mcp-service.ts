import { uploadCSV } from "@/app/actions/upload";
import { auth } from "@/lib/auth/auth";
import { generateBusinessIntelligence, type BusinessIntelligenceResult } from "@/lib/business/business-intelligence-engine";
import {
  businessModels,
  getBusinessModelRedirect,
  type BusinessModel,
} from "@/lib/data/business-model";
import { normalizeDatasetCategory } from "@/lib/data/dataset-category";
import {
  buildSemanticSchema,
  detectDatasetSemanticCapabilities,
  type SemanticField,
  type SemanticSchema,
} from "@/lib/data/semantic-schema";
import { executeStrictSQL } from "@/lib/chat/sql-executor";
import { ChatGptOAuthError, verifyChatGptAccessToken } from "@/lib/chatgpt/oauth";
import { getDb } from "@/lib/db";
import { datasetRows, datasets, mcpAuditLogs, profiles, users, type McpTokenScope } from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES } from "@/lib/upload/upload-limits";
import { sanitizeUploadFileNameForLog } from "@/lib/upload/upload-security";
import { debugError } from "@/lib/utils/debug";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

export type ChatGptMcpAuthContext = {
  authenticated: boolean;
  userId?: string;
  role: "user" | "admin";
  scopes: McpTokenScope[];
  tokenId?: string;
  tokenName?: string;
  authType: "oauth" | "session" | "none";
  authError?: "invalid_token" | "insufficient_scope";
  authErrorDescription?: string;
};

type DatasetRecord = typeof datasets.$inferSelect;

export type ChatGptToolResult = {
  structuredContent: Record<string, unknown>;
  text: string;
};

type ChatGptSemanticProfile = {
  version: "useclevr.semantic-schema.v1";
  classification: {
    datasetType: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    score: number;
    evidence: string[];
    warnings: string[];
    reason: string;
  };
  availableMetrics: Array<{
    metric: string;
    status: "AVAILABLE";
    sourceColumn: string;
    evidence: string[];
    confidence: "HIGH" | "MEDIUM" | "LOW";
  }>;
  blockedMetrics: Array<{
    metric: string;
    status: "BLOCKED";
    reasonCode: string;
    missingFields: SemanticField[];
    evidence: string[];
    confidence: "HIGH";
  }>;
  ambiguousMetrics: Array<{
    metric: SemanticField;
    status: "AMBIGUOUS";
    candidateColumns: string[];
    reason: string;
    confidence: "MEDIUM";
  }>;
  missingEvidence: Array<{
    metric: string;
    missingConcepts: SemanticField[];
    reasonCode: string;
  }>;
  warnings: Array<{
    code: string;
    severity: "INFO" | "WARNING";
    message: string;
  }>;
  diagnostics: {
    columnCount: number;
    rowCount: number;
    confirmedConceptCount: number;
    ambiguousConceptCount: number;
    generatedAt: string;
  };
};

export async function validateChatGptMcpAuth(request: NextRequest): Promise<ChatGptMcpAuthContext> {
  if (getBearerToken(request)) {
    try {
      const token = await verifyChatGptAccessToken(request);
      return {
        authenticated: true,
        userId: token.userId,
        role: token.scopes.includes("admin") ? "admin" : "user",
        scopes: token.scopes,
        tokenId: token.tokenId,
        authType: "oauth",
      };
    } catch (error) {
      return unauthenticated(
        "oauth",
        error instanceof ChatGptOAuthError && error.code === "insufficient_scope"
          ? "insufficient_scope"
          : "invalid_token",
        error instanceof ChatGptOAuthError ? error.message : "UseClevr authentication is required.",
      );
    }
  }

  let session = null;
  try {
    session = await auth();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("outside a request scope")) {
      throw error;
    }
  }
  if (session?.user?.id) {
    const role = String(session.user.role ?? "");
    return {
      authenticated: true,
      userId: session.user.id,
      role: role === "admin" || role === "superadmin" ? "admin" : "user",
      scopes: ["dataset:read", "dataset:write"],
      authType: "session",
    };
  }

  return unauthenticated("none", "invalid_token", "UseClevr authentication is required.");
}

export async function logChatGptMcpAudit(input: {
  action: "invoke_tool" | "list_tools" | "auth_failure";
  authContext?: ChatGptMcpAuthContext;
  toolName?: string;
  datasetId?: string;
  success: boolean;
  errorMessage?: string;
  durationMs?: number;
}) {
  const db = getDb();
  if (!db) return;

  try {
    await db.insert(mcpAuditLogs).values({
      id: randomUUID(),
      action: input.action,
      tokenId: input.authContext?.tokenId,
      tokenName: input.authContext?.tokenName,
      userId: input.authContext?.userId,
      toolName: input.toolName,
      datasetId: input.datasetId,
      success: input.success,
      errorMessage: input.errorMessage,
      durationMs: input.durationMs,
      createdAt: new Date(),
    });
  } catch (error) {
    if (isMissingAuditColumnError(error)) return;
    debugError("[CHATGPT_MCP] Audit log insert failed:", error);
  }
}

export async function listUseClevrDatasets(authContext: ChatGptMcpAuthContext, request: NextRequest): Promise<ChatGptToolResult> {
  assertAuthenticatedUser(authContext);
  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  const ownedDatasets = await db.query.datasets.findMany({
    where: eq(datasets.userId, authContext.userId!),
    columns: {
      id: true,
      name: true,
      fileName: true,
      rowCount: true,
      columnCount: true,
      datasetType: true,
      businessModel: true,
      analysisStatus: true,
      createdAt: true,
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit: 50,
  });

  const result = {
    datasets: ownedDatasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      fileName: dataset.fileName,
      rowCount: dataset.rowCount,
      columnCount: dataset.columnCount,
      datasetType: dataset.datasetType,
      businessModel: dataset.businessModel,
      analysisStatus: dataset.analysisStatus,
      createdAt: dataset.createdAt.toISOString(),
      openInUseClevrUrl: buildOpenInUseClevrUrl(request, dataset.id, dataset.datasetType, dataset.businessModel),
    })),
    totalCount: ownedDatasets.length,
  };

  return {
    structuredContent: result,
    text: result.totalCount === 0
      ? "No UseClevr datasets are available for this account."
      : `Found ${result.totalCount} UseClevr dataset${result.totalCount === 1 ? "" : "s"} for this account.`,
  };
}

export async function analyzeUseClevrDataset(
  authContext: ChatGptMcpAuthContext,
  request: NextRequest,
  input: { datasetId?: unknown; question?: unknown },
): Promise<ChatGptToolResult> {
  assertAuthenticatedUser(authContext);
  const datasetId = requireString(input.datasetId, "datasetId");
  const question = typeof input.question === "string" ? input.question.trim() : "";
  const { dataset, rows, columns } = await loadOwnedDataset(authContext.userId!, datasetId);
  const analysis = asRecord(dataset.analysis);
  const businessIntelligence = await getBusinessIntelligence(dataset, rows, columns);
  const semanticProfile = buildChatGptSemanticProfile({
    datasetId: dataset.id,
    datasetType: dataset.datasetType || dataset.businessModel || "standard",
    columns,
    rows,
    analysis,
  });
  const questionResult = question
    ? await executeQuestion(dataset.id, question, authContext.userId!)
    : null;
  const structuredContent = buildAnalysisResult({
    request,
    dataset,
    columns,
    businessIntelligence,
    semanticProfile,
    question,
    questionResult,
  });

  return {
    structuredContent,
    text: businessIntelligence.executiveSummary || `UseClevr analysis is ready for ${dataset.name}.`,
  };
}

export async function uploadUseClevrDataset(
  authContext: ChatGptMcpAuthContext,
  request: NextRequest,
  input: {
    fileName?: unknown;
    mimeType?: unknown;
    fileBase64?: unknown;
    datasetType?: unknown;
    businessModel?: unknown;
  },
): Promise<ChatGptToolResult> {
  assertAuthenticatedUser(authContext);
  if (!authContext.scopes.includes("dataset:write") && !authContext.scopes.includes("admin")) {
    const error = new Error("Missing dataset:write scope") as Error & {
      authChallengeCode?: "insufficient_scope";
      authChallengeDescription?: string;
    };
    error.name = "ForbiddenError";
    error.authChallengeCode = "insufficient_scope";
    error.authChallengeDescription = "UseClevr dataset upload requires the dataset:write scope.";
    throw error;
  }

  const fileName = sanitizeUploadFileNameForLog(requireString(input.fileName, "fileName"));
  const fileBase64 = requireString(input.fileBase64, "fileBase64");
  const mimeType = typeof input.mimeType === "string" ? input.mimeType : "application/octet-stream";
  const buffer = Buffer.from(fileBase64, "base64");

  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    const error = new Error(`File must be between 1 byte and ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`);
    error.name = "InvalidInputError";
    throw error;
  }

  const formData = new FormData();
  formData.set("file", new File([buffer], fileName, { type: mimeType }));
  formData.set("uploadMode", normalizeUploadCategory(input.datasetType));
  formData.set("dataset_type", normalizeUploadCategory(input.datasetType));
  if (typeof input.businessModel === "string" && input.businessModel.trim()) {
    formData.set("business_model", input.businessModel.trim());
  }

  const user = await loadUserForAuthContext(authContext.userId!);
  const uploadResult = await uploadCSV(formData, {
    user: {
      id: authContext.userId!,
      email: user.email,
      role: user.role,
    },
  });

  if (!uploadResult.success || !uploadResult.datasetId) {
    const error = new Error(sanitizeUploadError(uploadResult.error));
    error.name = "InvalidInputError";
    throw error;
  }

  const structuredContent = {
    dataset: {
      id: uploadResult.datasetId,
      name: uploadResult.datasetName,
      fileName: uploadResult.fileName,
      datasetType: uploadResult.datasetType,
      businessModel: uploadResult.businessModel,
      rowsProcessed: uploadResult.rowsProcessed,
      columnsDetected: uploadResult.columnsDetected,
      analysisStatus: uploadResult.analysisStatus,
      openInUseClevrUrl: absoluteAppUrl(request, uploadResult.redirectUrl || uploadResult.redirectTo || `/app/dashboard?datasetId=${encodeURIComponent(uploadResult.datasetId)}`),
    },
    preview: uploadResult.preview
      ? {
          headers: uploadResult.preview.headers,
          rows: uploadResult.preview.rows.slice(0, 5),
        }
      : undefined,
    usage: uploadResult.usage,
  };

  return {
    structuredContent,
    text: `Uploaded ${uploadResult.datasetName || uploadResult.fileName || "dataset"} and prepared UseClevr analysis.`,
  };
}

async function loadOwnedDataset(userId: string, datasetId: string) {
  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  const dataset = await db.query.datasets.findFirst({
    where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
  });

  if (!dataset) {
    const error = new Error("Dataset not found or access denied");
    error.name = "ForbiddenError";
    throw error;
  }

  let rows = (dataset.data as Record<string, unknown>[]) || [];
  if (rows.length === 0) {
    const storedRows = await db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, dataset.id),
      columns: { data: true },
      orderBy: (table, { asc }) => [asc(table.rowIndex)],
      limit: 5000,
    });
    rows = storedRows.map((row) => row.data as Record<string, unknown>);
  }

  return {
    dataset,
    rows,
    columns: (dataset.columns as string[]) || Object.keys(rows[0] || {}),
  };
}

async function getBusinessIntelligence(
  dataset: DatasetRecord,
  rows: Record<string, unknown>[],
  columns: string[],
): Promise<BusinessIntelligenceResult> {
  const analysis = asRecord(dataset.analysis);
  const existing = asRecord(analysis?.business_intelligence) || asRecord(dataset.aiInsights);
  if (existing) {
    return existing as unknown as BusinessIntelligenceResult;
  }

  return generateBusinessIntelligence({
    rows,
    columns,
    datasetId: dataset.id,
    datasetName: dataset.name,
    userId: dataset.userId,
    enableAi: false,
  });
}

async function executeQuestion(datasetId: string, question: string, userId: string) {
  const result = await executeStrictSQL(datasetId, question, userId);
  if (!result.success) {
    return {
      success: false,
      error: result.error || "UseClevr could not compute this question from the dataset.",
    };
  }

  return {
    success: true,
    operation: result.result?.operation,
    result: limitResultPayload(result.result),
  };
}

function buildChatGptSemanticProfile(input: {
  datasetId: string;
  datasetType: string;
  columns: string[];
  rows: Record<string, unknown>[];
  analysis: Record<string, unknown> | null;
}): ChatGptSemanticProfile {
  const schema = buildSemanticSchema({
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    columns: input.columns,
    rows: input.rows,
  });
  const capabilities = detectDatasetSemanticCapabilities({ schema, rows: input.rows });
  const availableMetrics = buildAvailableSemanticMetrics(schema);
  const blockedMetrics = buildBlockedSemanticMetrics(schema);
  const ambiguousMetrics = Object.entries(schema.ambiguous).map(([metric, candidates]) => ({
    metric: metric as SemanticField,
    status: "AMBIGUOUS" as const,
    candidateColumns: (candidates || []).map((candidate) => candidate.column),
    reason: `${metric} has multiple plausible source columns and requires review before metric use.`,
    confidence: "MEDIUM" as const,
  }));
  const warnings = [
    ...(schema.mixedCurrency
      ? [{
          code: "MIXED_CURRENCY",
          severity: "WARNING" as const,
          message: "Dataset contains multiple currency values, so money metrics require currency normalization.",
        }]
      : []),
    ...ambiguousMetrics.map((metric) => ({
      code: "AMBIGUOUS_MAPPING",
      severity: "WARNING" as const,
      message: `${metric.metric} has multiple plausible source columns.`,
    })),
  ];

  return {
    version: "useclevr.semantic-schema.v1",
    classification: {
      datasetType: input.datasetType,
      confidence: semanticConfidence(availableMetrics.length, ambiguousMetrics.length, input.columns.length),
      score: Math.round((availableMetrics.length / Math.max(1, input.columns.length)) * 100),
      evidence: [
        ...capabilities.revenueEvidence,
        ...capabilities.expenseEvidence,
        ...(schema.currencyCode ? [`Currency field resolves to ${schema.currencyCode}.`] : []),
        ...(input.analysis ? ["Stored analysis metadata is available for this dataset."] : []),
      ].slice(0, 12),
      warnings: warnings.map((warning) => warning.message),
      reason: "Dataset semantics use the current beta semantic schema and source-backed column mappings.",
    },
    availableMetrics,
    blockedMetrics,
    ambiguousMetrics,
    missingEvidence: blockedMetrics.map((metric) => ({
      metric: metric.metric,
      missingConcepts: metric.missingFields,
      reasonCode: metric.reasonCode,
    })),
    warnings,
    diagnostics: {
      columnCount: schema.columns.length,
      rowCount: input.rows.length,
      confirmedConceptCount: Object.keys(schema.mappings).length,
      ambiguousConceptCount: ambiguousMetrics.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

function buildAvailableSemanticMetrics(schema: SemanticSchema): ChatGptSemanticProfile["availableMetrics"] {
  return Object.entries(schema.mappings).map(([metric, mapping]) => ({
    metric,
    status: "AVAILABLE" as const,
    sourceColumn: mapping.column,
    evidence: [mapping.reason],
    confidence: mapping.confidence === "high" ? "HIGH" as const : "MEDIUM" as const,
  }));
}

function buildBlockedSemanticMetrics(schema: SemanticSchema): ChatGptSemanticProfile["blockedMetrics"] {
  const requiredMetricFields: Array<{ metric: string; fields: SemanticField[] }> = [
    { metric: "gross_margin", fields: ["revenue", "cogs"] },
    { metric: "net_margin", fields: ["revenue", "net_profit"] },
    { metric: "inventory_value", fields: ["product", "quantity"] },
    { metric: "regional_revenue", fields: ["revenue", "region"] },
    { metric: "customer_revenue", fields: ["revenue", "customer"] },
  ];

  return requiredMetricFields
    .map((metric) => {
      const missingFields = metric.fields.filter((field) => !schema.mappings[field]);
      if (missingFields.length === 0) return null;
      return {
        metric: metric.metric,
        status: "BLOCKED" as const,
        reasonCode: "MISSING_REQUIRED_EVIDENCE",
        missingFields,
        evidence: [`Missing semantic fields: ${missingFields.join(", ")}.`],
        confidence: "HIGH" as const,
      };
    })
    .filter((metric): metric is ChatGptSemanticProfile["blockedMetrics"][number] => Boolean(metric));
}

function semanticConfidence(
  availableMetricCount: number,
  ambiguousMetricCount: number,
  columnCount: number,
): ChatGptSemanticProfile["classification"]["confidence"] {
  if (columnCount === 0) return "LOW";
  const coverage = availableMetricCount / columnCount;
  if (coverage >= 0.65 && ambiguousMetricCount === 0) return "HIGH";
  if (coverage >= 0.35) return "MEDIUM";
  return "LOW";
}

function buildAnalysisResult(input: {
  request: NextRequest;
  dataset: DatasetRecord;
  columns: string[];
  businessIntelligence: BusinessIntelligenceResult;
  semanticProfile: ChatGptSemanticProfile;
  question: string;
  questionResult: Awaited<ReturnType<typeof executeQuestion>> | null;
}) {
  const precomputedMetrics = asRecord(input.dataset.precomputedMetrics);
  const semanticWarnings = input.semanticProfile.warnings.map((warning) => ({
    code: warning.code,
    severity: warning.severity,
    message: warning.message,
  }));
  const missingEvidenceWarnings = input.semanticProfile.missingEvidence.slice(0, 10).map((item) => ({
    code: item.reasonCode,
    severity: "WARNING",
    message: `${item.metric} is not available because ${item.missingConcepts.join(", ")} is missing.`,
  }));

  return {
    dataset: {
      id: input.dataset.id,
      name: input.dataset.name,
      fileName: input.dataset.fileName,
      rowCount: input.dataset.rowCount,
      columnCount: input.dataset.columnCount,
      datasetType: input.dataset.datasetType,
      businessModel: input.dataset.businessModel,
      analysisStatus: input.dataset.analysisStatus,
      openInUseClevrUrl: buildOpenInUseClevrUrl(
        input.request,
        input.dataset.id,
        input.dataset.datasetType,
        input.dataset.businessModel,
      ),
    },
    kpis: extractKpis(precomputedMetrics, input.businessIntelligence),
    insights: {
      executiveSummary: input.businessIntelligence.executiveSummary,
      healthScore: input.businessIntelligence.healthScore,
      detectedKpis: input.businessIntelligence.detectedKpis,
      risks: input.businessIntelligence.risks.slice(0, 8),
      opportunities: input.businessIntelligence.opportunities.slice(0, 8),
      recommendedActions: input.businessIntelligence.recommendedActions.slice(0, 8),
    },
    semanticProfile: {
      version: input.semanticProfile.version,
      classification: input.semanticProfile.classification,
      availableMetrics: input.semanticProfile.availableMetrics.slice(0, 20),
      blockedMetrics: input.semanticProfile.blockedMetrics.slice(0, 20),
      ambiguousMetrics: input.semanticProfile.ambiguousMetrics.slice(0, 20),
      diagnostics: input.semanticProfile.diagnostics,
    },
    question: input.question || undefined,
    questionResult: input.questionResult || undefined,
    warnings: [
      ...semanticWarnings,
      ...missingEvidenceWarnings,
      ...(input.dataset.analysisError
        ? [{ code: "ANALYSIS_STATUS_WARNING", severity: "WARNING", message: input.dataset.analysisError }]
        : []),
    ],
    returnedAt: new Date().toISOString(),
  };
}

function extractKpis(
  metrics: Record<string, unknown> | null,
  businessIntelligence: BusinessIntelligenceResult,
) {
  const readNumber = (...keys: string[]) => {
    for (const key of keys) {
      const value = metrics?.[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return null;
  };

  return {
    totalRevenue: readNumber("totalRevenue", "revenue"),
    totalExpenses: readNumber("totalExpenses", "totalCost", "cost"),
    grossProfit: readNumber("grossProfit", "totalProfit", "profit"),
    netProfit: readNumber("netProfit", "totalProfit", "profit"),
    margin: readNumber("netMargin", "profitMargin", "margin"),
    rowCount: metrics?.fullDatasetRowCount || metrics?.rowCount || businessIntelligence.profile.rowCount,
    source: metrics ? "precomputedMetrics" : "businessIntelligence",
  };
}

async function loadUserForAuthContext(userId: string) {
  const db = getDb();
  if (!db) return { email: null, role: null };

  const [user, profile] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true },
    }),
    db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: { email: true, role: true },
    }),
  ]);

  return {
    email: profile?.email || user?.email || null,
    role: profile?.role || null,
  };
}

function assertAuthenticatedUser(authContext: ChatGptMcpAuthContext): asserts authContext is ChatGptMcpAuthContext & { userId: string } {
  if (!authContext.authenticated || !authContext.userId) {
    const error = new Error("Unauthorized");
    error.name = "AuthenticationError";
    throw error;
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    const error = new Error(`${field} is required`);
    error.name = "InvalidInputError";
    throw error;
  }
  return value.trim();
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function unauthenticated(
  authType: ChatGptMcpAuthContext["authType"],
  authError: ChatGptMcpAuthContext["authError"] = "invalid_token",
  authErrorDescription = "UseClevr authentication is required.",
): ChatGptMcpAuthContext {
  return {
    authenticated: false,
    role: "user",
    scopes: [],
    authType,
    authError,
    authErrorDescription,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function limitResultPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 20);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      key,
      Array.isArray(item) ? item.slice(0, 20) : item,
    ]),
  );
}

function normalizeUploadCategory(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "standard";
}

function sanitizeUploadError(error: string | undefined) {
  if (!error) return "Upload failed.";
  const parts = error.split("|").filter(Boolean);
  return parts[parts.length - 1] || "Upload failed.";
}

function isMissingAuditColumnError(error: unknown) {
  const cause = error && typeof error === "object" ? (error as { cause?: unknown }).cause : null;
  const code = cause && typeof cause === "object" ? (cause as { code?: unknown }).code : null;
  const message = error instanceof Error ? error.message : String(error);
  return code === "42703" && message.includes("MCPAuditLog");
}

function buildOpenInUseClevrUrl(
  request: NextRequest,
  datasetId: string,
  datasetType?: string | null,
  businessModel?: string | null,
) {
  const redirect = getBusinessModelRedirect({
    datasetId,
    datasetType: normalizeDatasetCategory(datasetType) || "standard",
    businessModel: normalizeBusinessModel(businessModel),
  });
  return absoluteAppUrl(request, redirect);
}

function normalizeBusinessModel(value?: string | null): BusinessModel {
  return businessModels.includes(value as BusinessModel) ? value as BusinessModel : "generic";
}

function absoluteAppUrl(request: NextRequest, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  const origin = configured || request.nextUrl.origin;
  return new URL(pathOrUrl, origin).toString();
}
