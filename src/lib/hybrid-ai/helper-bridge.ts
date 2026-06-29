export const USECLEVR_HELPER_BASE_URL = "http://localhost:14567"

export type UseClevrHelperStatus =
  | { state: "connected"; message: "Secure runtime connected"; connected: true; privateEngineReady: true }
  | { state: "setup"; message: "Private AI engine needs setup"; connected: true; privateEngineReady: false }
  | { state: "offline"; message: "UseClevr Helper is not running"; connected: false; privateEngineReady: false }

export async function getUseClevrHelperStatus(): Promise<UseClevrHelperStatus> {
  try {
    const health = await fetch(`${USECLEVR_HELPER_BASE_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    })
    if (!health.ok) throw new Error("helper_offline")

    const status = await fetch(`${USECLEVR_HELPER_BASE_URL}/status`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    })
    if (!status.ok) throw new Error("helper_status_failed")

    const body = await status.json().catch(() => ({}))
    if (body?.connected && body?.privateEngineReady) {
      return {
        state: "connected",
        message: "Secure runtime connected",
        connected: true,
        privateEngineReady: true,
      }
    }

    return {
      state: "setup",
      message: "Private AI engine needs setup",
      connected: true,
      privateEngineReady: false,
    }
  } catch {
    return {
      state: "offline",
      message: "UseClevr Helper is not running",
      connected: false,
      privateEngineReady: false,
    }
  }
}

export async function askUseClevrHelper(message: string, datasetContext?: object) {
  const response = await fetch(`${USECLEVR_HELPER_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      datasetContext,
      mode: "private-analysis",
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    throw new Error("private_analysis_failed")
  }

  const body = await response.json()
  return {
    answer: String(body?.answer || ""),
    mode: "private-analysis" as const,
  }
}
