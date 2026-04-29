const DEBUG_FLAG =
  process.env.DEBUG === "1" ||
  process.env.DEBUG === "true" ||
  process.env.NEXT_PUBLIC_DEBUG === "1" ||
  process.env.NEXT_PUBLIC_DEBUG === "true"

export const isDebug = DEBUG_FLAG

export function debugLog(...args: unknown[]) {
  if (isDebug) console.log(...args)
}

export function debugError(...args: unknown[]) {
  if (isDebug) console.error(...args)
}
