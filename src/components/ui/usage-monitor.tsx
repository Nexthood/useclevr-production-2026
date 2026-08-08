"use client"

import { useNotice } from "@/components/ui/notice-bar"
import { buildUploadCreditLimitCopy } from "@/lib/billing/upload-credit-messaging"
import { debugError } from "@/lib/utils/debug"
import * as React from "react"

export const USAGE_REFRESH_EVENT = "useclevr:usage-refresh"

interface UsageMonitorProps {
  includedBalance: number
  purchasedBalance: number
  totalAvailable: number
  used: number
  reserved?: number
  isPro?: boolean
  unlimitedLabel?: string | null
}

export function UsageMonitor({ includedBalance, purchasedBalance, totalAvailable, used, reserved = 0, isPro = false, unlimitedLabel }: UsageMonitorProps) {
  const availableCredits = Math.max(0, totalAvailable - used - reserved)
  const percent = totalAvailable > 0 ? Math.min((used / totalAvailable) * 100, 100) : 0

  if (isPro) {
    return (
      <div className="usage-box rounded-lg border border-purple-200 bg-white p-3 shadow-sm dark:border-purple-800 dark:bg-purple-950/30 dark:shadow-none">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
          Included Credits
        </h4>
        <p className="text-sm font-medium text-foreground">
          {unlimitedLabel || "Included AI credits"}
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

  if (availableCredits <= 0) {
    return (
      <div className="usage-box rounded-lg border border-amber-500/50 bg-amber-50 p-3 shadow-sm dark:bg-amber-950/10">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          Included Credits
        </h4>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          {includedBalance.toLocaleString()} included · {purchasedBalance.toLocaleString()} purchased
        </p>
        <div className="h-1.5 mt-2 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/40">
          <div
            className="h-full rounded-full"
            style={{ width: "100%", background: "linear-gradient(135deg, hsl(187 79% 53%), hsl(270 50% 65%))" }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Upgrade or purchase more credits</p>
      </div>
    );
  }

  return (
    <div className="usage-box rounded-lg border border-purple-200 bg-white p-3 shadow-sm dark:border-purple-800 dark:bg-purple-950/30 dark:shadow-none">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
        Included Credits
      </h4>
      <p className="text-sm font-medium text-foreground">
        {includedBalance.toLocaleString()} included · {purchasedBalance.toLocaleString()} purchased
      </p>
      {reserved > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{reserved} reserved</p>
      )}
      <div className="h-1.5 mt-2 rounded-full bg-purple-100 dark:bg-purple-900/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      {percent >= 80 && (
        <p className="mt-1.5 text-xs text-muted-foreground">Upgrade for more included credits</p>
      )}
    </div>
  );
}

export function useUsage() {
  const [usage, setUsage] = React.useState(0)
  const [includedBalance, setIncludedBalance] = React.useState(0)
  const [purchasedBalance, setPurchasedBalance] = React.useState(0)
  const [totalAvailable, setTotalAvailable] = React.useState(2)
  const [reserved, setReserved] = React.useState(0)
  const [isPro, setIsPro] = React.useState(false)
  const [unlimitedLabel, setUnlimitedLabel] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [limitReached, setLimitReached] = React.useState(false)
  const [canAnalyze, setCanAnalyze] = React.useState(true)
  const { showNotice } = useNotice()
  const limitNoticeShownRef = React.useRef(false)

  const maybeShowLimitNotice = React.useCallback((isLimitReached: boolean) => {
    if (!isLimitReached || limitNoticeShownRef.current) {
      return
    }

    limitNoticeShownRef.current = true
    const creditCopy = buildUploadCreditLimitCopy({ used: usage, limit: totalAvailable, remaining: totalAvailable - usage - reserved })
    showNotice({
      type: "info",
      title: creditCopy.title,
      message: creditCopy.inlineMessage,
    })
  }, [showNotice, totalAvailable, usage, reserved])

  const refreshUsage = React.useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        const hasUnlimitedAccess = Boolean(data.unlimited) || ["superadmin", "admin"].includes(data.subscriptionTier)
        const usedCredits = data.usedCredits ?? data.analysisCount ?? 0
        const availableCredits = hasUnlimitedAccess ? 0 : Math.max(0, data.availableCredits ?? 0)

        setUsage(hasUnlimitedAccess ? 0 : usedCredits)
        setIncludedBalance(hasUnlimitedAccess ? 0 : (data.includedBalance ?? 0))
        setPurchasedBalance(hasUnlimitedAccess ? 0 : (data.purchasedBalance ?? 0))
        setTotalAvailable(hasUnlimitedAccess ? 0 : (data.total ?? availableCredits))
        setReserved(hasUnlimitedAccess ? 0 : (data.reservedCredits ?? 0))
        setIsPro(hasUnlimitedAccess)
        setUnlimitedLabel(data.unlimitedLabel || null)
        setLimitReached(Boolean(data.limitReached))
        setCanAnalyze(Boolean(data.canAnalyze ?? hasUnlimitedAccess))
        maybeShowLimitNotice(!hasUnlimitedAccess && Boolean(data.limitReached))
      }
    } catch (error) {
      debugError("Failed to refresh usage:", error)
    } finally {
      setIsLoading(false)
    }
  }, [maybeShowLimitNotice])

  React.useEffect(() => {
    void refreshUsage()
  }, [refreshUsage])

  React.useEffect(() => {
    const handleRefresh = () => {
      void refreshUsage()
    }

    window.addEventListener(USAGE_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(USAGE_REFRESH_EVENT, handleRefresh)
  }, [refreshUsage])

  return { usage, includedBalance, purchasedBalance, totalAvailable, available: totalAvailable, total: totalAvailable, reserved, isPro, isLoading, canAnalyze, limitReached, unlimitedLabel, refreshUsage }
}
