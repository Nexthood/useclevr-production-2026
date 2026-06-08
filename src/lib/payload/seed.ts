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

const faqSeed = [
  {
    category: "Getting Started",
    question: "How does UseClevr turn CSV data into answers?",
    answer: "Upload a CSV file and ask questions in plain English. UseClevr's AI reads your table headers and data types, runs verified calculations (sum, average, top-N, group-by, etc.), and returns both the computed result and a plain-language explanation.",
    sortOrder: 1,
    scope: "public" as const,
  },
  {
    category: "Getting Started",
    question: "Do I need SQL or data science skills?",
    answer: "No. UseClevr translates natural language into structured queries and deterministic calculations. You only need to understand your own data — the platform handles the rest.",
    sortOrder: 2,
    scope: "public" as const,
  },
  {
    category: "Getting Started",
    question: "How do I upload a dataset?",
    answer: "Go to the Datasets page from the sidebar and click \"Upload dataset\". Supported format is CSV (up to 50 MB per file). Once uploaded, the column headers are parsed and the dataset is ready for analysis.",
    sortOrder: 3,
    scope: "public" as const,
  },
  {
    category: "Getting Started",
    question: "What file formats are supported?",
    answer: "CSV files are fully supported for upload, analysis, and report generation. We recommend UTF-8 encoded CSVs with a header row.",
    sortOrder: 4,
    scope: "public" as const,
  },
  {
    category: "Getting Started",
    question: "How long does setup take?",
    answer: "Most users are analysing their first dataset within five minutes. Create an account, upload a CSV, and type your first question — no configuration required.",
    sortOrder: 5,
    scope: "public" as const,
  },
  {
    category: "Plans & Billing",
    question: "How do payments and subscriptions work?",
    answer: "UseClevr uses Stripe Checkout for secure subscription payments. When you choose a paid plan, you are redirected to Stripe's secure checkout page to enter your payment details. After payment, you are redirected back to UseClevr and your subscription is activated automatically.",
    sortOrder: 1,
    scope: "public" as const,
  },
  {
    category: "Plans & Billing",
    question: "What payment methods are supported?",
    answer: "We support all major credit and debit cards through Stripe. Enterprise invoices are available on the Business plan.",
    sortOrder: 2,
    scope: "public" as const,
  },
  {
    category: "Plans & Billing",
    question: "Does UseClevr store my card details?",
    answer: "No. UseClevr does not store your card details. Payments are processed securely by Stripe.",
    sortOrder: 3,
    scope: "public" as const,
  },
  {
    category: "Plans & Billing",
    question: "Can I upgrade or downgrade my plan at any time?",
    answer: "Yes. Plan changes take effect at the start of the next billing cycle. Go to Settings → Subscription to switch plans instantly.",
    sortOrder: 4,
    scope: "public" as const,
  },
  {
    category: "Plans & Billing",
    question: "Can I cancel my subscription?",
    answer: "Yes. You can cancel your subscription from your billing settings. Your paid access remains active until the end of your current billing period.",
    sortOrder: 5,
    scope: "public" as const,
  },
  {
    category: "Plans & Billing",
    question: "What happens to my data when I downgrade or cancel?",
    answer: "Your data remains accessible until the end of the current billing period. After cancellation, you can re-subscribe at any time to restore full access.",
    sortOrder: 6,
    scope: "public" as const,
  },
  {
    category: "Plans & Billing",
    question: "Is there a free plan?",
    answer: "Yes — the Free plan includes 1 dataset and limited AI questions so you can try the platform before upgrading. No credit card required.",
    sortOrder: 7,
    scope: "public" as const,
  },
  {
    category: "AI & Analysis",
    question: "Which AI models does UseClevr use?",
    answer: "UseClevr uses Google Gemini via the AI SDK for cloud analysis. Hybrid AI Lite runs a local model in your browser for sensitive datasets — your data never leaves your device during local analysis.",
    sortOrder: 1,
    scope: "public" as const,
  },
  {
    category: "AI & Analysis",
    question: "What kinds of questions can I ask?",
    answer: "Any question your structured data can answer: totals, averages, top-N rankings, group-by summaries, comparisons over time, trend analysis, and more. The AI will confirm if a question cannot be answered with the available columns.",
    sortOrder: 2,
    scope: "public" as const,
  },
  {
    category: "AI & Analysis",
    question: "How do I get the best answer from the AI assistant?",
    answer: "Ask one clear question, name the dataset or metric when it matters, and ask for the direct result first. Add context such as period, region, product, or customer segment when you need a focused answer.",
    sortOrder: 3,
    scope: "public" as const,
  },
  {
    category: "AI & Analysis",
    question: "Is Hybrid AI really local?",
    answer: "Yes. Hybrid AI connects to the local UseClevr runtime on your device. Local analysis keeps your data on your machine instead of sending it to the cloud AI provider.",
    sortOrder: 4,
    scope: "public" as const,
  },
  {
    category: "Data & Privacy",
    question: "Is my data secure?",
    answer: "UseClevr is GDPR-compliant and aligned with SOC 2 principles. Uploaded datasets and generated reports are your property. We never train external models on your data.",
    sortOrder: 1,
    scope: "public" as const,
  },
  {
    category: "Data & Privacy",
    question: "Where is my data stored?",
    answer: "Your datasets are stored in your configured database (Neon PostgreSQL). Reports are generated on demand and served to your browser. No persistent cloud AI storage is used.",
    sortOrder: 2,
    scope: "public" as const,
  },
  {
    category: "Data & Privacy",
    question: "Can I delete my data?",
    answer: "Yes. You can delete individual datasets from the Datasets page, or request full account deletion by contacting support. All data is removed within 30 days.",
    sortOrder: 3,
    scope: "public" as const,
  },
  {
    category: "Data & Privacy",
    question: "Do you use my data to train models?",
    answer: "No. UseClevr never uses your uploaded data, questions, or generated reports to train or fine-tune any external model.",
    sortOrder: 4,
    scope: "public" as const,
  },
  {
    category: "Technical",
    question: "Which browsers are supported?",
    answer: "UseClevr works on all modern browsers: Chrome, Firefox, Safari, and Edge (latest two stable versions). Hybrid AI Lite requires a browser with WebAssembly support.",
    sortOrder: 1,
    scope: "public" as const,
  },
  {
    category: "Technical",
    question: "Is there an API?",
    answer: "Yes. UseClevr provides REST API endpoints for queries and chat completions. See the Developer Guide for authentication, rate limits, and example requests.",
    sortOrder: 2,
    scope: "public" as const,
  },
  {
    category: "Technical",
    question: "What is Hybrid AI Lite vs Mega?",
    answer: "Hybrid AI Lite is the recommended option for everyday use on most devices. Hybrid AI MEGA is designed for business workstations with higher capacity requirements.",
    sortOrder: 3,
    scope: "public" as const,
  },
  {
    category: "Technical",
    question: "Can I self-host UseClevr?",
    answer: "Self-hosting is available on the Business / Custom plan. Contact sales@useclevr.com to discuss private deployment options for your organisation.",
    sortOrder: 4,
    scope: "public" as const,
  },
  {
    category: "Technical",
    question: "Can I change theme, contrast, or text size?",
    answer: "Yes. Use the display settings icon to choose Light, Dark, or System theme. High contrast increases visual separation, and Larger text raises the reading size across pages.",
    sortOrder: 5,
    scope: "public" as const,
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

async function ensureFaqsSeed(payload: Payload) {
  const p = payload as any
  for (const item of faqSeed) {
    const existing = await p.find({
      collection: "faqs",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        question: {
          equals: item.question,
        },
      },
    })

    if (existing.docs[0]) {
      continue
    }

    await p.create({
      collection: "faqs",
      data: item,
      overrideAccess: true,
    })
  }
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
  await ensureFaqsSeed(payload)
  await ensureGlobalSeed(payload, "homepage-content", homepageSeed)
  await ensureGlobalSeed(payload, "privacy-page-content", privacySeed)
  await ensureGlobalSeed(payload, "terms-page-content", termsSeed)
  await ensureNewsSeed(payload)
}
