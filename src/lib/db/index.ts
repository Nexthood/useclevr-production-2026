import { debugLog, debugError, debugWarn } from "@/lib/debug"

import { drizzle } from 'drizzle-orm/neon-http'
import { neon, neonConfig } from '@neondatabase/serverless'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDbClient> | undefined
}

/** Drizzle Database Client singleton with retry logic for cold-start */
function createDbClient() {
  const connectionUrl = process.env.DATABASE_URL || process.env.DIRECT_URL
  
  if (!connectionUrl) {
    debugWarn('[DB] DATABASE_URL not set - database features will be unavailable')
    return null
  }

  // Use Neon HTTP client for serverless/edge compatibility
  // fetchConnectionCache is now always enabled by Neon and deprecated for manual assignment
  const sql = neon(connectionUrl)
  // Initialize Drizzle with Neon client and attach schema for typed `db.query`
  const db = drizzle(sql, { schema })

  // Test connection in development with retry logic for cold-start
  if (process.env.NODE_ENV === 'development') {
    let retries = 0
    const maxRetries = 5
    
    const tryConnect = () => {
      debugLog(`[DB] Testing connection to database... (attempt ${retries + 1}/${maxRetries})`)
      sql`SELECT NOW()`.then(() => {
        debugLog('[DB] Successfully connected to database')
      }).catch((err) => {
        debugError(`[DB] Failed to connect (attempt ${retries + 1}):`, err.message)
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
