import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"

export default function sitemap(): MetadataRoute.Sitemap {
  return siteConfig.sitemap.map((path) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: new Date(),
  }))
}

