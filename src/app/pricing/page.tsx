import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getPricingFaqs } from "@/lib/content/faq"
import { Brain, Building2, Check, Cpu, Sparkles, Zap } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Pricing Plans - UseClevr | Free & Pro Tiers",
  description: "Simple, transparent pricing for teams of all sizes. Start free with 14-day trial. No credit card required. Scale as you grow.",
  keywords: ["pricing", "plans", "billing", "subscription", "data analysis"],
  openGraph: {
    title: "Pricing Plans - UseClevr",
    description: "Simple, transparent pricing for teams of all sizes. Start free with 14-day trial.",
    url: "https://useclevr.com/pricing",
    siteName: "UseClevr",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing Plans - UseClevr",
    description: "Simple, transparent pricing for teams of all sizes. Start free with 14-day trial.",
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
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="container mx-auto px-4 py-8 md:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-3">Choose your plan</h1>
              <p className="text-base text-muted-foreground mb-4">
                Start free and scale as you grow. No hidden fees, cancel anytime.
              </p>
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
            </div>

            <div className="relative grid gap-6 md:grid-cols-3">
              {/* Free Tier */}
              <Card className="space-y-4 border-border/50 bg-card p-6">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Free</h3>
                    <p className="text-sm text-muted-foreground">Perfect for exploring</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">€0</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Forever free</p>
                </div>

                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">1 dataset</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Up to 5,000 rows</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Limited AI questions</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Basic AI insights</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div className="text-sm font-medium">Community support</div>
                  </li>
                </ul>

                <div className="pt-2 border-t border-border/30">
                  <p className="text-xs text-muted-foreground">
                    Cloud only • Hybrid AI available on paid plans
                  </p>
                </div>

                 <Link href="/signup" className="block" prefetch={false}>
                  <Button
                    variant="outline"
                    className="w-full bg-transparent border-border/50 hover:bg-accent/5 text-sm"
                  >
                    Get started →
                  </Button>
                </Link>
              </Card>

              {/* Pro Tier - with Stripe checkout */}
              <Card className="relative space-y-4 border-2 border-[#7C3AED]/50 bg-card p-6">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-[#7C3AED] text-white text-xs font-medium px-3 py-1 rounded-full">Most popular</div>
                </div>
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#7C3AED]/20 to-[#06B6D4]/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-cyan-800 dark:text-cyan-100" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Pro</h3>
                    <p className="text-sm text-muted-foreground">For professionals & teams</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] bg-clip-text text-transparent">
                      €40
                    </span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Billed monthly or €400/year <span className="font-medium text-cyan-800 dark:text-cyan-100">(save 17%)</span>
                  </p>
                </div>

                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Unlimited datasets</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Advanced Clevr AI Analyst</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Natural language questions</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Fast insights from large CSV files</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Priority processing</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Email support</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">API access</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Unlimited Executive Report Downloads</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Export to PDF, PPT, DOCX & XLSX</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Branded Investor-Ready Reports</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Access to Download Center</div>
                    </div>
                  </li>
                </ul>

                <div className="pt-2 border-t border-[#7C3AED]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-primary dark:text-cyan-100" />
                    <span className="text-sm font-medium text-primary dark:text-cyan-100">Includes Hybrid AI Lite</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hybrid AI MEGA is included with Business.
                  </p>
                </div>

                <Link href="/signup" className="block" prefetch={false}>
                  <Button
                    size="sm"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-lg shadow-black/10 dark:shadow-black/30"
                  >
                    Start free trial →
                  </Button>
                </Link>
              </Card>

              {/* Business / Custom Tier */}
              <Card className="space-y-4 border-border/50 bg-card p-6">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Business / Custom</h3>
                    <p className="text-sm text-muted-foreground">For large organizations</p>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">€420</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Custom enterprise terms available</p>
                </div>

                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Custom limits</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Advanced security & compliance</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">On-premise or private deployment</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Custom integrations</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Dedicated support</div>
                    </div>
                  </li>
                </ul>

                <div className="pt-2 border-t border-[#7C3AED]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-primary dark:text-cyan-100" />
                    <span className="text-sm font-medium text-primary dark:text-cyan-100">Includes Hybrid AI MEGA</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Private deployment support is included.
                  </p>
                </div>

                <a href="mailto:sales@useclevr.com" className="block">
                  <Button
                    variant="outline"
                    className="w-full bg-transparent border-border/50 hover:bg-accent/5 text-sm"
                  >
                    Contact sales →
                  </Button>
                </a>
              </Card>
            </div>

            {/* Hybrid AI Modes Section */}
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-center mb-8">Hybrid AI Modes</h2>
              <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
                <Card className="p-4 bg-card border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                    <h3 className="font-semibold text-foreground">Lite</h3>
                    <span className="text-xs bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded dark:bg-slate-800 dark:text-slate-100">Pro</span>
                  </div>
                  <p className="text-sm text-muted-foreground">For normal laptops</p>
                  <p className="text-xs font-medium text-foreground mt-2">Included with Pro</p>
                </Card>
                <Card className="p-4 bg-card border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                    <h3 className="font-semibold text-foreground">MEGA</h3>
                    <span className="text-xs bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded dark:bg-emerald-950 dark:text-emerald-100">Business</span>
                  </div>
                  <p className="text-sm text-muted-foreground">For high-performance systems with Business support</p>
                  <p className="text-xs font-medium text-foreground mt-2">Included with Business</p>
                </Card>
              </div>
            </div>

            <div className="mt-12">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Frequently asked questions</h2>
              <div className="grid gap-4 max-w-3xl mx-auto">
                {pricingFaqs.map((item) => (
                  <Card key={item.q} className="p-6 bg-card border-border/50">
                    {item.tag && (
                      <span className="mb-3 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {item.tag}
                      </span>
                    )}
                    <h3 className="text-base font-semibold mb-2">{item.q}</h3>
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
