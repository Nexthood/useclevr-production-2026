# UseClevr Issue Register

Use this register for sales/project-facing issues that need tracking outside implementation details. Move implementation work into `.TODO/todo-next.md`.

| ID    | Issue                                                                             | Owner           | Status      | Action                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------- | --------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| I-001 | Railway test host can return runtime 502 while local packaging succeeds.          | Technical owner | Closed      | Verified: test.useclevr.com/api/health and app.useclevr.com/api/health both return 200 after the June deploy.                                 |
| I-002 | Sales validation needs a current demo dataset, screenshot set, script, and video. | Sales owner     | In progress | Complete the sales-validation kit under T-853 and review it against the current product journey.                                              |
| I-003 | Business Profile roadmap is broad and must stay separate from current claims.     | Product owner   | Controlled  | Use `.TODO/todo-future.md` for future modules and requirements for current behavior.                                                          |
| I-004 | Help chat misses need review to improve FAQ coverage.                             | Support owner   | Open        | Review unresolved help chat and ticket topics after demo/test usage.                                                                          |
| I-005 | Payload scope can blur content ownership and product-record ownership.            | Product owner   | Controlled  | Keep Payload ownership limited to approved content and support issues; keep business and dataset records owner-scoped in application storage. |
