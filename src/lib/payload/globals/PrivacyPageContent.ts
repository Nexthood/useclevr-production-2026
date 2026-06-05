import type { GlobalConfig } from "payload"

import { isCmsSuperAdmin, withGlobalLabel } from "@/lib/payload/access"

export const PrivacyPageContent: GlobalConfig = withGlobalLabel({
  slug: "privacy-page-content",
  access: {
    read: () => true,
    update: isCmsSuperAdmin,
  },
  admin: {
    description: "Public Privacy page content override.",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "description",
      type: "text",
      required: true,
    },
    {
      name: "lastUpdatedLabel",
      type: "text",
      required: true,
    },
    {
      name: "content",
      type: "textarea",
      required: true,
      admin: {
        rows: 24,
      },
    },
  ],
})
