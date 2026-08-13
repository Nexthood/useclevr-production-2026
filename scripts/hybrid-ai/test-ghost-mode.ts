import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8")
}

function assertIncludes(source: string, text: string, label: string) {
  assert.ok(source.includes(text), `${label} must include ${text}`)
}

const ghostMode = read("src/lib/ai/ghost-mode.ts")
assertIncludes(ghostMode, "GHOST_MODE_STORAGE_KEY", "ghost-mode.ts")
assertIncludes(ghostMode, "normalizeGhostMode", "ghost-mode.ts")
assertIncludes(ghostMode, "Eclipse Mode skips normal AI conversation history and content-level traces", "ghost-mode.ts")
assert.ok(!/Nothing leaves your device|Nobody can access your data|100% private|Zero data processing/.test(ghostMode), "Eclipse Mode copy must avoid unsupported privacy claims")

const assistant = read("src/components/chat/ai-assistant-workspace.tsx")
assertIncludes(assistant, "GHOST_MODE_STORAGE_KEY", "AI Assistant workspace")
assertIncludes(assistant, "Eclipse Mode ON", "AI Assistant workspace")
assertIncludes(assistant, "Eclipse Mode OFF", "AI Assistant workspace")
assertIncludes(assistant, "Eclipse Mode — minimize AI conversation retention", "AI Assistant workspace")
assertIncludes(assistant, "Private AI session with minimized conversation retention. Cloud AI may still process the minimum context required to answer.", "AI Assistant workspace")
assertIncludes(assistant, "EclipseModeGlyph", "AI Assistant workspace")
assertIncludes(assistant, "role=\"switch\"", "AI Assistant workspace")
assertIncludes(assistant, "aria-checked={ghostMode}", "AI Assistant workspace")
assertIncludes(assistant, "motion-reduce:transition-none", "AI Assistant workspace")
assertIncludes(assistant, "duration-300", "AI Assistant workspace")
assertIncludes(assistant, "body: JSON.stringify({", "AI Assistant workspace")
assertIncludes(assistant, "ghostMode,", "AI Assistant workspace")
assertIncludes(assistant, "sessionStorage.setItem(GHOST_MODE_STORAGE_KEY", "AI Assistant workspace")
assertIncludes(assistant, "sessionStorage.removeItem(GHOST_MODE_STORAGE_KEY)", "AI Assistant workspace")
assertIncludes(assistant, "setMessages([buildDatasetContextMessage(selectedDatasetId, datasets)])", "AI Assistant workspace")
assertIncludes(assistant, "Eclipse Mode conversations are not saved to history.", "AI Assistant workspace")
assertIncludes(assistant, "Dataset storage is unchanged.", "AI Assistant workspace")
assertIncludes(assistant, "disabled={ghostMode || !message.traceId}", "AI Assistant workspace")
assert.ok(!assistant.includes("Ghost Mode ON"), "AI Assistant must not show Ghost Mode product copy")

const validation = read("src/lib/validation.ts")
assertIncludes(validation, "ghostMode: z.boolean().optional().default(false)", "validation.ts")

const trace = read("src/lib/ai/ai-trace.ts")
assertIncludes(trace, "ghostMode?: boolean | null", "ai-trace.ts")
assertIncludes(trace, "if (normalizeGhostMode(input.ghostMode)) return null", "ai-trace.ts")
assert.ok(!/ghostMode[\s\S]{0,160}await db\.insert\(aiInteractionTraces\)/.test(trace), "Eclipse Mode must not insert content-level AI traces")

const historyRoute = read("src/app/api/assistant/history/route.ts")
assertIncludes(historyRoute, "normalizeGhostMode(body.ghostMode)", "assistant history route")
assertIncludes(historyRoute, "trace: null", "assistant history route")

const analyzeRoute = read("src/app/api/analyze/route.ts")
assertIncludes(analyzeRoute, "ghostModeTraceMessage", "analyze route")
assertIncludes(analyzeRoute, "isGhostMode = normalizeGhostMode(ghostMode)", "analyze route")
assertIncludes(analyzeRoute, "traceUserId && !isGhostMode", "analyze route")
assertIncludes(analyzeRoute, "Ghost Mode question metadata", "analyze route")
assertIncludes(analyzeRoute, "finalizeCredits", "analyze route")
assertIncludes(analyzeRoute, "logAiCost", "analyze route")

const chatRoute = read("src/app/api/chat/route.ts")
assertIncludes(chatRoute, "ghostModeTraceMessage", "chat route")
assertIncludes(chatRoute, "Incoming Ghost Mode message metadata", "chat route")
assertIncludes(chatRoute, "handleAnalyticalQuery(datasetId, lastMessage, !!stream, userId, ghostMode)", "chat route")

const hybridChatRoute = read("src/app/api/hybrid-ai/chat/route.ts")
assertIncludes(hybridChatRoute, "ghostMode: z.boolean().optional().default(false)", "hybrid chat route")
assertIncludes(hybridChatRoute, "createTrace", "hybrid chat route")
assertIncludes(hybridChatRoute, "const trace = ghostMode ? null : await createTrace", "hybrid chat route")
assertIncludes(hybridChatRoute, "traceId: trace?.id ?? null", "hybrid chat route")
assertIncludes(hybridChatRoute, "recordAiRequestAudit", "hybrid chat route")
assertIncludes(hybridChatRoute, "privacyWarning: ghostMode ? ghostModeTraceMessage() : null", "hybrid chat route")

const datasetChatRoute = read("src/app/api/hybrid-ai/dataset-chat/route.ts")
assertIncludes(datasetChatRoute, "ghostMode: z.boolean().optional().default(false)", "dataset chat route")
assertIncludes(datasetChatRoute, "ghostModeWarning", "dataset chat route")
assertIncludes(datasetChatRoute, "async function createDatasetChatTrace", "dataset chat route")
assertIncludes(datasetChatRoute, "if (input.ghostMode) return null", "dataset chat route")
assertIncludes(datasetChatRoute, "traceId: trace?.id ?? null", "dataset chat route")
assertIncludes(datasetChatRoute, "recordAiRequestAudit", "dataset chat route")
assertIncludes(datasetChatRoute, "datasetId: parsed.datasetId", "dataset chat route")
assert.ok(!datasetChatRoute.includes("Nothing leaves your device"), "dataset chat route must avoid unsupported local-only claims")

const privacyPolicy = read("src/app/(public)/privacy/page.tsx")
assertIncludes(privacyPolicy, "Eclipse Mode minimizes UseClevr retention for AI conversations", "privacy policy")
assertIncludes(privacyPolicy, "provider-routing metadata", "privacy policy")
assert.ok(!/Nothing leaves your device|Nobody can access your data|100% private|Zero data processing/.test(privacyPolicy), "Privacy Policy must avoid unsupported Eclipse Mode claims")

console.log("Eclipse Mode checks passed.")
