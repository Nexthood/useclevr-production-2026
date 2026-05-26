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

  const profileFields = [
    { id: "profile-name", title: "Add your name", complete: Boolean(profile?.fullName) },
    { id: "profile-email", title: "Confirm account email", complete: Boolean(profile?.email) },
  ]
  const businessFields = [
    { id: "business-name", title: "Add company name", complete: Boolean(businessDetails.businessName) },
    { id: "business-email", title: "Add company email", complete: Boolean(businessDetails.businessEmail) },
    { id: "business-industry", title: "Add industry", complete: Boolean(businessDetails.industry) },
    { id: "business-location", title: "Add location", complete: Boolean(businessDetails.location) },
    { id: "business-website", title: "Add website", complete: Boolean(businessDetails.website) },
    { id: "business-description", title: "Add business description", complete: Boolean(businessDetails.businessDescription) },
  ]
  const requiredPageVisits = [
    { id: "visit-profile", title: "Visit profile settings", href: "/app/settings/profile" },
    { id: "visit-business", title: "Visit business workspace", href: "/app/business" },
    { id: "visit-datasets", title: "Visit datasets", href: "/app/datasets" },
    { id: "visit-assistant", title: "Visit AI Assistant", href: "/app/assistant" },
    { id: "visit-downloads", title: "Visit reports and downloads", href: "/app/downloads" },
    { id: "visit-faq", title: "Visit dashboard FAQ", href: "/app/faq" },
  ]
  const hasDataset = Boolean(firstDataset)
  const hasAnalysis = Boolean(analyzedActivity)

  const steps: OnboardingStep[] = [
    ...profileFields.map((field) => ({
      id: field.id,
      title: field.title,
      description: "Complete the basic account fields in profile settings.",
      href: "/app/settings/profile",
      complete: field.complete,
      group: "Profile",
    })),
    ...businessFields.map((field) => ({
      id: field.id,
      title: field.title,
      description: "Complete the business profile fields that tailor analysis and reports.",
      href: "/app/business/profile",
      complete: field.complete,
      group: "Business profile",
    })),
    {
      id: "dataset-uploaded",
      title: "Upload data",
      description: "Add a CSV dataset from the upload workflow.",
      href: "/app/upload",
      complete: hasDataset,
      group: "Data workflow",
    },
    {
      id: "dataset-analyzed",
      title: "Run analysis",
      description: "Open a dataset and generate its first analysis.",
      href: "/app/datasets",
      complete: hasAnalysis,
      group: "Data workflow",
    },
    ...requiredPageVisits.map((page) => ({
      id: page.id,
      title: page.title,
      description: "Open this dashboard area at least once so setup progress reflects explored pages.",
      href: page.href,
      complete: visitedPages.has(page.href),
      group: "Page visits",
    })),
  ]
  const completedCount = steps.filter((step) => step.complete).length
  const completionPercent = Math.round(
    (completedCount / steps.length) * 100,
  )
  const hasSeenOnboarding = Boolean(seenActivity)

  return {
    completionPercent,
    autoOpen: !hasSeenOnboarding || completionPercent < 25,
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
