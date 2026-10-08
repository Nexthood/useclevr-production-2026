import { debugError, debugLog } from "@/lib/utils/debug"

import { neon, Pool as NeonPool } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzleNeonServerless } from 'drizzle-orm/neon-serverless'
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres'
import { Pool as PgPool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDbClient> | undefined
  dbUnavailable: boolean | undefined
}

function isServerlessUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('neon://')
}

function shouldUseServerless(): boolean {
  return process.env.NEON_USE_SERVERLESS === 'true'
}

function shouldUseWsPool(): boolean {
  return process.env.NEON_USE_WS_POOL === 'true'
}

type QueryProbe = { query: (query: string) => Promise<unknown> }

/** Drizzle Database Client singleton with retry logic for cold-start */
function createDbClient() {
  const connectionUrl = (process.env.DATABASE_URL || process.env.DIRECT_URL || '').trim()

  if (!connectionUrl) {
    throw new Error('[DB] DATABASE_URL not set - database features will be unavailable')
  }

  const useServerless = shouldUseServerless() || isServerlessUrl(connectionUrl)
  const useWsPool = shouldUseWsPool()

  let probe: QueryProbe
  const db = useWsPool
    ? (() => {
      const pool = new NeonPool({ connectionString: connectionUrl, max: 5 })
      probe = pool as QueryProbe
      return drizzleNeonServerless(pool, { schema })
    })()
    : useServerless
      ? (() => {
        const sql = neon(connectionUrl)
        probe = sql as unknown as QueryProbe
        return drizzleNeon(sql, { schema })
      })()
      : (() => {
        const pool = new PgPool({ connectionString: connectionUrl, max: 10 })
        probe = pool as QueryProbe
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
          const delay = Math.min(1000 * Math.pow(2, retries), 10000)
          debugLog(`[DB] Retrying in ${delay}ms...`)
          setTimeout(tryConnect, delay)
        } else {
          debugError('[DB] Max retries reached. Database may be in cold-start.')
        }
      })
    }

    setTimeout(tryConnect, 1000)
  }

  return db
}

function createUnavailableDbClient() {
  globalForDb.dbUnavailable = true
  return new Proxy({}, {
    get() {
      throw new Error('[DB] DATABASE_URL not set - database features will be unavailable')
    },
  }) as ReturnType<typeof createDbClient>
}

function initDbClient() {
  const connectionUrl = (process.env.DATABASE_URL || process.env.DIRECT_URL || '').trim()
  if (!connectionUrl) return createUnavailableDbClient()
  globalForDb.dbUnavailable = false
  return createDbClient()
}

export const db = globalForDb.db ?? initDbClient()

// Null-safe getter for use in other modules
export function getDb() {
  if (globalForDb.dbUnavailable) return null
  return db
}

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db
}

export type Database = typeof db
