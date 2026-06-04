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
    "Use AGENTS.md, .kilo/agent/changelog.md, ai-chat-behavior.config.ts, and gemini-behavior.config.ts as the post-interaction instruction sources.",
    "Run docs/AI-interaction/prompt-library/ai-memory-collection-post-interaction.md after each completed request/response cycle and keep only durable learning.",
    "Use docs/AI-interaction/prompt-library/ai-memory-collection.md when collecting learning from other AI chats.",
  ],
};
