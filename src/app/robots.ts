import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [...siteConfig.robots.allow],
      disallow: [...siteConfig.robots.disallow],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
