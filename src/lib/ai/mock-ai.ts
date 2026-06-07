export const MOCK_AI_PROVIDER_NAME = "Mock AI"
export const MOCK_AI_MODEL_NAME = "mock-local-development"

type MockCompletionInput = {
  messages?: { role: "system" | "user" | "assistant"; content: string }[]
  prompt?: string
  resultRows?: Record<string, unknown>[]
}

function getDelayMs() {
  const raw = Number(process.env.MOCK_AI_RESPONSE_DELAY_MS ?? 250)
  if (!Number.isFinite(raw)) return 250
  return Math.max(0, Math.min(raw, 5000))
}

function getLatestUserText(messages?: { role: "system" | "user" | "assistant"; content: string }[], prompt?: string) {
  const latestUserMessage = [...(messages ?? [])].reverse().find((message) => message.role === "user")
  return (latestUserMessage?.content || prompt || "").trim()
}

function summarizeRows(rows: Record<string, unknown>[] = []) {
  if (rows.length === 0) return "No result rows are available for this mock response."

  const first = rows[0]
  const entries = Object.entries(first).slice(0, 4)
  const summary = entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ")
  return `${rows.length} result ${rows.length === 1 ? "row" : "rows"} returned. Top row: ${summary}.`
}

async function delay() {
  const delayMs = getDelayMs()
  if (delayMs === 0) return
  await new Promise((resolve) => setTimeout(resolve, delayMs))
}

export function isMockAIMode() {
  return process.env.NODE_ENV !== "production" && process.env.MOCK_AI_MODE === "true"
}

export async function generateMockAICompletion(input: MockCompletionInput = {}) {
  await delay()

  const userText = getLatestUserText(input.messages, input.prompt)
  const lower = userText.toLowerCase()

  if (lower.includes("report") || lower.includes("pdf") || lower.includes("presentation")) {
    return JSON.stringify({
      action: "generate_report",
      format: lower.includes("presentation") ? "ppt" : "pdf",
      report_type: lower.includes("investor") || lower.includes("board") ? "pro" : "standard",
      title: "Mock business report",
      executive_summary: "Mock AI mode returns deterministic report content for local UI testing.",
      kpis: [{ name: "Mock KPI", value: "100%", insight: "Development response generated locally." }],
      sections: [{ title: "Mock analysis", content: "Use this response to validate report UI states without external AI calls." }],
      charts: [{ type: "bar", title: "Mock comparison", x_axis: "category", y_axis: "value", reason: "Shows chart rendering state." }],
      recommendations: ["Validate the report flow locally.", "Switch off mock mode before production checks."],
    })
  }

  const dataSummary = summarizeRows(input.resultRows)
  return [
    "MOCK RESPONSE",
    "",
    `Question: ${userText || "No prompt supplied."}`,
    "",
    dataSummary,
    "",
    "This local development response verifies chat, tracing, loading, and error-free UI behavior without calling external AI providers.",
  ].join("\n")
}

export async function generateMockAnalysisText(input: {
  question: string
  resultRows: Record<string, unknown>[]
}) {
  await delay()
  const dataSummary = summarizeRows(input.resultRows)

  return [
    "INSIGHT",
    input.resultRows.length > 0 ? "Mock analysis completed from the available query result." : "Mock analysis has no rows to summarize.",
    "",
    "EXPLANATION",
    `${dataSummary} Mock mode is active for local development, so no external AI provider is called.`,
    "",
    "RECOMMENDATION",
    "Use this response to verify the UI and trace flow, then disable mock mode for provider validation.",
  ].join("\n")
}

export function streamMockAICompletion(input: MockCompletionInput = {}) {
  return new ReadableStream<string>({
    async start(controller) {
      const content = await generateMockAICompletion(input)
      for (const chunk of content.match(/.{1,80}(\s|$)/g) ?? [content]) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}
