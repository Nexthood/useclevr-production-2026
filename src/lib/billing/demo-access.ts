import { getDb } from "@/lib/db"
import { demoVerificationCodes, demoUsage, demoSessions } from "@/lib/db/schema"
import { eq, and, gt, lt, gte, count } from "drizzle-orm"
import { DEMO_PLAN_LIMITS } from "./plans"
import { createHash } from "crypto"

const DEMO_CODE_EXPIRY_MINUTES = 10
const DEMO_MAX_ATTEMPTS = 5
const DEMO_RESEND_COOLDOWN_SECONDS = 60
const DEMO_SESSION_EXPIRY_HOURS = 24
const DEMO_MAX_RESEND_COUNT = 3
const DEMO_MAX_DEMO_ATTEMPTS_PER_EMAIL = 3

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex")
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32)
}

function generateDemoCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export interface DemoVerificationResult {
  success: boolean
  error?: string
  sessionToken?: string
  remainingAttempts?: number
  resendCooldown?: number
  usage?: {
    creditsUsed: number
    creditsRemaining: number
    datasetsCreated: number
    aiRequests: number
  }
}

export interface DemoVerificationCheck {
  allowed: boolean
  reason?: string
  emailRequired?: boolean
  codeRequired?: boolean
  verified?: boolean
}

