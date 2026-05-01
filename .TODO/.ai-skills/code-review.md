# Code Review

Checklist for reviewing TypeScript, React, Next.js, API, security, or performance changes.

## Priorities

| Area | Check |
| --- | --- |
| Correctness | Solves the problem without breaking existing flows |
| Security | Inputs validated, secrets not exposed, auth checks preserved |
| Data safety | DB reads/writes scoped to correct user/workspace |
| AI safety | Numeric computation uses verified computation when needed |
| UI behavior | Loading, empty, error, mobile states still work |
| Performance | Heavy work not in render paths or repeated unnecessarily |
| Maintainability | Follows existing patterns and keeps API routes thin |
| Tests | Risky logic has useful test or verification path |

## Output

Start with findings ordered by severity. Include:

- File and line reference
- Why it matters
- Suggested fix or question
- Missing test or verification note when relevant

If no issues found, state clearly and note any test gaps.
