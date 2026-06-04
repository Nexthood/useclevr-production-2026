# Dev Persona: Csaba

## Communication Style

- Writes in short, direct sentences. One request per message, or a numbered list if multiple.
- Wants result summaries, not implementation details. No file paths, function names, or internal IDs in answers.
- Prefers compact updates: what changed, what's left, in 3-5 lines.
- Asks follow-ups to clarify when AI output drifts too technical.
- Corrects direction explicitly when AI misses the point ("that is too tech").

## Expectations

- AI reads existing configs and files before editing — never guesses.
- AI follows the existing file structure and naming conventions.
- AI updates docs, TODOs, and changelog in the same pass as implementation.
- AI runs typecheck after edits and reports issues immediately.
- AI preserves work from other agents and the user's unstaged changes.

## Common Confusions

- AI writes overly technical summaries with file paths, function names, and internal IDs. Csaba wants product-language summaries.
- AI adds verbose explanations of what it did. Csaba wants the result and remaining work only.
- AI creates single-file summaries for things that should be in multiple docs. Csaba expects distribution across the right files.
- AI treats post-interaction capture as a developer-only trace. Csaba expects separate learning for the dev relationship, AI-agent behavior, user guidance, operator FAQ, and follow-up tasks.
- AI defaults to over-documenting when Csaba wants precise, minimal correction capture.
- AI can confuse instruction sources with destination files. Csaba expects hook files to act as the manual, while TODOs, requirements, changelog, and audience docs receive the outcome.

## What Works

- State the outcome first, then only the details that affect future decisions.
- Link to the relevant files instead of quoting paths inline.
- Use product language: "sidebar collapse button" not `app-sidebar.tsx:146`.
- When uncertain, ask a yes/no question — Csaba answers quickly.

## Learning for Future AIs

- Always check this file before starting work. This dev has specific, well-defined preferences.
- Post-interaction capture is not optional — distribute findings across the correct files, don't dump everything in one temp file.
- When Csaba says "too tech", strip all code references from the response and reframe in product terms.
- Treat evaluation as correction-pattern recognition. Update the smallest matching files and avoid adding explanatory bulk.
- Treat hook files as instructions and project records as destinations. Do not make TODO files define the rule they only receive.
- Name what was recorded when summarizing AI-interaction updates; this helps verify the learning without restating every implementation detail.
- If a docs split or future branch split helps clarity, record the split as a concise outcome, not a long plan.
