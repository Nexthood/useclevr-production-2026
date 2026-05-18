"use client"

import * as React from "react"
import Link from "next/link"
import { Check, FileText, ChevronRight, CreditCard } from "lucide-react"
import { CheckoutConfirmButton } from "@/components/billing/checkout-confirm-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPlanPrice, getBillingPlan } from "@/lib/billing/plans"
import { useSearchParams, useRouter } from "next/navigation"

type CheckoutStep = "review" | "terms"

function CheckoutClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const planId = searchParams.get("plan") ?? "pro_monthly"
  const discountParam = searchParams.get("discount") ?? ""
  const hasDiscount = discountParam === "auto"

  const plan = getBillingPlan(planId)
  const tscUrl = plan.tscAndConditionsUrl || "https://useclevr.com/terms"
  const canReview = plan.paymentProviderConnected !== false

  const [step, setStep] = React.useState<CheckoutStep>("review")
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [isGoing, setIsGoing] = React.useState(false)

  const onSubmit = () => {
    if (!termsAccepted) return
    setIsGoing(true)
    router.push(`/app/settings/checkout?form=review-accepted&plan=${planId}`)
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className={step === "review" ? "text-primary" : ""}>1. Review plan</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className={step === "terms" ? "text-primary" : ""}>2. Terms &amp; conditions</span>
        </div>
        <CardTitle className="text-2xl">{step === "review" ? "Review your plan" : "Accept terms &amp; conditions"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {step === "review"
            ? "Upgrade, downgrade, or review billing before payment is enabled."
            : "Please read and accept the terms and conditions before proceeding."}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {step === "review" && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-border bg-background p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <span className="text-xl font-semibold">{formatPlanPrice(plan)}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>

              <div className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {hasDiscount && (
                <div className="mt-5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground">
                  {plan.discountLabel || "Automatic discount checked and applied where available."}
                </div>
              )}

              <div className="mt-5">
                <Button onClick={() => setStep("terms")} className="w-full">
                  Continue to terms &amp; conditions
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-5">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Terms &amp; Conditions</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                By continuing you confirm acceptance of our{' '}
                <a href={tscUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Terms and Conditions
                </a>
                .
              </p>
              <div className="mt-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Full review must be completed before accepting.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "terms" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <div className="rounded-lg border border-border bg-background p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">{plan.name} — Terms &amp; Conditions</h2>
                  </div>

                  <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
                    <p className="mb-3 font-semibold text-foreground">1. General</p>
                    <p className="mb-3">
                      By subscribing to the {plan.name} plan you agree to these terms. All paid subscriptions are
                      billed in advance and will renew automatically at the end of each billing period ({plan.interval}ly)
                      unless cancelled before the renewal date.
                    </p>
                    <p className="mb-3 font-semibold text-foreground">2. Usage</p>
                    <p className="mb-3">
                      Your subscription grants access to the features described in your plan. UseClevr reserves the right
                      to modify features within your tier.
                    </p>
                    <p className="mb-3 font-semibold text-foreground">3. Cancellation &amp; Refunds</p>
                    <p className="mb-3">
                      You may cancel at any time. Upon cancellation your access continues until the end of the current
                      billing period. Refunds are handled case by case — contact support.
                    </p>
                    <p className="mb-3 font-semibold text-foreground">4. Data &amp; Privacy</p>
                    <p>
                      Uploaded datasets and generated reports remain your property. UseClevr processes data in accordance
                      with the{' '}
                      <a href="https://useclevr.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        Privacy Policy
                      </a>.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-5">
                  <p className="text-sm font-semibold mb-3">Accept terms</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    You must accept the Terms and Conditions before continuing.{' '}
                    <a href={tscUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open in new tab</a>
                  </p>
                  <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <p className="text-sm">
                      I have read and accept the Terms and Conditions
                    </p>
                  </label>
                </div>

                <div className="rounded-lg border border-border bg-background p-5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Payment</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {canReview
                      ? "Payment will be processed once you continue past this screen."
                      : "Card payment activates after the payment provider is connected."}
                  </p>
                  <div className="mt-4 space-y-3">
                    <Button
        disabled={!termsAccepted || isGoing}
        onClick={onSubmit}
                      className="w-full"
                    >
                      {isGoing
                        ? "Saving…"
                        : termsAccepted
                        ? "Save review &amp; continue"
                        : "Accept terms &amp; conditions to continue"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      onClick={() => setStep("review")}
                    >
                      Back to plan review
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Checkout saved locally when the payment provider is not yet connected.
                    </p>
                    <Link href="/app/settings/subscription" className="block">
                      <Button variant="outline" className="w-full bg-transparent">
                        Back to subscription
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-lg border border-border bg-background p-5">
                  <h2 className="font-semibold">{plan.name}</h2>
                  <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-3 space-y-1.5">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  {hasDiscount && (
                    <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground">
                      {plan.discountLabel || "Automatic discount checked and applied where available."}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-background p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Terms &amp; Conditions</h2>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    By continuing you confirm acceptance of our{' '}
                    <a href={tscUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Terms and Conditions
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function SettingsCheckoutPage() {
  return <CheckoutClient />
}
