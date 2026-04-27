UseClevr Local Agent – MVP API Contract

Base URL (local-only): http://127.0.0.1:5143

Endpoints

1) GET /status
- Purpose: Report local runtime presence and installed models
- Response 200 JSON:
  {
    "runtime": "unavailable" | "installing" | "available" | "starting" | "error",
    "models": [{ "name": string }],
    "info"?: string
  }

2) POST /install-runtime
- Purpose: Begin OS-specific runtime installation (non-blocking)
- Request JSON: {}
- Response 202 JSON: { "accepted": true }

3) POST /start-runtime
- Purpose: Start/ensure the local runtime is running
- Request JSON: {}
- Response 200 JSON: { "started": boolean }

4) POST /pull-model
- Purpose: Download/install a model via the local runtime
- Request JSON: { "model": string }
- Response 202 JSON: { "accepted": true }

5) POST /verify
- Purpose: Run a minimal test prompt to verify the selected model
- Request JSON: { "model": string }
- Response 200 JSON: { "ok": boolean }

Notes
- All operations are local and UseClevr-branded in the host app.
- Runtime/engine technicals are secondary; public UX remains UseClevr-first.
- Long-running actions should be asynchronous; status polled via GET /status.
