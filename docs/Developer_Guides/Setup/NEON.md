# Neon

## Project

| Field | Value |
| --- | --- |
| Project ID | `withered-star-79790747` |
| Branch ID | `br-crimson-sun-ai49oqj4` |
| Database | `neondb` |
| Role | `neondb_owner` |

## Local Use

Connection values are local-only. Put them in `.env.local`.

Required:

```env
DATABASE_URL=
DIRECT_URL=
```

## Commands

```bash
pnpm db:push
pnpm db:migrate
pnpm db:studio
```

Do not commit `.env`, `.env.local`, or real connection strings.
