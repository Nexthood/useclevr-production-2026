# Database & ORM Skill

## Description
Provides guidance on database operations using Drizzle ORM with Neon PostgreSQL.

## Capabilities
- Schema design and migrations
- Query optimization
- Transaction management
- Error handling
- Connection pooling

## Usage
For database-related tasks:
- Creating new tables
- Writing queries
- Migrations
- Performance tuning
- Troubleshooting connection issues

## Common Patterns

### Query Examples
```typescript
// Basic select
const users = await db.select().from(usersTable).where(eq(usersTable.email, email))

// Join with relations
const result = await db.query.users.findMany({
  with: { datasets: true }
})
```

### Migrations
```bash
npm run db:push    # Push schema changes
npm run db:generate  # Generate migration
```

## Best Practices
- Always use parameterized queries
- Implement proper indexes
- Handle connection errors gracefully
- Use transactions for multi-step operations