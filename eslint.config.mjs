import { fileURLToPath } from "node:url";

const CWD = fileURLToPath(new URL(".", import.meta.url));

// ── Flat config (ESM, ESLint 10.x) ─────────────────────────────────────────
// Next.js 16 dropped the built-in `next lint` command — use eslint directly.
// Rules aligned with ``ai-chat-behavior.config.ts`` comms style rules:
//   • clear, direct, product-first language
//   • no unused vars (prefixed `_` is fine)
//   • TypeScript prefers type-only imports
// Run: pnpm lint

export default [
  {
    ignores: [
      "dist/**",
      ".next/**",
      "node_modules/**",
      "mcp/**",
      "**/*.config.*",
      ".TODO/**",
      "scripts/**",
      "docs/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mjs", "**/*.js"],
    languageOptions: {
      parser: (await import("@typescript-eslint/parser")).default,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: `${CWD}/tsconfig.json`,
        tsconfigRootDir: CWD,
      },
    },
    plugins: {
      "@typescript-eslint": (await import("@typescript-eslint/eslint-plugin")).default,
    },
    rules: {
      // Turn all @typescript-eslint violations into warnings, not hard errors
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-explicit-any": ["warn", { ignoreRestArgs: true }],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
  },
];
