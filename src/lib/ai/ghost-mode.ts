export const GHOST_MODE_STORAGE_KEY = "useclevr_ghost_mode"

export function normalizeGhostMode(value: unknown): boolean {
  return value === true || value === "true" || value === "1"
}

export function ghostModeTraceMessage() {
  return "Eclipse Mode skips normal AI conversation history and content-level traces. Operational metadata for billing, security, provider routing, latency, token use, request status, and errors may still be retained."
}
