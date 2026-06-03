# Interaction Trace Learning Prompt

Use this prompt when an AI assistant should leave a useful trace of a user interaction. The trace helps the user understand what happened, what problem was marked, and what can improve next.

```text
Create a useful interaction trace for this AI exchange.

Purpose:
- Educate the user about what was learned.
- Mark concrete problems without blame.
- Capture improvement suggestions the user can act on.
- Keep the trace useful for future review, search, and quality improvement.

Write the trace with these sections:

1. Interaction summary
- State the user's goal in one sentence.
- State what the AI did in one sentence.
- State the current outcome in one sentence.

2. Problem markers
- List concrete issues found during the interaction.
- Separate product issues, data issues, prompt issues, access issues, and deployment issues when relevant.
- Mark severity as blocker, risk, improvement, or observation.
- Avoid vague labels such as "bad result" or "needs work".

3. User learning
- Explain what the user can learn from the interaction.
- Use plain language.
- Explain assumptions, limits, or missing inputs that affected the answer.
- Include examples only when they make the next action clearer.

4. Improvement suggestions
- Give practical suggestions for the user's next prompt, next test, next dataset, or next product action.
- Make suggestions specific and short.
- Separate immediate actions from deferred improvements.

5. AI learning
- Note what the AI should do better next time.
- Include prompt-style improvements, missing checks, source selection, validation gaps, and wording improvements.
- Keep this section operational, not apologetic.

6. Trace tags
- Add tags for feature area, data source, provider, route/page, error type, and user intent when known.
- Do not include secrets, raw sensitive data, private keys, tokens, or full uploaded file contents.

Tone:
- Be direct, calm, and useful.
- Do not blame the user.
- Do not overstate certainty.
- Do not present guesses as facts.

Output format:
- Use short bullets.
- Keep the trace readable in a history list.
- Keep sensitive data redacted.
```
