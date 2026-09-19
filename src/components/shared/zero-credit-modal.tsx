"use client"

import { USAGE_REFRESH_EVENT } from "@/components/ui/usage-monitor"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { CREDIT_TOP_UPS_BILLING_HREF } from "@/lib/billing/credit-topup-navigation"
import { CreditCard, Sparkles, Store } from "lucide-react"
import Link from "next/link"
import * as React from "react"

export interface CreditExhaustionPayload {
  reason: "zero_credits" | "insufficient_credits"
  tier: "free" | "pro" | "business"
  usableCredits: number
  includedBalance: number
  purchasedBalance: number
  reservedCredits: number
  requiredCredits: number
  resetAt: string | null
  cta: {
    action: "add_credits" | "upgrade"
    label: string
    href: string
  }
  title: string
  message: string
}

function isCreditExhaustionPayload(value: unknown): value is CreditExhaustionPayload {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<CreditExhaustionPayload>
  return (
    (candidate.reason === "zero_credits" || candidate.reason === "insufficient_credits") &&
    (candidate.tier === "free" || candidate.tier === "pro" || candidate.tier === "business") &&
    typeof candidate.usableCredits === "number" &&
    typeof candidate.cta?.action === "string" &&
    typeof candidate.cta.href === "string"
  )
}

/**
 * Extracts a server-issued zero-credit payload from an API response body.
 * Returns null unless the server explicitly flagged the request as blocked by
 * credit enforcement; the UI never derives unlock decisions on its own.
 */
export function parseCreditExhaustionPayload(data: unknown): CreditExhaustionPayload | null {
  if (!data || typeof data !== "object") return null
  const record = data as Record<string, unknown>
  if (isCreditExhaustionPayload(record.creditState)) return record.creditState
  return null
}

async function readCreditExhaustionPayload(response: Response): Promise<CreditExhaustionPayload | null> {
  if (response.status !== 402) return null
  try {
    const data = await response.clone().json()
    return parseCreditExhaustionPayload(data)
  } catch {
    return null
  }
}

type ZeroCreditModalProps = {
  state: CreditExhaustionPayload | null
  onOpenChange: (open: boolean) => void
}

export function ZeroCreditModal({ state, onOpenChange }: ZeroCreditModalProps) {
  React.useEffect(() => {
    if (state) window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
  }, [state])

  if (!state) return null

  const isFree = state.tier === "free"

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={state.title}
      description={state.message}
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Usable credits: {state.usableCredits}
              </p>
              <p className="text-xs text-muted-foreground">
                {state.includedBalance > 0 && `${state.includedBalance} included`}
                {state.includedBalance > 0 && state.purchasedBalance > 0 && " · "}
                {state.purchasedBalance > 0 && `${state.purchasedBalance} purchased`}
                {state.includedBalance === 0 && state.purchasedBalance === 0 && "No credits available"}
                {state.requiredCredits > 0 && ` · This action needs ${state.requiredCredits}`}
              </p>
            </div>
          </div>
        </div>

        {isFree ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Pro</p>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                More included credits every month, plus preserved purchased credits.
              </p>
              <Link href="/app/settings/checkout?plan=pro_monthly&discount=auto" className="block">
                <Button size="sm" className="w-full" onClick={() => onOpenChange(false)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Upgrade to Pro
                </Button>
              </Link>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Business</p>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                The highest limits for teams running AI analysis at scale.
              </p>
              <Link href="/app/settings/checkout?plan=business_monthly" className="block">
                <Button size="sm" variant="outline" className="w-full bg-transparent" onClick={() => onOpenChange(false)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Upgrade to Business
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Free plans cannot purchase credit top-ups. Upgrade to Pro or Business for monthly included credits and top-up purchasing.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                {state.tier === "business" ? "Business plan" : "Pro plan"}
              </p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Top up your credit balance and keep working without changing your plan.
            </p>
            <Link href={state.cta.href || CREDIT_TOP_UPS_BILLING_HREF} className="block">
              <Button size="sm" className="w-full" onClick={() => onOpenChange(false)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Add Credits
              </Button>
            </Link>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Shared 402 handling for AI surfaces. The server decides whether credits are
 * exhausted; this hook only renders the modal and refreshes authoritative
 * usage balances.
 */
export function useZeroCreditModal() {
  const [state, setState] = React.useState<CreditExhaustionPayload | null>(null)
  const inFlightRef = React.useRef(false)

  const openFromPayload = React.useCallback((payload: CreditExhaustionPayload) => {
    // Concurrent exhausted requests must not stack competing modals; the first
    // authoritative payload wins until the user closes it.
    if (inFlightRef.current) return
    inFlightRef.current = true
    window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
    setState(payload)
  }, [])

  const openFromResponse = React.useCallback(async (response: Response): Promise<boolean> => {
    const payload = await readCreditExhaustionPayload(response)
    if (!payload) return false
    openFromPayload(payload)
    return true
  }, [openFromPayload])

  const close = React.useCallback(() => {
    inFlightRef.current = false
    setState(null)
  }, [])

  return { state, openFromPayload, openFromResponse, close, open: state !== null }
}
