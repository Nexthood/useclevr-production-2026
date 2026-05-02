import { debugError, debugLog, debugWarn } from "@/lib/debug"

import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDbClient> | undefined
}

function isServerlessUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('neon://')
}

function shouldUseServerless(): boolean {
  return process.env.NEON_USE_SERVERLESS === 'true'
}

/** Drizzle Database Client singleton with retry logic for cold-start */
function createDbClient() {
  const connectionUrl = (process.env.DATABASE_URL || process.env.DIRECT_URL || '').trim()

  if (!connectionUrl) {
    debugWarn('[DB] DATABASE_URL not set - database features will be unavailable')
    return null
  }

  const useServerless = shouldUseServerless() || isServerlessUrl(connectionUrl)

  let probe: { query: (query: string) => Promise<unknown> }
  const db = useServerless
    ? (() => {
      const sql = neon(connectionUrl)
      probe = sql
      return drizzleNeon(sql, { schema })
    })()
    : (() => {
      const pool = new Pool({ connectionString: connectionUrl })
      probe = pool
      return drizzlePostgres(pool, { schema })
    })()

  // Test connection in development with retry logic for cold-start
  if (process.env.NODE_ENV === 'development') {
    let retries = 0
    const maxRetries = 5

    const tryConnect = () => {
      debugLog(`[DB] Testing connection to database... (attempt ${retries + 1}/${maxRetries})`)
      probe.query('SELECT NOW()').then(() => {
        debugLog('[DB] Successfully connected to database')
      }).catch((err: unknown) => {
        debugError(`[DB] Failed to connect (attempt ${retries + 1}):`, String(err))
        retries++
        if (retries < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, retries), 10000)
          debugLog(`[DB] Retrying in ${delay}ms...`)
          setTimeout(tryConnect, delay)
        } else {
          debugError('[DB] Max retries reached. Database may be in cold-start.')
        }
      })
    }

    // Start first connection attempt
    setTimeout(tryConnect, 1000)
  }

  return db
}

export const db: ReturnType<typeof createDbClient> = globalForDb.db ?? createDbClient()

// Null-safe getter for use in other modules
export function getDb() {
  return db
}

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db
}

export type Database = typeof db
