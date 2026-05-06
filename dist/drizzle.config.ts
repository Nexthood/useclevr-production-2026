import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: (process.env.DIRECT_URL || process.env.DATABASE_URL || '').trim(),
    ssl: 'require',
  },
  verbose: true,
  strict: true,
})
