import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/db"
import { aiProviderConfigs, profiles } from "@/lib/db/schema"
import {
  canUseHybridAiFeature,
  getHybridAiEntitlement,
  getHybridAiFeature,
  getHybridAiFeatureTier,
  type HybridAiFeatureId,
  type HybridAiTier,
} from "@/lib/hybrid-ai/features"
import { and, eq, ne } from "drizzle-orm"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"

export type HybridAiFeatureAccess = {
  userId: string
  role: string
  subscriptionTier: string
  accessTier: HybridAiTier | null
  canUseLite: boolean
  canUseMega: boolean
  enabledFeatureIds: HybridAiFeatureId[]
  providerLimit: number | null
}

export type HybridAiFeatureGateResult =
  | { success: true; session: Session; access: HybridAiFeatureAccess }
  | { success: false; error: NextResponse; status: 401 | 403; message: string; requiredTier?: HybridAiTier }

export async function getHybridAiFeatureAccess(userId: string, sessionRole?: string | null): Promise<HybridAiFeatureAccess> {
  const db = getDb()
  const profile = db
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
        columns: {
          subscriptionTier: true,
          role: true,
        },
      })
    : null

  const role = profile?.role || sessionRole || "user"
  const subscriptionTier = profile?.subscriptionTier || "free"
  const entitlement = getHybridAiEntitlement(subscriptionTier, role)

  return {
    userId,
    role,
    subscriptionTier,
    accessTier: entitlement.accessTier,
    canUseLite: entitlement.canUseLite,
    canUseMega: entitlement.canUseMega,
    enabledFeatureIds: entitlement.enabledModuleIds,
    providerLimit: entitlement.providerLimit,
  }
}

export async function requireHybridAiFeature(featureId: HybridAiFeatureId): Promise<HybridAiFeatureGateResult> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return {
      success: false,
      status: 401,
      message: "Unauthorized",
      error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    }
  }

  const access = await getHybridAiFeatureAccess(userId, session.user.role)
  if (access.enabledFeatureIds.includes(featureId)) {
    return { success: true, session, access }
  }

  const requiredTier = getHybridAiFeatureTier(featureId)
  const feature = getHybridAiFeature(featureId)
  const message =
    requiredTier === "mega"
      ? `${feature?.name || "This Hybrid AI feature"} requires Hybrid AI MEGA.`
      : `${feature?.name || "This Hybrid AI feature"} requires Hybrid AI Lite or MEGA.`

  return {
    success: false,
    status: 403,
    requiredTier,
    message,
    error: NextResponse.json(
      {
        success: false,
        error: "Upgrade required",
        upgradeRequired: true,
        requiredTier,
        featureId,
        featureName: feature?.name || "Hybrid AI",
        message,
        reason: feature?.upgradeReason || message,
      },
      { status: 403 },
    ),
  }
}

export async function canUseHybridAiFeatureForUser(userId: string, featureId: HybridAiFeatureId, sessionRole?: string | null) {
  const access = await getHybridAiFeatureAccess(userId, sessionRole)
  return canUseHybridAiFeature(featureId, access.subscriptionTier, access.role)
}

export async function canUseConfiguredAiProviders(userId: string, sessionRole?: string | null) {
  return canUseHybridAiFeatureForUser(userId, "basicLocalAi", sessionRole)
}

export async function assertCanSaveAiProvider(input: {
  userId: string
  sessionRole?: string | null
  providerId?: string | null
}) {
  const access = await getHybridAiFeatureAccess(input.userId, input.sessionRole)

  if (!access.enabledFeatureIds.includes("singleAiProvider")) {
    throw new HybridAiFeatureGateError("AI Providers require Hybrid AI Lite or MEGA.", "lite", "singleAiProvider")
  }

  if (access.providerLimit === null) return access

  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const existingProviders = await db.query.aiProviderConfigs.findMany({
    where: input.providerId
      ? and(eq(aiProviderConfigs.userId, input.userId), ne(aiProviderConfigs.id, input.providerId))
      : eq(aiProviderConfigs.userId, input.userId),
    columns: { id: true },
  })

  if (existingProviders.length >= access.providerLimit) {
    throw new HybridAiFeatureGateError(
      "Hybrid AI Lite includes one AI provider. Upgrade to Hybrid AI MEGA to connect multiple providers.",
      "mega",
      "singleAiProvider",
    )
  }

  return access
}

export class HybridAiFeatureGateError extends Error {
  constructor(
    message: string,
    public readonly requiredTier: HybridAiTier,
    public readonly featureId: HybridAiFeatureId,
  ) {
    super(message)
    this.name = "HybridAiFeatureGateError"
  }
}

export function featureGateFailureMessage(error: unknown) {
  if (error instanceof HybridAiFeatureGateError) return error.message
  return null
}
