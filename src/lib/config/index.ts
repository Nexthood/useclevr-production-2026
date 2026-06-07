/**
 * Runtime configuration with Zod validation
 * Uses P-291 prefix convention for config files
 */

import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MCP_SERVICE_TOKEN: z.string().min(32).optional(),
  MCP_ADMIN_TOKEN: z.string().min(32).optional(),
})

export const config = envSchema.parse(process.env)

export type Config = z.infer<typeof envSchema>

// Public config (safe for client)
export const publicConfig = {
  AUTH_URL: config.AUTH_URL || "",
}
