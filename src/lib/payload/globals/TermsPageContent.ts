import type { GlobalConfig } from "payload"

import { isCmsSuperAdmin, withGlobalLabel } from "@/lib/payload/access"

export const TermsPageContent: GlobalConfig = withGlobalLabel({
  slug: "terms-page-content",
  access: {
    read: () => true,
    update: isCmsSuperAdmin,
  },
  admin: {
    description: "Public Terms page content override.",
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
