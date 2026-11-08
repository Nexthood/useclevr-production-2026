import { registerHooks } from "node:module";
const mock = new URL("./mock-auth.mjs", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@/lib/auth/auth") return { url: mock, shortCircuit: true };
    const result = next(specifier, context);
    if (result.url.endsWith("/src/lib/auth/auth.ts")) return { url: mock, shortCircuit: true };
    return result;
  },
});
