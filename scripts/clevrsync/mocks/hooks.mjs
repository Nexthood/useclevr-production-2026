const here = (name) => new URL(`./${name}`, import.meta.url).href;

const SPECIFIER_MOCKS = new Map([["server-only", here("empty.mjs")]]);

export function resolve(specifier, context, next) {
  const direct = SPECIFIER_MOCKS.get(specifier);
  if (direct) {
    return { url: direct, shortCircuit: true };
  }
  return next(specifier, context);
}
