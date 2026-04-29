"use server"

import { debugLog, debugError, debugWarn } from "@/lib/debug"



import { db } from "@/lib/db"
import { users, profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function signup(formData: FormData) {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const isDemo = formData.get("demo") === "true"

  // Demo mode signup - no database required
  if (isDemo) {
    return { success: true, isDemo: true }
  }

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" }
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

  if (existingUser) {
    return { error: "An account with this email already exists" }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  // Create user with error handling
  let user
  try {
    const result = await db.insert(users).values({
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      email: user.email,
      fullName: name,
    })
  } catch (dbError) {
    debugError("Database connection error creating profile:", dbError)
    // User was created but profile failed - still return success
    // The profile can be created later
  }

  revalidatePath("/app/datasets")
  return { success: true }
}
