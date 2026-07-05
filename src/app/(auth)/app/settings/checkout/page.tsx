"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { billingPlans, formatPlanPrice, getBillingPlan, normalizeBillingPlanId } from "@/lib/billing/plans";

type DiscountRule = {
  id: string;
  type: "free" | "percentage" | "referral" | "stacking";
  name: string;
  code: string;
  percent?: number;
  description: string;
  enabled: boolean;
  planTarget?: "all" | "free" | "pro" | "business";
};
import { Check, ChevronRight, CreditCard, FileText, Lock, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

type CheckoutStep = "review" | "terms";

function CheckoutClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read plan & discount ONCE on mount; sync back via state so they survive
  // URL changes between steps 1 → 2.
  const planId = normalizeBillingPlanId(searchParams.get("plan"));
  const initialDiscount = searchParams.get("discount");
  const [discount, _setDiscount] = React.useState<boolean>(initialDiscount === "auto");
  const [plan, setPlan] = React.useState(getBillingPlan(planId));
  const [step, setStep] = React.useState<CheckoutStep>("review");
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [isGoing, setIsGoing] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [availableDiscounts, setAvailableDiscounts] = React.useState<DiscountRule[]>([]);

  // When the URL changes (back/forward), keep state in sync.
  React.useEffect(() => {
    setPlan(getBillingPlan(searchParams.get("plan")));
  }, [searchParams]);

  const paidPlans = billingPlans.filter((candidate) => candidate.tier === "pro" || candidate.tier === "business");

  const selectPlan = (nextPlanId: string) => {
    const normalized = normalizeBillingPlanId(nextPlanId);
    setPlan(getBillingPlan(normalized));
    setStep("review");
    setTermsAccepted(false);
    setCheckoutError(null);
    router.push(`/app/settings/checkout?plan=${normalized}${discount ? "&discount=auto" : ""}`);
  };

  // Fetch available discounts and filter by plan target
  React.useEffect(() => {
    const loadDiscounts = async () => {
      try {
        const res = await fetch("/api/admin/discounts", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const allDiscounts = data.discountRules || [];
        // Filter discounts by plan target - only show applicable ones
        const applicableDiscounts = allDiscounts.filter((d: DiscountRule) =>
          d.enabled && (d.planTarget === "all" || d.planTarget === plan.tier)
        );
        setAvailableDiscounts(applicableDiscounts);
      } catch {
        // Ignore errors - discounts are optional
      }
    };
    loadDiscounts();
  }, [plan.tier]);

  const tscUrl = "/terms";
  const canReview = !!plan.stripePriceId;
  const submitLabel = canReview ? "Continue to secure payment" : "Checkout unavailable";

  const onSubmit = async () => {
    if (!termsAccepted) return;
    setIsGoing(true);
    setCheckoutError(null);

    try {
      const response = await fetch("/api/checkout/confirm?form=review-accepted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setCheckoutError(result.error || "Checkout could not be started.");
        setIsGoing(false);
        return;
      }

      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      router.push(
        `/app/settings/checkout?success=1&plan=${planId}${discount ? "&discount=auto" : ""}`,
      );
    } catch {
      setCheckoutError("Checkout could not be started. Please try again.");
      setIsGoing(false);
    }
  };

  const goTerms = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep("terms");
    // Push discount into URL so Step 2 re-render picks it up via searchParams
    if (discount) {
      router.push(`/app/settings/checkout?form=review-accepted&plan=${planId}&discount=auto`);
    } else {
      router.push(`/app/settings/checkout?form=review-accepted&plan=${planId}`);
    }
  };

  const goBack = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep("review");
    if (discount) {
      router.push(`/app/settings/checkout?plan=${planId}&discount=auto`);
    } else {
      router.push(`/app/settings/checkout?plan=${planId}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl min-w-0 p-4">
      <Card className="min-w-0 border-border bg-card shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className={step === "review" ? "text-primary" : ""}>1. Review plan</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className={step === "terms" ? "text-primary" : ""}>2. Terms &amp; conditions</span>
          </div>
          <CardTitle className="text-2xl">
            {step === "review" ? "Review your plan" : "Accept terms &amp; conditions"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === "review"
              ? "Upgrade, downgrade, or review billing before payment is enabled."
              : "Please read and accept the terms and conditions before proceeding."}
          </p>
        </CardHeader>

      <CardContent className="space-y-6">
        {step === "review" && (
          <div className="w-full space-y-6">
            <div className="rounded-lg border border-border bg-background p-5">
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                {paidPlans.map((candidate) => {
                  const isSelected = candidate.id === plan.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => selectPlan(candidate.id)}
                      className={[
                        "rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5",
                      ].join(" ")}
                      aria-pressed={isSelected}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground">{candidate.name}</span>
                        <span
                          className={[
                            "h-4 w-4 rounded-full border",
                            isSelected ? "border-primary bg-primary shadow-[inset_0_0_0_4px_hsl(var(--background))]" : "border-muted-foreground/50",
                          ].join(" ")}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-1 block text-sm font-medium text-foreground">{formatPlanPrice(candidate)}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{candidate.description}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <span className="text-xl font-semibold">{formatPlanPrice(plan)}</span>
              </div>
              <p className="mt-3 break-words text-sm text-muted-foreground">{plan.description}</p>

              <div className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex min-w-0 items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 break-words">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                {availableDiscounts.length > 0 ? (
                  availableDiscounts.map((d) => (
                    <div key={d.id} className="min-w-0 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        <Tag className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 break-words">{d.name}: {d.percent}% off</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    No discounts available for {plan.tier} plan.
                  </div>
                )}
              </div>

              <div className="mt-5">
                <Button onClick={goTerms} className="w-full">
                  Continue to terms &amp; conditions
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-5">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <h2 className="font-semibold">Terms &amp; Conditions</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                By continuing you confirm acceptance of our{" "}
                <a
                  href={tscUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
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
          <div className="mx-auto grid w-full max-w-[1000px] min-w-0 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="min-w-0 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <h2 className="font-semibold text-base">{plan.name} — Terms &amp; Conditions</h2>
              </div>

              <div className="mt-2 max-h-[16rem] overflow-y-auto rounded-lg border border-border bg-muted/30 p-2.5 text-xs leading-relaxed text-muted-foreground">
                <p className="mb-1.5 font-semibold text-foreground text-xs">1. General</p>
                <p className="mb-1.5 text-xs">
                  By subscribing to the {plan.name} plan you agree to these terms. All paid
                  subscriptions are billed in advance and will renew automatically at the end of
                  each billing period ({plan.interval}ly) unless cancelled before the renewal date.
                </p>
                <p className="mb-1.5 font-semibold text-foreground text-xs">2. Usage</p>
                <p className="mb-1.5 text-xs">
                  Your subscription grants access to the features described in your plan. UseClevr
                  reserves the right to modify features within your tier.
                </p>
                <p className="mb-1.5 font-semibold text-foreground text-xs">3. Cancellation &amp; Refunds</p>
                <p className="mb-1.5 text-xs">
                  You may cancel at any time. Upon cancellation your access continues until the end
                  of the current billing period. Refunds are handled case by case — contact support.
                </p>
                <p className="mb-1.5 font-semibold text-foreground text-xs">4. Data &amp; Privacy</p>
                <p className="text-xs">
                  Uploaded datasets and generated reports remain your property. UseClevr processes
                  data in accordance with the{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="min-w-0 rounded-lg border border-border bg-background p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Lock className="h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm font-semibold">Accept terms &amp; conditions</p>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  You must read and accept the Terms before continuing. The full document is at{" "}
                  <a
                    href={tscUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Terms of Service
                  </a>
                  .
                </p>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <p className="text-sm">I have read and accept the Terms and Conditions</p>
                </label>
              </div>

              <div className="min-w-0 rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 shrink-0 text-primary" />
                  <h2 className="font-semibold text-base">Payment</h2>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {canReview
                    ? "Payment will be processed once you continue past this screen."
                    : "Card payment activates after the payment provider is connected."}
                </p>
                {!canReview && (
                  <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Payment provider connection is required before saving card details. Contact support to enable Stripe integration.
                  </div>
                )}
                <div className="mt-3 space-y-1.5">
                  <Button
                    onClick={onSubmit}
                    disabled={!termsAccepted || isGoing || !canReview}
                    className="w-full"
                  >
                    {isGoing
                      ? canReview
                        ? "Opening payment..."
                        : "Checkout unavailable"
                      : termsAccepted
                        ? submitLabel
                        : "Accept terms and conditions to continue"}
                  </Button>
                  {checkoutError && (
                    <p className="text-sm text-destructive">{checkoutError}</p>
                  )}
                  <Button variant="outline" className="w-full bg-transparent" onClick={goBack}>
                    Back to plan review
                  </Button>
                </div>
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Checkout requires an active payment provider and a configured price for this plan.
                  </p>
                  <Link href="/app/settings/subscription" className="block">
                    <Button variant="outline" className="w-full bg-transparent">
                      Back to subscription
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsCheckoutPage() {
  return <CheckoutClient />;
}
