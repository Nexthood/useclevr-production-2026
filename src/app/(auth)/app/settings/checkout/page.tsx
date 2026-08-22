"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  billingCountryOptions,
  getCountryFromLocale,
  getMarketForCountry,
  normalizeBillingInterval,
  normalizeCheckoutMarket,
  type BillingInterval,
  type CheckoutMarket,
  type SupportedCurrency,
} from "@/lib/billing/launch-pricing";
import { billingPlans, formatPlanPrice, getBillingPlan, normalizeBillingPlanId, type BillingPlan } from "@/lib/billing/plans";

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

type CheckoutPlan = BillingPlan & {
  status?: "ready" | "payment_provider_not_connected";
  stripePriceStatusByCurrency?: Partial<Record<SupportedCurrency, boolean>> | null;
  marketOptions?: CheckoutMarketOption[] | null;
};

type CheckoutPlanOption = Omit<CheckoutPlan, "stripePriceId"> & {
  stripePriceId?: string | null;
  launchPrices?: BillingPlan["launchPrices"] | null;
  stripePriceStatusByCurrency?: Partial<Record<SupportedCurrency, boolean>> | null;
  marketOptions?: CheckoutMarketOption[] | null;
};

type CheckoutMarketOption = {
  plan: "pro" | "business";
  billingInterval: BillingInterval;
  market: CheckoutMarket;
  marketLabel: string;
  currency: SupportedCurrency;
  amountMinor: number | null;
  displayPrice: string;
  enabled: boolean;
};

const defaultCheckoutPlans: CheckoutPlan[] = billingPlans.map((plan) => ({
  ...plan,
  status: plan.tier === "free" ? "ready" : "payment_provider_not_connected",
}));

function CheckoutClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read plan & discount ONCE on mount; sync back via state so they survive
  // URL changes between steps 1 → 2.
  const planId = normalizeBillingPlanId(searchParams.get("plan"));
  const initialDiscount = searchParams.get("discount");
  const [discount, _setDiscount] = React.useState<boolean>(initialDiscount === "auto");
  const [availablePlans, setAvailablePlans] = React.useState<CheckoutPlan[]>(defaultCheckoutPlans);
  const [isPlanConfigLoading, setIsPlanConfigLoading] = React.useState(true);
  const [step, setStep] = React.useState<CheckoutStep>("review");
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [isGoing, setIsGoing] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [availableDiscounts, setAvailableDiscounts] = React.useState<DiscountRule[]>([]);
  const [selectedMarket, setSelectedMarket] = React.useState<CheckoutMarket>(
    normalizeCheckoutMarket(searchParams.get("market")) ?? "eu",
  );
  const [selectedBillingInterval, setSelectedBillingInterval] = React.useState<BillingInterval>(
    normalizeBillingInterval(searchParams.get("interval")),
  );
  const [browserCountry, setBrowserCountry] = React.useState<string | null>(null);

  const plan: CheckoutPlan = availablePlans.find((candidate) => candidate.id === planId) ?? getBillingPlan(planId);
  const paidPlans = availablePlans.filter((candidate) => candidate.tier === "pro" || candidate.tier === "business");
  const isFreePlan = plan.tier === "free";
  const selectedMarketOption = getSelectedMarketOption(plan, selectedMarket, selectedBillingInterval);

  React.useEffect(() => {
    const country = getCountryFromLocale(navigator.language);
    setBrowserCountry(country);
    if (!searchParams.get("market") && country && billingCountryOptions.some((option) => option.value === country)) {
      setSelectedMarket(getMarketForCountry(country));
    }
  }, [searchParams]);

  // Load checkout readiness from the server because Stripe price env vars are server-only.
  React.useEffect(() => {
    let cancelled = false;

    async function loadCheckoutOptions() {
      setIsPlanConfigLoading(true);
      try {
        const response = await fetch("/api/checkout/options", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data.plans)) return;

        const serverPlans = new Map<string, CheckoutPlanOption>(
          data.plans.map((serverPlan: CheckoutPlanOption) => [serverPlan.id, serverPlan]),
        );

        if (!cancelled) {
          setAvailablePlans(
            billingPlans.map((staticPlan) => {
              const serverPlan = serverPlans.get(staticPlan.id);
              return {
                ...staticPlan,
                ...(serverPlan ?? {}),
                stripePriceId:
                  typeof serverPlan?.stripePriceId === "string" ? serverPlan.stripePriceId : undefined,
                launchPrices: serverPlan?.launchPrices ?? staticPlan.launchPrices,
                stripePriceStatusByCurrency: serverPlan?.stripePriceStatusByCurrency ?? null,
                marketOptions: serverPlan?.marketOptions ?? null,
              };
            }),
          );
        }
      } catch {
        // Keep the static plan copy visible; the payment panel explains when checkout is unavailable.
      } finally {
        if (!cancelled) setIsPlanConfigLoading(false);
      }
    }

    loadCheckoutOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectPlan = (nextPlanId: string) => {
    const normalized = normalizeBillingPlanId(nextPlanId);
    setStep("review");
    setTermsAccepted(false);
    setCheckoutError(null);
    const nextPlan = availablePlans.find((candidate) => candidate.id === normalized) ?? getBillingPlan(normalized);
    const nextMarket = getMarketSelectionForPlan(nextPlan, selectedMarket, selectedBillingInterval);
    setSelectedMarket(nextMarket);
    router.push(buildCheckoutUrl({ planId: normalized, market: nextMarket, billingInterval: selectedBillingInterval, discount }));
  };

  const selectBillingInterval = (billingInterval: BillingInterval) => {
    setSelectedBillingInterval(billingInterval);
    setStep("review");
    setTermsAccepted(false);
    setCheckoutError(null);
    router.push(buildCheckoutUrl({ planId, market: selectedMarket, billingInterval, discount }));
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
  const canReview = !isFreePlan && !isPlanConfigLoading && Boolean(selectedMarketOption?.enabled);
  const submitLabel = isPlanConfigLoading
    ? "Checking payment provider..."
    : canReview
      ? "Continue to secure payment"
      : "Checkout unavailable";

  const onSubmit = async () => {
    if (!termsAccepted) return;
    setIsGoing(true);
    setCheckoutError(null);

    try {
      const response = await fetch("/api/checkout/confirm?form=review-accepted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan.tier,
          billingInterval: selectedBillingInterval,
          market: selectedMarket,
          browserCountry,
        }),
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
    router.push(buildCheckoutUrl({ planId, market: selectedMarket, billingInterval: selectedBillingInterval, discount, form: "review-accepted" }));
  };

  const goBack = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep("review");
    router.push(buildCheckoutUrl({ planId, market: selectedMarket, billingInterval: selectedBillingInterval, discount }));
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
                <button
                  type="button"
                  onClick={() => selectPlan("free")}
                  className={[
                    "rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isFreePlan
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5",
                  ].join(" ")}
                  aria-pressed={isFreePlan}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">Free</span>
                    <span
                      className={[
                        "h-4 w-4 rounded-full border",
                        isFreePlan ? "border-primary bg-primary shadow-[inset_0_0_0_4px_hsl(var(--background))]" : "border-muted-foreground/50",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-1 block text-sm font-medium text-foreground">{formatPlanPrice(plan)}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Included plan. No checkout required.</span>
                </button>
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
                      <span className="mt-1 block text-sm font-medium text-foreground">
                        {formatCheckoutPlanPrice(candidate, selectedMarket, selectedBillingInterval)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{candidate.description}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <span className="text-xl font-semibold">
                  {formatCheckoutPlanPrice(plan, selectedMarket, selectedBillingInterval)}
                </span>
              </div>
              {!isFreePlan && (
                <div className="mt-4">
                  <BillingIntervalSelector
                    selectedBillingInterval={selectedBillingInterval}
                    onSelect={selectBillingInterval}
                  />
                </div>
              )}
              <p className="mt-3 break-words text-sm text-muted-foreground">{plan.description}</p>

              {(plan.id === "pro_monthly" || plan.id === "business_monthly") && (
                <MarketSelector
                  plan={plan}
                  selectedBillingInterval={selectedBillingInterval}
                  selectedMarket={selectedMarket}
                  onSelect={(market) => {
                    setSelectedMarket(market);
                    setCheckoutError(null);
                    router.push(buildCheckoutUrl({ planId, market, billingInterval: selectedBillingInterval, discount }));
                  }}
                />
              )}

              <div className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex min-w-0 items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 break-words">{feature}</span>
                  </div>
                ))}
              </div>

              {!isFreePlan && (
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
              )}

              <div className="mt-5">
                {isFreePlan ? (
                  <Link href="/app/settings/subscription" className="block">
                    <Button variant="outline" className="w-full bg-transparent">
                      Free is active. No checkout required.
                    </Button>
                  </Link>
                ) : (
                  <Button onClick={goTerms} className="w-full" disabled={!canReview}>
                    {canReview ? "Continue to terms & conditions" : "Checkout unavailable for this market"}
                  </Button>
                )}
                {!isFreePlan && !isPlanConfigLoading && !canReview && (
                  <p className="mt-2 text-sm text-destructive">
                    {selectedMarketOption
                      ? `${selectedBillingInterval === "yearly" ? "Yearly" : "Monthly"} billing is currently unavailable for this market.`
                      : "Choose an available billing market before checkout."}
                  </p>
                )}
              </div>
            </div>

            {!isFreePlan && (
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
            )}
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
                  each billing period ({selectedBillingInterval === "yearly" ? "yearly" : "monthly"}) unless cancelled before the renewal date.
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
                  {isPlanConfigLoading
                    ? "Checking the payment provider for this plan."
                    : canReview
                    ? `${plan.name} ${formatCheckoutPlanPrice(plan, selectedMarket, selectedBillingInterval)} billing opens once you continue past this screen.`
                    : "Card payment activates after the payment provider is connected."}
                </p>
                {!isFreePlan && (
                  <div className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Billing:</span>{" "}
                    {selectedBillingInterval === "yearly" ? "Yearly" : "Monthly"}
                  </div>
                )}
                {!isPlanConfigLoading && !canReview && (
                  <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Payment provider connection is required before saving card details. Contact support to enable Stripe integration.
                  </div>
                )}
                <div className="mt-3 space-y-1.5">
                  <Button
                    onClick={onSubmit}
                    disabled={!termsAccepted || isGoing || isPlanConfigLoading || !canReview}
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
                    {isPlanConfigLoading
                      ? "Checking secure checkout availability for this plan."
                      : canReview
                        ? "Secure Stripe checkout opens after you accept the terms."
                        : "Checkout requires an active payment provider and a configured price for this plan."}
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

function MarketSelector({
  plan,
  selectedBillingInterval,
  selectedMarket,
  onSelect,
}: {
  plan: CheckoutPlan;
  selectedBillingInterval: BillingInterval;
  selectedMarket: CheckoutMarket;
  onSelect: (market: CheckoutMarket) => void;
}) {
  const options = (plan.marketOptions ?? []).filter((option) => option.billingInterval === selectedBillingInterval);
  if (options.length === 0) return null;

  return (
    <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">Billing market</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((option) => {
          const selected = option.market === selectedMarket;
          return (
            <button
              key={option.market}
              type="button"
              disabled={!option.enabled}
              onClick={() => onSelect(option.market)}
              className={[
                "min-h-20 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary bg-primary/10" : "border-border bg-background",
                option.enabled ? "hover:border-primary/50" : "cursor-not-allowed opacity-60",
              ].join(" ")}
              aria-pressed={selected}
            >
              <span className="block text-sm font-semibold text-foreground">{option.marketLabel}</span>
              <span className="mt-1 block text-sm font-medium text-foreground">
                {option.enabled ? option.displayPrice : "Unavailable"}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {option.enabled ? option.currency : "Not configured"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Checkout uses the selected market to choose the approved Stripe subscription price.
      </p>
    </div>
  );
}

function BillingIntervalSelector({
  selectedBillingInterval,
  onSelect,
}: {
  selectedBillingInterval: BillingInterval;
  onSelect: (billingInterval: BillingInterval) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-muted/40 p-1 sm:w-auto" role="group" aria-label="Billing interval">
      {(["monthly", "yearly"] as BillingInterval[]).map((billingInterval) => {
        const selected = billingInterval === selectedBillingInterval;
        return (
          <button
            key={billingInterval}
            type="button"
            onClick={() => onSelect(billingInterval)}
            className={[
              "min-h-10 flex-1 rounded-md px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-28",
              selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            ].join(" ")}
            aria-pressed={selected}
          >
            {billingInterval === "yearly" ? "Yearly" : "Monthly"}
          </button>
        );
      })}
    </div>
  );
}

function getSelectedMarketOption(plan: CheckoutPlan, market: CheckoutMarket, billingInterval: BillingInterval) {
  return plan.marketOptions?.find((option) => option.market === market && option.billingInterval === billingInterval) ?? null;
}

function getMarketSelectionForPlan(plan: CheckoutPlan, currentMarket: CheckoutMarket, billingInterval: BillingInterval): CheckoutMarket {
  const options = (plan.marketOptions ?? []).filter((option) => option.billingInterval === billingInterval);
  if (options.some((option) => option.market === currentMarket && option.enabled)) return currentMarket;
  return options.find((option) => option.enabled)?.market ?? currentMarket;
}

function formatCheckoutPlanPrice(plan: CheckoutPlan, market: CheckoutMarket, billingInterval: BillingInterval) {
  if (plan.tier === "free") return formatPlanPrice(plan);

  if (plan.id === "pro_monthly" || plan.id === "business_monthly") {
    return getSelectedMarketOption(plan, market, billingInterval)?.displayPrice ?? formatPlanPrice(plan);
  }

  return formatPlanPrice(plan);
}

function buildCheckoutUrl({
  planId,
  market,
  billingInterval,
  discount,
  form,
}: {
  planId: string;
  market: CheckoutMarket;
  billingInterval: BillingInterval;
  discount: boolean;
  form?: string;
}) {
  const params = new URLSearchParams({ plan: normalizeBillingPlanId(planId), market });
  params.set("interval", billingInterval);
  if (form) params.set("form", form);
  if (discount) params.set("discount", "auto");
  return `/app/settings/checkout?${params.toString()}`;
}

export default function SettingsCheckoutPage() {
  return <CheckoutClient />;
}
