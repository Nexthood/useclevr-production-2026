const here = (name) => new URL(`./${name}`, import.meta.url).href

const SPECIFIER_MOCKS = new Map([
  ["@/lib/db", here("mock-ai-db.mjs")],
  ["@/lib/hybrid-ai/feature-gate", here("mock-feature-gate.mjs")],
  ["node:dns/promises", here("mock-dns.mjs")],
])

const RESOLVED_PATH_MOCKS = [
  ["/src/lib/db/index.ts", here("mock-ai-db.mjs")],
  ["/src/lib/db.ts", here("mock-ai-db.mjs")],
  ["/src/lib/hybrid-ai/feature-gate.ts", here("mock-feature-gate.mjs")],
]

export function resolve(specifier, context, next) {
  const direct = SPECIFIER_MOCKS.get(specifier)
  if (direct) {
    return { url: direct, shortCircuit: true }
  }

  const resolved = next(specifier, context)
  if (resolved && typeof resolved.url === "string") {
    for (const [suffix, mockUrl] of RESOLVED_PATH_MOCKS) {
      if (resolved.url.endsWith(suffix)) {
        return { url: mockUrl, shortCircuit: true }
      }
    }
  }
  return resolved
}
