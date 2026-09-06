import {
  analyzeUseClevrDataset,
  listUseClevrDatasets,
  logChatGptMcpAudit,
  uploadUseClevrDataset,
  validateChatGptMcpAuth,
  type ChatGptMcpAuthContext,
  type ChatGptToolResult,
} from "@/lib/chatgpt/mcp-service";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

const PROTOCOL_VERSION = "2025-06-18";
const MCP_WWW_AUTHENTICATE_META_KEY = "mcp/www_authenticate";

const toolDefinitions = [
  {
    name: "useclevr_list_datasets",
    title: "List UseClevr datasets",
    description:
      "Lists datasets owned by the authenticated UseClevr user, including dashboard links.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    securitySchemes: [
      {
        type: "oauth2",
        scopes: ["dataset:read"],
      },
    ],
  },
  {
    name: "useclevr_analyze_dataset",
    title: "Analyze UseClevr dataset",
    description:
      "Returns trusted KPIs, insights, warnings, semantic diagnostics, and optional computed question results for an authorized UseClevr dataset.",
    inputSchema: {
      type: "object",
      properties: {
        datasetId: {
          type: "string",
          description: "The UseClevr dataset ID returned by useclevr_list_datasets or upload.",
        },
        question: {
          type: "string",
          description: "Optional business question to compute against the dataset.",
        },
      },
      required: ["datasetId"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    securitySchemes: [
      {
        type: "oauth2",
        scopes: ["dataset:read"],
      },
    ],
  },
  {
    name: "useclevr_upload_dataset",
    title: "Upload CSV or Excel dataset",
    description:
      "Uploads a CSV, XLSX, or XLS file to the authenticated UseClevr account and runs the existing UseClevr upload and analysis workflow.",
    inputSchema: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "Original file name ending in .csv, .xlsx, or .xls.",
        },
        mimeType: {
          type: "string",
          description: "File MIME type.",
        },
        fileBase64: {
          type: "string",
          description: "Base64-encoded file bytes.",
        },
        datasetType: {
          type: "string",
          enum: ["standard", "retail", "profitability", "accountancy", "prebookkeeping"],
        },
        businessModel: {
          type: "string",
          enum: ["local_retail", "ecommerce", "saas", "startup", "investor", "marketplace", "generic"],
        },
      },
      required: ["fileName", "fileBase64"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
    securitySchemes: [
      {
        type: "oauth2",
        scopes: ["dataset:read", "dataset:write"],
      },
    ],
  },
];

export async function GET(request: NextRequest) {
  const authContext = await validateChatGptMcpAuth(request);
  if (!authContext.authenticated) {
    await logChatGptMcpAudit({
      action: "auth_failure",
      authContext,
      success: false,
      errorMessage: "Unauthorized",
    });
    return withMcpHeaders(unauthorizedResponse(request, authContext), request);
  }

  await logChatGptMcpAudit({
    action: "list_tools",
    authContext,
    success: true,
  });

  return withMcpHeaders(NextResponse.json({
    server: serverInfo(),
    capabilities: { tools: {} },
    tools: toolDefinitions,
  }), request);
}

