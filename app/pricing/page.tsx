import { CheckoutButton } from "@/components/checkout-form"
import { PublicFooter } from "@/components/public-footer"
import { PublicHeader } from "@/components/public-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="container mx-auto px-4 md:px-6 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-3">Choose your plan</h1>
              <p className="text-base text-muted-foreground mb-4">
                Start free and scale as you grow. No hidden fees, cancel anytime.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-[#06B6D4]">
                  <Check className="h-4 w-4" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2 text-[#06B6D4]">
                  <Check className="h-4 w-4" />
                  <span>No credit card required</span>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 relative">
              {/* Free Tier */}
              <Card className="p-6 space-y-4 bg-card border-border/50">
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
              <Card className="p-6 space-y-4 border-2 border-[#7C3AED]/50 bg-card relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-[#7C3AED] text-white text-xs font-medium px-3 py-1 rounded-full">Most popular</div>
                </div>
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#7C3AED]/20 to-[#06B6D4]/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-[#06B6D4]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Pro</h3>
                    <p className="text-sm text-muted-foreground">For professionals & teams</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] bg-clip-text text-transparent">
                      €29
                    </span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Billed monthly or €290/year <span className="text-[#06B6D4]">(save 17%)</span>
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
                    <Brain className="h-4 w-4 text-[#A78BFA]" />
                    <span className="text-sm font-medium text-[#A78BFA]">Includes Hybrid AI Lite</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hybrid AI Standard available as add-on
                  </p>
                </div>

                <CheckoutButton
                  productId="pro_monthly"
                  className="w-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:opacity-90 text-white font-medium text-sm"
                >
                  Start free trial →
                </CheckoutButton>
              </Card>

              {/* Business / Custom Tier */}
              <Card className="p-6 space-y-4 bg-card border-border/50">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Business / Custom</h3>
                    <p className="text-sm text-muted-foreground">For large organizations</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">Custom</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Volume-based pricing</p>
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
                    <Brain className="h-4 w-4 text-[#A78BFA]" />
                    <span className="text-sm font-medium text-[#A78BFA]">Includes Hybrid AI Standard</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hybrid AI MEGA / private deployment available on request
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
              <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <Card className="p-4 bg-card border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-5 w-5 text-cyan-400" />
                    <h3 className="font-semibold text-foreground">Lite</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">For normal laptops</p>
                  <p className="text-xs text-cyan-400 mt-2">~2GB download</p>
                </Card>
                <Card className="p-4 bg-card border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-5 w-5 text-purple-400" />
                    <h3 className="font-semibold text-foreground">Standard</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">For stronger devices</p>
                  <p className="text-xs text-purple-400 mt-2">~5GB download</p>
                </Card>
                <Card className="p-4 bg-card border border-gray-500/20 opacity-70">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="h-5 w-5 text-gray-400" />
                    <h3 className="font-semibold text-foreground">MEGA</h3>
                    <span className="text-xs bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded">Soon</span>
                  </div>
                  <p className="text-sm text-muted-foreground">For high-performance systems</p>
                  <p className="text-xs text-gray-400 mt-2">~15GB download</p>
                </Card>
              </div>
            </div>

            <div className="mt-12">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Frequently asked questions</h2>
              <div className="grid gap-4 max-w-3xl mx-auto">
                <Card className="p-6 bg-card border-border/50">
                  <h3 className="text-base font-semibold mb-2">Can I change plans later?</h3>
                  <p className="text-sm text-muted-foreground">
                    Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                  </p>
                </Card>
                <Card className="p-6 bg-card border-border/50">
                  <h3 className="text-base font-semibold mb-2">What payment methods do you accept?</h3>
                  <p className="text-sm text-muted-foreground">
                    We accept all major credit cards, PayPal, and wire transfers for Enterprise plans.
                  </p>
                </Card>
                <Card className="p-6 bg-card border-border/50">
                  <h3 className="text-base font-semibold mb-2">Is there a free trial for Pro?</h3>
                  <p className="text-sm text-muted-foreground">
                    Yes, all new Pro subscribers get a 14-day free trial. No credit card required to start.
                  </p>
                </Card>
                <Card className="p-6 bg-card border-border/50">
                  <h3 className="text-base font-semibold mb-2">What happens to my data if I cancel?</h3>
                  <p className="text-sm text-muted-foreground">
                    Your data is retained for 30 days after cancellation. You can export it anytime or request permanent
                    deletion.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
