import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { debugError } from '@/lib/utils/debug';
import {
  generateWithUniversalAiAdapter,
  isLocalAiUnavailableError,
  logDefaultCloudFallback,
  logUniversalAiResponse,
} from '@/lib/ai/universal-ai-adapter';
import { eq } from 'drizzle-orm';
import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { normalizeDataset, generateAggregatedContext } from './sql-executor';
import { formatAIResponse } from './explanation';
import type { AppSearchResult } from '@/lib/search/app-search';

export type ChatProviderStatus = {
  label: string;
  state: "connection_healthy" | "fallback_active" | "provider_unavailable" | "offline_active" | "local_unavailable";
  message: string;
  fallbackActive: boolean;
};

interface BuildSystemPromptParams {
  datasetId?: string;
  processedData?: any[];
  appSearchResults: AppSearchResult[];
}

interface DatasetInfo {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
}

async function fetchDatasetForChat(datasetId?: string): Promise<{
  datasetInfo: DatasetInfo | null;
  rows: any[];
}> {
  if (!datasetId) return { datasetInfo: null, rows: [] };

  const dataset = await db!.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) return { datasetInfo: null, rows: [] };

  const datasetInfo: DatasetInfo = {
    id: dataset.id,
    name: dataset.name,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    columns: dataset.columns as string[],
  };

  const rawData = (dataset.data as Record<string, any>[]) || [];
  const rows = normalizeDataset(rawData).slice(0, 50);

  return { datasetInfo, rows };
}

