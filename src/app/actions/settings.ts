"use server"

import { v4 as uuidv4 } from "uuid"
import { auth } from "@/lib/auth/auth"
import { isBuiltinUserId } from "@/lib/auth/builtin-users"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import { recordActivity } from "@/lib/activity/activity-store"
import { saveAiProviderConfig, setAiMode, setAiProviderRouting, type AiMode, type AiProviderType } from "@/lib/ai/byoai-provider"
import { upsertBusinessDetails, upsertPrimaryBusinessDetails } from "@/lib/business/business-store"
import { getDb } from "@/lib/db"
import { profiles, users } from "@/lib/db/schema"
import { assertCanSaveAiProvider, featureGateFailureMessage, getHybridAiFeatureAccess } from "@/lib/hybrid-ai/feature-gate"
import { failure, type Result, success } from "@/lib/result"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

type ProfileData = { message: string }

export async function updateProfile(formData: FormData): Promise<Result<ProfileData>> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return failure("Please sign in again.")
  }

  const fullName = String(formData.get("fullName") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()

  if (!fullName) {
    return failure("Name is required.")
  }

  if (!email || !email.includes("@")) {
    return failure("Use a valid email address.")
  }

  if (isBuiltinUserId(userId)) {
    return success({ message: "Built-in account identity is locked." })
  }

  const db = getDb()

  if (!db) {
    return failure("Database connection is unavailable.")
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
    },
  })

  if (existingUser && existingUser.id !== userId) {
    return failure("That email is already used by another account.")
  }

  await db.update(users)
    .set({
      name: fullName,
      email,
    })
    .where(eq(users.id, userId))

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: {
      userId: true,
    },
  })

  if (existingProfile) {
    await db.update(profiles)
      .set({
        fullName,
        email,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
  } else {
    await db.insert(profiles).values({
      id: `profile_${uuidv4()}`,
      userId,
      email,
      fullName,
    })
  }

  await recordActivity({
    userId,
    userEmail: email,
    type: "profile_updated",
    feature: "settings",
    title: "Profile updated",
    description: "Account profile details were saved.",
  })

  revalidatePath("/app")
  revalidatePath("/app/settings")
  revalidatePath("/app/settings/profile")

  return success({ message: "Profile saved." })
}

// ---------------------------------------------------------------------------
// AI provider settings
// ---------------------------------------------------------------------------

export async function saveAiProvider(formData: FormData): Promise<Result<ProfileData>> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) return failure("Please sign in again.")

  try {
    await assertCanSaveAiProvider({
      userId,
      sessionRole: session.user.role,
      providerId: String(formData.get("providerId") || "") || undefined,
    })
    await saveAiProviderConfig(userId, {
      id: String(formData.get("providerId") || "") || undefined,
      providerName: String(formData.get("providerName") || ""),
      providerType: String(formData.get("providerType") || "openai-compatible") as AiProviderType,
      baseUrl: String(formData.get("baseUrl") || ""),
      modelName: String(formData.get("modelName") || ""),
      apiKey: formData.has("apiKey") ? String(formData.get("apiKey") || "") : undefined,
      enabled: formData.get("enabled") === "on",
      isDefault: formData.get("isDefault") === "on",
      isFallback: formData.get("isFallback") === "on",
      priority: Number(formData.get("priority") || 100),
    })
  } catch (error) {
    const gateMessage = featureGateFailureMessage(error)
    if (gateMessage) return failure(gateMessage)
    const message = error instanceof Error ? error.message : "AI provider was not saved."
    return failure(message)
  }

  await recordActivity({
    userId,
    userEmail: session.user.email,
    type: "profile_updated",
    feature: "settings",
    title: "AI provider saved",
    description: "Bring Your Own AI provider settings were updated.",
  })

  revalidatePath("/app/settings")
  revalidatePath("/app/settings/ai-providers")

  return success({ message: "AI provider saved." })
}

