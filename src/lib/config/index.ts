/**
 * Runtime configuration with Zod validation
 * Uses P-291 prefix convention for config files
 */

import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
})

export const config = envSchema.parse(process.env)

export type Config = z.infer<typeof envSchema>

// Public config (safe for client)
export const publicConfig = {
  NEXTAUTH_URL: config.NEXTAUTH_URL || "",
}
