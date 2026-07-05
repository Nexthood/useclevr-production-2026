# User Guide For AI Collaboration

Use direct requests that describe the current product state you want. Write expected text as current
behavior, not as a comparison with an old page, removed form, possible future state, or blocked
future path.

## Effective Requests

- State the feature, page, or workflow first.
- Include the expected current state.
- Mention past behavior or future risk only when it prevents a regression.
- Ask for docs, requirements, changelog, and TODO updates when the work changes durable behavior.
- Mark branch or deploy scope clearly, such as beta-only or dist-test-only.

## Communication Patterns

- Compact prompts can include multiple outcomes in one message.
- Include the expected page, route, branch, deploy target, or document folder when scope matters.
- Ask the AI to inspect files and current worktree state before deciding.
- Expect implementation, verification, TODO updates, and changelog updates in the same pass when the request changes product behavior.
- Ask for explicit task splitting when a broad request spans product, docs, deployment, and sales work.

## How AI Analysis Works

- AI analysis uses aggregated dataset metrics only. Raw row-level data never leaves the server.
- The AI provider indicator next to each response shows which provider answered (Gemini Cloud).
- Every response has thumbs-up/thumbs-down feedback buttons so you can rate answer quality.
- Your past questions and answers are logged so you can review, search, and re-run them.
- Export your conversation history as JSON or CSV from the History tab in the AI Assistant sidebar.
- AI traces keep the prompt, answer, provider, timing, and feedback so the product can improve answer quality without storing secrets or raw uploaded files.

## Understanding AI Responses

- The provider name appears in the message header (e.g., "via Gemini Cloud").
- Error messages include a clear explanation of what went wrong and suggested next steps.
- The data usage notice at the top of the chat area explains what data is sent to AI providers.

## Managing Your History

- Open the History tab in the right sidebar to browse past conversations.
- Use the Search tab to find specific prompts or responses.
- Click the re-run button on any history entry to ask the same question again.
- Export your full history from the History tab's Export link.

## Theme Settings

- Click the sun/moon icon in the topbar to switch between Light and Dark themes.
- Use browser or operating-system accessibility settings for text size, page zoom, and contrast.
- Your theme preference persists across sessions.
- Use [Accessibility and display settings](../../User_Guides/accessibility.md) for display guidance.

## Risk Points

- Broad prompts need an explicit task split before edits start.
- Feature restoration needs route links, sidebar links, API support, and current UI patterns checked together.
- TODO retirement happens after the work is implemented, deferred, or deliberately ignored.

## Tips for Faster AI Responses

- Upload a CSV dataset first, then ask questions about it — the AI needs data to analyze.
- Be specific about what you want: numbers, trends, comparisons, or recommendations.
- If the response is too general, ask for specifics: "give me concrete numbers" or "show me month by month".
- Use the re-run button (↻) on any past response to ask the same question again without retyping.
- Rate responses with thumbs up/down — this trains which answers are useful for your business.

## Efficient AI Usage

- Ask one clear business question at a time.
- Name the dataset, metric, period, or segment when it matters.
- Ask for the direct result first when speed matters.
- Ask for evidence when a recommendation needs review.
- Use feedback buttons so operators can spot weak answers and improve support guidance.

## Bookkeeping Requests

- Describe accounting work as current dashboard behavior.
- Use terms such as bank reconciliation, expense coding, receipts, monthly close, tax preparation,
  and compliance checks.
- Link bookkeeping data to datasets, business profile details, and accountancy pages.