export async function updateAiProviderRouting(formData: FormData): Promise<Result<ProfileData>> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) return failure("Please sign in again.")

  try {
    const access = await getHybridAiFeatureAccess(userId, session.user.role)
    if (!access.enabledFeatureIds.includes("singleAiProvider")) {
      return failure("AI provider routing requires Hybrid AI Lite or MEGA.")
    }
    const fallbackProviderId = String(formData.get("fallbackProviderId") || "").trim()
    if (access.providerLimit === 1 && fallbackProviderId) {
      return failure("Hybrid AI Lite includes one AI provider. Upgrade to Hybrid AI MEGA to configure a fallback provider.")
    }
    await setAiProviderRouting(userId, {
      defaultProviderId: String(formData.get("defaultProviderId") || ""),
      fallbackProviderId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider routing was not saved."
    return failure(message)
  }

  await recordActivity({
    userId,
    userEmail: session.user.email,
    type: "profile_updated",
    feature: "settings",
    title: "AI provider routing saved",
    description: "Default and fallback AI provider settings were updated.",
  })

  revalidatePath("/app/settings")
  revalidatePath("/app/settings/ai-providers")

  return success({ message: "AI provider routing saved." })
}

export async function updateAiMode(formData: FormData): Promise<Result<ProfileData>> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) return failure("Please sign in again.")

  const mode = String(formData.get("aiMode") || "auto") as AiMode

  try {
    const access = await getHybridAiFeatureAccess(userId, session.user.role)
    if (!access.enabledFeatureIds.includes("aiModeRouting")) {
      return failure("AI mode switching requires Hybrid AI Lite or MEGA.")
    }
    await setAiMode(userId, mode)
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI mode was not saved."
    return failure(message)
  }

  await recordActivity({
    userId,
    userEmail: session.user.email,
    type: "profile_updated",
    feature: "settings",
    title: "AI mode saved",
    description: "Hybrid AI mode routing was updated.",
  })

  revalidatePath("/app/settings")
  revalidatePath("/app/settings/ai-providers")

  return success({ message: "AI mode saved." })
}

// ---------------------------------------------------------------------------
// Business details
// ---------------------------------------------------------------------------

export async function updateBusinessDetails(formData: FormData): Promise<Result<ProfileData>> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) return failure("Please sign in again.")

  const db = getDb()
  if (!db) return failure("Database connection is unavailable.")

  try {
    await requireBuiltinUserRecord(userId)
  } catch {
    return failure("Database connection is unavailable.")
  }

  const businessName        = String(formData.get("businessName") ?? "").trim()
  const businessEmail       = String(formData.get("businessEmail") ?? "").trim().toLowerCase()
  const industry            = String(formData.get("industry") ?? "").trim() || null
  const location            = String(formData.get("location") ?? "").trim() || null
  const website             = String(formData.get("website") ?? "").trim() || null
  const businessDescription = String(formData.get("businessDescription") ?? "").trim() || null
  const businessId          = String(formData.get("businessId") ?? "").trim()

  const details = {
    businessName,
    businessEmail,
    industry: industry || "",
    location: location || "",
    website: website || "",
    businessDescription: businessDescription || "",
  }

  if (businessId && businessId !== "profile-primary") {
    try {
      await upsertBusinessDetails(userId, businessId, details)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save business details."
      return failure(message)
    }

    await recordActivity({
      userId,
      userEmail: session.user.email,
      type: "business_updated",
      feature: "business",
      title: businessId === "new" ? "Business profile created" : "Business profile updated",
      description: "Business profile details were saved.",
    })

    revalidatePath("/app")
    revalidatePath("/app/business")
    revalidatePath("/app/business/profile")
    revalidatePath("/app/business/review")

    return success({ message: businessId === "new" ? "Business profile created." : "Business profile saved." })
  }

  try {
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: {
        userId: true,
        email: true,
        fullName: true,
      },
    })

    if (existingProfile) {
      await db.update(profiles)
        .set({
          businessName,
          businessEmail,
          industry,
          location,
          website,
          businessDescription,
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, userId))
    } else {
      await db.insert(profiles).values({
        id: `profile_${uuidv4()}`,
        userId,
        businessName,
        businessEmail,
        industry,
        location,
        website,
        businessDescription,
      })
    }

    await upsertPrimaryBusinessDetails(userId, details)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save business details."
    return failure(message)
  }

  await recordActivity({
    userId,
    userEmail: session.user.email,
    type: "business_updated",
    feature: "settings",
    title: "Business details updated",
    description: "Business profile details were saved.",
  })

  revalidatePath("/app")
  revalidatePath("/app/settings")
  revalidatePath("/app/settings/business")
  revalidatePath("/app/business")
  revalidatePath("/app/business/profile")
  revalidatePath("/app/business/review")

  return success({ message: "Business details saved." })
}

// ---------------------------------------------------------------------------
// Theme preference
// ---------------------------------------------------------------------------

const validThemes = ["light", "dark"] as const
type ThemeValue = (typeof validThemes)[number]

export async function setThemePreference(theme: string): Promise<Result<{ message: string }>> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) return failure("Please sign in again.")

  const db = getDb()
  if (!db) return failure("Database connection is unavailable.")

  try {
    await requireBuiltinUserRecord(userId)
  } catch {
    return failure("Database connection is unavailable.")
  }

  if (!validThemes.includes(theme as ThemeValue)) {
    return failure("Invalid theme value.")
  }

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { userId: true },
  })

  if (existingProfile) {
    await db.update(profiles)
      .set({ themePreference: theme as ThemeValue, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
  } else {
    await db.insert(profiles).values({
      id: `profile_${uuidv4()}`,
      userId,
      themePreference: theme as ThemeValue,
    })
  }

  revalidatePath("/app")

  return success({ message: "Theme preference saved." })
}
