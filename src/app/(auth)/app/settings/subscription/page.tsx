import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";
import { getActiveCreditTopUpPackages } from "@/lib/billing/credit-packages";
import { getSubscriptionIntervalForStripePriceId } from "@/lib/billing/launch-pricing";
import { getBillingSettings } from "@/lib/billing/settings-store";
import { getCreditTopUpHistory } from "@/lib/billing/credit-topup-service";
import { getDb } from "@/lib/db";
import { datasets, profiles } from "@/lib/db/schema";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { count, eq, sum } from "drizzle-orm";
import { ArrowUpRight, CreditCard, FileText, ReceiptText, ShieldCheck, Sparkles, LoaderCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreditTopUpButton } from "@/components/shared/credit-topup-button"
import { SubscriptionPlanSelector } from "@/components/billing/subscription-plan-selector";

export const metadata: Metadata = { title: "Subscription" };

type SubscriptionTab = "overview" | "billing" | "usage" | "terms";

const tabs: Array<{ id: SubscriptionTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "billing", label: "Billing" },
  { id: "usage", label: "AI Usage & Credits" },
  { id: "terms", label: "Terms & Conditions" },
];

function normalizeTab(value: string | string[] | undefined): SubscriptionTab {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "billing" || tab === "usage" || tab === "terms") return tab;
  return "overview";
}

function planLabel(tier: string | null | undefined) {
  if (tier === "superadmin") return "Super admin";
  if (tier === "admin") return "Admin";
  if (tier === "business") return "Business";
  if (tier === "pro") return "Pro";
  return "Free";
}

