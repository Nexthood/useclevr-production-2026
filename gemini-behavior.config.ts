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
    "This AI agent must use AGENTS.md, .kilo/agent/changelog.md, ai-chat-behavior.config.ts, and gemini-behavior.config.ts as the post-interaction instruction sources.",
    "This AI agent must run project-prompts/ai-memory-collection-post-interaction.md after each completed request/response cycle and update project-logs/interactive-log.md, project-logs/activity-log.md, and docs/AI-interaction/interaction-status.md.",
    "This AI agent must use project-prompts/ai-memory-collection.md when collecting learning from other AI chats.",
  ],
};
