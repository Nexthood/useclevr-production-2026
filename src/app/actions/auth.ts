"use server"

import { v4 as uuidv4 } from "uuid"
import { debugError } from "@/lib/utils/debug"

import { recordActivity } from "@/lib/activity/activity-store"
import { validatePasswordPolicy } from "@/lib/auth/password-policy"
import { createSupabaseAuthClient } from "@/lib/auth/supabase"
import { db } from "@/lib/db"
import { profiles, users } from "@/lib/db/schema"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"

export async function signup(formData: FormData) {
  const name = String(formData.get("name") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = formData.get("password") as string
  const isDemo = formData.get("demo") === "true"

  // Demo mode signup - no database required
  if (isDemo) {
    return { success: true, isDemo: true }
  }

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  if (!z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email address" }
  }

  const passwordPolicy = validatePasswordPolicy(password, { email, name })
  if (!passwordPolicy.passed) {
    return { error: passwordPolicy.message }
  }

  const supabase = createSupabaseAuthClient()
  if (!supabase.client) {
    return { error: supabase.error }
  }

  // Check if user already exists with error handling
  let existingUser
  try {
    existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })
  } catch (dbError) {
    debugError("Database connection error during signup:", dbError)
    return { error: "Database connection failed. Please check your configuration." }
  }

  if (existingUser?.password && existingUser.emailVerified) {
    return { error: "An account with this email already exists" }
  }

  if (existingUser?.password && !existingUser.emailVerified) {
    const { error } = await supabase.client.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: await getEmailVerificationRedirectUrl(),
      },
    })

    if (error) {
      debugError("Supabase resend error during existing unverified signup:", error)
      return { error: "We could not send a confirmation code. Please try again." }
    }

    return { success: true, verificationRequired: true, email }
  }

  const { error: signUpError } = await supabase.client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        name,
      },
      emailRedirectTo: await getEmailVerificationRedirectUrl(),
    },
  })

  if (signUpError) {
    debugError("Supabase signup error:", signUpError)
    return { error: "We could not send a confirmation code. Please try again." }
  }

  // Handle existing OAuth user - automatically link password after email OTP starts
  if (existingUser && !existingUser.password) {
    // Automatically add password to existing OAuth user
    try {
      const hashedPassword = await bcrypt.hash(password, 12)
      await db.update(users)
        .set({ password: hashedPassword, name: name || existingUser.name, emailVerified: null })
        .where(eq(users.id, existingUser.id))

      return { success: true, linked: true, verificationRequired: true, email }
    } catch (dbError) {
      debugError("Error linking password to OAuth user:", dbError)
      return { error: "Failed to link account. Please try again." }
    }
  }

  if (existingUser) {
    return { error: "An account with this email already exists" }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  // Create user with error handling
  let user
  try {
    const result = await db.insert(users).values({
      id: `user_${uuidv4()}`,
      name,
      email,
      password: hashedPassword,
      emailVerified: null,
    }).returning()
    user = result[0]
  } catch (dbError) {
    debugError("Database connection error creating user:", dbError)
    return { error: "Database connection failed. Please check your configuration." }
  }

  // Create profile for the user
  try {
    await db.insert(profiles).values({
      id: `profile_${uuidv4()}`,
      userId: user.id,
      email: user.email,
      fullName: name,
    })
  } catch (dbError) {
    debugError("Database connection error creating profile:", dbError)
    try {
      await db.delete(users).where(eq(users.id, user.id))
    } catch (cleanupError) {
      debugError("Database cleanup error after failed profile creation:", cleanupError)
    }
    return { error: "Account setup failed. Please try again." }
  }

  await recordActivity({
    userId: user.id,
    userEmail: user.email,
    type: "register",
    feature: "account",
    title: "Account registered",
    description: "Account access was created with email signup.",
  })

  revalidatePath("/app/datasets")
  return { success: true, verificationRequired: true, email }
}

export async function verifySignupOtp(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const token = String(formData.get("token") || "").replace(/\D/g, "")

  if (!email || !token) {
    return { error: "Enter the confirmation code from your email." }
  }

  if (!z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email address." }
  }

  if (token.length !== 6) {
    return { error: "Enter the 6-digit confirmation code." }
  }

  const supabase = createSupabaseAuthClient()
  if (!supabase.client) {
    return { error: supabase.error }
  }

  const { error } = await supabase.client.auth.verifyOtp({
    email,
    token,
    type: "email",
  })

  if (error) {
    debugError("Supabase OTP verification error:", error)
    return { error: "The confirmation code is invalid or expired. Request a new code and try again." }
  }

  const confirmedAt = new Date()

  try {
    await db.update(users)
      .set({ emailVerified: confirmedAt })
      .where(eq(users.email, email))
  } catch (dbError) {
    debugError("Database error confirming signup email:", dbError)
    return { error: "Email verified, but account activation failed. Please contact support." }
  }

  return { success: true }
}

export async function resendSignupOtp(emailInput: string) {
  const email = emailInput.trim().toLowerCase()

  if (!z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email address." }
  }

  const supabase = createSupabaseAuthClient()
  if (!supabase.client) {
    return { error: supabase.error }
  }

  const { error } = await supabase.client.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: await getEmailVerificationRedirectUrl(),
    },
  })

  if (error) {
    debugError("Supabase OTP resend error:", error)
    return { error: "We could not resend the confirmation code. Please try again." }
  }

  return { success: true }
}

export async function getEmailPasswordSignInStatus(emailInput: string, passwordInput: string) {
  const email = emailInput.trim().toLowerCase()
  const password = String(passwordInput || "")

  if (!z.string().email().safeParse(email).success) {
    return { status: "unknown" as const }
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        password: true,
        emailVerified: true,
      },
    })

    if (user?.password && !user.emailVerified && await bcrypt.compare(password, user.password)) {
      return { status: "unverified" as const }
    }
  } catch (dbError) {
    debugError("Database error checking email verification status:", dbError)
  }

  return { status: "unknown" as const }
}

async function getEmailVerificationRedirectUrl() {
  const headerStore = await headers()
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host")
  const protocol = headerStore.get("x-forwarded-proto") || "https"

  if (host) {
    return `${protocol}://${host}/login?tab=signin`
  }

  const configuredUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL
  if (configuredUrl) {
    return `${configuredUrl.replace(/\/$/, "")}/login?tab=signin`
  }

  return "https://useclevr.com/login?tab=signin"
}
