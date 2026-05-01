# Code Review Skill

Use this checklist when reviewing TypeScript, React, Next.js, API, security, or performance changes.

## Review Priorities

| Area | What To Check |
| --- | --- |
| Correctness | The change solves the intended problem without breaking existing flows. |
| Security | Inputs are validated, secrets are not exposed, auth checks are preserved, and uploads are constrained. |
| Data safety | Database reads/writes are scoped to the right user/workspace and use safe query patterns. |
| AI safety | LLM output is not trusted for numeric computation when verified computation should be used. |
| UI behavior | Loading, empty, error, and mobile states still work. |
| Performance | Heavy work is not pushed into render paths or repeated unnecessarily. |
| Maintainability | Code follows existing project patterns and keeps API routes thin where possible. |
| Tests | Risky logic has a useful unit, integration, or manual verification path. |

## Output Format

Start reviews with findings ordered by severity. Include:

- File and line reference.
- Why it matters.
- Suggested fix or question.
- Missing test or verification note when relevant.

If no issues are found, say that clearly and mention any remaining test gaps.
