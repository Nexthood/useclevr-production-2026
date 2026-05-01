# Database Skill

Use this checklist when changing Drizzle schema, Neon connections, migrations, or query behavior.

## Current Database Stack

UseClevr uses Drizzle ORM with Neon PostgreSQL.

## Review Checklist

| Area | What To Check |
| --- | --- |
| Schema | Changes are represented in `lib/db/schema.ts` and migrations when needed. |
| Connections | `DATABASE_URL` and `DIRECT_URL` are used server-side only and match Neon requirements. |
| Migrations | Shared or production-impacting schema changes have a repeatable migration path. |
| Query safety | Queries are parameterized and scoped to the correct user/workspace. |
| Performance | Common dashboard, upload, report, and query paths have appropriate indexes or limits. |
| Data shape | API responses do not expose private columns or unrelated tenant data. |
| Failure handling | Connection and query errors return useful server-side diagnostics without leaking secrets. |

## Common Commands

```bash
pnpm db:generate
pnpm db:push
pnpm db:migrate
pnpm db:studio
```

Use `pnpm db:push` for quick local schema sync. Use generated migrations for shared or production changes.
