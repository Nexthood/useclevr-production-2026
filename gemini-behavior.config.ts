/**
 * GEMINI BEHAVIOR CONFIGURATION
 * Project-specific guidance for Gemini Code Assist.
 */
export const geminiConfig = {
  instructions: [
    "Keep responses concise and minimal.",
    "Do not show code diffs in the chat explanation; provide full file contents or snippets as blocks instead.",
    "Prioritize deterministic TypeScript logic over speculative AI assumptions.",
    "Keep middleware.ts temporarily when it is the stable production packaging path; revisit proxy after Railway deploy stability.",
    "Update docs/AI-interaction after durable AI instruction changes.",
  ],
};
