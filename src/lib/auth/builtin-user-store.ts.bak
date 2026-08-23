import { eq, sql } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

import { getDb } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { findBuiltinUserById } from "./builtin-users"

function builtinSubscriptionTier(role: string) {
  return role === "superadmin" ? "superadmin" : "free"
}

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

  const now = new Date()
  await db.execute(sql`
    INSERT INTO "Profile" ("id", "userId", "email", "fullName", "role", "subscriptionTier", "createdAt", "updatedAt")
    VALUES (${`profile_${uuidv4()}`}, ${builtinUser.id}, ${builtinUser.email}, ${builtinUser.name}, ${builtinUser.role}, ${builtinSubscriptionTier(builtinUser.role)}, ${now}, ${now})
    ON CONFLICT ("userId") DO UPDATE SET
      "email" = EXCLUDED."email",
      "fullName" = EXCLUDED."fullName",
      "role" = EXCLUDED."role",
      "subscriptionTier" = EXCLUDED."subscriptionTier",
      "updatedAt" = EXCLUDED."updatedAt"
  `)

  return true
}

export async function requireBuiltinUserRecord(userId?: string | null): Promise<void> {
  if (!(await ensureBuiltinUserRecord(userId))) {
    throw new Error("Database connection is unavailable.")
  }
}
