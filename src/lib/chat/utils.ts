import { debugLog } from "@/lib/utils/debug";

const chatSessionLog: Map<string, { count: number; lastTime: number; lastMessage: string }> = new Map()
const MAX_CHAT_COUNT = 5
const CHAT_TIMEOUT_MS = 60000

export function checkChatLoop(sessionKey: string, message: string): { allowed: boolean; message?: string } {
  const now = Date.now()
  const existing = chatSessionLog.get(sessionKey)

  if (existing) {
    if (now - existing.lastTime > CHAT_TIMEOUT_MS) {
      chatSessionLog.set(sessionKey, { count: 1, lastTime: now, lastMessage: message })
      return { allowed: true }
    }

    if (existing.lastMessage === message && existing.count >= MAX_CHAT_COUNT) {
      return {
        allowed: false,
        message: `Chat blocked: Same message repeated ${MAX_CHAT_COUNT}+ times. Please rephrase your question.`
      }
    }

    chatSessionLog.set(sessionKey, {
      count: existing.count + 1,
      lastTime: now,
      lastMessage: message
    })
  } else {
    chatSessionLog.set(sessionKey, { count: 1, lastTime: now, lastMessage: message })
  }

  return { allowed: true }
}

export function logChatExecution(
  action: string,
  details: Record<string, any>,
  options: { datasetId?: string; userId?: string; question?: string; sql?: string; executionTime?: number; success?: boolean } = {}
) {
  const logEntry: Record<string, unknown> = {
    ...details,
    ...options,
    action,
    timestamp: new Date().toISOString(),
    ...(options.question && {
      questionLength: options.question.length,
      isAnalytical: /\b(how many|how much|total|sum|count|average|avg|top|highest|lowest|minimum|maximum|revenue|profit|region|currency|list|distinct|group by|analyze)\b/i.test(options.question)
    }),
    ...(options.sql && { sqlGenerated: true, sqlLength: options.sql.length }),
    ...(options.executionTime !== undefined && { executionTimeMs: options.executionTime }),
    ...(options.success !== undefined && { success: options.success }),
  };
  delete logEntry.question;
  delete logEntry.sql;
  delete logEntry.message;
  delete logEntry.prompt;
  delete logEntry.processedData;
  delete logEntry.datasetRows;
  delete logEntry.rows;
  delete logEntry.data;

  debugLog(`[CHAT] ${action}:`, JSON.stringify(logEntry));
}
