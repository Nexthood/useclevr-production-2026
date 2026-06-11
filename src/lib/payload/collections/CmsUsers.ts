import type { CollectionConfig } from "payload"

import { isCmsSuperAdmin } from "@/lib/payload/access"

export const CmsUsers: CollectionConfig = {
  slug: "cms-users",
  auth: true,
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "role", "updatedAt"],
    description: "CMS admin accounts for news and public page content.",
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    read: isCmsSuperAdmin,
    create: isCmsSuperAdmin,
    update: isCmsSuperAdmin,
    delete: isCmsSuperAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "base",
      options: [
        { label: "Base", value: "base" },
        { label: "Superadmin", value: "superadmin" },
      ],
      saveToJWT: true,
    },
  ],
  timestamps: true,
}
