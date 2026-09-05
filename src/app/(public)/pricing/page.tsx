import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { PublicPricingPlans } from "@/components/billing/public-pricing-plans"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getPricingFaqs } from "@/lib/content/faq"
import { Check } from "lucide-react"
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

export default function PricingPage() {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip">
      <PublicHeader />

      <main className="flex-1">
        <PublicPageHeader
          title="Choose your plan"
          description="Simple pricing for business owners who want clear answers from CSV and Excel data."
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

            <div className="mt-12">
              <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">Frequently asked questions</h2>
              <div className="mx-auto grid max-w-3xl gap-4">
                {pricingFaqs.map((item) => (
                  <Card key={item.q} className="min-w-0 border-border/50 bg-card p-6">
                    {item.tag && (
                      <span className="mb-3 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {item.tag}
                      </span>
                    )}
                    <h3 className="mb-2 break-words text-base font-semibold">{item.q}</h3>
                    <p className="break-words text-sm text-muted-foreground">{item.a}</p>
                  </Card>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link href="/faq">
                  <Button variant="outline" className="h-auto min-h-11 whitespace-normal bg-transparent text-center leading-tight">View all FAQ</Button>
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
