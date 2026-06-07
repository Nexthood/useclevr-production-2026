import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";
import { formatPlanPrice } from "@/lib/billing/plans";
import { getBillingSettings } from "@/lib/billing/settings-store";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { ArrowUpRight, CreditCard, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Subscription" };

export default async function SubscriptionSettingsPage() {
  const session = await auth();
  const usage = await getAnalystCreditUsage(session?.user?.id);
  const billingSettings = await getBillingSettings();
  const remaining = Math.max(0, usage.total - usage.analysisCount);
  const isUnlimited =
    usage.trialActive ||
    usage.subscriptionTier === "pro" ||
    usage.subscriptionTier === "business" ||
    usage.subscriptionTier === "superadmin";

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-foreground">Subscription</CardTitle>
            <CardDescription className="text-muted-foreground">
              Manage your plan and billing.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-foreground">Current plan</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {usage.subscriptionTier === "superadmin"
              ? "Super admin"
              : usage.trialActive
                ? "14-day trial"
              : isUnlimited
                ? "Pro tier"
                : "Free tier"}
          </p>
          {!isUnlimited && (
            <Link href="/app/settings/checkout?plan=pro_monthly&discount=auto" className="mt-3 block">
              <Button variant="outline" size="sm" className="bg-transparent">
                Upgrade
              </Button>
            </Link>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-cyan-800 dark:text-cyan-100" />
            <p className="text-sm font-medium text-foreground">Analyst credits</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {isUnlimited
              ? usage.trialActive
                ? `Unlimited analyst usage for ${usage.trialDaysRemaining} more ${usage.trialDaysRemaining === 1 ? "day" : "days"}`
                : "Unlimited analyst usage"
              : `${usage.analysisCount} / ${usage.total} free credits used`}
          </p>
          {!isUnlimited && (
            <p className="mt-1 text-xs text-muted-foreground">
              {usage.limitReached
                ? "Free credits are used. Subscribe to Pro or top up to continue analysis."
                : `${remaining} free ${remaining === 1 ? "credit" : "credits"} remaining.`}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium text-primary mb-2">
              <Sparkles className="h-3 w-3" />
              Pricing
            </div>
            <h2 className="text-base font-semibold text-foreground">Plans</h2>
            <p className="text-sm text-muted-foreground">
              Short plan overview. Full plan details live on the public plans page.
            </p>
          </div>
          <Link href="/pricing">
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              Home plans
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {billingSettings.plans
            .filter((plan) => plan.id !== "pro_annual")
            .map((plan) => {
              const isCurrent =
                (plan.tier === "free" && !isUnlimited) ||
                (plan.tier === "pro" && usage.subscriptionTier === "pro") ||
                (plan.tier === "business" && usage.subscriptionTier === "business");

              return (
                <div key={plan.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">{formatPlanPrice(plan)}</p>
                    </div>
                    {isCurrent && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-3 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
                  {isCurrent ? (
                    <Button
                      disabled
                      size="sm"
                      variant="outline"
                      className="mt-4 w-full bg-transparent"
                    >
                      Active plan
                    </Button>
                  ) : (
                    <Link href={`/app/settings/checkout?plan=${plan.id}`}>
                      <Button
                        size="sm"
                        variant={plan.tier === "free" ? "outline" : "default"}
                        className={
                          plan.tier === "free" ? "mt-4 w-full bg-transparent" : "mt-4 w-full"
                        }
                      >
                        {plan.tier === "free" ? "Downgrade" : "Review change"}
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Annual Pro discounts are applied automatically in checkout. If a payment provider is not
          connected, checkout saves a review instead of collecting a card.
        </div>
      </CardContent>
    </Card>
  );
}
