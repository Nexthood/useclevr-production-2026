import { ActivityList } from "@/app/app/settings/activity/activity-list"
import { auth } from "@/lib/auth"
import { listAllActivities } from "@/lib/activity/activity-store"
import { redirect } from "next/navigation"

export const metadata = { title: "Total Activity — Useclever" }

export default async function TotalActivityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (session.user.role !== "superadmin") redirect("/app/settings/activity")

  const activities = await listAllActivities()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Total Activity</h1>
        <p className="text-sm text-muted-foreground">
          The latest product activity across user accounts.
        </p>
      </div>

      <ActivityList activities={activities} emptyText="No product activity has been recorded yet." showUser />
    </div>
  )
}
