# Production release safety

## Approval boundary

Beta publication builds and smoke-tests the source, publishes `dist-test`, and prepares the exact
`beta` to `main` pull request. Both beta workflows perform no merge and no production dispatch.
A human release owner verifies test acceptance and manually merges the reviewed pull request.

The production publisher checks GitHub protection metadata before entering the environment
`useclevr-web / production`. The environment must already exist with all of these controls:

- Required reviewers are named individual human accounts; bot accounts and teams are rejected.
- Prevent self-review is enabled and administrator bypass is disabled.
- Selected deployment branches contain exactly one branch rule, `main`, and no tag rule.
- The repository plan supports required reviewers. Public repositories support these rules on
  current GitHub plans; private repositories require the applicable paid plan.

The publisher fails when metadata is absent, inaccessible, or incomplete. It never creates an
unprotected replacement environment. GitHub holds the publication job for human approval, then the
job checks protection again before building. Both checkouts use the workflow run's exact
`github.sha`; moving `main` does not change the approved source.

The repository administrator must require human PR approval and the source/build check on `main`,
dismiss stale approvals, and prevent automation and administrator bypasses. Administrators must
protect `dist` against writes outside the approved publisher. GitHub environments do not restrict
independent Railway, Vercel, or direct Git operations. The operator must verify those services do
not bypass the release boundary. Vercel source deployments from `main` require a separately verified
provider approval control or the enforced human merge boundary.

Before introducing these workflow changes, the administrator cancels running promotion workflows
and disables existing PR auto-merge. A workflow update does not cancel an older run's permissions.
The administrator configures and verifies the protected environment before authorizing production
publication. The operator must not remove protection while publication jobs are queued or running.

## Migration contract

`scripts/runtime/railway-predeploy.cjs` requires a database URL and restores the runtime before
opening one migration connection. `DIRECT_URL` takes precedence over `DATABASE_URL`; the operator
must verify that migration and application connection references reach the same intended database.
Image builds run no database migrations. Railway runs the complete schema-sync transaction through
its configured predeploy command.

Only the migration connection receives these fixed limits:

| Limit                                            | Value       |
| ------------------------------------------------ | ----------- |
| Connection establishment                         | 10 seconds  |
| PostgreSQL `lock_timeout`                        | 3 seconds   |
| PostgreSQL `statement_timeout`                   | 60 seconds  |
| Transaction deadline                             | 120 seconds |
| PostgreSQL `idle_in_transaction_session_timeout` | 30 seconds  |
| Rollback/connection cleanup                      | 5 seconds   |

The runner reads `server_version_num` from its own connection. PostgreSQL 17 and later receive
native `transaction_timeout`; PostgreSQL 12–16 use a connection-terminating watchdog. The watchdog
also protects PostgreSQL 17+ against stalled transport, with a five-second cleanup grace period.
Unsupported or unreadable versions fail. Application connection settings are unaffected.

The operator sets Railway's separate predeploy timeout to 180 seconds and confirms that the service
honors it. The 300-second HTTP healthcheck timeout does not protect predeploy. The operator rehearses
the complete schema-sync sequence against representative isolated fixtures before accepting these
budgets. The runner does not retry failures or silently increase limits.

Connection, SQL, lock, statement, transaction, idle, and cleanup failures produce a nonzero exit.
Rollback is attempted while the connection remains usable. Disconnect terminates an open database
transaction. A rollback failure does not replace the original failure. Diagnostics contain stage,
safe error codes, and server version metadata; they omit SQL, error messages/details, connection
strings, credentials, and row content. A failure during COMMIT reports an unknown commit outcome.

Migration 0037 adds a nullable trace reference without historical backfill. Its ALTER TABLE locks
and ordinary index construction remain blocking operations; time limits bound exposure but do not
make the migration online. Do not run CREATE INDEX CONCURRENTLY inside this transaction. Split the
migration only through a separately reviewed change if representative rehearsal exceeds the budget.

## Railway metadata verification

An authorized operator inspects Railway service settings without exporting variable values:

1. Confirm project, environment, service, and domains; production consumes `dist` and test consumes
   `dist-test`, with separate database references and no source-branch/preview bypass.
2. Confirm service root `/dist`, config path `/server-config/railway.json`, effective builder and
   Dockerfile selection, and no conflicting dashboard command overrides.
3. Confirm predeploy `node ./scripts/runtime/railway-predeploy.cjs`, start
   `node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs`, and predeploy timeout
   180 seconds. Confirm build logs contain no database migration execution.
4. Confirm Node compatibility, database version, DDL privileges, database-reference alignment,
   backup/PITR retention, and recoverable successful deployment availability. Use provider metadata
   and approved schema/catalog checks; do not inspect customer rows or print connection values.
5. Record only sanitized setting names, statuses, version numbers, deployment IDs, and source SHAs.

The project wrapper's `pnpm railway:status` and `pnpm railway inspect --json` commands report linked
service/deployment identity. They do not prove branch mapping, commands, timeouts, permissions, or
backup readiness. A missing private project link blocks live verification; restore it only through
an approved operator action. Do not use variable-list output as evidence because it exposes values.

## Release and recovery checklist

1. Verify both implementation/review commits and the separately approved safety changes. Preserve
   unrelated worktree changes and require passing workflow, migration, type, and product regressions.
2. Complete GitHub and provider configuration checks. Prove that publication remains blocked with
   no approval and proceeds only for the reviewed SHA after an authorized human approves it.
3. Record the previous successful Railway deployment ID, image/source revision, variables recovery
   behavior, rollback retention, backup/PITR checkpoint, incident owner, and abort thresholds.
4. Rehearse restore into an isolated database and run the previous application against the expanded
   schema. Record restoration duration and the impact of writes after the recovery checkpoint.
5. Verify beta CI, generated artifact source identity, Railway predeploy/startup, and test-account
   passport/governance acceptance. The human release owner then approves the merge and the protected
   production publication job. Separate authorization covers production migration execution.
6. Monitor predeploy and its exact source/artifact identity. On predeploy failure, stop promotion;
   verify transaction termination and lock release using metadata. Do not repeatedly redeploy or
   increase time limits during contention. Railway must not activate the failed candidate.
7. If COMMIT acknowledgement is lost, treat schema state as unknown. An authorized database operator
   checks catalog state before any retry. Do not assume rollback or rerun automatically.
8. If the application fails after commit, restore the recorded previous deployment, retain additive
   passport schema, and verify database readiness plus existing and passport workflows. Do not use
   Deploy Latest Commit as a rollback or remove recoverable deployments with cleanup commands.
9. Require separate incident authorization for database restore. Preserve subsequent writes and
   new passport records. Do not automatically drop tables, columns, or indexes to reverse 0037.

HTTP 200 from GET `/api/health` is liveness only: it can report a degraded database. POST readiness
checks connectivity but does not establish schema compatibility. Release acceptance includes the
predeploy result and schema-backed synthetic-account workflows.

## Verification limits

Local fixtures establish functional behavior, not production compatibility. The operator must
verify actual PostgreSQL version, permissions/schema, live provider settings, enforcement with the
GitHub workflow token, representative migration duration, hosted approval behavior, and recovery
readiness. Missing evidence keeps production NO-GO. Configuring protected environments or provider
settings requires separate authorization; a local workflow declaration does not configure them.

References: [GitHub environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments),
[PostgreSQL timeouts](https://www.postgresql.org/docs/17/runtime-config-client.html),
[Railway predeploy](https://docs.railway.com/deployments/pre-deploy-command),
and [Railway rollback](https://docs.railway.com/deployments/deployment-actions).
