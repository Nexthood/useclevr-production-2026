import { debugError } from "@/lib/utils/debug"

import { getCheckoutSession, syncVerifiedCheckoutSession } from "@/app/actions/stripe"
import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Card, CardContent } from "@/components/ui/card"
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store"
import { CheckCircle, LayoutDashboard } from "lucide-react"
import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Payment Successful - UseClevr",
  description: "Your subscription is now active",
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; s?: string }>
}) {
  const { session_id, s } = await searchParams
  const stripeSessionId = session_id || s

  let session: Awaited<ReturnType<typeof getCheckoutSession>> = null
  if (stripeSessionId) {
    try {
      session = await getCheckoutSession(stripeSessionId)
      if (session?.payment_status === "paid") {
        await syncVerifiedCheckoutSession(stripeSessionId)
      }
    } catch (error) {
      debugError("Error fetching session:", error)
    }
  }
  const planLabel = await getCheckoutPlanLabel(session?.metadata?.billingPlanId ?? session?.metadata?.productId ?? null)

  // Minimal unlock + guidance: if this checkout was for Hybrid AI Lite,
  // set cookie so the modal unlocks Lite and redirect to app with setup hint
  try {
    const isLite = Boolean(session && "metadata" in session && (session as any).metadata?.productId === "hybrid_ai_lite")
    if (isLite) {
      const store = await cookies()
      store.set("hybridAiLiteEnabled", "1", { path: "/", maxAge: 60 * 60 * 24 * 365 })
      // Send user directly to dashboard where Hybrid AI modal lives, with hint to open Lite setup
      // Do not auto-start any downloads or runtime; only provide UI context.
      return redirect("/app?hybrid=lite&setup=1")
    }
  } catch {
    // Non-fatal if cookie cannot be set
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex flex-1 items-center justify-center bg-muted/20 px-4 py-12">
        <Card className="w-full max-w-lg border-border bg-card text-card-foreground shadow-sm">
          <CardContent className="space-y-7 p-8 text-center sm:p-10">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
                <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-normal text-foreground">Payment successful</h1>
              <p className="text-base text-muted-foreground">Your UseClevr subscription is now active.</p>
            </div>

            {planLabel && (
              <div className="rounded-lg border border-border bg-muted/40 px-5 py-4 text-left">
                <p className="text-sm font-medium text-muted-foreground">Current plan</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{planLabel}</p>
              </div>
            )}

            <div className="flex justify-center">
              <Link
                href="/app"
                className="inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-lg border border-primary/30 bg-gradient-to-b from-primary/95 to-primary/80 px-6 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_hsl(var(--primary)/0.18),inset_0_1px_0_rgba(255,255,255,0.24)] ring-offset-background transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_14px_38px_hsl(var(--primary)/0.24),inset_0_1px_0_rgba(255,255,255,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 sm:w-auto"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden="true" />
                Go to Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <PublicFooter />
    </div>
  )
}

async function getCheckoutPlanLabel(planId: string | null) {
  if (!planId) return null

  try {
    const plan = await getConfiguredBillingPlan(planId)
    return plan.tier === "free" ? null : plan.name
  } catch {
    return null
  }
}
