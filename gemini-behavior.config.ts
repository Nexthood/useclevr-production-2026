/**
 * GEMINI BEHAVIOR CONFIGURATION
 * Project-specific guidance for Gemini Code Assist.
 */
export const geminiConfig = {
  instructions: [
    "Keep responses concise and minimal.",
    "Do not show code diffs in the chat explanation; provide full file contents or snippets as blocks instead.",
    "Prioritize deterministic TypeScript logic over speculative AI assumptions.",
    "Review relevant files before editing and preserve staged or unstaged work from users and other agents.",
    "Use docs/AI-interaction/prompt-library/ai-memory-collection.md when collecting learning from other AI chats.",
  ],
};
