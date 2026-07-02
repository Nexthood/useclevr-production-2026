import http from "node:http"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const PORT = Number(process.env.USECLEVR_HELPER_PORT || 14567)
const HOST = process.env.USECLEVR_HELPER_HOST || "127.0.0.1"
const PRIVATE_ENGINE_URL = process.env.USECLEVR_PRIVATE_ENGINE_URL || "http://localhost:11434/api/chat"
const PRIVATE_ENGINE_MODEL = process.env.USECLEVR_PRIVATE_ENGINE_MODEL || "llama3.2:3b-instruct"
const __dirname = dirname(fileURLToPath(import.meta.url))

const hybridAiFeatures = {
  privateChat: true,
  csvExcelAnalysis: true,
  dashboardInsights: true,
  singleAiProvider: true,
  aiModeRouting: true,
  multipleAiProviders: true,
  multiDocumentAnalysis: true,
  advancedReports: true,
  aiAuditLogs: true,
  workflowAutomationRoadmap: true,
  helperRoadmap: true,
  aiAgents: true,
  deepResearch: true,
  backgroundTasks: true,
  businessAssistants: true,
  teamAi: true,
  localKnowledgeBase: true,
}

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
}

function sendJson(response, status, body) {
  response.writeHead(status, jsonHeaders)
  response.end(JSON.stringify(body))
}

async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

async function checkPrivateEngine() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(PRIVATE_ENGINE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: PRIVATE_ENGINE_MODEL,
        stream: false,
        messages: [{ role: "user", content: "Reply with ok." }],
        options: { num_predict: 4 },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return response.ok
  } catch {
    clearTimeout(timeout)
    return false
  }
}

function buildPrivateAnalysisPrompt(message, datasetContext) {
  const context = datasetContext
    ? `\n\nDataset context:\n${JSON.stringify(datasetContext, null, 2).slice(0, 12000)}`
    : ""

  return [
    "You are UseClevr Hybrid AI running private analysis on this device.",
    "Answer in clear business language. Use only the provided message and dataset context.",
    "If the available context is not enough, say what is missing and suggest the next safe step.",
    "",
    `User question: ${message}`,
    context,
  ].join("\n")
}

async function askPrivateEngine({ message, datasetContext }) {
  const response = await fetch(PRIVATE_ENGINE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: PRIVATE_ENGINE_MODEL,
      stream: false,
      messages: [
        {
          role: "user",
          content: buildPrivateAnalysisPrompt(message, datasetContext),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`private_engine_unavailable:${response.status}`)
  }

  const body = await response.json()
  return String(body?.message?.content || body?.response || "").trim()
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, jsonHeaders)
    response.end()
    return
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`)

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true, app: "UseClevr Helper" })
      return
    }

    if (request.method === "GET" && url.pathname === "/status") {
      sendJson(response, 200, {
        connected: true,
        privateEngineReady: await checkPrivateEngine(),
        features: hybridAiFeatures,
        modules: {
          lite: [
            "privateChat",
            "csvExcelAnalysis",
            "dashboardInsights",
            "singleAiProvider",
            "aiModeRouting",
          ],
          mega: [
            "privateChat",
            "csvExcelAnalysis",
            "dashboardInsights",
            "singleAiProvider",
            "aiModeRouting",
            "multipleAiProviders",
            "multiDocumentAnalysis",
            "advancedReports",
            "aiAuditLogs",
            "workflowAutomationRoadmap",
            "helperRoadmap",
            "aiAgents",
            "deepResearch",
            "backgroundTasks",
            "businessAssistants",
            "teamAi",
            "localKnowledgeBase",
          ],
        },
      })
      return
    }

    if (request.method === "POST" && url.pathname === "/chat") {
      const body = await readJsonBody(request)
      const message = typeof body.message === "string" ? body.message.trim() : ""
      if (!message) {
        sendJson(response, 400, { error: "message_required" })
        return
      }

      try {
        const answer = await askPrivateEngine({
          message,
          datasetContext: body.datasetContext && typeof body.datasetContext === "object" ? body.datasetContext : undefined,
        })
        sendJson(response, 200, {
          answer: answer || "Private analysis completed, but no answer was returned.",
          mode: "private-analysis",
        })
      } catch {
        sendJson(response, 503, {
          answer: "Private AI Analysis needs setup before it can answer.",
          mode: "private-analysis",
          error: "private_engine_not_ready",
        })
      }
      return
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/chat-window")) {
      const html = await readFile(join(__dirname, "../public/index.html"), "utf8")
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/html; charset=utf-8",
      })
      response.end(html)
      return
    }

    sendJson(response, 404, { error: "not_found" })
  } catch {
    sendJson(response, 500, { error: "helper_error" })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`UseClevr Helper running at http://${HOST}:${PORT}`)
})
