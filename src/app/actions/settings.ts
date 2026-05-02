"use server"

import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { profiles, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

type UpdateProfileResult = {
  success?: boolean
  error?: string
  message?: string
}

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return { error: "Please sign in again." }
  }

  const fullName = String(formData.get("fullName") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()

  if (!fullName) {
    return { error: "Name is required." }
  }

  if (!email || !email.includes("@")) {
    return { error: "Use a valid email address." }
  }

  if (userId === "demo-user-id") {
    return {
      success: true,
      message: "Demo profile loaded. Changes are not saved for the shared demo account.",
    }
  }

  const db = getDb()

  if (!db) {
    return { error: "Database connection is unavailable." }
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
    },
  })

  if (existingUser && existingUser.id !== userId) {
    return { error: "That email is already used by another account." }
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
      id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      email,
      fullName,
    })
  }

  revalidatePath("/app")
  revalidatePath("/app/settings")
  revalidatePath("/app/settings/profile")

  return { success: true, message: "Profile saved." }
}
