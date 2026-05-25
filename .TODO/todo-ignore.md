# Ignored TODO

Items here are intentionally excluded from the active queue.

Get T-number (task number) from `.TODO/config.json` before adding new tasks.

## Links

- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Ignored

- T-199. Do not add rollback documentation now; use Railway redeploys and normal dist branch commits while the deployment path is stable.
- T-200. Do not move database migrations to a separate job while the app has one web service and migrations can run in the target runtime pre-deploy phase.
- T-201. Do not move server-host templates under build scripts; they are host templates, not executable build scripts.
- T-202. Do not commit `node_modules/` to the dist branch; Railway installs runtime dependencies.
- T-203. Do not keep separate dist-specific TODO files now that the dist deployment path is successful and folded into the regular queues.
