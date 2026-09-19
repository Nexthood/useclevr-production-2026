"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, LoaderCircle } from "lucide-react"

const POLL_INTERVAL_MS = 1500
const MAX_POLLS = 13

type PollState = "idle" | "polling" | "completed" | "timeout"

/**
 * Bounded authoritative polling after a credit top-up return.
 *
 * Reads the Stripe session id appended to the success URL, polls the
 * report-only status endpoint (which reflects webhook-confirmed DB state),
 * and refreshes the server-rendered Billing page the moment the top-up is
 * completed. Never grants credits, never reloads the page in a loop, and
 * stops polling as soon as completion or the bounded timeout is reached.
 */
export function TopUpConfirmationPoller() {
  const router = useRouter()
  const [state, setState] = React.useState<PollState>("idle")
  const [completedInfo, setCompletedInfo] = React.useState<{ credits: number; amount: string; currency: string } | null>(null)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("topup") !== "success") return
    const sessionId = params.get("session_id")
    if (!sessionId || !sessionId.startsWith("cs_")) return

    let cancelled = false
    let polls = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    setState("polling")

    const stop = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }

    const tick = async () => {
      if (cancelled) return
      polls += 1
      try {
        const res = await fetch(`/api/billing/credit-topup/status?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        })
        if (res.ok) {
          const data = (await res.json()) as { status?: string; creditsGranted?: number; amount?: number; currency?: string }
          if (data.status === "completed") {
            if (cancelled) return
            setCompletedInfo({
              credits: data.creditsGranted ?? 0,
              amount: typeof data.amount === "number" ? data.amount.toFixed(2) : "",
              currency: data.currency ?? "",
            })
            setState("completed")
            stop()
            router.refresh()
            return
          }
          if (data.status === "refunded") {
            if (cancelled) return
            setState("timeout")
            stop()
            return
          }
        }
      } catch {
        // transient network error — keep waiting within the bounded window
      }

      if (polls >= MAX_POLLS) {
        if (cancelled) return
        setState("timeout")
        stop()
        return
      }

      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    void tick()

    return () => {
      cancelled = true
      stop()
    }
  }, [router])

  if (state === "completed" && completedInfo) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              Credits added successfully
            </p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              {completedInfo.credits.toLocaleString()} purchased credits are now available in your UseClevr account.
              Purchased credits are non-refundable and do not expire.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === "timeout") {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <LoaderCircle className="mt-0.5 h-5 w-5 animate-spin text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Payment received. Confirmation is taking longer than expected. You will not be charged again.
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Credits appear automatically as soon as payment confirmation completes. Reload this page to check again.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === "polling") {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <LoaderCircle className="mt-0.5 h-5 w-5 animate-spin text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Payment received — credits are being confirmed.
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              This usually takes a few seconds. Your balance refreshes automatically.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
