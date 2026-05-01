import Link from "next/link"
import { auth } from "@/lib/auth"
import { PublicHeader } from "@/components/public-header"
import { PublicFooter } from "@/components/public-footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles, Users, Gift, TrendingUp, ArrowRight, Check } from "lucide-react"

export default async function AffiliatePage() {
  const session = await auth()
  const isLoggedIn = !!session

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 md:px-6 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-sm text-cyan-400">
              <Sparkles className="h-4 w-4" />
              Partner Program
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Earn rewards while{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                helping businesses
              </span>{" "}
              succeed
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Invite colleagues and clients to UseClevr. Earn credits, unlock premium features, and grow together with our affiliate program.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              {isLoggedIn ? (
                <Link href="/app/referral">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 h-12 px-8 text-base rounded-full"
                  >
                    Go to Referral Center
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                 <Link href="/signup" prefetch={false}>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 h-12 px-8 text-base rounded-full"
                  >
                    Start Referring
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-4 md:px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6 bg-card border-border/50 text-center">
                <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Invite</h3>
                <p className="text-muted-foreground">
                  Share your unique referral link with colleagues, clients, or anyone who needs business intelligence.
                </p>
              </Card>

              <Card className="p-6 bg-card border-border/50 text-center">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. They Convert</h3>
                <p className="text-muted-foreground">
                  When they sign up and upload their first dataset, you earn referral credits.
                </p>
              </Card>

              <Card className="p-6 bg-card border-border/50 text-center">
                <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                  <Gift className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Earn Rewards</h3>
                <p className="text-muted-foreground">
                  Unlock premium features, extended AI queries, and exclusive partner benefits.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Rewards */}
        <section className="container mx-auto px-4 md:px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">Earn while you refer</h2>
            <p className="text-muted-foreground text-center mb-12">
              The more you share, the more you earn. No limits.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border-cyan-500/20">
                <h3 className="text-xl font-semibold mb-4">Referral Rewards</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-cyan-400 mt-0.5" />
                    <span>5 AI query credits per successful referral</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-cyan-400 mt-0.5" />
                    <span>1 month of Pro features for you and your referral</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-cyan-400 mt-0.5" />
                    <span>Priority support access</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/20">
                <h3 className="text-xl font-semibold mb-4">Partner Benefits</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-purple-400 mt-0.5" />
                    <span>10+ referrals: Custom dashboard analytics</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-purple-400 mt-0.5" />
                    <span>25+ referrals: Early access to new features</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-purple-400 mt-0.5" />
                    <span>50+ referrals: Dedicated account manager</span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 md:px-6 py-20">
          <Card className="p-12 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 border-cyan-500/20 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to start earning?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join hundreds of UseClevr partners already earning rewards while helping businesses make better decisions.
            </p>
            {isLoggedIn ? (
              <Link href="/app/referral">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 h-12 px-8 text-base rounded-full"
                >
                  Go to Referral Center
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
             ) : (
               <Link href="/signup" prefetch={false}>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 h-12 px-8 text-base rounded-full"
                >
                  Get Your Referral Link
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </Card>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
