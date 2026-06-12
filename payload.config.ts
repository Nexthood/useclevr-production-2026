import path from "node:path"
import { fileURLToPath } from "node:url"

import { BUILTIN_BASE_USER, BUILTIN_SUPER_ADMIN_USER } from "@/lib/auth/builtin-users"
import { Faqs } from "@/lib/cms/collections/Faqs"
import { CmsUsers } from "@/lib/payload/collections/CmsUsers"
import { Media } from "@/lib/payload/collections/Media"
import { dashboardMcpTools } from "@/lib/payload/mcp-dashboard-tools"
import { NewsPosts } from "@/lib/payload/collections/NewsPosts"
import { HomePageContent } from "@/lib/payload/globals/HomePageContent"
import { PrivacyPageContent } from "@/lib/payload/globals/PrivacyPageContent"
import { TermsPageContent } from "@/lib/payload/globals/TermsPageContent"
import { seedPayloadPhaseZero } from "@/lib/payload/seed"
import { postgresAdapter } from "@payloadcms/db-postgres"
import { mcpPlugin } from "@payloadcms/plugin-mcp"
import { stripePlugin } from "@payloadcms/plugin-stripe"
import { lexicalEditor } from "@payloadcms/richtext-lexical"
import { s3Storage } from "@payloadcms/storage-s3"
import { buildConfig } from "payload"
import sharp from "sharp"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || ""
const payloadSecret = process.env.PAYLOAD_SECRET || process.env.AUTH_SECRET || "useclevr-payload-phase-zero"
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || ""
const uploadProvider = process.env.UPLOAD_PROVIDER
const payloadStorageBucket =
  uploadProvider === "r2" ? process.env.R2_BUCKET : process.env.AWS_S3_BUCKET
const payloadStorageRegion =
  uploadProvider === "r2" ? "auto" : process.env.AWS_REGION || "us-east-1"
const payloadStorageAccessKey =
  uploadProvider === "r2" ? process.env.R2_ACCESS_KEY_ID : process.env.AWS_ACCESS_KEY_ID
const payloadStorageSecretKey =
  uploadProvider === "r2" ? process.env.R2_SECRET_ACCESS_KEY : process.env.AWS_SECRET_ACCESS_KEY
const payloadStorageEnabled = Boolean(
  (uploadProvider === "s3" &&
    payloadStorageBucket &&
    payloadStorageAccessKey &&
    payloadStorageSecretKey) ||
    (uploadProvider === "r2" &&
      payloadStorageBucket &&
      process.env.R2_ENDPOINT &&
      payloadStorageAccessKey &&
      payloadStorageSecretKey),
)

let hasSeeded = false

export default buildConfig({
  secret: payloadSecret,
  serverURL: process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  editor: lexicalEditor(),
  sharp,
  db: postgresAdapter({
    pool: {
      connectionString: databaseUrl,
    },
    push: false,
  }),
  admin: {
    user: CmsUsers.slug,
    components: {
      beforeLogin: [
        {
          path: "@/components/payload/payload-auth-brand",
          exportName: "PayloadLoginIntro",
        },
      ],
      graphics: {
        Logo: {
          path: "@/components/payload/payload-auth-brand",
          exportName: "PayloadAdminLogo",
        },
      },
      afterNavLinks: [
        {
          path: "@/components/payload/payload-auth-brand",
          exportName: "PayloadDashboardLink",
        },
      ],
    },
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
  collections: [CmsUsers, Media, NewsPosts, Faqs],
  globals: [HomePageContent, PrivacyPageContent, TermsPageContent],
  plugins: [
    s3Storage({
      enabled: payloadStorageEnabled,
      bucket: payloadStorageBucket || "",
      collections: {
        media: {
          prefix: "payload-media",
          ...(uploadProvider === "r2" && process.env.R2_PUBLIC_URL
            ? {
                generateFileURL: ({ filename, prefix }) =>
                  `${process.env.R2_PUBLIC_URL}/${prefix ? `${prefix}/` : ""}${filename}`,
              }
            : {}),
        },
      },
      config: {
        credentials:
          payloadStorageAccessKey && payloadStorageSecretKey
            ? {
                accessKeyId: payloadStorageAccessKey,
                secretAccessKey: payloadStorageSecretKey,
              }
            : undefined,
        region: payloadStorageRegion,
        ...(uploadProvider === "r2"
          ? {
              endpoint: process.env.R2_ENDPOINT,
              forcePathStyle: true,
            }
          : {}),
      },
    }),
    mcpPlugin({
      collections: {
        "cms-users": {
          enabled: false,
        },
        media: {
          enabled: false,
        },
        "news-posts": {
          description: "UseClevr public news managed by the content team.",
          enabled: {
            find: true,
            create: true,
            update: true,
            delete: true,
          },
        },
        faqs: {
          description: "UseClevr public, dashboard, and operator FAQ content.",
          enabled: {
            find: true,
            create: true,
            update: true,
            delete: true,
          },
        },
      },
      globals: {
        "homepage-content": {
          enabled: false,
        },
        "privacy-page-content": {
          enabled: false,
        },
        "terms-page-content": {
          enabled: false,
        },
      },
      mcp: {
        tools: dashboardMcpTools as never,
        serverOptions: {
          serverInfo: {
            name: "UseClevr",
            version: "1.0.0",
          },
        },
      },
      overrideAuth: async (_req, getDefaultMcpAccessSettings) => {
        const headers = _req.headers
        if (headers instanceof Headers && headers.get("x-internal-trusted-proxy") === "1") {
          return {
            user: {
              id: 0,
              email: "mcp@useclevr.local",
              collection: "cms-users",
              _strategy: "mcp-api-key",
            } as never,
            collections: {
              find: true,
              create: true,
              update: true,
              delete: true,
            },
            globals: {
              find: true,
              update: true,
            },
            "payload-mcp-tool": {
              listDashboardDatasets: true,
              getDashboardDatasetInsights: true,
            },
          }
        }
        return getDefaultMcpAccessSettings()
      },
    }),
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

    let tablesReady = false
    try {
      await payload.find({ collection: "cms-users", limit: 0, overrideAccess: true })
      tablesReady = true
    } catch {
      payload.logger.warn("Database tables not ready — seed skipped (expected during build against fresh databases)")
    }

    if (!tablesReady) return

    try {
      await seedPayloadPhaseZero(payload)
      payload.logger.info(
        `Seeded Phase 0 Payload content and demo CMS users: ${BUILTIN_BASE_USER.email}, ${BUILTIN_SUPER_ADMIN_USER.email}`,
      )
    } catch (cause) {
      payload.logger.warn(
        { err: cause },
        "Seed failed after table-existence check — unexpected error",
      )
    }
  },
  typescript: {
    outputFile: path.resolve(dirname, "src/payload-types.ts"),
  },
})