function bytesToDisplay(bytes: number) {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${Math.max(0.1, mb).toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export default async function SubscriptionSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const activeTab = normalizeTab(params?.tab);
  const showTopUpSuccess = params?.topup === "success";
  const session = await auth();
  const usage = await getAnalystCreditUsage(
    session?.user?.id,
    session?.user?.role,
    session?.user?.email ?? null,
  );
  const billingSettings = await getBillingSettings();
  const isUnlimited = usage.unlimited;
  const remaining = isUnlimited ? 0 : Math.max(0, usage.availableCredits ?? 0);
  const db = getDb();

  const [profile, datasetStats] = await Promise.all([
    db && session?.user?.id
      ? db.query.profiles.findFirst({
          where: eq(profiles.userId, session.user.id),
          columns: {
            stripeCustomerId: true,
            stripeCurrentPeriodEnd: true,
            stripePriceId: true,
            stripeStatus: true,
            subscriptionTier: true,
          },
        })
      : null,
    db && session?.user?.id
      ? db
          .select({
            datasetCount: count(),
            storageBytes: sum(datasets.fileSize),
          })
          .from(datasets)
          .where(eq(datasets.userId, session.user.id))
          .then((rows) => rows[0] ?? { datasetCount: 0, storageBytes: "0" })
          .catch(() => ({ datasetCount: 0, storageBytes: "0" }))
      : { datasetCount: 0, storageBytes: "0" },
  ]);

  const providerConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const tier = profile?.subscriptionTier || usage.subscriptionTier || "free";
  const currentPlanLabel = planLabel(tier);
  const paymentStatus = profile?.stripeStatus
    ? profile.stripeStatus.replaceAll("_", " ")
    : profile?.stripeCustomerId
      ? "Customer connected"
      : providerConfigured
        ? "Ready for checkout"
        : "Not configured";
  const currentBillingInterval = profile?.stripePriceId
    ? getSubscriptionIntervalForStripePriceId(profile.stripePriceId)
    : null;
  const billingCycle = currentBillingInterval === "yearly" ? "Yearly" : profile?.stripePriceId ? "Monthly" : "None";
  const nextBillingDate = profile?.stripeCurrentPeriodEnd
    ? profile.stripeCurrentPeriodEnd.toLocaleDateString()
    : "Not scheduled";
  const datasetCount = Number(datasetStats.datasetCount ?? 0);
  const storageBytes = Number(datasetStats.storageBytes ?? 0);
  const activePlan = billingSettings.plans.find((plan) => plan.tier === tier) ?? billingSettings.plans[0];
  const datasetLimit = Number.isFinite(activePlan.limits.maxDatasets)
    ? String(activePlan.limits.maxDatasets)
    : "Unlimited";

  const creditPackages = getActiveCreditTopUpPackages();
  const topUpHistory = session?.user?.id ? await getCreditTopUpHistory(session.user.id, 20) : [];
  const pendingTopUp = topUpHistory.find(
    (t) => t.status === "pending" || t.status === "duplicate" || t.status === "failed",
  );
  const showPendingTopUp = showTopUpSuccess || pendingTopUp;
  const completedTopUps = topUpHistory.filter((t) => t.status === "completed");

  return (
    <Card className="min-w-0 border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-foreground">Subscription Management</CardTitle>
            <CardDescription className="text-muted-foreground">
              Manage your plan, billing, AI usage, credits, and subscription terms.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex min-w-0 gap-2 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1" role="tablist" aria-label="Subscription sections">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                href={tab.id === "overview" ? "/app/settings/subscription" : `/app/settings/subscription?tab=${tab.id}`}
                className={[
                  "shrink-0 rounded-md px-3 py-2 text-sm font-medium transition",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                ].join(" ")}
                role="tab"
                aria-selected={active}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Current Plan" value={currentPlanLabel} detail="Active account access" />
              <MetricCard
                label="AI Credits Summary"
                value={isUnlimited ? usage.unlimitedLabel || "Unlimited" : `${usage.analysisCount} / ${usage.total} used`}
                detail={isUnlimited ? "No monthly credit limit applies." : `${remaining} credits available.`}
              />
              <MetricCard label="Dataset Usage" value={`${datasetCount} / ${datasetLimit}`} detail="Uploaded datasets in this workspace" />
              <MetricCard label="Storage Usage" value={bytesToDisplay(storageBytes)} detail="Based on uploaded dataset file sizes" />
              <MetricCard label="Monthly Reset" value="Monthly" detail="AI credits refresh each billing month." />
              <MetricCard label="Upgrade Recommendation" value={usage.limitReached ? "Upgrade recommended" : "Plan is active"} detail={usage.limitReached ? "More credits are needed to continue analysis." : "Usage is within the current plan."} />
            </div>

            <div className="rounded-lg border border-border bg-background p-5">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">Plan Benefits</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{activePlan.description}</p>
                </div>
                {!isUnlimited && (
                  <Link href="/app/settings/checkout?plan=pro_monthly&discount=auto">
                    <Button className="shrink-0">Quick Upgrade</Button>
                  </Link>
                )}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {activePlan.features.map((feature) => (
                  <div key={feature} className="rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            <SubscriptionPlanSelector
              plans={billingSettings.plans}
              currentTier={tier}
              currentPlanLabel={currentPlanLabel}
            />
          </div>
        )}

        {activeTab === "billing" && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Current Subscription" value={currentPlanLabel} />
              <MetricCard label="Payment Method" value={profile?.stripeCustomerId ? "Connected" : "Not connected"} />
              <MetricCard label="Next Billing Date" value={nextBillingDate} />
              <MetricCard label="Billing Cycle" value={billingCycle} />
              <MetricCard label="Payment Status" value={paymentStatus} />
              <MetricCard label="Billing History" value="No invoices yet" />
            </div>

            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {providerConfigured ? "Subscription billing" : "Payment provider not configured"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {profile?.stripeCurrentPeriodEnd
                      ? `The current subscription period ends ${nextBillingDate}.`
                      : providerConfigured
                        ? "Choose a paid plan to open secure Stripe checkout."
                        : "Contact sales to enable card collection and subscription billing."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/app/settings/checkout?plan=pro_monthly&discount=auto">
                <Button>Upgrade Plan</Button>
              </Link>
              <a href="mailto:sales@useclevr.com">
                <Button variant="outline" className="bg-transparent">
                  Cancel Subscription
                </Button>
              </a>
            </div>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ReceiptText className="h-4 w-4" />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-hidden rounded-b-lg border-t border-border">
                  <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr] bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground">
                    <span>Invoice</span>
                    <span>Status</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No invoices yet.
                  </div>
                </div>
              </CardContent>
            </Card>

            {showPendingTopUp && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <LoaderCircle className="mt-0.5 h-5 w-5 animate-spin text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Payment received — credits are being confirmed.
                    </p>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                      {pendingTopUp
                        ? `Your payment of ${pendingTopUp.amountMinor / 100} ${pendingTopUp.currency} via ${pendingTopUp.provider} has been received. Credits will appear in your account once the webhook is confirmed.`
                        : "Your payment has been received. Credits will appear in your account once the webhook is confirmed."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isUnlimited && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-foreground">Purchase Credit Top-Ups</h3>
                {creditPackages.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {creditPackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="rounded-lg border border-border bg-background p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-foreground">{pkg.name}</h4>
                          <span className="text-sm text-muted-foreground">
                            {pkg.monetaryAmountCents / 100} {pkg.currency}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {pkg.creditsGranted} credits · {pkg.pricingVersion}
                        </p>
                        {pkg.providers.stripe ? (
                          <CreditTopUpButton
                            key={pkg.id}
                            packageId={pkg.id}
                            provider="stripe"
                            disabled={!session?.user?.id}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No credit top-up packages are currently available.
                  </p>
                )}
              </div>
            )}

            {completedTopUps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground">Credit Top-Up History</h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.8fr] bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                    <span>Date</span>
                    <span>Provider</span>
                    <span>Amount</span>
                    <span>Credits</span>
                    <span className="text-right">Status</span>
                  </div>
                  <div className="divide-y divide-border">
                    {completedTopUps.map((t) => (
                      <div key={t.id} className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.8fr] items-center px-4 py-3 text-sm">
                        <span className="text-foreground">
                          {new Date(t.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="capitalize">{t.provider}</span>
                        <span className="text-muted-foreground">
                          {t.amountMinor / 100} {t.currency}
                        </span>
                        <span className="text-foreground">{t.creditsGranted.toLocaleString()}</span>
                        <span className="text-right">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-300">
                            Paid
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Payment reference: {completedTopUps[0].providerPaymentId}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "usage" && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Monthly Credits" value={isUnlimited ? "Unlimited" : String(usage.total)} />
              <MetricCard label="Credits Used" value={isUnlimited ? "0" : String(usage.analysisCount)} />
              <MetricCard label="Credits Reserved" value={isUnlimited ? "0" : String(usage.reservedCredits)} />
              <MetricCard label="Credits Available" value={isUnlimited ? usage.unlimitedLabel || "Unlimited" : String(remaining)} />
              <MetricCard label="Token Usage" value="Calculated per AI request" />
              <MetricCard label="Estimated AI Cost" value="Tracked by provider usage" />
              <MetricCard label="Monthly Reset Date" value="Monthly billing reset" />
            </div>

            <div className="rounded-lg border border-border bg-background p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-800 dark:text-cyan-100" />
                <h2 className="text-base font-semibold text-foreground">Usage History</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Dataset usage currently shows {datasetCount} uploaded {datasetCount === 1 ? "dataset" : "datasets"}.
                AI request history appears in AI Activity when provider audit logging is available for your plan.
              </p>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground">Upgrade Recommendation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {usage.limitReached
                  ? "You have used the included credits for this plan. Upgrade to continue analysis."
                  : "Your current plan has enough credits for normal usage."}
              </p>
              {!isUnlimited && (
                <Link href="/app/settings/checkout?plan=pro_monthly&discount=auto" className="mt-3 inline-block">
                  <Button size="sm">Upgrade</Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {activeTab === "terms" && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <PolicyCard title="Terms" description="UseClevr service terms and acceptable use." href="/terms" />
              <PolicyCard title="Privacy" description="Data handling, AI processing, cookies, and user rights." href="/privacy" />
              <PolicyCard title="Billing Policy" description="Subscription billing, payment handling, invoices, and renewals." href="/terms" />
              <PolicyCard title="Refund Policy" description="Refund requests are handled case by case through support." href="/terms" />
            </div>
            <div className="rounded-lg border border-border bg-background p-5">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Subscription Rules</h2>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Free plan usage is limited by included datasets and AI credits.</li>
                <li>Paid subscriptions renew monthly unless cancelled before renewal.</li>
                <li>Plan access changes after checkout and payment confirmation.</li>
                <li>Invoices and payment receipts are handled through the payment provider.</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PolicyCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="block">
      <div className="h-full rounded-lg border border-border bg-background p-5 transition hover:border-primary/40 hover:bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <p className="font-semibold text-foreground">{title}</p>
          <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
