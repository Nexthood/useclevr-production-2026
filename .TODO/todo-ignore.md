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

- T-199. Skip rollback documentation while Railway redeploys and normal dist branch commits cover the
  stable deployment path.
- T-200. Do not move database migrations to a separate job while the app has one web service and migrations can run in the target runtime pre-deploy phase.
- T-201. Do not move server-host templates under build scripts; they are host templates, not executable build scripts.
- T-202. Do not commit `node_modules/` to the dist branch; Railway installs runtime dependencies.
- T-203. Avoid separate dist-specific TODO files after the dist deployment path succeeds and folds
  into the regular queues.
- T-452. Retire `.TODO/todo-analysis.md` — detailed codebase analysis folded into regular TODO queue. Items already addressed by prior tasks; remaining findings moved to todo-next.md and todo-future.md.
- T-453. Accept tsconfig `target: "ES6"` — Next.js handles transpilation internally; changing target has no practical effect on output.
- T-454. Accept build tooling mismatch between Turbopack config and webpack flag — `next build --webpack` flag ensures reproducible builds while Turbopack config is inert for production build.
