import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProductActivity } from "@/lib/activity/activity-store"

export function ActivityList({
  activities,
  emptyText,
  showUser = false,
}: {
  activities: ProductActivity[]
  emptyText: string
  showUser?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest 100 events</CardTitle>
        <CardDescription>Only project feature activity is shown.</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <article key={activity.id} className="rounded-md border border-border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{activity.title}</h2>
                    {activity.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
                    )}
                    {showUser && (
                      <p className="mt-2 text-xs text-muted-foreground">{activity.userEmail || activity.userId}</p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={activity.createdAt.toISOString()}>
                    {formatActivityDate(activity.createdAt)}
                  </time>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatActivityDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
