import { ActivityList } from "./activity-list"
import { auth } from "@/lib/auth"
import { listUserActivities } from "@/lib/activity/activity-store"
import { redirect } from "next/navigation"

export const metadata = { title: "Activity — Useclever" }

export default async function ActivityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activities = await listUserActivities(session.user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          The latest account, subscription, and dataset activity for your workspace.
        </p>
      </div>

      <ActivityList activities={activities} emptyText="No activity has been recorded yet." />
    </div>
  )
}