function buildSystemPrompt(
  datasetInfo: DatasetInfo | null,
  datasetRows: any[],
  appSearchResults: AppSearchResult[]
): string {
  let systemContent = `You are Clevr, a business intelligence analyst for startup founders and small businesses.

For analytical or numeric questions:

1. Use only the verified dataset context supplied below.
2. Calculate a metric only when the required columns exist in the dataset.
3. Never invent proxy costs, ad spend, customer lifespan, benchmarks, forecasts, or missing values.
4. When a calculation is unavailable, name the exact missing columns and explain which metric they enable.
5. Keep every numeric claim traceable to the supplied aggregate or column summary.

Response structure:
- Direct answer first.
- Short evidence with the metric, segment, or period used.
- One practical next action supported by the result.

Accuracy overrides fluency. Never guess or approximate.

IMPORTANT DOCUMENT GENERATION RULE:
If user requests: generate report, create report, download report, export report, make PDF, create presentation, PowerPoint, Word document, Excel summary, investor report, board report, management report

You MUST return ONLY valid JSON. No markdown. No explanations. No commentary. No extra text.

FORMAT DETECTION:
- PDF → "format": "pdf"
- PowerPoint/slides/presentation → "format": "ppt"
- Word/document → "format": "docx"
- Excel/spreadsheet → "format": "xlsx"
Default: "format": "pdf"

PLAN LOGIC:
- If user asks for: investor deck, branded report, executive presentation, detailed board report → "report_type": "pro"
- Otherwise → "report_type": "standard"

REQUIRED OUTPUT STRUCTURE:
{
  "action": "generate_report",
  "format": "pdf | ppt | docx | xlsx",
  "report_type": "standard | pro",
  "title": "Professional report title",
  "executive_summary": "3-6 sentence executive overview",
  "kpis": [
    {
      "name": "KPI name",
      "value": "value",
      "insight": "short interpretation"
    }
  ],
  "sections": [
    {
      "title": "Section title",
      "content": "Detailed structured business analysis"
    }
  ],
  "charts": [
    {
      "type": "bar | line | pie | table",
      "title": "Chart title",
      "x_axis": "column name",
      "y_axis": "column name",
      "reason": "why this chart is relevant"
    }
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2"
  ]
}

CRITICAL: Return ONLY JSON. No markdown. No backticks. No explanations. No text outside JSON.

IMPORTANT: When users ask data questions (e.g., "highest revenue by country", "top products by sales"), you MUST:
1. Automatically detect relevant columns (e.g., Country, Revenue_USD, Product)
2. Perform aggregation (SUM) on the data provided
3. Sort results and return the TOP entity with exact values
4. Give a CONCISE answer with the result

Example responses:
- "USA has the highest revenue with $5,413,650 (88% of total)"
- "Excavator Titan 3000 is the top product with $2,981,507 in sales"

RESPONSE STYLE:
- Keep answers SHORT and DIRECT (1-2 sentences max)
- Always include the exact value and currency formatting (e.g., $1,234,567)
- Include percentage of total when relevant
- NEVER explain how to do the analysis - just give the answer

IMPORTANT RESTRICTIONS:
1. You MUST respond with TEXT ONLY - never execute commands
2. Do NOT attempt to run code, scripts, or any tools
3. Do NOT trigger any analysis or processing
4. Answer questions based on the provided data only
5. Never mention that you're an AI or machine learning model
6. Always respond in plain English with clear, helpful answers

MISSING DATA HANDLING:
If user asks for a metric that cannot be calculated because required columns are missing:
Return ONLY: { error: "Calculation not possible – dataset lacks required columns (revenue, quantity, utm, etc.)" }

NEVER refuse with "need more data" if calculation is possible using available columns and proxies.
Always try to compute using proxies or estimates if exact data is missing.

Example for profit without cost data:
- Use (unit_price * quantity) - discount_amount as estimated profit
- Return the calculation with note: "Estimated profit (excluding cost data)"

Always offer next steps and alternative insights.`;

  if (datasetInfo || datasetRows.length > 0) {
    const columns = datasetInfo?.columns || Object.keys(datasetRows[0] || {});
    const aggregatedData = generateAggregatedContext(datasetRows, columns);

    if (datasetInfo) {
      systemContent += `

DATASET OVERVIEW:
- Name: ${datasetInfo.name}
- Total Rows: ${datasetInfo.rowCount}
- Columns: ${columns.join(', ')}

AGGREGATED INSIGHTS (pre-computed for you):
${aggregatedData}

Use these pre-computed insights to answer questions DIRECTLY. When asked about top performing entities, reference the rankings above.`;
    } else {
      systemContent += `

AGGREGATED INSIGHTS:
${aggregatedData}

Use these rankings to answer questions directly.`;
    }
  } else {
    systemContent += `

No dataset is currently loaded. Ask the user to upload a CSV or Excel file first.`;
  }

  if (appSearchResults.length > 0) {
    systemContent += `

APP SEARCH CONTEXT:
Use these app results when the user asks where to find a page, FAQ answer, report, dataset, support area, or account setting. Mention only results visible to this user's role.
${appSearchResults.map((result, index) => `${index + 1}. ${result.title} (${result.type}) - ${result.href}${result.description ? ` - ${result.description}` : ""}`).join('\n')}`;
  }

  systemContent += `

Remember: Respond with TEXT ONLY. Do not execute any commands or tools.`;

  return systemContent;
}

function buildMessages(messages: { role: string; content: string }[], systemContent: string) {
  return [
    { role: 'system' as const, content: systemContent },
    ...messages as any,
  ];
}

