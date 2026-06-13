import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

import { getDb } from "@/lib/db"
import { profiles, users } from "@/lib/db/schema"
import { findBuiltinUserById } from "./builtin-users"

export async function ensureBuiltinUserRecord(userId?: string | null): Promise<boolean> {
  const builtinUser = findBuiltinUserById(userId)
  if (!builtinUser) return true

  const db = getDb()
  if (!db) return false

  const existingEmailOwner = await db.query.users.findFirst({
    where: eq(users.email, builtinUser.email),
    columns: { id: true },
  })

  if (existingEmailOwner && existingEmailOwner.id !== builtinUser.id) {
    throw new Error(`Built-in account email is assigned to another user: ${builtinUser.email}`)
  }

  await db
    .insert(users)
    .values({
      id: builtinUser.id,
      email: builtinUser.email,
      name: builtinUser.name,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: builtinUser.email,
        name: builtinUser.name,
      },
    })

  await db
    .insert(profiles)
    .values({
      id: `profile_${uuidv4()}`,
      userId: builtinUser.id,
      email: builtinUser.email,
      fullName: builtinUser.name,
      subscriptionTier: builtinUser.role === "superadmin" ? "business" : "free",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: profiles.userId })

  return true
}

export async function requireBuiltinUserRecord(userId?: string | null): Promise<void> {
  if (!(await ensureBuiltinUserRecord(userId))) {
    throw new Error("Database connection is unavailable.")
  }
}
