import type { GlobalConfig } from "payload"

import { isCmsSuperAdmin, withGlobalLabel } from "@/lib/payload/access"

export const HomePageContent: GlobalConfig = withGlobalLabel({
  slug: "homepage-content",
  access: {
    read: () => true,
    update: isCmsSuperAdmin,
  },
  admin: {
    description: "Public homepage hero and news teaser copy.",
  },
  fields: [
    {
      name: "heroBadge",
      type: "text",
      required: true,
    },
    {
      name: "heroTitle",
      type: "text",
      required: true,
    },
    {
      name: "heroHighlight",
      type: "text",
      required: true,
    },
    {
      name: "heroDescription",
      type: "textarea",
      required: true,
      admin: {
        rows: 3,
      },
    },
    {
      name: "heroAudience",
      type: "text",
      required: true,
    },
    {
      name: "primaryCtaLabel",
      type: "text",
      required: true,
    },
    {
      name: "secondaryCtaLabel",
      type: "text",
      required: true,
    },
    {
      name: "newsSectionTitle",
      type: "text",
      required: true,
    },
    {
      name: "newsSectionDescription",
      type: "textarea",
      required: true,
      admin: {
        rows: 2,
      },
    },
  ],
})
