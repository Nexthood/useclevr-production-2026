import { BUILTIN_BASE_USER, BUILTIN_SUPER_ADMIN_USER, DEMO_PASS } from "@/lib/auth/builtin-users"

import type { Payload } from "payload"

const cmsUsers = [
  {
    email: BUILTIN_BASE_USER.email,
    password: DEMO_PASS,
    name: "Base CMS User",
    role: "base" as const,
  },
  {
    email: BUILTIN_SUPER_ADMIN_USER.email,
    password: DEMO_PASS,
    name: "Superadmin CMS User",
    role: "superadmin" as const,
  },
]

const newsSeed = [
  {
    slug: "useclevr-launch-readiness",
    title: "UseClevr launch readiness update",
    summary: "The team has aligned public pages, dashboard setup, and support flows for the next release window.",
    publishedAt: "2026-06-01T09:00:00.000Z",
    content:
      "UseClevr is moving through launch-readiness work with the dashboard setup flow, support surface, and public guidance aligned.\n\nThis update focuses on clear first-use experience, stable deployment flow, and direct customer-facing product language.",
  },
  {
    slug: "hybrid-ai-access-update",
    title: "Hybrid AI access update",
    summary: "Plan messaging and access boundaries now explain how Hybrid AI tiers map to product usage.",
    publishedAt: "2026-05-29T10:30:00.000Z",
    content:
      "Hybrid AI access now reads more clearly across the product and support guidance.\n\nCustomers can see which plan unlocks each Hybrid AI level without relying on technical wording or hidden upgrade paths.",
  },
  {
    slug: "business-profile-progress",
    title: "Business Profile progress update",
    summary: "Business Profile remains the setup center for company identity, tax context, and reporting confidence.",
    publishedAt: "2026-05-25T08:15:00.000Z",
    content:
      "The Business workspace now acts as the main setup context for company identity, location, tax, and financial readiness.\n\nThis makes onboarding signals clearer and improves the confidence of analysis and accountancy guidance.",
  },
  {
    slug: "support-and-faq-improvements",
    title: "Support and FAQ improvements",
    summary: "Public FAQ, dashboard FAQ, and ticket flows now align more closely with the real support journey.",
    publishedAt: "2026-05-21T11:45:00.000Z",
    content:
      "UseClevr continues to simplify support entry points by keeping FAQ answers, help chat, and ticket creation in clearer roles.\n\nVisitors can stay on the public path, dashboard users can stay in product context, and platform staff can use operator guidance without leaking it publicly.",
  },
  {
    slug: "reporting-and-downloads-refined",
    title: "Reporting and downloads refined",
    summary: "Report generation and downloads continue to focus on readable executive output and user-owned access.",
    publishedAt: "2026-05-18T13:20:00.000Z",
    content:
      "Reporting work continues to prioritize readable business output, scoped downloads, and clear row actions.\n\nThe product direction stays focused on practical decision support instead of broad generic BI complexity.",
  },
]

const homepageSeed = {
  heroBadge: "Business intelligence workspace",
  heroTitle: "AI-powered business intelligence",
  heroHighlight: "without the complexity",
  heroDescription: "Turn CSV data into executive reports and actionable business insights with AI.",
  heroAudience: "For founders, startup teams, and business operators who need fast answers from data.",
  primaryCtaLabel: "Start free trial",
  secondaryCtaLabel: "Schedule demo",
  newsSectionTitle: "Product news",
  newsSectionDescription: "Follow product updates, release notes, and launch-readiness highlights from the UseClevr team.",
}

const privacySeed = {
  title: "Privacy Policy",
  description: "Current privacy terms for UseClevr.",
  lastUpdatedLabel: "Last updated: June 4, 2026",
  content:
    "UseClevr collects account, usage, billing, and uploaded-business-data information only to operate, secure, and improve the service.\n\nUseClevr stores and processes customer data with role-based access boundaries, operational logging, and service-provider support where needed.\n\nUseClevr does not sell personal information to advertisers.\n\nCustomers can contact start@useclevr.com for privacy requests, correction requests, or deletion requests allowed by applicable law.",
}

const termsSeed = {
  title: "Terms of Service",
  description: "Current terms for using UseClevr.",
  lastUpdatedLabel: "Last updated: June 4, 2026",
  content:
    "UseClevr provides AI-assisted business intelligence, reporting, and support workflows for uploaded business data.\n\nCustomers must use the service lawfully, protect account access, and review generated outputs before relying on them for business, legal, tax, investment, or compliance decisions.\n\nPaid plans, subscriptions, and payment flows remain subject to the active billing terms and payment-provider rules.\n\nQuestions about these terms can be sent to start@useclevr.com.",
}

async function ensureCmsUsers(payload: Payload) {
  for (const user of cmsUsers) {
    const existing = await payload.find({
      collection: "cms-users",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        email: {
          equals: user.email,
        },
      },
    })

    if (existing.docs[0]) {
      continue
    }

    await payload.create({
      collection: "cms-users",
      data: user,
      overrideAccess: true,
    })
  }
}

async function ensureGlobalSeed(payload: Payload, slug: "homepage-content" | "privacy-page-content" | "terms-page-content", data: Record<string, unknown>) {
  const existing = await payload.findGlobal({
    slug,
    depth: 0,
    overrideAccess: true,
  })

  const hasPrimaryField = Object.values(existing || {}).some((value) => {
    return typeof value === "string" ? value.trim().length > 0 : false
  })

  if (hasPrimaryField) {
    return
  }

  await payload.updateGlobal({
    slug,
    data,
    depth: 0,
    overrideAccess: true,
  })
}

async function ensureNewsSeed(payload: Payload) {
  for (const item of newsSeed) {
    const existing = await payload.find({
      collection: "news-posts",
      depth: 0,
      draft: false,
      limit: 1,
      overrideAccess: true,
      where: {
        slug: {
          equals: item.slug,
        },
      },
    })

    if (existing.docs[0]) {
      continue
    }

    await payload.create({
      collection: "news-posts",
      data: {
        ...item,
        _status: "published",
      },
      draft: false,
      overrideAccess: true,
    })
  }
}

export async function seedPayloadPhaseZero(payload: Payload) {
  await ensureCmsUsers(payload)
  await ensureGlobalSeed(payload, "homepage-content", homepageSeed)
  await ensureGlobalSeed(payload, "privacy-page-content", privacySeed)
  await ensureGlobalSeed(payload, "terms-page-content", termsSeed)
  await ensureNewsSeed(payload)
}
