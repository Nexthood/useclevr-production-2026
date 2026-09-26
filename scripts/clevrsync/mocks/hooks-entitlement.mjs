const here = (name) => new URL(`./${name}`, import.meta.url).href;

const SPECIFIER_MOCKS = new Map([
  ["server-only", here("empty.mjs")],
  ["@/lib/usage/analyst-credits", here("mock-analyst-credits.mjs")],
]);

const RESOLVED_PATH_MOCKS = [
  ["/src/lib/usage/analyst-credits.ts", here("mock-analyst-credits.mjs")],
];

export function resolve(specifier, context, next) {
  const direct = SPECIFIER_MOCKS.get(specifier);
  if (direct) {
    return { url: direct, shortCircuit: true };
  }
  const resolved = next(specifier, context);
  for (const [suffix, mockUrl] of RESOLVED_PATH_MOCKS) {
    if (resolved && typeof resolved.url === "string" && resolved.url.endsWith(suffix)) {
      return { url: mockUrl, shortCircuit: true };
    }
  }
  return resolved;
}
