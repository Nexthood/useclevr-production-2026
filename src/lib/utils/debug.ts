function isDebugValue(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized !== "0" && normalized !== "false" && normalized !== "off"
}

const DEBUG_FLAG =
  isDebugValue(process.env.DEBUG) ||
  isDebugValue(process.env.NEXT_PUBLIC_DEBUG)

export const isDebug = DEBUG_FLAG

export function debugLog(...args: unknown[]) {
  if (isDebug) console.log(...args)
}

export function debugError(...args: unknown[]) {
  if (isDebug) console.error(...args)
}

export function debugWarn(...args: unknown[]) {
  if (isDebug) console.warn(...args)
}
