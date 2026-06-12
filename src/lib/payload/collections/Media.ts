import path from "node:path"

import type { Access, CollectionConfig } from "payload"

import { isCmsSuperAdmin, withCollectionGroup } from "@/lib/payload/access"

const durableStorageConfigured = Boolean(
  (process.env.UPLOAD_PROVIDER === "s3" &&
    process.env.AWS_S3_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY) ||
    (process.env.UPLOAD_PROVIDER === "r2" &&
      process.env.R2_BUCKET &&
      process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY),
)

const manageMedia: Access = (args) =>
  durableStorageConfigured ? isCmsSuperAdmin(args) : false

export const Media: CollectionConfig = withCollectionGroup({
  slug: "media",
  admin: {
    useAsTitle: "alt",
    defaultColumns: ["alt", "filename", "mimeType", "updatedAt"],
    description: "Durable images and files used by Payload-managed public content.",
  },
  access: {
    read: () => true,
    create: manageMedia,
    update: manageMedia,
    delete: manageMedia,
  },
  upload: {
    staticDir: path.resolve(process.cwd(), "payload-media"),
    mimeTypes: ["image/*"],
    imageSizes: [
      {
        name: "thumbnail",
        width: 480,
        height: 270,
        position: "centre",
      },
      {
        name: "social",
        width: 1200,
        height: 630,
        position: "centre",
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      admin: {
        description: "Describe the image for screen readers and unavailable-image states.",
      },
    },
  ],
  timestamps: true,
})
