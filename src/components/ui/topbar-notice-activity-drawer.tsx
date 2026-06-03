"use client"

import { Modal } from "@/components/ui/modal"
import { useNotice } from "@/components/ui/notice-bar"
import { Activity, AlertCircle, Bell, CheckCircle2, Clock3, Info, Loader2 } from "lucide-react"
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

export function TopbarNoticeActivityDrawer({ className = "" }: { className?: string }) {
  const { notices, clearNotice, clearAllNotices } = useNotice()
  const [open, setOpen] = React.useState(false)
  const [activities, setActivities] = React.useState<ActivityItem[]>([])
  const [activityStatus, setActivityStatus] = React.useState<"idle" | "loading" | "error">("idle")

  React.useEffect(() => {
    if (!open) return

    let ignore = false
    setActivityStatus("loading")
    fetch("/api/activity?limit=8")
      .then((response) => {
        if (!response.ok) throw new Error("Activity unavailable")
        return response.json()
      })
      .then((payload) => {
        if (ignore) return
        setActivities(payload.activities ?? [])
        setActivityStatus("idle")
      })
      .catch(() => {
        if (ignore) return
        setActivities([])
        setActivityStatus("error")
      })

    return () => {
      ignore = true
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        className={["relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted", className].filter(Boolean).join(" ")}
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

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Notices and activity"
        description={`${notices.length} active ${notices.length === 1 ? "notice" : "notices"}`}
        variant="sidebar"
      >
        <div className="grid gap-6">
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
                  const Icon = noticeIcon[notice.type] || Info
                  return (
                    <article
                      key={notice.id}
                      className="rounded-lg border border-border/70 bg-card/60 p-4 text-card-foreground shadow-sm transition-all hover:shadow-md hover:bg-card/90"
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 flex-shrink-0 ${
                          notice.type === "error" ? "text-red-500" : notice.type === "success" ? "text-green-600" : "text-blue-600"
                        }`} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold leading-tight text-foreground">{notice.title}</h4>
                          {notice.message && (
                            <p className="mt-1 text-xs text-muted-foreground/85 leading-relaxed">{notice.message}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="text-xs font-medium text-primary transition hover:text-primary/80 whitespace-nowrap ml-2"
                          onClick={() => clearNotice(notice.id)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Activity</h3>
              <Link href="/app/settings/activity" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {activityStatus === "loading" ? (
                <p className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading recent activity.
                </p>
              ) : activityStatus === "error" ? (
                <p className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-4 py-6 text-center text-sm text-muted-foreground">
                  Recent activity could not be loaded.
                </p>
              ) : activities.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  No recent project activity.
                </p>
              ) : (
                activities.map((item) => (
                  <article key={item.id} className="rounded-lg border border-border/70 bg-card/60 p-3.5 text-card-foreground shadow-sm transition-all hover:shadow-md hover:bg-card/90">
                    <div className="flex gap-3">
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 flex-shrink-0 text-primary/70" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-foreground leading-tight">{item.title}</h4>
                        {item.description && (
                          <p className="mt-1 text-xs text-muted-foreground/85 leading-relaxed">{item.description}</p>
                        )}
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
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
      </Modal>
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
