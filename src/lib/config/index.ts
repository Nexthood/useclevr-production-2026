/**
 * Runtime configuration with Zod validation
 * Uses P-291 prefix convention for config files
 */

import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1).default(""),
  AUTH_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MCP_SERVICE_TOKEN: z.string().min(32).optional(),
  MCP_ADMIN_TOKEN: z.string().min(32).optional(),
  MCP_URL: z.string().url().optional(),
})

function resolveSecret(): string {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32) {
    return process.env.AUTH_SECRET
  }
  if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 32) {
    return process.env.NEXTAUTH_SECRET
  }
  return ""
}

const rawEnv = { ...process.env, AUTH_SECRET: resolveSecret() }
export const config = envSchema.parse(rawEnv)

export type Config = z.infer<typeof envSchema>

// Public config (safe for client)
export const publicConfig = {
  AUTH_URL: config.AUTH_URL || "",
}
