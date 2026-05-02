export const siteConfig = {
  name: "UseClevr",
  url: "https://useclevr.com",
  robots: {
    allow: ["/"],
    disallow: [
      "/app",
      "/app/",
      "/api",
      "/api/",
    ],
  },
  sitemap: [
    "/",
    "/pricing",
    "/privacy",
    "/terms",
    "/security",
    "/contact",
    "/affiliate",
  ],
} as const

