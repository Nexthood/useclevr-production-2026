"use client"

import * as React from "react"

interface UsageMonitorProps {
  used: number
  total?: number
  isPro?: boolean
}

export function UsageMonitor({ used, total = 2, isPro = false }: UsageMonitorProps) {
  const remaining = Math.max(0, total - used);
  const percent = Math.min((used / total) * 100, 100);

  // For pro users, show unlimited
  if (isPro) {
    return (
      <div className="usage-box p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-purple-950/30 shadow-sm dark:shadow-none">
        <h4 className="text-xs font-semibold text-purple-300 dark:text-purple-300 uppercase tracking-wider mb-2">
          Analyst Credits
        </h4>
        <p className="text-sm text-white font-medium">
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
      <div className="usage-box p-3 rounded-lg border border-amber-500/50 dark:border-amber-500/50 bg-amber-950/20 dark:bg-amber-950/10 shadow-sm">
        <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
          Analyst Credits
        </h4>
        <p className="text-sm text-amber-400 font-medium">
          0 remaining
        </p>
        <p className="text-xs text-white/60 mt-2">
          Subscribe to Pro or top up
        </p>
      </div>
    );
  }

  return (
    <div className="usage-box p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-purple-950/30 shadow-sm dark:shadow-none">
      <h4 className="text-xs font-semibold text-purple-300 dark:text-purple-300 uppercase tracking-wider mb-1.5">
        Analyst Credits
      </h4>
      <p className="text-sm text-white font-medium">
        {used} / {total} used
      </p>
      <div className="h-1.5 mt-2 rounded-full bg-purple-100 dark:bg-purple-900/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      {percent >= 80 && (
        <p className="text-xs text-white/50 mt-1.5">Upgrade to Pro for more</p>
      )}
    </div>
  );
}

// Hook to manage usage state
export function useUsage() {
  const [usage, setUsage] = React.useState(0)
  const [isPro, setIsPro] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    // Fetch user usage from API
    async function fetchUsage() {
      try {
        const res = await fetch("/api/usage")
        if (res.ok) {
          const data = await res.json()
          setUsage(data.analysisCount || 0)
          setIsPro(data.subscriptionTier === "pro")
        }
      } catch (error) {
        console.error("Failed to fetch usage:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUsage()
  }, [])

  const refreshUsage = async () => {
    try {
      const res = await fetch("/api/usage")
      if (res.ok) {
        const data = await res.json()
        setUsage(data.analysisCount || 0)
        setIsPro(data.subscriptionTier === "pro")
      }
    } catch (error) {
      console.error("Failed to refresh usage:", error)
    }
  }

  const canAnalyze = isPro || usage < 5

  return { usage, isPro, isLoading, canAnalyze, refreshUsage }
}
