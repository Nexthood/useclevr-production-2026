"use server"

import { archiveBusiness, restoreBusiness } from "@/lib/business/business-store"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function archiveBusinessAction(formData: FormData): Promise<void> {
  const session = await auth()
  const userId = session?.user?.id
  const id = String(formData.get("id") || "")

  if (!userId || !id) return

  await archiveBusiness(userId, id)
  revalidatePath("/app/business")
}

export async function restoreBusinessAction(formData: FormData): Promise<void> {
  const session = await auth()
  const userId = session?.user?.id
  const id = String(formData.get("id") || "")

  if (!userId || !id) return

  await restoreBusiness(userId, id)
  revalidatePath("/app/business")
}