export async function POST(request: NextRequest) {
  const authContext = await validateChatGptMcpAuth(request);
  if (!authContext.authenticated) {
    await logChatGptMcpAudit({
      action: "auth_failure",
      authContext,
      success: false,
      errorMessage: "Unauthorized",
    });
    return withMcpHeaders(unauthorizedResponse(request, authContext), request);
  }

  const rateLimitKey = `chatgpt-mcp:${authContext.userId || "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, 60, 60_000)) {
    return withMcpHeaders(jsonRpcError(null, -32029, "Rate limit exceeded", 429), request);
  }

  let message: JsonRpcRequest;
  try {
    message = await request.json();
  } catch {
    return withMcpHeaders(jsonRpcError(null, -32700, "Invalid JSON", 400), request);
  }

  if (!message.id && message.method?.startsWith("notifications/")) {
    return withMcpHeaders(new NextResponse(null, { status: 202 }), request);
  }

  const id = message.id ?? null;
  try {
    const result = await handleJsonRpcRequest(request, authContext, message);
    return withMcpHeaders(NextResponse.json({ jsonrpc: "2.0", id, result }), request);
  } catch (error) {
    const { status, code, message: errorMessage } = normalizeError(error);
    const challenge = getErrorAuthChallenge(request, error, status);
    const response = challenge
      ? jsonRpcAuthChallengeResult(id, errorMessage, status, challenge)
      : jsonRpcError(id, code, errorMessage, status);
    if (challenge) response.headers.set("WWW-Authenticate", challenge);
    return withMcpHeaders(response, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withMcpHeaders(new NextResponse(null, { status: 204 }), request);
}

async function handleJsonRpcRequest(
  request: NextRequest,
  authContext: ChatGptMcpAuthContext,
  message: JsonRpcRequest,
) {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: serverInfo(),
        instructions:
          "UseClevr analyzes only datasets owned by the authenticated UseClevr user. Use the returned Open in UseClevr URLs for full dashboards.",
      };

    case "tools/list":
      await logChatGptMcpAudit({
        action: "list_tools",
        authContext,
        success: true,
      });
      return { tools: toolDefinitions };

    case "tools/call":
      return callTool(request, authContext, message.params);

    case "ping":
      return {};

    default:
      throw Object.assign(new Error(`Unsupported MCP method: ${message.method || "unknown"}`), {
        code: -32601,
        status: 404,
      });
  }
}

async function callTool(
  request: NextRequest,
  authContext: ChatGptMcpAuthContext,
  params: unknown,
) {
  const parsed = parseToolCallParams(params);
  const startMs = Date.now();
  let toolResult: ChatGptToolResult;

  try {
    if (parsed.name === "useclevr_list_datasets") {
      toolResult = await listUseClevrDatasets(authContext, request);
    } else if (parsed.name === "useclevr_analyze_dataset") {
      toolResult = await analyzeUseClevrDataset(authContext, request, parsed.arguments);
    } else if (parsed.name === "useclevr_upload_dataset") {
      toolResult = await uploadUseClevrDataset(authContext, request, parsed.arguments);
    } else {
      throw Object.assign(new Error(`Unknown tool: ${parsed.name}`), { code: -32602, status: 400 });
    }

    await logChatGptMcpAudit({
      action: "invoke_tool",
      authContext,
      toolName: parsed.name,
      datasetId: typeof parsed.arguments.datasetId === "string" ? parsed.arguments.datasetId : undefined,
      success: true,
      durationMs: Date.now() - startMs,
    });

    return {
      content: [{ type: "text", text: toolResult.text }],
      structuredContent: toolResult.structuredContent,
    };
  } catch (error) {
    await logChatGptMcpAudit({
      action: "invoke_tool",
      authContext,
      toolName: parsed.name,
      datasetId: typeof parsed.arguments.datasetId === "string" ? parsed.arguments.datasetId : undefined,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Tool invocation failed",
      durationMs: Date.now() - startMs,
    });
    throw error;
  }
}

function parseToolCallParams(params: unknown) {
  if (!params || typeof params !== "object") {
    throw Object.assign(new Error("Tool call params are required"), { code: -32602, status: 400 });
  }

  const record = params as Record<string, unknown>;
  if (typeof record.name !== "string" || !record.name.trim()) {
    throw Object.assign(new Error("Tool name is required"), { code: -32602, status: 400 });
  }

  const args = record.arguments && typeof record.arguments === "object"
    ? record.arguments as Record<string, unknown>
    : {};

  return {
    name: record.name.trim(),
    arguments: args,
  };
}

function serverInfo() {
  return {
    name: "useclevr-chatgpt-mcp",
    title: "UseClevr",
    version: "0.1.0",
  };
}

function unauthorizedResponse(request: NextRequest, authContext: ChatGptMcpAuthContext) {
  const challenge = buildMcpAuthenticateChallenge(
    request,
    authContext.authError || "invalid_token",
    authContext.authErrorDescription || "UseClevr authentication is required.",
  );
  const response = NextResponse.json({
    error: "Unauthorized",
    isError: true,
    _meta: {
      [MCP_WWW_AUTHENTICATE_META_KEY]: [challenge],
    },
  }, { status: 401 });
  response.headers.set("WWW-Authenticate", challenge);
  return response;
}

function jsonRpcAuthChallengeResult(
  id: string | number | null,
  message: string,
  status: number,
  challenge: string,
) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: message }],
      isError: true,
      _meta: {
        [MCP_WWW_AUTHENTICATE_META_KEY]: [challenge],
      },
    },
  }, { status });
}

function jsonRpcError(id: string | number | null, code: number, message: string, status: number) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  }, { status });
}

function getErrorAuthChallenge(request: NextRequest, error: unknown, status: number) {
  if (!(error instanceof Error)) return null;
  const errorMeta = error as Error & {
    authChallengeCode?: "invalid_token" | "insufficient_scope";
    authChallengeDescription?: string;
  };
  if (!errorMeta.authChallengeCode) return null;
  if (status !== 401 && status !== 403) return null;
  return buildMcpAuthenticateChallenge(
    request,
    errorMeta.authChallengeCode,
    errorMeta.authChallengeDescription || error.message,
  );
}

function buildMcpAuthenticateChallenge(
  request: NextRequest,
  error: "invalid_token" | "insufficient_scope",
  errorDescription: string,
) {
  return [
    `Bearer resource_metadata="${escapeChallengeValue(resourceMetadataUrl(request))}"`,
    `scope="dataset:read dataset:write"`,
    `error="${escapeChallengeValue(error)}"`,
    `error_description="${escapeChallengeValue(errorDescription)}"`,
  ].join(", ");
}

function escapeChallengeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function normalizeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, code: -32603, message: "Internal error" };
  }

  const errorMeta = error as Error & { status?: unknown; code?: unknown };
  const status = typeof errorMeta.status === "number"
    ? errorMeta.status
    : error.name === "AuthenticationError"
      ? 401
      : error.name === "ForbiddenError"
        ? 403
        : error.name === "InvalidInputError"
          ? 400
          : 500;
  const code = typeof errorMeta.code === "number"
    ? errorMeta.code
    : status === 401
      ? -32001
      : status === 403
        ? -32003
        : status === 400
          ? -32602
          : -32603;
  return {
    status,
    code,
    message: status >= 500 ? "Internal error" : error.message,
  };
}

function resourceMetadataUrl(request: NextRequest) {
  const configured = process.env.CHATGPT_MCP_RESOURCE_METADATA_URL;
  if (configured) return configured;
  return new URL("/.well-known/oauth-protected-resource", request.nextUrl.origin).toString();
}

function withMcpHeaders(response: NextResponse, request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin === "https://chatgpt.com" || origin === "https://chat.openai.com" || origin?.endsWith(".openai.com")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Protocol-Version");
  response.headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, MCP-Protocol-Version");
  response.headers.set("MCP-Protocol-Version", PROTOCOL_VERSION);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
