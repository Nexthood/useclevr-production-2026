import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { generateAntigravityCompletion, generateAntigravityStream } from '@/lib/ai/antigravity-client';
import { debugLog, debugError } from '@/lib/utils/debug';
import { eq } from 'drizzle-orm';
import { normalizeDataset, generateAggregatedContext } from './sql-executor';
import { formatAIResponse } from './explanation';
import type { AppSearchResult } from '@/lib/search/app-search';

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
  let systemContent = `You are Clevr, elite AI analyst for startup founders and investors.

Your ONLY rule for analytical/numeric questions: ALWAYS compute using available data – no excuses, no "need more data", no "not supported".

For ANY question with ROAS, CAC, LTV, profit, margin, revenue attribution, channel performance, campaign ROI:

1. Use utm_source, utm_medium, utm_campaign for attribution when available.
2. Calculate ROAS as: ROAS = SUM(net_revenue) / SUM(estimated_ad_spend) per channel
   - If no direct ad_spend: use proxy (e.g. 10% of net_revenue as estimated cost, or average CPA from known data)
3. Calculate CAC as: total marketing_cost / new customers acquired per channel
4. Calculate LTV as: average net_revenue per customer * estimated lifespan (use 12 months default if unknown)
5. Profit: (unit_price * quantity) - discount_amount - tax - shipping - refund_amount
6. Margin %: (Profit / Gross Revenue) * 100

ALWAYS generate and EXECUTE real SQL to compute it (use datasetId from request).

If calculation impossible (no revenue, no quantity, no attribution columns):
Return ONLY: { error: "Calculation not possible – dataset lacks required columns (revenue, quantity, utm, etc.)" }

NEVER say:
- "no cost data"
- "need ad spend"
- "cannot calculate ROAS"
- "operation not supported"
- "upload dataset with..."

Response structure:
- Direct answer first (e.g. "Best ROAS is Google Ads with 4.2x")
- Breakdown/table with real numbers
- Founder action: "Double budget on X, kill Y"
- If visualization: suggest chart type

IMPORTANT: Compute ROAS, CAC, LTV, profit, margin using available columns. Use proxies if needed. NEVER refuse with 'need more data' if calculation possible. Execute SQL first. If impossible, return exact error.

Accuracy overrides fluency.
Never guess or approximate.
Never hallucinate.

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

No dataset is currently loaded. Ask the user to upload a CSV file first.`;
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
  appSearchResults: AppSearchResult[] = []
): Promise<{ success: boolean; content: string }> {
  const { datasetInfo, rows } = await fetchDatasetForChat(datasetId);

  let datasetRowsData = rows;
  if (processedData && Array.isArray(processedData) && processedData.length > 0) {
    datasetRowsData = processedData.slice(0, 50);
  }

  const systemContent = buildSystemPrompt(datasetInfo, datasetRowsData, appSearchResults);

  if (!process.env.GEMINI_API_KEY) {
    return { success: false, content: 'AI service not configured. Please contact support.' };
  }

  try {
    const content = await generateAntigravityCompletion({
      model: 'gemini-2.5-flash',
      messages: buildMessages(messages, systemContent),
      temperature: 0.3,
      max_tokens: 1500,
    });

    return { success: true, content: formatAIResponse(content) };
  } catch (antigravityError) {
    debugError('[ANTIGRAVITY ERROR]', antigravityError);
    return {
      success: false,
      content: `AI service error: ${antigravityError instanceof Error ? antigravityError.message : 'Unknown error'}`,
    };
  }
}

export async function handleRegularChatStream(
  messages: { role: string; content: string }[],
  datasetId?: string,
  processedData?: any[],
  appSearchResults: AppSearchResult[] = []
): Promise<ReadableStream<string>> {
  const { datasetInfo, rows } = await fetchDatasetForChat(datasetId);

  let datasetRowsData = rows;
  if (processedData && Array.isArray(processedData) && processedData.length > 0) {
    datasetRowsData = processedData.slice(0, 50);
  }

  const systemContent = buildSystemPrompt(datasetInfo, datasetRowsData, appSearchResults);

  return generateAntigravityStream({
    model: 'gemini-2.5-flash',
    messages: buildMessages(messages, systemContent),
    temperature: 0.3,
    max_tokens: 1500,
  });
}
