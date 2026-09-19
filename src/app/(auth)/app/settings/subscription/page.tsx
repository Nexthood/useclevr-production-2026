import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";
import { getActiveCreditTopUpPackages } from "@/lib/billing/credit-packages";
import { CREDIT_TOP_UPS_SECTION_ID } from "@/lib/billing/credit-topup-navigation";
import { getSubscriptionIntervalForStripePriceId, getSubscriptionTierForStripePriceId } from "@/lib/billing/launch-pricing";
import { getBillingSettings } from "@/lib/billing/settings-store";
import Stripe from "stripe";
import { getCreditTopUpHistory } from "@/lib/billing/credit-topup-service";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { getActiveDatasetCount } from "@/lib/usage/dataset-limits";
import { syncSubscription } from "@/services/stripe/webhook";
import { retrieveStripeSubscription } from "@/services/stripe/checkout";
import { eq } from "drizzle-orm";
import { ArrowUpRight, CheckCircle, CreditCard, FileText, ReceiptText, ShieldCheck, Sparkles, LoaderCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreditTopUpButton } from "@/components/shared/credit-topup-button"
import { TopUpConfirmationPoller } from "@/components/billing/topup-confirmation-poller";
import { SubscriptionPlanSelector } from "@/components/billing/subscription-plan-selector";
import { SubscriptionCancelButton } from "@/components/billing/subscription-cancel-button";

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
  let profile = null;
  let datasetStats: { datasetCount: number; storageBytes: string } = { datasetCount: 0, storageBytes: "0" };

  if (db && session?.user?.id) {
    const [profileResult] = await Promise.all([
      db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
        columns: {
          stripeCustomerId: true,
          stripeCurrentPeriodEnd: true,
          stripePriceId: true,
          stripeStatus: true,
          subscriptionTier: true,
          stripeSubscriptionId: true,
        },
      }),
    ]);

    profile = profileResult;
    // Use canonical active dataset count matching Dataset Library definition
    datasetStats = { datasetCount: await getActiveDatasetCount(session.user.id), storageBytes: "0" };
  }

  // ----- Subscription recovery (idempotent) -----
  const recoveryLog = (event: string, data: Record<string, unknown> = {}) => {
    console.warn(`[SUBSCRIPTION_RECOVERY] ${event}`, data);
  };

  recoveryLog("started", { authenticated: Boolean(session?.user?.id), userId: session?.user?.id ?? null });
  recoveryLog("profile_state", {
    profile_loaded: Boolean(profile),
    subscriptionTier: profile?.subscriptionTier ?? null,
    storedSubscriptionId: Boolean(profile?.stripeSubscriptionId),
    storedCustomerId: Boolean(profile?.stripeCustomerId),
    stripeCustomerIdPresent: Boolean(profile?.stripeCustomerId),
  });

  if (!profile || profile.subscriptionTier === "free") {
    let recovered = false;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      recoveryLog("sync_failed", { reason: "Stripe not configured" });
    } else {
      const stripe = new Stripe(stripeKey, {});

      if (profile?.stripeSubscriptionId) {
        recoveryLog("stored_subscription_lookup", { found: true });
        try {
          const sub = await retrieveStripeSubscription(profile.stripeSubscriptionId);
          if (sub.status === "active" || sub.status === "trialing") {
            recoveryLog("active_subscription_found", { subscriptionId: sub.id, status: sub.status });
            const priceId = sub.items.data[0]?.price?.id;
            recoveryLog("price_id_found", { priceId: priceId ?? null });
            const tier = priceId ? getSubscriptionTierForStripePriceId(priceId) : null;
            recoveryLog("price_mapping_result", { priceId, tier: tier ?? "unmapped" });

            if (tier) {
              recoveryLog("sync_started", { source: "stored_subscription", tier });
              recoveryLog("sync_invoked", { subscriptionId: sub.id, stripeCustomerId: sub.customer });
              const syncResult = await syncSubscription(sub, "manual_subscription_sync", session?.user?.id ?? null);
              recoveryLog("sync_result", { synced: syncResult.synced, reason: syncResult.reason ?? null });
              if (syncResult.synced) {
                recoveryLog("sync_success", { tier });
                recovered = true;
              } else {
                recoveryLog("sync_failed", { reason: syncResult.reason });
              }
            } else {
              recoveryLog("sync_failed", { reason: "unknown_price_id" });
            }
          } else {
            recoveryLog("active_subscription_missing", { subscriptionId: sub.id, status: sub.status });
          }
        } catch (err) {
          recoveryLog("sync_failed", { source: "stored_subscription", reason: (err as Error).message });
        }
      } else {
        recoveryLog("stored_subscription_lookup", { found: false });
      }

      if (!recovered && profile?.stripeCustomerId) {
        recoveryLog("stored_customer_lookup", { found: true });
        try {
          const customer = await stripe.customers.retrieve(profile.stripeCustomerId);
          if (customer.deleted) {
            recoveryLog("active_subscription_missing", { customerId: customer.id, deleted: true });
          } else {
const subs = await stripe.subscriptions.list({
             customer: profile.stripeCustomerId,
           });
            const activeSub = subs.data.find(
              (s) => s.status === "active" || s.status === "trialing",
            );
            if (activeSub) {
              recoveryLog("active_subscription_found", { subscriptionId: activeSub.id, status: activeSub.status });
              const priceId = activeSub.items.data[0]?.price?.id;
              recoveryLog("price_id_found", { priceId: priceId ?? null });
              const tier = priceId ? getSubscriptionTierForStripePriceId(priceId) : null;
              recoveryLog("price_mapping_result", { priceId, tier: tier ?? "unmapped" });

              if (tier) {
                recoveryLog("sync_started", { source: "stored_customer", tier });
                const fullSub = await stripe.subscriptions.retrieve(activeSub.id);
                recoveryLog("sync_invoked", { subscriptionId: fullSub.id, stripeCustomerId: fullSub.customer });
                const syncResult = await syncSubscription(fullSub, "manual_subscription_sync", session?.user?.id ?? null);
                recoveryLog("sync_result", { synced: syncResult.synced, reason: syncResult.reason ?? null });
                if (syncResult.synced) {
                  recoveryLog("sync_success", { tier });
                  recovered = true;
                } else {
                  recoveryLog("sync_failed", { reason: syncResult.reason });
                }
              } else {
                recoveryLog("sync_failed", { reason: "unknown_price_id" });
              }
            } else {
              recoveryLog("active_subscription_missing", { customerId: customer.id });
            }
          }
        } catch (err) {
          recoveryLog("sync_failed", { source: "stored_customer", reason: (err as Error).message });
        }
      } else {
        recoveryLog("stored_customer_lookup", { found: false });
      }

      if (!recovered && !profile?.stripeCustomerId) {
        const userEmail = session?.user?.email ?? null;
        recoveryLog("email_customer_lookup", { found: Boolean(userEmail) });
        if (userEmail) {
          const normalizedEmail = userEmail.trim().toLowerCase();
          try {
            recoveryLog("email_customer_lookup", { strategy: "email_filter_first", email: userEmail });
            let matchedCustomers: Stripe.Customer[] = [];
            try {
              const emailFilterResult = await stripe.customers.list({ email: userEmail, limit: 1 });
              matchedCustomers = emailFilterResult.data;
              recoveryLog("email_customer_lookup", { strategy: "email_filter", matchCount: emailFilterResult.data.length });
            } catch {
              recoveryLog("email_customer_lookup", { strategy: "email_filter", result: "unsupported_fallback_to_pagination" });
            }
            if (matchedCustomers.length === 0) {
              recoveryLog("email_customer_lookup", { strategy: "pagination", reason: "email_filter_empty_starting_pagination" });
              let hasMore = true;
              let startingAfter: string | undefined;
              while (hasMore) {
                const page = await stripe.customers.list({ limit: 100, starting_after: startingAfter });
                const pageMatches = page.data.filter(
                  (c) => c.email?.trim().toLowerCase() === normalizedEmail,
                );
                matchedCustomers = matchedCustomers.concat(pageMatches);
                hasMore = page.has_more;
                if (page.data.length > 0) {
                  startingAfter = page.data[page.data.length - 1].id;
                } else {
                  hasMore = false;
                }
                if (matchedCustomers.length > 1) break;
              }
              recoveryLog("email_customer_lookup", { strategy: "pagination", matchCount: matchedCustomers.length });
            }
            if (matchedCustomers.length === 1) {
              const customer = matchedCustomers[0];
              recoveryLog("email_customer_lookup", { found: true, matchCount: 1, customerId: customer.id });
const subs = await stripe.subscriptions.list({
               customer: customer.id,
             });
              const activeSub = subs.data.find(
                (s) => s.status === "active" || s.status === "trialing",
              );
              if (activeSub) {
                recoveryLog("active_subscription_found", { subscriptionId: activeSub.id, status: activeSub.status });
                const priceId = activeSub.items.data[0]?.price?.id;
                recoveryLog("price_id_found", { priceId: priceId ?? null });
                const tier = priceId ? getSubscriptionTierForStripePriceId(priceId) : null;
                recoveryLog("price_mapping_result", { priceId, tier: tier ?? "unmapped" });

                if (tier) {
                  recoveryLog("sync_started", { source: "email_customer", tier });
                  const fullSub = await stripe.subscriptions.retrieve(activeSub.id);
                  recoveryLog("sync_invoked", { subscriptionId: fullSub.id, stripeCustomerId: fullSub.customer });
                  const syncResult = await syncSubscription(fullSub, "manual_subscription_sync", session?.user?.id ?? null);
                  recoveryLog("sync_result", { synced: syncResult.synced, reason: syncResult.reason ?? null });
                  if (syncResult.synced) {
                    recoveryLog("sync_success", { tier });
                    recovered = true;
                  } else {
                    recoveryLog("sync_failed", { reason: syncResult.reason });
                  }
                } else {
                  recoveryLog("sync_failed", { reason: "unknown_price_id" });
                }
              } else {
                recoveryLog("active_subscription_missing", { customerId: customer.id });
              }
            } else if (matchedCustomers.length > 1) {
              recoveryLog("email_customer_lookup", { found: false, matchCount: matchedCustomers.length, reason: "ambiguous" });
            } else {
              recoveryLog("email_customer_lookup", { found: false, matchCount: 0, reason: "customer_not_found" });
            }
          } catch (err) {
            recoveryLog("sync_failed", { source: "email_customer", reason: (err as Error).message });
          }
        }
      }

      if (session?.user?.id && db) {
        profile = await db.query.profiles.findFirst({
          where: eq(profiles.userId, session.user.id),
          columns: {
            stripeCustomerId: true,
            stripeCurrentPeriodEnd: true,
            stripePriceId: true,
            stripeStatus: true,
            subscriptionTier: true,
            stripeSubscriptionId: true,
          },
        });
      }

      recoveryLog("final_profile_state", {
        subscriptionTier: profile?.subscriptionTier ?? null,
        storedSubscriptionId: Boolean(profile?.stripeSubscriptionId),
        storedCustomerId: Boolean(profile?.stripeCustomerId),
        tierImmediatelyAfterDBUpdate: profile?.subscriptionTier ?? null,
        finalResolvedEntitlementTier: profile?.subscriptionTier ?? null,
        processPlanChangeResult: recovered ? "completed" : "not_triggered",
        recovered,
      });
    }
  }

  let cancelAtPeriodEnd = false;
  if (profile?.stripeSubscriptionId && profile?.subscriptionTier !== "free") {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {});
      const sub = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId);
      cancelAtPeriodEnd = sub.cancel_at_period_end;
    } catch (error) {
      console.warn("Failed to fetch subscription status for cancellation check:", error);
    }
  }

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
  // Credit top-ups are a paid-plan feature: Free accounts cannot purchase
  // them, and the server-side checkout gate enforces the same rule.
  const canPurchaseTopUps = tier === "pro" || tier === "business";
  const topUpHistory = session?.user?.id ? await getCreditTopUpHistory(session.user.id, 20) : [];
  const pendingTopUp = topUpHistory.find(
    (t) => t.status === "pending" || t.status === "duplicate" || t.status === "failed",
  );
  const completedTopUps = topUpHistory.filter((t) => t.status === "completed");
  const latestCompletedTopUp = completedTopUps.length > 0 ? completedTopUps[completedTopUps.length - 1] : null;
  const showTopUpConfirmation = showTopUpSuccess && latestCompletedTopUp;
  const showPendingTopUp = !latestCompletedTopUp && (showTopUpSuccess || Boolean(pendingTopUp));

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
              <MetricCard 
                label={cancelAtPeriodEnd ? "Access Until" : "Next Billing Date"} 
                value={nextBillingDate} 
              />
              <MetricCard label="Billing Cycle" value={billingCycle} />
              <MetricCard 
                label="Payment Status" 
                value={cancelAtPeriodEnd ? "Cancellation scheduled" : paymentStatus} 
              />
              <MetricCard label="Billing History" value={completedTopUps.length > 0 ? `${completedTopUps.length} credit purchase${completedTopUps.length === 1 ? "" : "s"}` : "No credit purchases yet"} />
            </div>

            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {providerConfigured ? "Subscription billing" : "Payment provider not configured"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {cancelAtPeriodEnd
                      ? `Your ${currentPlanLabel} subscription remains active until ${nextBillingDate} and will not renew.`
                      : profile?.stripeCurrentPeriodEnd
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
              <SubscriptionCancelButton
                planName={currentPlanLabel}
                currentPeriodEnd={profile?.stripeCurrentPeriodEnd ?? null}
                isCanceled={cancelAtPeriodEnd}
                stripeSubscriptionId={profile?.stripeSubscriptionId ?? null}
              />
            </div>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ReceiptText className="h-4 w-4" />
                  Subscription Invoices
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
                    No subscription invoices yet.
                  </div>
                </div>
              </CardContent>
            </Card>

            {showTopUpConfirmation && latestCompletedTopUp && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">
                      Credits added successfully
                    </p>
                    <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                      {latestCompletedTopUp.creditsGranted.toLocaleString()} purchased credits have been added to your UseClevr account.
                      Purchased credits are non-refundable and do not expire.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {showTopUpSuccess && <TopUpConfirmationPoller />}

            {showPendingTopUp && !showTopUpSuccess && (
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
              <div id={CREDIT_TOP_UPS_SECTION_ID} className="scroll-mt-24 space-y-4">
                <h3 className="text-base font-semibold text-foreground">Purchase Credit Top-Ups</h3>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p>
                    Purchased credits are non-refundable and do not expire. For billing questions, contact support.
                  </p>
                </div>
                {!canPurchaseTopUps ? (
                  <p className="text-sm text-muted-foreground">
                    Credit top-ups are available on the Pro and Business plans. Upgrade your plan to purchase additional credits.
                  </p>
                ) : creditPackages.length > 0 ? (
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

            {(completedTopUps.length > 0 || topUpHistory.some((t) => t.status === "refunded")) && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground">Credit Top-Up History</h3>
                <p className="text-sm text-muted-foreground">
                  Purchased credits are non-refundable and do not expire. For billing questions, contact support.
                </p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.8fr] bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                    <span>Date</span>
                    <span>Provider</span>
                    <span>Amount</span>
                    <span>Credits</span>
                    <span className="text-right">Status</span>
                  </div>
                  <div className="divide-y divide-border">
                    {[...topUpHistory]
                      .filter((t) => t.status === "completed" || t.status === "refunded")
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((t) => (
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
                          {t.status === "refunded" ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-700 dark:text-red-300">
                              Refunded
                            </span>
                          ) : (t.metadata as Record<string, unknown> | null)?.partiallyRefunded ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">
                              Partially Refunded
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-300">
                              Completed
                            </span>
                          )}
                        </span>
                      </div>
                     ))}
                   </div>
                 </div>
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
                <li>Purchased credit top-ups are non-refundable and do not expire.</li>
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
