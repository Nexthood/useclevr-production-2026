import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { PublicPricingPlans } from "@/components/billing/public-pricing-plans"
import { Check } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Subscription Plans | UseClevr",
  description: "UseClevr subscription plans and pricing for CSV and Excel analysis, business insights, retail dashboards, reports, and accounting AI.",
  keywords: ["subscription", "plans", "pricing", "billing", "data analysis"],
  openGraph: {
    title: "Subscription Plans | UseClevr",
    description: "UseClevr subscription plans and pricing for CSV and Excel analysis, business insights, retail dashboards, reports, and accounting AI.",
    url: "https://useclevr.com/subscription",
    siteName: "UseClevr",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Subscription Plans | UseClevr",
    description: "UseClevr subscription plans and pricing for CSV and Excel analysis, business insights, retail dashboards, reports, and accounting AI.",
  },
  robots: {
    index: true,
    follow: true,
  },
  canonical: "https://useclevr.com/subscription",
}

export default function SubscriptionPage() {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip">
      <PublicHeader />

      <main className="flex-1">
        <PublicPageHeader
          title="Subscription plans"
          description="Pick the UseClevr subscription that fits your business. Upgrade, downgrade, or cancel anytime."
          actions={
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-100">
                <Check className="h-4 w-4" />
                <span>Free plan included</span>
              </div>
              <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-100">
                <Check className="h-4 w-4" />
                <span>No credit card required</span>
              </div>
            </div>
          }
        />

        <section className="container mx-auto min-w-0 px-4 py-8 md:px-6">
          <div className="mx-auto max-w-6xl min-w-0">
            <PublicPricingPlans />

            <div className="mt-8 text-center">
              <Link href="/faq" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Questions about plans? Read the FAQ
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
