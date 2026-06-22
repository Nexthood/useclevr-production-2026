import { and, desc, eq } from "drizzle-orm"

import { getPrimaryBusinessDetails } from "@/lib/business/business-store"
import { getDb } from "@/lib/db"
import { datasets, userActivities } from "@/lib/db/schema"

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
  steps: OnboardingStep[]
  completedCount: number
  totalCount: number
}

export async function getOnboardingStatus(userId: string | null | undefined): Promise<OnboardingStatus> {
  if (!userId) {
    return emptyStatus()
  }

  const db = getDb()
  if (!db) {
    return emptyStatus()
  }

  const [businessDetails, firstDataset, analyzedActivity] = await Promise.all([
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
  ])

  const hasDataset = Boolean(firstDataset)
  const hasAnalysis = Boolean(analyzedActivity)

  const businessComplete = Boolean(businessDetails.businessName && businessDetails.businessEmail && businessDetails.industry && businessDetails.location && businessDetails.website && businessDetails.businessDescription)
  const accountancyComplete = businessComplete && hasDataset

  const steps: OnboardingStep[] = [
    {
      id: "business-profile-completed",
      title: "Business Profile",
      description: "Complete company, tax, payroll, margin, cash-flow, and operating assumptions.",
      href: "/app/business/setup",
      complete: businessComplete,
      group: "Core workflow",
      section: "Business",
    },
    {
      id: "accountancy-ready",
      title: "Accountancy",
      description: "Prepare accounting context from the Business Profile and uploaded financial records.",
      href: "/app/accountancy",
      complete: accountancyComplete,
      group: "Core workflow",
      section: "Accountancy",
    },
    {
      id: "dataset-uploaded",
      title: "Dataset Upload",
      description: "Upload the first business dataset for analysis.",
      href: "/app/upload",
      complete: hasDataset,
      group: "Core workflow",
      section: "Upload",
    },
    {
      id: "dataset-analyzed",
      title: "Analysis",
      description: "Run the first dataset analysis.",
      href: "/app/datasets",
      complete: hasAnalysis,
      group: "Core workflow",
      section: "Analysis",
    },
  ]
  const completedCount = steps.filter((step) => step.complete).length
  const completionPercent = Math.round(
    (completedCount / steps.length) * 100,
  )

  return {
    completionPercent,
    steps,
    completedCount,
    totalCount: steps.length,
  }
}

function emptyStatus(): OnboardingStatus {
  return {
    completionPercent: 0,
    steps: [],
    completedCount: 0,
    totalCount: 0,
  }
}
