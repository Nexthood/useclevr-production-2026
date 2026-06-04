# UseClevr Issue Register

Use this register for sales/project-facing issues that need tracking outside implementation details. Move implementation work into `.TODO/todo-next.md`.

| ID    | Issue                                                                         | Owner           | Status      | Action                                                                                                                        |
| ----- | ----------------------------------------------------------------------------- | --------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| I-001 | Railway test host can return runtime 502 while local packaging succeeds.      | Technical owner | Closed      | Verified: test.useclevr.com/api/health and app.useclevr.com/api/health both return 200 after the June deploy.                 |
| I-002 | Sales docs need a current demo dataset and screenshot set.                    | Sales owner     | In progress | Demo datasets and screenshot guide prepared. Screenshot capture still needed (manual).                                        |
| I-003 | Business Profile roadmap is broad and must stay separate from current claims. | Product owner   | Controlled  | Use `.TODO/todo-future.md` for future modules and requirements for current behavior.                                          |
| I-004 | Help chat misses need review to improve FAQ coverage.                         | Support owner   | Open        | Review unresolved help chat and ticket topics after demo/test usage.                                                          |
| I-005 | Payload CMS planning is ready but not active implementation.                  | Product owner   | Controlled  | Payload work in `.TODO/todo-future.md` (T-537, T-563); migration prompt in `.TODO/todo-migration-payload.md` until activated. |
