import { and, desc, eq, inArray } from "drizzle-orm"

import { getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { getDb } from "@/lib/db"
import { datasets, profiles, userActivities } from "@/lib/db/schema"

export type OnboardingStep = {
  id: string
  title: string
  description: string
  href: string
  complete: boolean
  group?: string
  section?: string
}

export type OnboardingStatus = {
  completionPercent: number
  autoOpen: boolean
  hasSeenOnboarding: boolean
  steps: OnboardingStep[]
  completedCount: number
  totalCount: number
}

const ONBOARDING_SEEN_TYPES = ["onboarding_seen"] as const

export async function getOnboardingStatus(userId: string | null | undefined): Promise<OnboardingStatus> {
  if (!userId) {
    return emptyStatus(false)
  }

  const db = getDb()
  if (!db) {
    return emptyStatus(false)
  }

  const [profile, businessDetails, firstDataset, analyzedActivity, seenActivity, pageVisitActivities] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: {
        email: true,
        fullName: true,
        businessName: true,
        businessEmail: true,
        industry: true,
        location: true,
        website: true,
        businessDescription: true,
      },
    }),
    getPrimaryBusinessDetails(userId),
    db.query.datasets.findFirst({
      where: eq(datasets.userId, userId),
      columns: { id: true },
      orderBy: [desc(datasets.createdAt)],
    }),
    db.query.userActivities.findFirst({
      where: and(eq(userActivities.userId, userId), eq(userActivities.type, "dataset_analyzed")),
      columns: { id: true },
      orderBy: [desc(userActivities.createdAt)],
    }),
    db.query.userActivities.findFirst({
      where: and(eq(userActivities.userId, userId), inArray(userActivities.type, ONBOARDING_SEEN_TYPES)),
      columns: { id: true },
      orderBy: [desc(userActivities.createdAt)],
    }),
    db.query.userActivities.findMany({
      where: and(eq(userActivities.userId, userId), eq(userActivities.type, "page_visited")),
      columns: { metadata: true },
      orderBy: [desc(userActivities.createdAt)],
      limit: 100,
    }),
  ])

  const visitedPages = new Set(
    pageVisitActivities
      .map((activity) => {
        const metadata = activity.metadata as { path?: unknown } | null
        return typeof metadata?.path === "string" ? metadata.path : null
      })
      .filter((path): path is string => Boolean(path)),
  )

  const requiredPageVisits = [
    { id: "visit-profile", title: "Visit profile settings", href: "/app/settings/profile" },
    { id: "visit-business", title: "Visit business workspace", href: "/app/business" },
    { id: "visit-business-profile", title: "Visit business profile", href: "/app/business/profile" },
    { id: "visit-business-locations", title: "Visit business locations", href: "/app/business/locations" },
    { id: "visit-business-tax", title: "Visit business tax settings", href: "/app/business/tax" },
    { id: "visit-business-financial", title: "Visit business financial settings", href: "/app/business/financial" },
    { id: "visit-business-review", title: "Visit business review", href: "/app/business/review" },
    { id: "visit-datasets", title: "Visit datasets", href: "/app/datasets" },
    { id: "visit-assistant", title: "Visit AI Assistant", href: "/app/assistant" },
    { id: "visit-downloads", title: "Visit reports and downloads", href: "/app/downloads" },
    { id: "visit-faq", title: "Visit dashboard FAQ", href: "/app/faq" },
  ]
  const hasDataset = Boolean(firstDataset)
  const hasAnalysis = Boolean(analyzedActivity)

  const profileComplete = Boolean(profile?.fullName && profile?.email)
  const businessComplete = Boolean(businessDetails.businessName && businessDetails.businessEmail && businessDetails.industry && businessDetails.location && businessDetails.website && businessDetails.businessDescription)

  const visitedCount = requiredPageVisits.filter((p) => visitedPages.has(p.href)).length
  const allPagesVisited = visitedCount === requiredPageVisits.length

  const steps: OnboardingStep[] = [
    {
      id: "profile-completed",
      title: "Complete profile",
      description: "Add your name and confirm your account email in profile settings.",
      href: "/app/settings/profile",
      complete: profileComplete,
      group: "Profile",
      section: "Account",
    },
    {
      id: "business-profile-completed",
      title: "Complete business profile",
      description: "Add company name, email, industry, location, website, and description.",
      href: "/app/business/profile",
      complete: businessComplete,
      group: "Business",
      section: "Account",
    },
    {
      id: "dataset-uploaded",
      title: "Upload data",
      description: "Add a CSV dataset from the upload workflow.",
      href: "/app/upload",
      complete: hasDataset,
      group: "Data workflow",
      section: "Data",
    },
    {
      id: "dataset-analyzed",
      title: "Run analysis",
      description: "Open a dataset and generate its first analysis.",
      href: "/app/datasets",
      complete: hasAnalysis,
      group: "Data workflow",
      section: "Data",
    },
    {
      id: "pages-visited",
      title: `Guided tour (${visitedCount} of ${requiredPageVisits.length} pages)`,
      description: "Visit the main dashboard sections to complete the tour.",
      href: requiredPageVisits.find((p) => !visitedPages.has(p.href))?.href ?? requiredPageVisits[0].href,
      complete: allPagesVisited,
      group: "Page visits",
      section: "Tour",
    },
  ]
  const completedCount = steps.filter((step) => step.complete).length
  const completionPercent = Math.round(
    (completedCount / steps.length) * 100,
  )
  const hasSeenOnboarding = Boolean(seenActivity)

  return {
    completionPercent,
    autoOpen: !hasSeenOnboarding || completionPercent < 50,
    hasSeenOnboarding,
    steps,
    completedCount,
    totalCount: steps.length,
  }
}

function emptyStatus(autoOpen: boolean): OnboardingStatus {
  return {
    completionPercent: 0,
    autoOpen,
    hasSeenOnboarding: false,
    steps: [],
    completedCount: 0,
    totalCount: 0,
  }
}
