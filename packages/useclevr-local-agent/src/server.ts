/**
 * UseClevr Local Agent (MVP)
 * Minimal localhost server exposing a health/status endpoint.
 * This is the foundation for the UseClevr Hybrid AI Runtime.
 */

import http from 'http'
import { URL } from 'url'

const PORT = Number(process.env.USECLEVR_AGENT_PORT || 5143)

// Basic JSON responder utility
function json(res: http.ServerResponse, code: number, body: unknown) {
  const data = Buffer.from(JSON.stringify(body))
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', String(data.length))
  res.end(data)
}

// Status payload aligned with app/api/local-ai-status/route.ts expectations
function statusOk() {
  return {
    success: true,
    name: 'UseClevr Local Agent',
    product: 'UseClevr Hybrid Runtime',
    runtime: 'available',
    version: process.env.USECLEVR_AGENT_VERSION || '0.1.0',
  }
}

const server = http.createServer((req, res) => {
  try {
    if (!req.url) return json(res, 404, { success: false })
    const u = new URL(req.url, `http://localhost:${PORT}`)

    // CORS for local web app usage (minimal, localhost only)
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      return res.end()
    }

    if (req.method === 'GET' && u.pathname === '/status') {
      return json(res, 200, statusOk())
    }

    if (req.method === 'GET' && u.pathname === '/health') {
      return json(res, 200, { ok: true })
    }

    return json(res, 404, { success: false, error: 'not_found' })
  } catch (e) {
    return json(res, 500, { success: false, error: 'agent_error' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[UseClevr Local Agent] listening on http://127.0.0.1:${PORT}`)
})
