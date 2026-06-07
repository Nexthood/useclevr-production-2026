import type { CollectionConfig } from "payload"

export const Faqs: CollectionConfig = {
  slug: "faqs",
  admin: {
    useAsTitle: "question",
    group: "Content",
    defaultColumns: ["question", "category", "updatedAt"],
    description: "Public FAQ entries shown on the /faq page and homepage accordion.",
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: "category",
      type: "text",
      required: true,
      admin: {
        description: "FAQ category label (e.g. Getting Started, Plans & Billing)",
      },
      validate: (val: string | null | undefined) => {
        if (!val || val.trim().length === 0) return "Category is required"
        if (val.trim().length < 2) return "Category must be at least 2 characters"
        if (val.trim().length > 100) return "Category must be under 100 characters"
        return true
      },
    },
    {
      name: "question",
      type: "text",
      required: true,
      validate: (val: string | null | undefined) => {
        if (!val || val.trim().length === 0) return "Question is required"
        if (val.trim().length < 5) return "Question must be at least 5 characters"
        if (val.trim().length > 500) return "Question must be under 500 characters"
        return true
      },
    },
    {
      name: "answer",
      type: "richText",
      required: true,
    },
    {
      name: "tag",
      type: "text",
      admin: {
        description: "Optional tag for filtering (e.g. 'pricing')",
      },
      validate: (val: string | null | undefined) => {
        if (val && val.trim().length > 50) return "Tag must be under 50 characters"
        return true
      },
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
      admin: {
        description: "Display order within category",
      },
      validate: (val: number | null | undefined) => {
        if (val !== null && val !== undefined && (typeof val !== "number" || !Number.isInteger(val))) {
          return "Sort order must be a whole number"
        }
        return true
      },
    },
    {
      name: "scope",
      type: "select",
      defaultValue: "public",
      options: [
        { label: "Public", value: "public" },
        { label: "Dashboard", value: "dashboard" },
        { label: "Operator", value: "operator" },
      ],
      admin: {
        description: "Where this FAQ entry appears",
      },
    },
  ],
  timestamps: true,
}
