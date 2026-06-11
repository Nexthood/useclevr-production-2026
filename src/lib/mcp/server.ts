import { debugError, debugLog } from "@/lib/utils/debug";

import {
  CompareDatasetsInput,
  CreateFaqInput,
  CreateNewsInput,
  DeleteFaqInput,
  DeleteNewsInput,
  GetCostBreakdownInput,
  GetDatasetSchemaInput,
  GetFaqsInput,
  GetNewsInput,
  GetPrecomputedKpisInput,
  GetProfitMarginTrendInput,
  GetProfitabilitySummaryInput,
  GetRevenueTrendsInput,
  getToolByName,
  GetTopProductsInput,
  GetTopRegionsInput,
  ListDatasetsInput,
  mcpTools,
  type MCPScope,
  UpdateFaqInput,
  UpdateNewsInput,
  zodToJsonSchema,
} from "./tools";

import {
  compareDatasets,
  createFaq,
  createNews,
  deleteFaq,
  deleteNews,
  getCostBreakdownFromCache,
  getDatasetSchema,
  getFaqs,
  getNews,
  getPrecomputedKpis,
  getProfitMarginTrend,
  getProfitabilitySummary,
  getRevenueTrends,
  getTopProducts,
  getTopRegions,
  listDatasets,
  updateFaq,
  updateNews,
} from "./handlers";

import { getAvailableResources, readResource } from "./resources";

export interface MCPAuthInfo {
  userId?: string;
  role?: string;
}

export interface MCPToolInvocation {
  name: string;
  input: Record<string, unknown>;
}

export interface MCPToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export async function invokeTool(
  invocation: MCPToolInvocation,
  auth?: MCPAuthInfo,
): Promise<MCPToolResult> {
  const { name, input } = invocation;

  debugLog(`[MCP] Invoking tool: ${name}`);
  debugLog(`[MCP] Input:`, input);

  try {
    const tool = getToolByName(name);

    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${name}`,
      };
    }

    switch (name) {
      case "getFaqs": {
        const validatedInput = GetFaqsInput.parse(input);
        return {
          success: true,
          result: await getFaqs(
            validatedInput.category,
            validatedInput.query,
            validatedInput.limit,
          ),
        };
      }

      case "getNews": {
        const validatedInput = GetNewsInput.parse(input);
        return {
          success: true,
          result: await getNews(
            validatedInput.slug,
            validatedInput.query,
            validatedInput.limit,
            validatedInput.includeContent,
          ),
        };
      }

      case "getDatasetSchema": {
        const validatedInput = GetDatasetSchemaInput.parse(input);
        return {
          success: true,
          result: getDatasetSchema(validatedInput.datasetId),
        };
      }

      case "getPrecomputedKpis": {
        const validatedInput = GetPrecomputedKpisInput.parse(input);
        return {
          success: true,
          result: getPrecomputedKpis(validatedInput.datasetId),
        };
      }

      case "getTopRegions": {
        const validatedInput = GetTopRegionsInput.parse(input);
        return {
          success: true,
          result: getTopRegions(
            validatedInput.datasetId,
            validatedInput.metric,
            validatedInput.limit,
          ),
        };
      }

      case "getCostBreakdown": {
        const validatedInput = GetCostBreakdownInput.parse(input);
        return {
          success: true,
          result: getCostBreakdownFromCache(validatedInput.datasetId),
        };
      }

      case "getProfitMarginTrend": {
        const validatedInput = GetProfitMarginTrendInput.parse(input);
        return {
          success: true,
          result: getProfitMarginTrend(validatedInput.datasetId),
        };
      }

      case "compareDatasets": {
        const validatedInput = CompareDatasetsInput.parse(input);
        return {
          success: true,
          result: await compareDatasets(
            validatedInput.datasetIdA,
            validatedInput.datasetIdB,
          ),
        };
      }

      case "getTopProducts": {
        const validatedInput = GetTopProductsInput.parse(input);
        return {
          success: true,
          result: getTopProducts(
            validatedInput.datasetId,
            validatedInput.metric,
            validatedInput.limit,
          ),
        };
      }

      case "getRevenueTrends": {
        const validatedInput = GetRevenueTrendsInput.parse(input);
        return {
          success: true,
          result: getRevenueTrends(
            validatedInput.datasetId,
            validatedInput.dateGrain,
            validatedInput.metric,
          ),
        };
      }

      case "getProfitabilitySummary": {
        const validatedInput = GetProfitabilitySummaryInput.parse(input);
        return {
          success: true,
          result: getProfitabilitySummary(validatedInput.datasetId),
        };
      }

      case "createFaq": {
        const validatedInput = CreateFaqInput.parse(input);
        return {
          success: true,
          result: await createFaq(
            validatedInput.category,
            validatedInput.question,
            validatedInput.answer,
            validatedInput.tag,
          ),
        };
      }

      case "updateFaq": {
        const validatedInput = UpdateFaqInput.parse(input);
        return {
          success: true,
          result: await updateFaq(
            validatedInput.id,
            validatedInput.category,
            validatedInput.question,
            validatedInput.answer,
            validatedInput.tag,
          ),
        };
      }

      case "deleteFaq": {
        const validatedInput = DeleteFaqInput.parse(input);
        return {
          success: true,
          result: await deleteFaq(validatedInput.id),
        };
      }

      case "createNews": {
        const validatedInput = CreateNewsInput.parse(input);
        return {
          success: true,
          result: await createNews(
            validatedInput.title,
            validatedInput.slug,
            validatedInput.summary,
            validatedInput.content,
          ),
        };
      }

      case "updateNews": {
        const validatedInput = UpdateNewsInput.parse(input);
        return {
          success: true,
          result: await updateNews(
            validatedInput.id,
            validatedInput.title,
            validatedInput.slug,
            validatedInput.summary,
            validatedInput.content,
          ),
        };
      }

      case "deleteNews": {
        const validatedInput = DeleteNewsInput.parse(input);
        return {
          success: true,
          result: await deleteNews(validatedInput.id),
        };
      }

      case "listDatasets": {
        ListDatasetsInput.parse(input);
        return {
          success: true,
          result: await listDatasets(auth?.userId),
        };
      }

      default:
        return {
          success: false,
          error: `Tool not implemented: ${name}`,
        };
    }
  } catch (error: unknown) {
    debugError(`[MCP] Tool invocation error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function listTools() {
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema),
    requiredScopes: tool.requiredScopes,
  }));
}

export function listToolsByScope(scopes: MCPScope[]) {
  const scopeSet = new Set(scopes);
  return mcpTools
    .filter((tool) => tool.requiredScopes.every((s) => scopeSet.has(s)))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema),
      requiredScopes: tool.requiredScopes,
    }));
}

export function listResources(datasetId: string) {
  return getAvailableResources(datasetId);
}

export function getResource(uri: string) {
  return readResource(uri);
}

export { setAnalysisCache } from "./handlers";
