import { debugLog, debugError, debugWarn } from "@/lib/debug"

import {
  mcpTools,
  getToolByName,
  GetDatasetSchemaInput,
  GetPrecomputedKpisInput,
  GetTopRegionsInput,
  GetRevenueTrendsInput,
  GetProfitabilitySummaryInput,
} from './tools';

import {
  getDatasetSchema,
  getPrecomputedKpis,
  getTopRegions,
  getRevenueTrends,
  getProfitabilitySummary,
} from './handlers';

import {
  getAvailableResources,
  readResource,
} from './resources';

export interface MCPToolInvocation {
  name: string;
  input: Record<string, any>;
}

export interface MCPToolResult {
  success: boolean;
  result?: any;
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

    let validatedInput: any;
    
    switch (name) {
      case 'getDatasetSchema':
        validatedInput = GetDatasetSchemaInput.parse(input);
        return {
          success: true,
          result: getDatasetSchema(validatedInput.datasetId),
        };
        
      case 'getPrecomputedKpis':
        validatedInput = GetPrecomputedKpisInput.parse(input);
        return {
          success: true,
          result: getPrecomputedKpis(validatedInput.datasetId),
        };
        
      case 'getTopRegions':
        validatedInput = GetTopRegionsInput.parse(input);
        return {
          success: true,
          result: getTopRegions(
            validatedInput.datasetId,
            validatedInput.metric,
            validatedInput.limit
          ),
        };
        
      case 'getRevenueTrends':
        validatedInput = GetRevenueTrendsInput.parse(input);
        return {
          success: true,
          result: getRevenueTrends(
            validatedInput.datasetId,
            validatedInput.dateGrain,
            validatedInput.metric
          ),
        };
        
      case 'getProfitabilitySummary':
        validatedInput = GetProfitabilitySummaryInput.parse(input);
        return {
          success: true,
          result: getProfitabilitySummary(validatedInput.datasetId),
        };
        
      default:
        return {
          success: false,
          error: `Tool not implemented: ${name}`,
        };
    }
  } catch (error: any) {
    debugError(`[MCP] Tool invocation error:`, error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
}

export function listTools() {
  return mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: 'object',
  }));
}

export function listResources(datasetId: string) {
  return getAvailableResources(datasetId);
}

export function getResource(uri: string) {
  return readResource(uri);
}

export { setAnalysisCache } from './handlers';
