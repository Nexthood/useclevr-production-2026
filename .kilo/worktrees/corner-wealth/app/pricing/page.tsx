import { PublicHeader } from "@/components/public-header"
import { PublicFooter } from "@/components/public-footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, Sparkles, Zap, Building2 } from "lucide-react"
import Link from "next/link"
import { CheckoutButton } from "@/components/checkout-form"

export const metadata = {
  title: "Pricing - UseClevr",
  description: "Simple, transparent pricing for teams of all sizes",
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

                <Link href="/signup" className="block">
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
                      <div className="text-sm font-medium">Advanced AI assistant</div>
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
                </ul>

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
