import { dashboardFaqCategories, superAdminFaqCategories } from "@/lib/content/dashboard-faq"
import { allFaqCategories } from "@/lib/content/faq"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { listAllReports } from "@/lib/reports/report-generator"
import { and, ilike, or, eq } from "drizzle-orm"

export type AppSearchRole = "user" | "demo" | "superadmin"

export type AppSearchResult = {
  id: string
  type: "page" | "dataset" | "report" | "faq"
  title: string
  description?: string
  href: string
}

type SearchInput = {
  query: string
  userId?: string | null
  role?: string | null
  limit?: number
}

const APP_PAGES: Array<AppSearchResult & { roles?: AppSearchRole[]; keywords: string }> = [
  {
    id: "page-dashboard",
    type: "page",
    title: "Dashboard",
    description: "Workspace overview, setup state, and quick actions.",
    href: "/app",
    keywords: "dashboard overview home start metrics setup progress",
  },
  {
    id: "page-datasets",
    type: "page",
    title: "Datasets",
    description: "Upload files, open tables, run analysis, and generate reports.",
    href: "/app/datasets",
    keywords: "datasets csv upload table analyze report delete bulk",
  },
  {
    id: "page-assistant",
    type: "page",
    title: "AI Assistant",
    description: "Ask questions about uploaded datasets.",
    href: "/app/assistant",
    keywords: "ai assistant chat analysis questions suggestions hybrid",
  },
  {
    id: "page-downloads",
    type: "page",
    title: "Reports & Downloads",
    description: "Find generated reports and downloads.",
    href: "/app/downloads",
    keywords: "reports downloads pdf export files",
  },
  {
    id: "page-business",
    type: "page",
    title: "Business",
    description: "Manage business profiles, locations, tax, financial details, and reviews.",
    href: "/app/business",
    keywords: "business profile company location tax financial review",
  },
  {
    id: "page-accountancy",
    type: "page",
    title: "Accountancy",
    description: "Review tax, compliance, and reporting workspace pages.",
    href: "/app/accountancy",
    keywords: "accountancy accounting tax compliance reporting receipts",
  },
  {
    id: "page-tickets",
    type: "page",
    title: "Tickets",
    description: "Create support requests and track issue resolution.",
    href: "/app/tickets",
    keywords: "tickets support issues help new ticket",
  },
  {
    id: "page-faq",
    type: "page",
    title: "Dashboard FAQ",
    description: "Customer help for dashboard, billing, datasets, reports, and Hybrid AI.",
    href: "/app/faq",
    keywords: "faq help questions billing datasets reports hybrid ai support",
  },
  {
    id: "page-account",
    type: "page",
    title: "Account",
    description: "Update account profile and preferences.",
    href: "/app/settings/profile",
    keywords: "account profile settings preferences email name",
  },
  {
    id: "page-subscription",
    type: "page",
    title: "Subscription",
    description: "Review plan, billing status, and checkout options.",
    href: "/app/settings/subscription",
    keywords: "subscription billing plan checkout payment credits",
  },
  {
    id: "page-admin-customers",
    type: "page",
    title: "Admin Customers",
    description: "Review and manage customer records.",
    href: "/app/admin/customers",
    keywords: "admin customers users plans superadmin",
    roles: ["superadmin"],
  },
  {
    id: "page-admin-levels",
    type: "page",
    title: "Customer Levels",
    description: "Manage customer level rules.",
    href: "/app/admin/levels",
    keywords: "admin customer levels rewards rules",
    roles: ["superadmin"],
  },
  {
    id: "page-admin-discounts",
    type: "page",
    title: "Discount Rules",
    description: "Manage discount and referral rules.",
    href: "/app/admin/discounts",
    keywords: "admin discounts coupons referral rules",
    roles: ["superadmin"],
  },
  {
    id: "page-operator-faq",
    type: "page",
    title: "Operator FAQ",
    description: "Super-admin payment, support, and incident notes.",
    href: "/app/faq?scope=operator",
    keywords: "operator faq admin payments incidents webhook support",
    roles: ["superadmin"],
  },
]

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function matchesQuery(result: AppSearchResult & { keywords?: string }, query: string) {
  const haystack = `${result.title} ${result.description || ""} ${result.keywords || ""}`.toLowerCase()
  return haystack.includes(query)
}

