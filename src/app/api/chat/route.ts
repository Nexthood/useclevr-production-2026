import { auth } from '@/lib/auth/auth';
import { isBuiltinUserId } from '@/lib/auth/builtin-users';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import {
  EXPLANATION_SYSTEM_PROMPT,
  generateExplanationPrompt
} from '@/lib/utils/queryIntentPrompt';
import { searchApp } from '@/lib/search/app-search';
import { getAnalystCreditUsage } from '@/lib/usage/analyst-credits';
import { chatRequestSchema, validateOrError } from '@/lib/validation';
import { generateAntigravityCompletion, generateAntigravityStream } from '@/lib/ai/antigravity-client';
import {
  generateWithUniversalAiAdapter,
  isLocalAiUnavailableError,
  logDefaultCloudFallback,
  logUniversalAiResponse,
} from '@/lib/ai/universal-ai-adapter';
import { debugError, debugLog } from '@/lib/utils/debug';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { validateDatasetId } from '@/lib/chat/validation';
import { executeStrictSQL } from '@/lib/chat/sql-executor';
import { formatAIResponse } from '@/lib/chat/explanation';
import { handleRegularChat, handleRegularChatStream, type ChatProviderStatus } from '@/lib/chat/fallback';
import { checkChatLoop, logChatExecution } from '@/lib/chat/utils';