export async function requestDemoVerification(
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<DemoVerificationResult> {
  const db = getDb()
  if (!db) {
    return { success: false, error: "Service temporarily unavailable" }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const emailHash = hashEmail(normalizedEmail)
  const ipHash = ipAddress ? hashIp(ipAddress) : null

  const existingUsage = await db.query.demoUsage.findFirst({
    where: eq(demoUsage.emailHash, emailHash),
  })

  if (existingUsage?.blockedAt) {
    return {
      success: false,
      error: "This email has been blocked from demo access. Please sign up for a free account.",
    }
  }

  if (existingUsage && existingUsage.totalCreditsUsed >= DEMO_PLAN_LIMITS.monthlyCredits) {
    return {
      success: false,
      error: "Demo credits exhausted. Please sign up for a free account to continue.",
    }
  }

  const now = new Date()
  const recentRequests = await db
    .select({ count: count() })
    .from(demoVerificationCodes)
    .where(
      and(
        eq(demoVerificationCodes.email, normalizedEmail),
        eq(demoVerificationCodes.status, "pending"),
        gt(demoVerificationCodes.expiresAt, now)
      )
    )

  if (recentRequests[0]?.count && recentRequests[0].count > 0) {
    const lastRequest = await db.query.demoVerificationCodes.findFirst({
      where: and(
        eq(demoVerificationCodes.email, normalizedEmail),
        eq(demoVerificationCodes.status, "pending")
      ),
      orderBy: (table) => [table.createdAt],
    })

    if (lastRequest) {
      const lastResend = lastRequest.lastResendAt
      if (lastResend) {
        const cooldownEnd = new Date(lastResend.getTime() + DEMO_RESEND_COOLDOWN_SECONDS * 1000)
        if (cooldownEnd > now) {
          const cooldownSeconds = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 1000)
          return {
            success: false,
            error: "Please wait before requesting a new code",
            resendCooldown: cooldownSeconds,
          }
        }
      }

      if (lastRequest.resendCount >= DEMO_MAX_RESEND_COUNT) {
        return {
          success: false,
          error: "Maximum resend attempts reached. Please try again later.",
        }
      }

      const newCode = generateDemoCode()
      const codeHash = createHash("sha256").update(newCode).digest("hex")
      const expiresAt = new Date(now.getTime() + DEMO_CODE_EXPIRY_MINUTES * 60 * 1000)

      await db
        .update(demoVerificationCodes)
        .set({
          codeHash,
          expiresAt,
          attempts: 0,
          resendCount: lastRequest.resendCount + 1,
          lastResendAt: now,
          createdAt: now,
        })
        .where(eq(demoVerificationCodes.id, lastRequest.id))

      return {
        success: true,
        remainingAttempts: DEMO_MAX_ATTEMPTS,
        resendCooldown: DEMO_RESEND_COOLDOWN_SECONDS,
      }
    }
  }

  const existingPending = await db.query.demoVerificationCodes.findFirst({
    where: and(
      eq(demoVerificationCodes.email, normalizedEmail),
      eq(demoVerificationCodes.status, "pending"),
      gt(demoVerificationCodes.expiresAt, now)
    ),
  })

  if (existingPending) {
    const expiresIn = Math.ceil((existingPending.expiresAt.getTime() - now.getTime()) / 1000)
    return {
      success: false,
      error: `Verification code already sent. Code expires in ${expiresIn} seconds.`,
      remainingAttempts: DEMO_MAX_ATTEMPTS - existingPending.attempts,
    }
  }

  const newCode = generateDemoCode()
  const codeHash = createHash("sha256").update(newCode).digest("hex")
  const expiresAt = new Date(now.getTime() + DEMO_CODE_EXPIRY_MINUTES * 60 * 1000)

  const id = `dvc_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  await db.insert(demoVerificationCodes).values({
    id,
    email: normalizedEmail,
    emailHash,
    codeHash,
    ipHash,
    userAgent,
    status: "pending",
    expiresAt,
    attempts: 0,
    resendCount: 0,
  })

  console.log(`[DEMO] Verification code for ${normalizedEmail}: ${newCode}`)

  return {
    success: true,
    remainingAttempts: DEMO_MAX_ATTEMPTS,
  }
}

export async function verifyDemoCode(
  email: string,
  code: string,
  ipAddress?: string,
  userAgent?: string
): Promise<DemoVerificationResult> {
  const db = getDb()
  if (!db) {
    return { success: false, error: "Service temporarily unavailable" }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const codeHash = createHash("sha256").update(code).digest("hex")

  const verification = await db.query.demoVerificationCodes.findFirst({
    where: and(
      eq(demoVerificationCodes.email, normalizedEmail),
      eq(demoVerificationCodes.status, "pending")
    ),
  })

  if (!verification) {
    return { success: false, error: "Invalid or expired verification code" }
  }

  if (verification.attempts >= DEMO_MAX_ATTEMPTS) {
    await db
      .update(demoVerificationCodes)
      .set({ status: "failed" })
      .where(eq(demoVerificationCodes.id, verification.id))

    return { success: false, error: "Too many failed attempts. Please request a new code." }
  }

  const now = new Date()
  if (verification.expiresAt < now) {
    await db
      .update(demoVerificationCodes)
      .set({ status: "expired" })
      .where(eq(demoVerificationCodes.id, verification.id))

    return { success: false, error: "Verification code expired. Please request a new code." }
  }

  if (verification.codeHash !== codeHash) {
    await db
      .update(demoVerificationCodes)
      .set({ attempts: verification.attempts + 1 })
      .where(eq(demoVerificationCodes.id, verification.id))

    const remaining = DEMO_MAX_ATTEMPTS - verification.attempts - 1
    return {
      success: false,
      error: "Invalid verification code",
      remainingAttempts: remaining > 0 ? remaining : 0,
    }
  }

  await db
    .update(demoVerificationCodes)
    .set({ status: "verified", usedAt: now })
    .where(eq(demoVerificationCodes.id, verification.id))

  const sessionToken = `demo_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`
  const expiresAt = new Date(now.getTime() + DEMO_SESSION_EXPIRY_HOURS * 60 * 60 * 1000)
  const emailHash = hashEmail(normalizedEmail)
  const ipHash = ipAddress ? hashIp(ipAddress) : null

  let demoUsageRecord = await db.query.demoUsage.findFirst({
    where: eq(demoUsage.emailHash, emailHash),
  })

  if (!demoUsageRecord) {
    const usageId = `du_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
    await db.insert(demoUsage).values({
      id: usageId,
      email: normalizedEmail,
      emailHash,
      ipHash,
      sessionToken,
      totalCreditsUsed: 0,
      datasetUploads: 0,
      aiRequests: 0,
      rowCountTotal: 0,
      hasVerifiedEmail: true,
      firstAccessAt: now,
      lastAccessAt: now,
    })

    demoUsageRecord = {
      id: usageId,
      email: normalizedEmail,
      emailHash,
      ipHash,
      sessionToken,
      totalCreditsUsed: 0,
      datasetUploads: 0,
      aiRequests: 0,
      rowCountTotal: 0,
      hasVerifiedEmail: true,
      blockedAt: null,
      blockReason: null,
      firstAccessAt: now,
      lastAccessAt: now,
      createdAt: now,
      updatedAt: now,
    } as any
  } else if (demoUsageRecord) {
    await db
      .update(demoUsage)
      .set({
        sessionToken,
        hasVerifiedEmail: true,
        lastAccessAt: now,
      })
      .where(eq(demoUsage.id, demoUsageRecord.id))
  }

  if (!demoUsageRecord) {
    return { success: false, error: "Failed to create demo session" }
  }

  const sessionId = `ds_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  await db.insert(demoSessions).values({
    id: sessionId,
    demoUsageId: demoUsageRecord.id,
    sessionToken,
    creditsUsed: 0,
    datasetsCreated: 0,
    aiRequests: 0,
    ipHash,
    userAgent,
    expiresAt,
  })

  const creditsRemaining = DEMO_PLAN_LIMITS.monthlyCredits - (demoUsageRecord.totalCreditsUsed || 0)

  return {
    success: true,
    sessionToken,
    usage: {
      creditsUsed: demoUsageRecord.totalCreditsUsed || 0,
      creditsRemaining,
      datasetsCreated: demoUsageRecord.datasetUploads || 0,
      aiRequests: demoUsageRecord.aiRequests || 0,
    },
  }
}

export async function validateDemoSession(sessionToken: string): Promise<{
  valid: boolean
  email?: string
  usage?: {
    creditsUsed: number
    creditsRemaining: number
    datasetsCreated: number
    aiRequests: number
  }
  reason?: string
}> {
  const db = getDb()
  if (!db) {
    return { valid: false, reason: "Service unavailable" }
  }

  const now = new Date()

  const session = await db.query.demoSessions.findFirst({
    where: and(
      eq(demoSessions.sessionToken, sessionToken),
      gt(demoSessions.expiresAt, now)
    ),
  })

  if (!session) {
    return { valid: false, reason: "Invalid or expired session" }
  }

  const demoUsageRecord = await db.query.demoUsage.findFirst({
    where: eq(demoUsage.id, session.demoUsageId),
  })

  if (!demoUsageRecord) {
    return { valid: false, reason: "Demo record not found" }
  }

  if (demoUsageRecord.blockedAt) {
    return { valid: false, reason: "Demo access blocked" }
  }

  const creditsUsed = demoUsageRecord.totalCreditsUsed || 0
  const creditsRemaining = DEMO_PLAN_LIMITS.monthlyCredits - creditsUsed

  return {
    valid: true,
    email: demoUsageRecord.email,
    usage: {
      creditsUsed,
      creditsRemaining,
      datasetsCreated: demoUsageRecord.datasetUploads || 0,
      aiRequests: demoUsageRecord.aiRequests || 0,
    },
  }
}

export async function checkDemoAccess(sessionToken: string, action: "upload" | "ai_analysis" | "ai_chat" | "report"): Promise<{
  allowed: boolean
  reason?: string
  upgradeMessage?: string
  creditsRemaining?: number
}> {
  const session = await validateDemoSession(sessionToken)

  if (!session.valid) {
    return {
      allowed: false,
      reason: session.reason || "Invalid session",
      upgradeMessage: "Please verify your email to access the demo.",
    }
  }

  if (!session.usage) {
    return { allowed: false, reason: "Unable to verify usage" }
  }

  if (session.usage.creditsRemaining <= 0) {
    return {
      allowed: false,
      reason: "Demo credits exhausted",
      upgradeMessage: "Demo includes 2 credits. Upgrade to continue.",
    }
  }

  if (action === "upload" && session.usage.datasetsCreated >= DEMO_PLAN_LIMITS.maxDatasets) {
    return {
      allowed: false,
      reason: `Demo limit: ${DEMO_PLAN_LIMITS.maxDatasets} dataset maximum`,
      upgradeMessage: "Demo includes 1 dataset. Upgrade to continue.",
    }
  }

  return {
    allowed: true,
    creditsRemaining: session.usage.creditsRemaining,
  }
}

export async function consumeDemoCredit(
  sessionToken: string,
  action: "upload" | "ai_analysis" | "ai_chat" | "report",
  creditsToConsume: number = 1
): Promise<{
  success: boolean
  remainingCredits?: number
  error?: string
}> {
  const db = getDb()
  if (!db) {
    return { success: false, error: "Service unavailable" }
  }

  const session = await validateDemoSession(sessionToken)
  if (!session.valid || !session.usage) {
    return { success: false, error: session.reason || "Invalid session" }
  }

  if (session.usage.creditsRemaining < creditsToConsume) {
    return { success: false, error: "Insufficient demo credits" }
  }

  const now = new Date()

  const demoSession = await db.query.demoSessions.findFirst({
    where: and(
      eq(demoSessions.sessionToken, sessionToken),
      gt(demoSessions.expiresAt, now)
    ),
  })

  if (!demoSession) {
    return { success: false, error: "Session not found" }
  }

  const demoUsageRecord = await db.query.demoUsage.findFirst({
    where: eq(demoUsage.id, demoSession.demoUsageId),
  })

  if (!demoUsageRecord) {
    return { success: false, error: "Demo record not found" }
  }

  const newCreditsUsed = (demoUsageRecord.totalCreditsUsed || 0) + creditsToConsume
  const newDatasets = action === "upload" ? (demoUsageRecord.datasetUploads || 0) + 1 : demoUsageRecord.datasetUploads || 0
  const newAiRequests = action !== "upload" ? (demoUsageRecord.aiRequests || 0) + 1 : demoUsageRecord.aiRequests || 0

  await db
    .update(demoUsage)
    .set({
      totalCreditsUsed: newCreditsUsed,
      datasetUploads: newDatasets,
      aiRequests: newAiRequests,
      lastAccessAt: now,
    })
    .where(eq(demoUsage.id, demoUsageRecord.id))

  await db
    .update(demoSessions)
    .set({
      creditsUsed: demoSession.creditsUsed + creditsToConsume,
      datasetsCreated: action === "upload" ? demoSession.datasetsCreated + 1 : demoSession.datasetsCreated,
      aiRequests: action !== "upload" ? demoSession.aiRequests + 1 : demoSession.aiRequests,
    })
    .where(eq(demoSessions.id, demoSession.id))

  return {
    success: true,
    remainingCredits: DEMO_PLAN_LIMITS.monthlyCredits - newCreditsUsed,
  }
}

export function getDemoLimits() {
  return {
    credits: DEMO_PLAN_LIMITS.monthlyCredits,
    maxDatasets: DEMO_PLAN_LIMITS.maxDatasets,
    maxRowsPerDataset: DEMO_PLAN_LIMITS.maxRowsPerDataset,
    maxFileSizeMb: DEMO_PLAN_LIMITS.maxFileSizeMb,
  }
}
