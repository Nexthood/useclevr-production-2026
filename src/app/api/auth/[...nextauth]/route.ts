import { handlers } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * NextAuth v5 API Route Handler
 * 
 * CRITICAL PATTERNS TO PREVENT HEADER ERRORS:
 * 
 * 1. Export only GET and POST - do not modify them
 * 2. Never add additional code before or after the exports
 * 3. The handlers object already contains the correct response logic
 * 4. Do NOT call handlers directly or wrap them in try-catch that modifies responses
 * 
 * Why this prevents header errors:
 * - handlers.GET and handlers.POST are pre-configured Response objects
 * - They handle all the header logic internally
 * - Exporting them directly avoids any intermediate processing
 * - Next.js App Router handles them as proper API endpoints
 */

// Export the handlers directly - no modifications needed
// These are pre-built API handlers that manage their own responses
export const { GET, POST } = handlers