function streamResponse(readable: ReadableStream<string>): Response {
  const encoder = new TextEncoder()
  const transformed = readable.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      if (typeof chunk === 'string') {
        controller.enqueue(encoder.encode(chunk))
      }
    },
  }))
  return new Response(transformed, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

async function handleAnalyticalQuery(
  datasetId: string,
  lastMessage: string,
  stream: boolean,
  userId: string,
): Promise<Response> {
  debugLog('[CHAT] Question requires verified computation');

  const validation = await validateDatasetId(datasetId);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: 'No active dataset selected or invalid ID', reason: validation.error },
      { status: 400 }
    );
  }

  debugLog('[STRICT_SQL] Executing strict SQL for:', lastMessage);
  const sqlResult = await executeStrictSQL(datasetId, lastMessage);

  if (!sqlResult.success) {
    debugLog('[STRICT_SQL] Failed:', sqlResult.error);

    const dataset = await db!.query.datasets.findFirst({
      where: eq(datasets.id, datasetId),
    });
    const availableCols = (dataset?.columns as string[]) || [];

    return NextResponse.json({
      error: 'Unable to compute this question from the dataset',
      reason: sqlResult.error || 'No matching computation pattern found',
      availableColumns: availableCols,
      suggestion: 'Try asking about: total revenue, average sales, count of rows, top products by revenue, or rephrase your question to match available columns: ' + availableCols.slice(0, 10).join(', ')
    }, { status: 400 });
  }

  debugLog('[STRICT_SQL] Success! Result:', JSON.stringify(sqlResult.result).slice(0, 200));

  const explainedValue = sqlResult.result.count || sqlResult.result.total || sqlResult.result.average ||
    sqlResult.result.data || sqlResult.result.minimum || sqlResult.result.maximum ||
    sqlResult.result.profitMargin || 0;

  const explanationPrompt = generateExplanationPrompt({
    success: true,
    computed_value: explainedValue,
    operation: sqlResult.result.operation,
    row_count: validation.dataset?.rowCount
  }, lastMessage);

  const fullExplanationPrompt = `${EXPLANATION_SYSTEM_PROMPT}\n\n${explanationPrompt}`;
  let providerStatus: ChatProviderStatus = {
    label: "Cloud fallback",
    state: "connection_healthy",
    message: "Connection healthy",
    fallbackActive: false,
  };

  try {
    const adapterResult = await generateWithUniversalAiAdapter(userId, fullExplanationPrompt);
    if (adapterResult) {
      logUniversalAiResponse(adapterResult);
      const explanation = formatAIResponse(adapterResult.text);
      providerStatus = providerStatusFromAdapterResult(
        adapterResult.providerType,
        adapterResult.providerName,
        adapterResult.fallbackUsed,
        adapterResult.mode,
        adapterResult.route,
      );
      if (stream) {
        return streamResponse(textToReadableStream(explanation));
      }

      return NextResponse.json({
        success: true,
        content: explanation,
        role: 'assistant',
        verified: true,
        providerName: adapterResult.providerName,
        modelName: adapterResult.modelName,
        providerStatus,
        computation: {
          operation: sqlResult.result.operation,
          sql: sqlResult.sql,
          result: sqlResult.result,
        },
      });
    }
  } catch (adapterError) {
    if (isLocalAiUnavailableError(adapterError)) {
      providerStatus = {
        label: "Offline mode",
        state: "local_unavailable",
        message: "Local provider unavailable",
        fallbackActive: false,
      };
      const message = "Offline mode is enabled, but your local AI provider is not reachable.";
      if (stream) {
        return streamResponse(textToReadableStream(message));
      }
      return NextResponse.json({
        success: false,
        content: message,
        role: "assistant",
        verified: true,
        providerStatus,
        computation: {
          operation: sqlResult.result.operation,
          sql: sqlResult.sql,
          result: sqlResult.result,
        },
      });
    }
    providerStatus = {
      label: "Cloud fallback",
      state: "fallback_active",
      message: "Provider unavailable",
      fallbackActive: true,
    };
    logDefaultCloudFallback(userId, adapterError);
  }

  if (stream) {
    const aiStream = generateAntigravityStream({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
        { role: 'user', content: explanationPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    // Wrap the raw AI stream so the last chunk carries metadata
    const encoder = new TextEncoder();
    let fullExplanation = '';
    const wrapped = aiStream.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        const text = typeof chunk === 'string' ? chunk : '';
        fullExplanation += text;
        controller.enqueue(encoder.encode(text));
      },
      flush(controller) {
        const formatted = formatAIResponse(fullExplanation);
        const meta = JSON.stringify({
          _meta: true,
          verified: true,
          content: formatted,
          computation: {
            operation: sqlResult.result.operation,
            sql: sqlResult.sql,
            result: sqlResult.result,
          },
        });
        controller.enqueue(encoder.encode('\n' + meta));
      },
    }));

    return streamResponse(wrapped);
  }

  try {
    const rawExplanation = await generateAntigravityCompletion({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
        { role: 'user', content: explanationPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });
    const explanation = formatAIResponse(rawExplanation);

    return NextResponse.json({
      success: true,
      content: explanation,
      role: 'assistant',
      verified: true,
      providerName: "gemini-cloud",
      modelName: "gemini-2.5-flash",
      providerStatus,
      computation: {
        operation: sqlResult.result.operation,
        sql: sqlResult.sql,
        result: sqlResult.result,
      },
    });
  } catch (antigravityError) {
    debugError('[ANTIGRAVITY] Error generating explanation:', antigravityError);
    return NextResponse.json({
      success: true,
      content: `Result: ${JSON.stringify(sqlResult.result)}`,
      role: 'assistant',
      verified: true,
      providerName: "system",
      modelName: "deterministic-result",
      providerStatus: {
        label: "Cloud fallback",
        state: "provider_unavailable",
        message: "Provider unavailable",
        fallbackActive: true,
      },
      computation: {
        operation: sqlResult.result.operation,
        sql: sqlResult.sql,
        result: sqlResult.result,
      },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateOrError(chatRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { messages, datasetId, processedData, stream } = validation.data;
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const lastMessage = messages[messages.length - 1]?.content || '';
    const isAnalyticalQuery = /\b(how many|how much|total|sum|count|average|avg|top|highest|lowest|minimum|maximum|revenue|profit|region|currency|list|distinct|group by|analyze)\b/i.test(lastMessage);

    if (isAnalyticalQuery && !datasetId) {
      debugLog('[CHAT] REJECTED: Analytical query without datasetId');
      return NextResponse.json(
        {
          success: false,
          error: 'No active dataset selected or invalid dataset ID',
          reason: 'Please select an active dataset before asking analytical questions',
        },
        { status: 400 }
      );
    }

    const appSearchResults = await searchApp({
      query: lastMessage,
      userId,
      role: session.user.role,
      limit: 6,
    });

    if (userId && !isBuiltinUserId(userId)) {
      const usage = await getAnalystCreditUsage(userId, session.user.role);
      if (usage.limitReached) {
        debugLog('[CHAT] REJECTED: Free limit reached');
        return NextResponse.json(
          {
            success: false,
            error: 'Free limit reached',
            message: 'You\'ve used your 2 included Analyst credits. Subscribe to Pro or top up your balance to continue.',
            upgradeRequired: true,
            analysisCount: usage.analysisCount,
            creditsRemaining: 0,
          },
          { status: 403 }
        );
      }
    }

    if (datasetId) {
      debugLog('[CHAT] Validating datasetId:', datasetId);
      const dataset = await db!.query.datasets.findFirst({
        where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
      });

      if (!dataset) {
        debugLog('[CHAT] REJECTED: Dataset not found:', datasetId);
        return NextResponse.json(
          {
            success: false,
            error: 'No active dataset selected or invalid dataset ID',
            reason: 'Dataset not found',
          },
          { status: 400 }
        );
      }

      debugLog('[CHAT] Dataset validated:', dataset.name, '- rows:', dataset.rowCount);
    } else {
      debugLog('[CHAT] No datasetId - non-analytical query allowed');
    }

    const sessionKey = datasetId || 'no-dataset';

    debugLog('[CHAT] Incoming message:', lastMessage);
    debugLog('[CHAT] Dataset ID:', datasetId);

    const loopCheck = checkChatLoop(sessionKey + ':' + lastMessage.slice(0, 50), lastMessage);
    if (!loopCheck.allowed) {
      logChatExecution('LOOP_DETECTED', { sessionKey, message: lastMessage.slice(0, 50) });
      return NextResponse.json(
        { success: false, error: loopCheck.message },
        { status: 429 }
      );
    }

    logChatExecution('AI_CALL_INITIATED', { datasetId, messageLength: lastMessage.length });

    const isAnalyticalQuestion = isAnalyticalQuery || /\b(how many|how much|total|sum|count|average|avg|top|highest|lowest|minimum|maximum|revenue|profit|region|currency|list|distinct|group by|analyze)\b/i.test(lastMessage);

    if (datasetId && isAnalyticalQuestion) {
      return handleAnalyticalQuery(datasetId, lastMessage, !!stream, userId);
    }

    if (stream) {
      const readable = await handleRegularChatStream(messages, datasetId, processedData, appSearchResults, userId);
      return streamResponse(readable);
    }

    const result = await handleRegularChat(messages, datasetId, processedData, appSearchResults, userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.content },
        { status: 500 }
      );
    }

    logChatExecution('AI_CALL_COMPLETE', { datasetId, responseLength: result.content.length });

    return NextResponse.json({
      success: true,
      content: result.content,
      role: 'assistant',
      providerName: result.providerName || "gemini-cloud",
      modelName: result.modelName || "gemini-2.5-flash",
      providerStatus: result.providerStatus || {
        label: "Cloud fallback",
        state: "connection_healthy",
        message: "Connection healthy",
        fallbackActive: false,
      },
    });

  } catch (err: any) {
    debugError('[CHAT CRASH]', {
      message: err.message,
      stack: err.stack?.slice(0, 500),
    });

    return NextResponse.json(
      {
        success: false,
        error: err.message || 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
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

function textToReadableStream(text: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}
