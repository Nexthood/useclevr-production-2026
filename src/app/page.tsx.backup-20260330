import Link from "next/link"
import { PublicHeader } from "@/components/public-header"
import { PublicFooter } from "@/components/public-footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles, Database, MessageSquare, Shield, Zap, BarChart3 } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 md:px-6 flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="max-w-5xl mx-auto text-center space-y-6 py-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/5 text-sm text-[#7C3AED] mb-4">
              <Sparkles className="h-4 w-4" />
              <span>Enterprise AI Data Platform</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance leading-tight">
              Transform data into{" "}
              <span className="bg-gradient-to-r from-[#7C3AED] via-[#A78BFA] to-[#06B6D4] bg-clip-text text-transparent">
                strategic intelligence
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground text-balance max-w-3xl mx-auto leading-relaxed">
              UseClevr helps professionals and teams turn CSV files into clear answers using AI — no SQL, no dashboards, no setup.
            </p>

            <p className="text-base text-muted-foreground">Trusted by data-driven organizations worldwide.</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-[#7C3AED] text-white hover:bg-[#7C3AED]/90 h-14 px-10 text-base rounded-full shadow-lg shadow-[#7C3AED]/20"
                >
                  Start free trial
                </Button>
              </Link>
              <a href="mailto:sales@useclevr.com">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-10 text-base border-border hover:bg-accent/5 rounded-full bg-transparent"
                >
                  Schedule demo
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#7C3AED]" />
                <span>SOC 2 aligned</span>
              </div>
              <span className="hidden md:inline">•</span>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#06B6D4]" />
                <span>GDPR compliant</span>
              </div>
              <span className="hidden md:inline">•</span>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#7C3AED]" />
                <span>99.9% uptime SLA</span>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/50 bg-primary/10 text-sm text-primary mb-4">
                Platform Capabilities
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Enterprise-grade data intelligence</h2>
              <p className="text-lg text-muted-foreground">Built for scale, security, and performance</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-8 space-y-4 bg-card border-border/50">
                <div className="h-16 w-16 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-[#7C3AED]" />
                </div>
                <h3 className="text-2xl font-bold">AI-Powered Insights</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Turn CSV files into clear answers using AI. Get instant insights without SQL, dashboards, or complex setup.
                </p>
              </Card>

              <Card className="p-8 space-y-4 bg-card border-border/50">
                <div className="h-16 w-16 rounded-2xl bg-[#06B6D4]/10 flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-[#06B6D4]" />
                </div>
                <h3 className="text-2xl font-bold">Natural Language Questions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Ask questions about your data in plain English. No technical jargon required — just real business value.
                </p>
              </Card>

              <Card className="p-8 space-y-4 bg-card border-border/50">
                <div className="h-16 w-16 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-[#7C3AED]" />
                </div>
                <h3 className="text-2xl font-bold">Fast Insights from Large Files</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Process large CSV files quickly with priority processing. Save time and get clarity instantly.
                </p>
              </Card>

              <Card className="p-8 space-y-4 bg-card border-border/50">
                <div className="h-16 w-16 rounded-2xl bg-[#06B6D4]/10 flex items-center justify-center">
                  <Database className="h-8 w-8 text-[#06B6D4]" />
                </div>
                <h3 className="text-2xl font-bold">Unlimited Datasets</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Upload and analyze as many CSV files as you need with our Pro plan. No limits on your data exploration.
                </p>
              </Card>

              <Card className="p-8 space-y-4 bg-card border-border/50">
                <div className="h-16 w-16 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-[#7C3AED]" />
                </div>
                <h3 className="text-2xl font-bold">Advanced Security</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Enterprise-grade security and compliance with on-premise or private deployment options for your sensitive data.
                </p>
              </Card>

              <Card className="p-8 space-y-4 bg-card border-border/50">
                <div className="h-16 w-16 rounded-2xl bg-[#06B6D4]/10 flex items-center justify-center">
                  <BarChart3 className="h-8 w-8 text-[#06B6D4]" />
                </div>
                <h3 className="text-2xl font-bold">API Access</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Integrate UseClevr into your workflow with API access. Build custom integrations tailored to your needs.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-balance">Ready to unlock your data's potential?</h2>
            <p className="text-lg text-muted-foreground">
              Join leading organizations using UseClevr to drive data-informed decisions
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-[#7C3AED] text-white hover:bg-[#7C3AED]/90 h-14 px-10 text-base rounded-full"
                >
                  Start your free trial
                </Button>
              </Link>
              <a href="mailto:sales@useclevr.com">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-10 text-base border-border/50 hover:bg-accent/5 bg-transparent rounded-full"
                >
                  Contact sales
                </Button>
              </a>
            </div>
            <p className="text-sm text-[#06B6D4]">No credit card required · 14-day free trial · Cancel anytime</p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
