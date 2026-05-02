"use client"

import * as React from "react"
import { useNotice } from "@/components/ui/notice-bar"
import { debugError } from "@/lib/debug"

interface UsageMonitorProps {
  used: number
  total?: number
  isPro?: boolean
}

export function UsageMonitor({ used, total = 2, isPro = false }: UsageMonitorProps) {
  const percent = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  // For pro users, show unlimited
  if (isPro) {
    return (
      <div className="usage-box rounded-lg border border-purple-200 bg-white p-3 shadow-sm dark:border-purple-800 dark:bg-purple-950/30 dark:shadow-none">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
          Analyst Credits
        </h4>
        <p className="text-sm font-medium text-foreground">
          Unlimited
        </p>
        <div className="h-1.5 mt-2 rounded-full bg-purple-100 dark:bg-purple-900/50 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: "100%", background: "linear-gradient(135deg, hsl(187 79% 53%), hsl(270 50% 65%))" }}
          />
        </div>
      </div>
    );
  }

  // Limit reached - show premium upgrade state
  if (used >= total) {
    return (
      <div className="usage-box rounded-lg border border-amber-500/50 bg-amber-50 p-3 shadow-sm dark:bg-amber-950/10">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          Analyst Credits
        </h4>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          {used} / {total} used
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Subscribe to Pro or top up
        </p>
      </div>
    );
  }

  return (
    <div className="usage-box rounded-lg border border-purple-200 bg-white p-3 shadow-sm dark:border-purple-800 dark:bg-purple-950/30 dark:shadow-none">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
        Analyst Credits
      </h4>
      <p className="text-sm font-medium text-foreground">
        {used} / {total} used
      </p>
      <div className="h-1.5 mt-2 rounded-full bg-purple-100 dark:bg-purple-900/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      {percent >= 80 && (
        <p className="mt-1.5 text-xs text-muted-foreground">Upgrade to Pro for more</p>
      )}
    </div>
  );
}

// Hook to manage usage state
export function useUsage() {
  const [usage, setUsage] = React.useState(0)
  const [total, setTotal] = React.useState(2)
  const [isPro, setIsPro] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [limitReached, setLimitReached] = React.useState(false)
  const { showNotice } = useNotice()
  const limitNoticeShownRef = React.useRef(false)

  const maybeShowLimitNotice = React.useCallback((isLimitReached: boolean) => {
    if (!isLimitReached || limitNoticeShownRef.current) {
      return
    }

    limitNoticeShownRef.current = true
    showNotice({
      type: "info",
      title: "Analyst credits used.",
      message: "You have used all free analyst credits. Subscribe to Pro or top up to continue.",
    })
  }, [showNotice])

  React.useEffect(() => {
    // Fetch user usage from API
    async function fetchUsage() {
      try {
        const res = await fetch("/api/usage")
        if (res.ok) {
          const data = await res.json()
          setUsage(data.analysisCount || 0)
          setTotal(data.total || 2)
          setIsPro(data.subscriptionTier === "pro")
          setLimitReached(Boolean(data.limitReached))
          maybeShowLimitNotice(Boolean(data.limitReached))
        }
      } catch (error) {
        debugError("Failed to fetch usage:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUsage()
  }, [maybeShowLimitNotice])

  const refreshUsage = async () => {
    try {
      const res = await fetch("/api/usage")
      if (res.ok) {
        const data = await res.json()
        setUsage(data.analysisCount || 0)
        setTotal(data.total || 2)
        setIsPro(data.subscriptionTier === "pro")
        setLimitReached(Boolean(data.limitReached))
        maybeShowLimitNotice(Boolean(data.limitReached))
      }
    } catch (error) {
      debugError("Failed to refresh usage:", error)
    }
  }

  const canAnalyze = isPro || usage < total

  return { usage, total, isPro, isLoading, canAnalyze, limitReached, refreshUsage }
}
