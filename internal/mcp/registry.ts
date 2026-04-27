import { MCPTool } from './types';
import { getDatasetSummaryTool, handleGetDatasetSummary } from './tools/getDatasetSummary';

const tools: Map<string, MCPTool> = new Map();
const handlers: Map<string, (params: unknown) => Promise<unknown>> = new Map();

tools.set(getDatasetSummaryTool.name, getDatasetSummaryTool);
handlers.set(getDatasetSummaryTool.name, handleGetDatasetSummary);

export function getTool(name: string): MCPTool | undefined {
  return tools.get(name);
}

export function getAllTools(): MCPTool[] {
  return Array.from(tools.values());
}

export async function executeTool(name: string, params: Record<string, unknown>): Promise<unknown> {
  const handler = handlers.get(name);
  if (!handler) {
    throw new Error(`Tool not found: ${name}`);
  }
  return handler(params);
}