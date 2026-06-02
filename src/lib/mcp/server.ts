import { debugError, debugLog } from "@/lib/utils/debug";

import {
  GetDatasetSchemaInput,
  GetPrecomputedKpisInput,
  GetProfitabilitySummaryInput,
  GetRevenueTrendsInput,
  getToolByName,
  GetTopRegionsInput,
  mcpTools,
} from "./tools";

import {
  getDatasetSchema,
  getPrecomputedKpis,
  getProfitabilitySummary,
  getRevenueTrends,
  getTopRegions,
} from "./handlers";

import { getAvailableResources, readResource } from "./resources";

export interface MCPToolInvocation {
  name: string;
  input: Record<string, unknown>;
}

export interface MCPToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export async function invokeTool(invocation: MCPToolInvocation): Promise<MCPToolResult> {
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
    inputSchema: "object",
  }));
}

export function listResources(datasetId: string) {
  return getAvailableResources(datasetId);
}

export function getResource(uri: string) {
  return readResource(uri);
}

export { setAnalysisCache } from "./handlers";
