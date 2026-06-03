# Current-State Product Text Prompt

Use this prompt when rewriting requirements, changelog-ready product notes, TODO descriptions, guides, or planning text.

```text
Rewrite this text as current-state product language.

Rules:
- Use direct verbs such as Show, Use, Route, Keep, Open, Support, Prevent, and Validate.
- Describe current behavior, current rules, and current user outcomes.
- Avoid past-state comparisons, removed-option notes, speculative possibilities, and future blockages.
- Mention past or future states only when the detail prevents a concrete risk.
- Keep each bullet short and user-observable.
- Avoid internal file names, function names, package names, route internals, and implementation details unless the document is developer-only.

Output:
- Use concise bullets.
- Group by product area when grouping helps.
- Keep developer-only notes in a separate Dev section.
```
