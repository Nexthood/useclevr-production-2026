"use server"

import { debugLog, debugError, debugWarn } from "@/lib/debug"



import { db } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

export async function joinWaitlist(email: string, source: string = "landing_page"): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Validate email
    if (!email || !email.includes("@")) {
      return { success: false, error: "Please enter a valid email address" }
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if already on waitlist
    const existing = await db.query.waitlist.findFirst({
      where: eq(waitlist.email, normalizedEmail),
    })

    if (existing) {
      // Already on waitlist - still return success
      return { success: true }
    }

    // Add to waitlist
    const id = uuidv4()
    await db.insert(waitlist).values({
      id,
      email: normalizedEmail,
      source,
      status: "new",
    })

    debugLog("[WAITLIST] New signup:", normalizedEmail, "from:", source)

    return { success: true }
  } catch (error) {
    debugError("[WAITLIST] Error:", error)
    return { success: false, error: "Failed to join waitlist. Please try again." }
  }
}