import { and, desc, eq, inArray } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { datasets, profiles, userActivities } from "@/lib/db/schema"

export type OnboardingStep = {
  id: string
  title: string
  description: string
  href: string
  complete: boolean
}

export type OnboardingStatus = {
  completionPercent: number
  autoOpen: boolean
  hasSeenOnboarding: boolean
  steps: OnboardingStep[]
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

  const [profile, firstDataset, analyzedActivity, seenActivity] = await Promise.all([
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
  ])

  const hasProfile = Boolean(profile?.fullName && profile?.email)
  const hasBusinessDetails = Boolean(
    profile?.businessName &&
      profile?.businessEmail &&
      profile?.industry &&
      profile?.location &&
      profile?.website &&
      profile?.businessDescription,
  )
  const hasDataset = Boolean(firstDataset)
  const hasAnalysis = Boolean(analyzedActivity)

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      title: "Complete profile",
      description: "Add your name and account email in Settings.",
      href: "/app/settings/profile",
      complete: hasProfile,
    },
    {
      id: "business",
      title: "Complete business details",
      description: "Fill company context so analysis and suggestions fit your work.",
      href: "/app/settings/business",
      complete: hasBusinessDetails,
    },
    {
      id: "upload",
      title: "Upload data",
      description: "Add a CSV dataset from the upload workflow.",
      href: "/app/upload",
      complete: hasDataset,
    },
    {
      id: "analysis",
      title: "Run analysis",
      description: "Open a dataset and generate its first analysis.",
      href: "/app/datasets",
      complete: hasAnalysis,
    },
  ]
  const completionPercent = Math.round(
    (steps.filter((step) => step.complete).length / steps.length) * 100,
  )
  const hasSeenOnboarding = Boolean(seenActivity)

  return {
    completionPercent,
    autoOpen: !hasSeenOnboarding || completionPercent < 25,
    hasSeenOnboarding,
    steps,
  }
}

function emptyStatus(autoOpen: boolean): OnboardingStatus {
  return {
    completionPercent: 0,
    autoOpen,
    hasSeenOnboarding: false,
    steps: [],
  }
}
