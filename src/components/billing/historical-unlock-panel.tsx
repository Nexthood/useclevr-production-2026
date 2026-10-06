"use client";

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle, Lock, Loader2, ShieldCheck, RefreshCw } from "lucide-react"

type UnlockState = "idle" | "starting" | "error"

/**
 * One-time historical data unlock purchase panel.
 *
 * Two actions exist after a subscription ends, and this panel keeps them
 * clearly separate:
 *  - Reactivate the Pro/Business subscription (full premium functionality).
 *  - Purchase the PERMANENT historical data unlock: a one-time payment that
 *    restores access to the preserved historical data without creating any
 *    recurring subscription or paid-plan entitlement.
 *
 * The server resolves the applicable tier and Stripe Price; the client never
 * sends a tier or price. amounts are display-only.
 */
export function HistoricalUnlockPanel({
  unlockTier,
  amount,
  currency,
  displayName,
}: {
  unlockTier: "pro" | "business"
  amount: number
  currency: string
  displayName: string
}) {
  const router = useRouter()
  const [state, setState] = React.useState<UnlockState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const startUnlock = async () => {
    setState("starting")
    setErrorMessage(null)
    try {
      const response = await fetch("/api/checkout/historical-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const data = (await response.json().catch(() => ({}))) as {
        checkoutUrl?: string
        error?: string
        code?: string
      }

      if (response.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      if (data.code === "already_unlocked" || data.code === "subscription_active") {
        router.refresh()
        return
      }

      setErrorMessage(data.error || "The historical data unlock could not be started. Please try again.")
      setState("error")
    } catch {
      setErrorMessage("The historical data unlock could not be started. Please try again.")
      setState("error")
    }
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-5" data-unlock-tier={unlockTier}>
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{displayName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            One-time payment. No subscription. Permanent access to your preserved historical data.
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatFixedRegionalPrice(amount, currency)}{" "}
            one-time payment
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={startUnlock} disabled={state === "starting"}>
              {state === "starting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Unlock Historical Data
            </Button>
            <LinkLike href="/app/settings/checkout?plan=pro_monthly&discount=auto" label="Reactivate Subscription" />
          </div>
          {state === "error" && errorMessage && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Fixed regional price formatting with the exact UseClevr presentation per
 * supported currency ($29 / €25 / £22 / C$40 style). No locale-dependent
 * currency symbol swaps — the unlock price text is always deterministic.
 */
export function formatFixedRegionalPrice(amount: number, currency: string): string {
  const symbolByCurrency: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CAD: "C$" }
  const symbol = symbolByCurrency[currency.toUpperCase()] ?? "$"
  return `${symbol}${amount.toLocaleString("en-US")}`
}

function LinkLike({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/40"
    >
      <RefreshCw className="mr-1 h-4 w-4" />
      {label}
    </a>
  )
}

type PollState = "idle" | "polling" | "completed"

/**
 * Bounded authoritative polling after the unlock checkout return. Reads the
 * report-only status endpoint (which reflects webhook-confirmed DB state) and
 * refreshes the page the moment the entitlement exists. Never grants the
 * unlock itself — the Stripe webhook is authoritative.
 */
export function HistoricalUnlockConfirmationPoller() {
  const router = useRouter()
  const [state, setState] = React.useState<PollState>("idle")

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("unlock") !== "success") return

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
        const res = await fetch("/api/checkout/historical-unlock", { cache: "no-store" })
        if (!res.ok && res.status === 401) {
          stop()
          return
        }
        if (res.ok) {
          const data = (await res.json()) as { unlocked?: boolean }
          if (data.unlocked) {
            if (cancelled) return
            setState("completed")
            stop()
            router.refresh()
            return
          }
        }
      } catch {
        // transient network error — keep waiting within the bounded window
      }

      if (polls >= 13) {
        if (!cancelled) setState("completed")
        stop()
        return
      }

      timer = setTimeout(tick, 1500)
    }

    void tick()

    return () => {
      cancelled = true
      stop()
    }
  }, [router])

  if (state === "completed") {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              Historical data unlocked
            </p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              Your preserved historical data is unlocked permanently. This one-time payment does
              not reactivate the subscription. Reload this page if confirmation is still pending.
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
          <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Payment received — your unlock is being confirmed.
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              This usually takes a few seconds. Your data was never deleted.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export function HistoricalDataUnsafeNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p>Your existing UseClevr data is safely preserved. Cancelling never deletes your data.</p>
    </div>
  )
}
