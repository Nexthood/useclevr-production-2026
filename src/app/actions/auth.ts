"use server"

import { v4 as uuidv4 } from "uuid"
import { debugError } from "@/lib/utils/debug"

import { recordActivity } from "@/lib/activity/activity-store"
import { validatePasswordPolicy } from "@/lib/auth/password-policy"
import { db } from "@/lib/db"
import { profiles, users } from "@/lib/db/schema"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
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

  // Handle existing OAuth user - automatically link password
  if (existingUser && !existingUser.password) {
    // Automatically add password to existing OAuth user
    try {
      const hashedPassword = await bcrypt.hash(password, 12)
      await db.update(users)
        .set({ password: hashedPassword, name: name || existingUser.name })
        .where(eq(users.id, existingUser.id))

      return { success: true, linked: true }
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
  return { success: true }
}
