# Ignored TODO

This retired queue stores deliberate no-fix decisions with rationale.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Links

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Ignored

- T-522. Do not build Business Profile as an ERP, accounting ledger, payroll system, policy-management system, or lending platform; keep it as SME business-intelligence setup context.
- T-523. Do not present tax, legal, insurance, or financing outputs as professional advice; label them as estimates, user-provided values, or professional-verification items.
- T-199. Do not replace the current app, auth, billing, datasets, reports, tickets, AI traces, workspaces, or business records with Payload CMS; keep Payload limited to a future editable-content layer.
- T-200. Review database migrations as a separate job while the app has one web service and migrations can run in the target runtime pre-deploy phase.
- T-201. Review server-host templates under build scripts; they are host templates, not executable build scripts.
- T-202. Do not commit `node_modules/` to the dist branch; Railway installs runtime dependencies.
- T-203. Avoid separate dist-specific TODO files after the dist deployment path succeeds and folds into the regular queues.
- T-452. Retire `.TODO/todo-analysis.md` — detailed codebase analysis folded into regular TODO queue. Items already addressed by prior tasks; remaining findings moved to todo-next.md and todo-future.md.
- T-453. Accept tsconfig `target: "ES6"` — Next.js handles transpilation internally; changing target has no practical effect on output.
- T-454. Ensures reproducible builds for production and test builds.

[additional test ]

- T-473. Verify /api/health returns OK after every deploy.
- T-474. Verify Railway production starts from a fresh deploy.
- T-475. Check runtime logs after deploy, not only build logs.
- T-476. Test Stripe checkout from pricing page and billing page.
- T-477. Test Stripe webhook delivery and subscription status update.
- T-478. Confirm all pages show the same pricing.
- T-479. Test login, signup, logout, and session refresh.
- T-480. Test dataset upload with normal CSV.
- T-481. Test dataset upload with bad/dirty CSV.
- T-482. Test AI chat using uploaded dataset context.
- T-483. Test dataset generation after upload.
- T-484. Test admin/superadmin access.
- T-485. Test subscription access limits.
- T-486. Test failed payment / unpaid subscription handling.
- T-487. Run production smoke test before each main deploy.
