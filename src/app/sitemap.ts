import { siteConfig } from "@/config/site"
import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  return siteConfig.sitemap.map((path) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: new Date(),
  }))
}

