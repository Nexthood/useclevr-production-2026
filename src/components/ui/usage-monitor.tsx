"use client"

import { useNotice } from "@/components/ui/notice-bar"
import { CREDIT_TOP_UPS_BILLING_HREF } from "@/lib/billing/credit-topup-navigation"
import { buildUploadCreditLimitCopy } from "@/lib/billing/upload-credit-messaging"
import { debugError } from "@/lib/utils/debug"
import { PlusCircle } from "lucide-react"
import Link from "next/link"
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
  subscriptionTier?: string
  onAddCreditsClick?: () => void
}

export function UsageMonitor({ includedBalance, purchasedBalance, totalAvailable, used, reserved = 0, isPro = false, unlimitedLabel, subscriptionTier = "free", onAddCreditsClick }: UsageMonitorProps) {
  const availableCredits = Math.max(0, totalAvailable - used - reserved)
  const percent = totalAvailable > 0 ? Math.min((used / totalAvailable) * 100, 100) : 0
  const isUnlimited = isPro && Boolean(unlimitedLabel)
  const isPaidPro = isPro && !unlimitedLabel

  if (isUnlimited) {
    return (
      <div className="usage-box rounded-lg border border-purple-200 bg-white p-3 shadow-sm dark:border-purple-800 dark:bg-purple-950/30 dark:shadow-none">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
          Unlimited Plan
        </h4>
        <p className="text-sm font-medium text-foreground">
          {unlimitedLabel || "Unlimited credits"}
        </p>
        <div className="h-1.5 mt-2 rounded-full bg-purple-100 dark:bg-purple-900/50 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: "100%", background: "linear-gradient(135deg, hsl(187 79% 53%), hsl(270 50% 65%))" }}
          />
        </div>
        <AddCreditsLink onClick={onAddCreditsClick} />
      </div>
    );
  }

  if (isPaidPro) {
    return (
      <div className="usage-box rounded-lg border border-purple-200 bg-white p-3 shadow-sm dark:border-purple-800 dark:bg-purple-950/30 dark:shadow-none">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
          {subscriptionTier === "business" ? "Business Plan" : "Pro Plan"}
        </h4>
        <p className="text-sm font-medium text-foreground">
          {totalAvailable.toLocaleString()} credits available
        </p>
        {(includedBalance > 0 || purchasedBalance > 0) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {includedBalance > 0 && `${includedBalance.toLocaleString()} included`}
            {includedBalance > 0 && purchasedBalance > 0 && " · "}
            {purchasedBalance > 0 && `${purchasedBalance.toLocaleString()} purchased`}
          </p>
        )}
        <div className="h-1.5 mt-2 rounded-full bg-purple-100 dark:bg-purple-900/50 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: "100%", background: "linear-gradient(135deg, hsl(187 79% 53%), hsl(270 50% 65%))" }}
          />
        </div>
        <AddCreditsLink onClick={onAddCreditsClick} />
      </div>
    );
  }

  if (availableCredits <= 0) {
    return (
      <div className="usage-box rounded-lg border border-amber-500/50 bg-amber-50 p-3 shadow-sm dark:bg-amber-950/10">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          No credits available
        </h4>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          {includedBalance > 0 && `${includedBalance.toLocaleString()} included`}
          {includedBalance > 0 && purchasedBalance > 0 && " · "}
          {purchasedBalance > 0 && `${purchasedBalance.toLocaleString()} purchased`}
        </p>
        <div className="h-1.5 mt-2 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/40">
          <div
            className="h-full rounded-full"
            style={{ width: "100%", background: "linear-gradient(135deg, hsl(187 79% 53%), hsl(270 50% 65%))" }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Add credits to continue</p>
        <AddCreditsLink onClick={onAddCreditsClick} />
      </div>
    );
  }

  return (
    <div className="usage-box rounded-lg border border-purple-200 bg-white p-3 shadow-sm dark:border-purple-800 dark:bg-purple-950/30 dark:shadow-none">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
        Credits available
      </h4>
      <p className="text-sm font-medium text-foreground">
        {totalAvailable.toLocaleString()} credits available
      </p>
      {(includedBalance > 0 || purchasedBalance > 0) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {includedBalance > 0 && `${includedBalance.toLocaleString()} included`}
          {includedBalance > 0 && purchasedBalance > 0 && " · "}
          {purchasedBalance > 0 && `${purchasedBalance.toLocaleString()} purchased`}
        </p>
      )}
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
      <AddCreditsLink onClick={onAddCreditsClick} />
    </div>
  );
}

function AddCreditsLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href={CREDIT_TOP_UPS_BILLING_HREF}
      onClick={onClick}
      className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2 text-xs font-semibold text-purple-800 transition hover:border-purple-300 hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:border-purple-700/70 dark:bg-purple-950/40 dark:text-purple-100 dark:hover:bg-purple-900/50"
    >
      <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
      <span>+ Add Credits</span>
    </Link>
  )
}

export function useUsage() {
  const [usage, setUsage] = React.useState(0)
  const [includedBalance, setIncludedBalance] = React.useState(0)
  const [purchasedBalance, setPurchasedBalance] = React.useState(0)
  const [totalAvailable, setTotalAvailable] = React.useState(2)
  const [reserved, setReserved] = React.useState(0)
  const [subscriptionTier, setSubscriptionTier] = React.useState("free")
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
        setIsPro(hasUnlimitedAccess || data.subscriptionTier === "pro" || data.subscriptionTier === "business")
        setSubscriptionTier(data.subscriptionTier || "free")
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

  return { usage, includedBalance, purchasedBalance, totalAvailable, available: totalAvailable, total: totalAvailable, reserved, isPro, subscriptionTier, isLoading, canAnalyze, limitReached, unlimitedLabel, refreshUsage }
}