function roleCanSee(roles: AppSearchRole[] | undefined, role: string | null | undefined) {
  if (!roles?.length) return true
  return roles.includes(role === "superadmin" ? "superadmin" : "user")
}

function faqResults(query: string, isSuperAdmin: boolean): AppSearchResult[] {
  const categories = [
    ...dashboardFaqCategories.map((category) => ({ ...category, href: "/app/faq" })),
    ...allFaqCategories.map((category) => ({ ...category, href: "/faq" })),
    ...(isSuperAdmin
      ? superAdminFaqCategories.map((category) => ({ ...category, href: "/app/faq?scope=operator" }))
      : []),
  ]

  return categories.flatMap((category) =>
    category.items
      .filter((item) => `${category.category} ${item.q} ${item.a}`.toLowerCase().includes(query))
      .map((item, index) => ({
        id: `faq-${category.category}-${index}-${item.q}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
        type: "faq" as const,
        title: item.q,
        description: `${category.category}: ${item.a}`,
        href: category.href,
      })),
  )
}

export async function searchApp({ query, userId, role, limit = 20 }: SearchInput): Promise<AppSearchResult[]> {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return []

  const isSuperAdmin = role === "superadmin"
  const staticResults = APP_PAGES
    .filter((item) => roleCanSee(item.roles, role))
    .filter((item) => matchesQuery(item, normalizedQuery))
    .map(({ roles: _roles, keywords: _keywords, ...result }) => result)

  const faqMatches = faqResults(normalizedQuery, isSuperAdmin)

  const dynamicResults: AppSearchResult[] = []
  const db = getDb()

  if (db && userId) {
    const datasetWhere = isSuperAdmin
      ? or(ilike(datasets.name, `%${normalizedQuery}%`), ilike(datasets.fileName, `%${normalizedQuery}%`))
      : and(
          eq(datasets.userId, userId),
          or(ilike(datasets.name, `%${normalizedQuery}%`), ilike(datasets.fileName, `%${normalizedQuery}%`)),
        )

    const datasetMatches = await db
      .select({
        id: datasets.id,
        name: datasets.name,
        fileName: datasets.fileName,
        analysisStatus: datasets.analysisStatus,
      })
      .from(datasets)
      .where(datasetWhere)
      .limit(10)

    dynamicResults.push(
      ...datasetMatches.map((dataset) => ({
        id: `dataset-${dataset.id}`,
        type: "dataset" as const,
        title: dataset.name,
        description: `${dataset.fileName} · ${dataset.analysisStatus || "dataset"}`,
        href: `/app/datasets/${encodeURIComponent(dataset.id)}`,
      })),
    )
  }

  try {
    const reportMatches = listAllReports()
      .filter((report) =>
        `${report.datasetName} ${report.summary} ${report.findings.join(" ")}`.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 5)

    dynamicResults.push(
      ...reportMatches.map((report) => ({
        id: `report-${report.id}`,
        type: "report" as const,
        title: `${report.datasetName} report`,
        description: report.summary,
        href: `/report/${encodeURIComponent(report.id)}`,
      })),
    )
  } catch {
    // Report search is best-effort because report storage can be file-backed.
  }

  const unique = new Map<string, AppSearchResult>()
  for (const result of [...dynamicResults, ...staticResults, ...faqMatches]) {
    unique.set(`${result.type}:${result.href}:${result.title}`, result)
  }

  return Array.from(unique.values()).slice(0, limit)
}
