import { DashboardSubpageLayout, DashboardContent } from "@/components/layout/dashboard-subpage-layout";
import { Card } from "@/components/ui/card";
import { billingPlans, formatPlanPrice } from "@/lib/billing/plans";
import { CreditCard, Check, Infinity as InfinityIcon } from "lucide-react";

function tierColor(tier: string): string {
  switch (tier) {
    case "free": return "text-slate-600 dark:text-slate-400";
    case "pro": return "text-blue-700 dark:text-blue-300";
    case "business": return "text-purple-700 dark:text-purple-300";
    default: return "text-muted-foreground";
  }
}

function tierBg(tier: string): string {
  switch (tier) {
    case "free": return "bg-slate-500/10";
    case "pro": return "bg-blue-500/10";
    case "business": return "bg-purple-500/10";
    default: return "bg-card";
  }
}

function tierBadge(tier: string): string {
  switch (tier) {
    case "free": return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "pro": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "business": return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function stripeEnvLabel(priceId: string | undefined): string {
  if (!priceId) return "N/A (Free plan)";
  const clean = priceId.replace(/^process\.env\./, "");
  return clean || "N/A";
}

export default function AdminBillingSettingsPage() {
  return (
    <DashboardSubpageLayout
      title="Billing Settings"
      description="View current billing plan configuration"
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Billing Settings" }]}
      icon={CreditCard}
    >
      <DashboardContent>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {billingPlans.map((plan) => (
            <Card key={plan.id} className="flex flex-col border-border bg-card">
              <div className={`rounded-t-lg px-5 pb-0 pt-5 ${tierBg(plan.tier)}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tierBadge(plan.tier)}`}>
                    {plan.tier}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`text-3xl font-bold ${tierColor(plan.tier)}`}>{formatPlanPrice(plan)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-5">
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Stripe Price ID
                  </h4>
                  <code className="block rounded bg-muted px-2 py-1 text-xs text-foreground">
                    {plan.stripePriceId ? plan.stripePriceId : "N/A"}
                  </code>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Env Variable
                  </h4>
                  <code className="block rounded bg-muted px-2 py-1 text-xs text-foreground">
                    {stripeEnvLabel(plan.stripePriceId)}
                  </code>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Usage Limits
                  </h4>
                  <p className="text-sm text-foreground">
                    Max datasets:{" "}
                    <span className="font-medium">
                      {plan.maxDatasets === Infinity ? (
                        <span className="inline-flex items-center gap-1">
                          Unlimited <InfinityIcon className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        plan.maxDatasets
                      )}
                    </span>
                  </p>
                </div>

                <div className="flex-1">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Features
                  </h4>
                  <ul className="space-y-1.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </DashboardContent>
    </DashboardSubpageLayout>
  );
}
