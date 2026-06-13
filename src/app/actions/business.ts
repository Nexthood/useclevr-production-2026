"use server"

import { archiveBusiness, deleteBusiness, restoreBusiness } from "@/lib/business/business-store"
import { requireAuth } from "@/lib/auth/require-auth"
import { debugError } from "@/lib/utils/debug"
import { revalidatePath } from "next/cache"

export async function archiveBusinessAction(formData: FormData): Promise<void> {
  const session = await requireAuth()
  const userId = session.user.id
  const id = String(formData.get("id") || "")

  if (!id) return

  try {
    const archived = await archiveBusiness(userId, id)
    if (!archived) throw new Error("Business was not found or cannot be archived.")
    revalidatePath("/app/business")
  } catch (err) {
    debugError("Failed to archive business:", err)
  }
}

export async function restoreBusinessAction(formData: FormData): Promise<void> {
  const session = await requireAuth()
  const userId = session.user.id
  const id = String(formData.get("id") || "")

  if (!id) return

  try {
    const restored = await restoreBusiness(userId, id)
    if (!restored) throw new Error("Archived business was not found.")
    revalidatePath("/app/business")
  } catch (err) {
    debugError("Failed to restore business:", err)
  }
}

export async function deleteBusinessAction(formData: FormData): Promise<void> {
  const session = await requireAuth()
  const userId = session.user.id
  const id = String(formData.get("id") || "")

  if (!id) return

  try {
    const deleted = await deleteBusiness(userId, id)
    if (!deleted) throw new Error("Only owned, archived secondary businesses can be deleted.")
    revalidatePath("/app/business")
  } catch (err) {
    debugError("Failed to delete business:", err)
  }
}
