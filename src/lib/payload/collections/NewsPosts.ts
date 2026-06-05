import type { CollectionConfig } from "payload"

import { isCmsSuperAdmin, publishedOrCmsUser, withCollectionGroup } from "@/lib/payload/access"

export const NewsPosts: CollectionConfig = withCollectionGroup({
  slug: "news-posts",
  versions: {
    drafts: true,
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "_status", "publishedAt", "updatedAt"],
    description: "Public news posts managed in Payload during Phase 0.",
  },
  access: {
    read: publishedOrCmsUser,
    create: isCmsSuperAdmin,
    update: isCmsSuperAdmin,
    delete: isCmsSuperAdmin,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Public URL slug for the news post.",
      },
    },
    {
      name: "summary",
      type: "textarea",
      required: true,
      admin: {
        rows: 3,
      },
    },
    {
      name: "content",
      type: "textarea",
      required: true,
      admin: {
        rows: 18,
      },
    },
    {
      name: "publishedAt",
      type: "date",
      required: true,
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data

        if (typeof data.slug === "string") {
          data.slug = data.slug
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
        }

        return data
      },
    ],
  },
  timestamps: true,
})