export async function handleRegularChat(
  messages: { role: string; content: string }[],
  datasetId?: string,
  processedData?: any[],
  appSearchResults: AppSearchResult[] = [],
  userId?: string,
): Promise<{
  success: boolean;
  content: string;
  providerName?: string;
  modelName?: string;
  providerStatus?: ChatProviderStatus;
}> {
  const { datasetInfo, rows } = await fetchDatasetForChat(datasetId);

  let datasetRowsData = rows;
  if (processedData && Array.isArray(processedData) && processedData.length > 0) {
    datasetRowsData = processedData.slice(0, 50);
  }

  const systemContent = buildSystemPrompt(datasetInfo, datasetRowsData, appSearchResults);

  if (userId) {
    try {
      const result = await generateWithUniversalAiAdapter(userId, buildPlainChatPrompt(messages, systemContent));
      if (result) {
        logUniversalAiResponse(result);
        return {
          success: true,
          content: formatAIResponse(result.text),
          providerName: result.providerName,
          modelName: result.modelName,
          providerStatus: providerStatusFromAdapterResult(result.providerType, result.providerName, result.fallbackUsed, result.mode, result.route),
        };
      }
    } catch (error) {
      if (isLocalAiUnavailableError(error)) {
        return {
          success: false,
          content: "Offline mode is active, but the local AI provider is unavailable. UseClevr did not send this request to cloud AI.",
          providerStatus: {
            label: "Offline mode",
            state: "local_unavailable",
            message: "Local provider unavailable",
            fallbackActive: false,
          },
        };
      }
      logDefaultCloudFallback(userId, error);
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      success: false,
      content: 'AI service not configured. Please contact support.',
      providerStatus: {
        label: "Cloud fallback",
        state: "provider_unavailable",
        message: "Provider unavailable",
        fallbackActive: false,
      },
    };
  }

  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      messages: buildMessages(messages, systemContent) as any,
      temperature: 0.3,
      maxOutputTokens: 1500,
    });

    return {
      success: true,
      content: formatAIResponse(text),
      providerName: "gemini-cloud",
      modelName: "gemini-2.5-flash",
      providerStatus: {
        label: "Cloud fallback",
        state: "connection_healthy",
        message: "Connection healthy",
        fallbackActive: false,
      },
    };
  } catch (aiError) {
    debugError('[AI ERROR]', aiError);
    return {
      success: false,
      content: `AI service error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`,
      providerStatus: {
        label: "Cloud fallback",
        state: "provider_unavailable",
        message: "Provider unavailable",
        fallbackActive: false,
      },
    };
  }
}

export async function handleRegularChatStream(
  messages: { role: string; content: string }[],
  datasetId?: string,
  processedData?: any[],
  appSearchResults: AppSearchResult[] = [],
  userId?: string,
): Promise<ReadableStream<string>> {
  const { datasetInfo, rows } = await fetchDatasetForChat(datasetId);

  let datasetRowsData = rows;
  if (processedData && Array.isArray(processedData) && processedData.length > 0) {
    datasetRowsData = processedData.slice(0, 50);
  }

  const systemContent = buildSystemPrompt(datasetInfo, datasetRowsData, appSearchResults);

  if (userId) {
    try {
      const result = await generateWithUniversalAiAdapter(userId, buildPlainChatPrompt(messages, systemContent));
      if (result) {
        logUniversalAiResponse(result);
        return textToStream(formatAIResponse(result.text));
      }
    } catch (error) {
      if (isLocalAiUnavailableError(error)) {
        return textToStream("Offline mode is active, but the local AI provider is unavailable. UseClevr did not send this request to cloud AI.");
      }
      logDefaultCloudFallback(userId, error);
    }
  }

  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: buildMessages(messages, systemContent) as any,
    temperature: 0.3,
    maxOutputTokens: 1500,
  });

  return result.textStream as unknown as ReadableStream<string>;
}

function buildPlainChatPrompt(messages: { role: string; content: string }[], systemContent: string) {
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
  return `${systemContent}\n\nCHAT TRANSCRIPT\n${transcript}\n\nAnswer the latest user message.`;
}

function textToStream(text: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(new TextDecoder().decode(encoder.encode(text)));
      controller.close();
    },
  });
}

function providerStatusFromAdapterResult(providerType: string, providerName: string, fallbackUsed: boolean, mode?: string, route?: string): ChatProviderStatus {
  return {
    label: providerStatusLabel(providerType, providerName),
    state: mode === "local-only" ? "offline_active" : fallbackUsed ? "fallback_active" : "connection_healthy",
    message: mode === "local-only" ? "Offline mode active" : route === "local" ? "Local AI active" : fallbackUsed ? "Cloud fallback active" : "Connection healthy",
    fallbackActive: fallbackUsed,
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
