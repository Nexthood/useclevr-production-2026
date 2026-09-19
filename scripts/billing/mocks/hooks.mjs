const here = (name) => new URL(`./${name}`, import.meta.url).href

const SPECIFIER_MOCKS = new Map([
  ["@/lib/db", here("mock-db.mjs")],
  ["@/lib/billing/credit-account-service", here("mock-credit-account.mjs")],
  ["@/services/stripe/credit-checkout", here("mock-stripe.mjs")],
  ["@/lib/email/subscription-emails", here("mock-emails.mjs")],
])

const RESOLVED_PATH_MOCKS = [
  ["/src/lib/db/index.ts", here("mock-db.mjs")],
  ["/src/lib/billing/credit-account-service.ts", here("mock-credit-account.mjs")],
  ["/src/services/stripe/credit-checkout.ts", here("mock-stripe.mjs")],
  ["/src/lib/email/subscription-emails.ts", here("mock-emails.mjs")],
]

export function resolve(specifier, context, next) {
  const direct = SPECIFIER_MOCKS.get(specifier)
  if (direct) {
    return { url: direct, shortCircuit: true }
  }

  const resolved = next(specifier, context)
  for (const [suffix, mockUrl] of RESOLVED_PATH_MOCKS) {
    if (resolved && typeof resolved.url === "string" && resolved.url.endsWith(suffix)) {
      return { url: mockUrl, shortCircuit: true }
    }
  }
  return resolved
}
