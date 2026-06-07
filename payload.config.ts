import path from "node:path"
import { fileURLToPath } from "node:url"

import { BUILTIN_BASE_USER, BUILTIN_SUPER_ADMIN_USER } from "@/lib/auth/builtin-users"
import { Faqs } from "@/lib/cms/collections/Faqs"
import { CmsUsers } from "@/lib/payload/collections/CmsUsers"
import { NewsPosts } from "@/lib/payload/collections/NewsPosts"
import { HomePageContent } from "@/lib/payload/globals/HomePageContent"
import { PrivacyPageContent } from "@/lib/payload/globals/PrivacyPageContent"
import { TermsPageContent } from "@/lib/payload/globals/TermsPageContent"
import { seedPayloadPhaseZero } from "@/lib/payload/seed"
import { postgresAdapter } from "@payloadcms/db-postgres"
import { stripePlugin } from "@payloadcms/plugin-stripe"
import { lexicalEditor } from "@payloadcms/richtext-lexical"
import { buildConfig } from "payload"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || ""
const payloadSecret = process.env.PAYLOAD_SECRET || process.env.AUTH_SECRET || "useclevr-payload-phase-zero"
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || ""

let hasSeeded = false

export default buildConfig({
  secret: payloadSecret,
  serverURL: process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: {
      connectionString: databaseUrl,
    },
    push: false,
  }),
  admin: {
    user: CmsUsers.slug,
    meta: {
      titleSuffix: "UseClevr Admin",
      description: "Minimal content admin for UseClevr public news and page content.",
    },
    autoLogin: false,
  },
  routes: {
    admin: "/admin",
    api: "/api/payload",
  },
  collections: [CmsUsers, NewsPosts, Faqs],
  globals: [HomePageContent, PrivacyPageContent, TermsPageContent],
  plugins: [
    ...(stripeSecretKey
      ? [
          stripePlugin({
            stripeSecretKey,
            logs: false,
            rest: false,
          }),
        ]
      : []),
  ],
  onInit: async (payload) => {
    if (hasSeeded) return
    hasSeeded = true
    try {
      await seedPayloadPhaseZero(payload)
      payload.logger.info(
        `Seeded Phase 0 Payload content and demo CMS users: ${BUILTIN_BASE_USER.email}, ${BUILTIN_SUPER_ADMIN_USER.email}`,
      )
    } catch (cause) {
      payload.logger.warn(
        { err: cause },
        "Seed skipped — database tables not ready (expected during build against fresh databases)",
      )
    }
  },
  typescript: {
    outputFile: path.resolve(dirname, "src/payload-types.ts"),
  },
})
