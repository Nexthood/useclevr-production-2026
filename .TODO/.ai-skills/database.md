# Database

Checklist for changing Drizzle schema, Neon connections, migrations, or queries.

## Stack

Drizzle ORM with Neon PostgreSQL.

## Checklist

| Area | Check |
| --- | --- |
| Schema | Changes in `lib/db/schema.ts` and migrations when needed |
| Connections | `DATABASE_URL` and `DIRECT_URL` server-side only, match Neon requirements |
| Migrations | Shared or production-impacting changes have a migration path |
| Query safety | Queries parameterized and scoped to correct user/workspace |
| Performance | Common paths (dashboard, upload, report, query) have indexes or limits |
| Data shape | API responses don't expose private columns or tenant data |
| Failure handling | Connection and query errors return server-side diagnostics without leaking secrets |

## Commands

```bash
pnpm db:generate  # Generate migration
pnpm db:push      # Quick local schema sync
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Drizzle Studio
```

Use `db:push` for quick local sync. Use migrations for shared or production changes.
