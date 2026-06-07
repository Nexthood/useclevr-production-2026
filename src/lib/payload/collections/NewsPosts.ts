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
      validate: (val: string | null | undefined) => {
        if (!val || val.trim().length === 0) return "Title is required"
        if (val.trim().length < 3) return "Title must be at least 3 characters"
        if (val.trim().length > 200) return "Title must be under 200 characters"
        return true
      },
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
      validate: (val: string | null | undefined) => {
        if (!val || val.trim().length === 0) return "Slug is required"
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val.trim())) return "Slug must contain only lowercase letters, numbers, and hyphens"
        if (val.trim().length > 150) return "Slug must be under 150 characters"
        return true
      },
    },
    {
      name: "summary",
      type: "textarea",
      required: true,
      admin: {
        rows: 3,
      },
      validate: (val: string | null | undefined) => {
        if (!val || val.trim().length === 0) return "Summary is required"
        if (val.trim().length < 10) return "Summary must be at least 10 characters"
        if (val.trim().length > 500) return "Summary must be under 500 characters"
        return true
      },
    },
    {
      name: "content",
      type: "textarea",
      required: true,
      admin: {
        rows: 18,
      },
      validate: (val: string | null | undefined) => {
        if (!val || val.trim().length === 0) return "Content is required"
        if (val.trim().length < 20) return "Content must be at least 20 characters"
        return true
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
