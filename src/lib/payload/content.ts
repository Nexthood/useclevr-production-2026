import { getPayloadClient } from "@/lib/payload/get-payload"
import type { NewsPost } from "@/payload-types"

type HomepageContent = {
  heroBadge: string
  heroTitle: string
  heroHighlight: string
  heroDescription: string
  heroAudience: string
  primaryCtaLabel: string
  secondaryCtaLabel: string
  newsSectionTitle: string
  newsSectionDescription: string
}

type LegalContent = {
  title: string
  description: string
  lastUpdatedLabel: string
  content: string
}

export type NewsPostSummary = {
  id: string
  title: string
  slug: string
  summary: string
  content: string
  publishedAt: string
}

const homepageFallback: HomepageContent = {
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

const privacyFallback: LegalContent = {
  title: "Privacy Policy",
  description: "Current privacy terms for UseClevr.",
  lastUpdatedLabel: "Last updated: June 4, 2026",
  content:
    "UseClevr collects account, usage, billing, and uploaded-business-data information only to operate, secure, and improve the service.\n\nUseClevr stores and processes customer data with role-based access boundaries, operational logging, and service-provider support where needed.\n\nUseClevr does not sell personal information to advertisers.\n\nCustomers can contact start@useclevr.com for privacy requests, correction requests, or deletion requests allowed by applicable law.",
}

const termsFallback: LegalContent = {
  title: "Terms of Service",
  description: "Current terms for using UseClevr.",
  lastUpdatedLabel: "Last updated: June 4, 2026",
  content:
    "UseClevr provides AI-assisted business intelligence, reporting, and support workflows for uploaded business data.\n\nCustomers must use the service lawfully, protect account access, and review generated outputs before relying on them for business, legal, tax, investment, or compliance decisions.\n\nPaid plans, subscriptions, and payment flows remain subject to the active billing terms and payment-provider rules.\n\nQuestions about these terms can be sent to start@useclevr.com.",
}

export function renderParagraphs(content: string) {
  return content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function getHomepageContent(): Promise<HomepageContent> {
  try {
    const payload = await getPayloadClient()
    const page = await payload.findGlobal({
      slug: "homepage-content",
      depth: 0,
    })

    return {
      ...homepageFallback,
      ...page,
    }
  } catch {
    return homepageFallback
  }
}

export async function getPrivacyContent(): Promise<LegalContent> {
  try {
    const payload = await getPayloadClient()
    const page = await payload.findGlobal({
      slug: "privacy-page-content",
      depth: 0,
    })

    return {
      ...privacyFallback,
      ...page,
    }
  } catch {
    return privacyFallback
  }
}

export async function getTermsContent(): Promise<LegalContent> {
  try {
    const payload = await getPayloadClient()
    const page = await payload.findGlobal({
      slug: "terms-page-content",
      depth: 0,
    })

    return {
      ...termsFallback,
      ...page,
    }
  } catch {
    return termsFallback
  }
}

function normalizeNewsDoc(
  doc: Partial<Pick<NewsPost, "id" | "title" | "slug" | "summary" | "content" | "publishedAt">>,
): NewsPostSummary {
  return {
    id: String(doc.id || ""),
    title: String(doc.title || ""),
    slug: String(doc.slug || ""),
    summary: String(doc.summary || ""),
    content: String(doc.content || ""),
    publishedAt: String(doc.publishedAt || ""),
  }
}

export async function getNewsPosts(limit = 10): Promise<NewsPostSummary[]> {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: "news-posts",
      depth: 0,
      draft: false,
      limit,
      sort: "-publishedAt",
    })

    return result.docs.map((doc) => normalizeNewsDoc(doc))
  } catch {
    return []
  }
}

export async function getNewsPostBySlug(slug: string): Promise<NewsPostSummary | null> {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: "news-posts",
      depth: 0,
      draft: false,
      limit: 1,
      where: {
        slug: {
          equals: slug,
        },
      },
    })

    const doc = result.docs[0]
    return doc ? normalizeNewsDoc(doc) : null
  } catch {
    return null
  }
}
