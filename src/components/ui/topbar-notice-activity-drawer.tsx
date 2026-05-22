"use client"

import { useNotice } from "@/components/ui/notice-bar"
import { Activity, AlertCircle, Bell, CheckCircle2, Clock3, Info, X } from "lucide-react"
import Link from "next/link"
import * as React from "react"

type ActivityItem = {
  id: string
  type: string
  feature: string
  title: string
  description: string | null
  createdAt: string
}

const noticeIcon = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
}

export function TopbarNoticeActivityDrawer() {
  const { notices, clearNotice, clearAllNotices } = useNotice()
  const [open, setOpen] = React.useState(false)
  const [activities, setActivities] = React.useState<ActivityItem[]>([])

  React.useEffect(() => {
    if (!open) return

    let ignore = false
    fetch("/api/activity?limit=8")
      .then((response) => (response.ok ? response.json() : { activities: [] }))
      .then((payload) => {
        if (!ignore) setActivities(payload.activities ?? [])
      })
      .catch(() => {
        if (!ignore) setActivities([])
      })

    return () => {
      ignore = true
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
        aria-label="Open notices"
        title="Notices"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {notices.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {notices.length > 9 ? "9+" : notices.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/25"
            aria-label="Close notices"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Notices</h2>
                <p className="text-xs text-muted-foreground">{notices.length} active</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Close notices"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Toasts</h3>
                  {notices.length > 0 && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={clearAllNotices}
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {notices.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      No active notices.
                    </p>
                  ) : (
                    notices.map((notice) => {
                      const Icon = noticeIcon[notice.type]
                      return (
                        <article
                          key={notice.id}
                          className="rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-semibold">{notice.title}</h4>
                              {notice.message && (
                                <p className="mt-1 text-sm text-muted-foreground">{notice.message}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                              aria-label="Dismiss notice"
                              onClick={() => clearNotice(notice.id)}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </section>

              <section className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                  <Link href="/app/settings/activity" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      No recent project activity.
                    </p>
                  ) : (
                    activities.map((item) => (
                      <article key={item.id} className="rounded-md border border-border bg-card p-4">
                        <div className="flex gap-3">
                          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                            {item.description && (
                              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                            )}
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock3 className="h-3 w-3" aria-hidden="true" />
                              {formatTime(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
