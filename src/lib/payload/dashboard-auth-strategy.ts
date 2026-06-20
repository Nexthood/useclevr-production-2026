import { auth } from "@/lib/auth/auth"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import type { AuthStrategy } from "payload"

export const dashboardSessionStrategy: AuthStrategy = {
  name: "dashboard-session",
  authenticate: async ({ payload }) => {
    const session = await auth()
    const dashboardUser = session?.user
    const email = dashboardUser?.email?.trim().toLowerCase()

    if (!email || !dashboardUser) return { user: null }

    const existing = await payload.find({
      collection: "cms-users",
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })

    const role = isSuperAdminUserId(dashboardUser.id) ? "superadmin" : "base"
    const existingDoc = existing.docs[0]
    if (existingDoc?.role === "superadmin" && role !== "superadmin") {
      return { user: null }
    }

    const document =
      existingDoc ||
      (await payload.create({
        collection: "cms-users",
        data: {
          email,
          name: dashboardUser.name?.trim() || email.split("@")[0] || "UseClevr operator",
          password: crypto.randomUUID() + crypto.randomUUID(),
          role,
        },
        overrideAccess: true,
      }))

    return {
      user: {
        ...document,
        collection: "cms-users",
        _strategy: "dashboard-session",
      },
    }
  },
}
