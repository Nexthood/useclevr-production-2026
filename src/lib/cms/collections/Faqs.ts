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
    },
    {
      name: "question",
      type: "text",
      required: true,
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
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
      admin: {
        description: "Display order within category",
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
