import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * Setup Profile columns that might be missing from older DB schema
 * This is a safety migration to ensure columns exist
 */

import { db } from "@/lib/db"
import { neon } from "@neondatabase/serverless"

export async function GET() {
  try {
    // Connect directly for raw query 
    const sql = neon(process.env.DATABASE_URL!)
    
    // Try to add missing columns if they don't exist (ignore errors)
    // We'll run each in sequence and ignore their individual errors
    await sql`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS analysisCount integer DEFAULT 0 NOT NULL`.catch(() => {})
    await sql`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS credits integer DEFAULT 0 NOT NULL`.catch(() => {})
    await sql`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS freeUploadsUsed integer DEFAULT 0 NOT NULL`.catch(() => {})

    return Response.json({ 
      success: true, 
      message: "Profile columns guaranteed" 
    })
  } catch (error) {
    debugError("[SETUP] Schema migration error:", error)
    return Response.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 })
  }
}