import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

function assertIncludes(source: string, expected: string, message: string) {
  assert.ok(source.includes(expected), message)
}

function assertNotIncludes(source: string, forbidden: string, message: string) {
  assert.equal(source.includes(forbidden), false, message)
}

function extractCalls(source: string, callNames: string[]) {
  return source
    .split("\n")
    .filter((line) => callNames.some((name) => line.includes(`${name}(`)))
    .join("\n")
}

function main() {
  const chatRoute = readProjectFile("src/app/api/chat/route.ts")
  const analyzeRoute = readProjectFile("src/app/api/analyze/route.ts")
  const sqlExecutor = readProjectFile("src/lib/chat/sql-executor.ts")
  const chatUtils = readProjectFile("src/lib/chat/utils.ts")
  const chatFallback = readProjectFile("src/lib/chat/fallback.ts")
  const verificationEmail = readProjectFile("src/lib/auth/verification-email.ts")

  const chatLogs = extractCalls(chatRoute, ["debugLog", "debugError", "logChatExecution"])
  assertIncludes(chatRoute, "messageLength", "chat logs retain message length metadata")
  assertIncludes(chatRoute, "datasetId", "chat logs retain dataset metadata")
  assertIncludes(chatRoute, "ghostMode", "chat logs retain Ghost Mode metadata")
  assertNotIncludes(chatLogs, "lastMessage)", "chat logs never pass complete user message content")
  assertNotIncludes(chatLogs, "lastMessage.slice", "chat logs never pass user-message snippets")
  assertNotIncludes(chatLogs, "JSON.stringify(sqlResult.result)", "chat logs never stringify SQL result data")
  assertNotIncludes(chatLogs, "processedData", "chat logs never pass processed dataset rows")
  assertNotIncludes(chatLogs, "prompt:", "chat logs never pass prompt text")

  assertIncludes(chatRoute, "return handleAnalyticalQuery(datasetId, lastMessage, !!stream, userId, ghostMode)", "normal analytical chat still uses the existing handler")
  assertIncludes(chatRoute, "handleRegularChat(messages, datasetId, processedData, appSearchResults, userId)", "normal non-stream chat still calls the existing chat handler")
  assertIncludes(chatRoute, "handleRegularChatStream(messages, datasetId, processedData, appSearchResults, userId)", "normal stream chat still calls the existing stream handler")
  assertIncludes(chatRoute, "privacyWarning: ghostMode ? ghostModeTraceMessage() : undefined", "Ghost Mode privacy response remains intact")

  const analyzeLogs = extractCalls(analyzeRoute, ["debugLog", "debugError", "debugWarn"])
  assertIncludes(analyzeRoute, "questionLength: question.length", "analysis logs retain question length metadata")
  assertIncludes(analyzeRoute, "ghostMode: isGhostMode", "analysis logs retain Ghost Mode metadata")
  assertNotIncludes(analyzeLogs, "Question:', question", "analysis logs never pass complete question text")

  const sqlLogs = extractCalls(sqlExecutor, ["debugLog", "debugError"])
  assertIncludes(sqlExecutor, "questionLength", "SQL diagnostics retain question length")
  assertIncludes(sqlExecutor, "rowCount", "SQL diagnostics retain row count")
  assertIncludes(sqlExecutor, "columnCount", "SQL diagnostics retain column count")
  assertIncludes(sqlExecutor, "operation", "SQL diagnostics retain operation metadata")
  assertNotIncludes(sqlLogs, "question:", "SQL diagnostics never log question text")
  assertNotIncludes(sqlLogs, "Generated SQL", "SQL diagnostics never log raw SQL")
  assertNotIncludes(sqlLogs, "JSON.stringify(result)", "SQL diagnostics never stringify result data")
  assertNotIncludes(sqlLogs, "${value}", "normalization diagnostics never log raw values")

  assertIncludes(chatUtils, "questionLength: options.question.length", "chat execution logs derive question length")
  assertIncludes(chatUtils, "sqlGenerated: true", "chat execution logs retain SQL presence metadata")
  for (const deletedKey of ["question", "sql", "message", "prompt", "processedData", "datasetRows", "rows", "data"]) {
    assertIncludes(chatUtils, `delete logEntry.${deletedKey}`, `chat execution logs delete raw ${deletedKey}`)
  }

  const fallbackLogs = extractCalls(chatFallback, ["debugError"])
  assertNotIncludes(fallbackLogs, "aiError);", "fallback AI errors are logged as metadata, not raw error objects")

  const emailLogs = extractCalls(verificationEmail, ["debugLog", "console.warn", "console.error"])
  assertIncludes(verificationEmail, "maskEmail(email)", "verification email logs mask the recipient email")
  assertIncludes(verificationEmail, "codeGenerated: Boolean(code)", "console provider logs only code-generated metadata")
  assertNotIncludes(emailLogs, "${code}", "verification email logs never interpolate the code")
  assertNotIncludes(emailLogs, "verification code for", "console provider no longer logs email plus code")
  assertNotIncludes(emailLogs, "config.apiKey", "Resend API key is not logged")
  assertNotIncludes(emailLogs, "Authorization", "authorization headers are not logged")
  assertNotIncludes(emailLogs, "sessionToken", "session tokens are not logged")
  assertNotIncludes(emailLogs, "password", "passwords are not logged")
}

main()
