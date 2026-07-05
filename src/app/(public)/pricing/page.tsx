import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { billingPlans, formatPlanPrice, type BillingPlan } from "@/lib/billing/plans"
import { getPricingFaqs } from "@/lib/content/faq"
import { Building2, Check, Sparkles, Zap } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Pricing Plans | UseClevr",
  description: "Simple UseClevr pricing for CSV and Excel analysis, business insights, retail dashboards, reports, and accounting AI.",
  keywords: ["pricing", "plans", "billing", "subscription", "data analysis"],
  openGraph: {
    title: "Pricing Plans | UseClevr",
    description: "Simple UseClevr pricing for CSV and Excel analysis, business insights, retail dashboards, reports, and accounting AI.",
    url: "https://useclevr.com/pricing",
    siteName: "UseClevr",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing Plans | UseClevr",
    description: "Simple UseClevr pricing for CSV and Excel analysis, business insights, retail dashboards, reports, and accounting AI.",
  },
  robots: {
    index: true,
    follow: true,
  },
  canonical: "https://useclevr.com/pricing",
}

const pricingFaqs = getPricingFaqs()
const plans = billingPlans

const planIcon = {
  free: Sparkles,
  pro: Zap,
  business: Building2,
} as const

const checkoutHref: Record<BillingPlan["tier"], string> = {
  free: "/signup",
  pro: "/signup",
  business: "/app/settings/checkout?plan=business_monthly",
}

const ctaLabel: Record<BillingPlan["tier"], string> = {
  free: "Get Started",
  pro: "Start Free Trial",
  business: "Review Business",
}

function PricingCard({ plan }: { plan: BillingPlan }) {
  const Icon = planIcon[plan.tier]
  const isPro = plan.tier === "pro"

  return (
    <Card
      className={[
        "flex h-full flex-col space-y-5 border-border/50 bg-card p-6",
        isPro ? "relative border-2 border-primary/50 shadow-lg shadow-primary/10" : "",
      ].join(" ")}
    >
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            Most Popular
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="mb-1 text-xl font-bold">{plan.name}</h3>
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight">{formatPlanPrice(plan).replace("/month", "")}</span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>
      </div>

      <ul className="flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium">{feature}</span>
          </li>
        ))}
      </ul>

      <Link href={checkoutHref[plan.tier]} className="block" prefetch={false}>
        <Button
          variant={isPro ? "default" : "outline"}
          className={isPro ? "w-full" : "w-full bg-transparent"}
        >
          {ctaLabel[plan.tier]}
        </Button>
      </Link>
    </Card>
  )
}

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        <PublicPageHeader
          title="Choose your plan"
          description="Simple pricing for business owners who want clear answers from CSV and Excel data."
          actions={
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-100">
                <Check className="h-4 w-4" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-100">
                <Check className="h-4 w-4" />
                <span>No credit card required</span>
              </div>
            </div>
          }
        />

        <section className="container mx-auto px-4 py-8 md:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((plan) => (
                <PricingCard key={plan.id} plan={plan} />
              ))}
            </div>

            <div className="mt-12">
              <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">Frequently asked questions</h2>
              <div className="mx-auto grid max-w-3xl gap-4">
                {pricingFaqs.map((item) => (
                  <Card key={item.q} className="border-border/50 bg-card p-6">
                    {item.tag && (
                      <span className="mb-3 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {item.tag}
                      </span>
                    )}
                    <h3 className="mb-2 text-base font-semibold">{item.q}</h3>
                    <p className="text-sm text-muted-foreground">{item.a}</p>
                  </Card>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link href="/faq">
                  <Button variant="outline" className="bg-transparent">View all FAQ</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
