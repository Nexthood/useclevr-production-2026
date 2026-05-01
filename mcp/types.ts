export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export type MCPToolName = 'getDatasetSummary';

export interface MCPToolContext {
  datasetId: string;
}

export interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface DatasetSummaryResult {
  datasetId: string;
  rowCount?: number;
  columnCount?: number;
  columns?: string[];
}