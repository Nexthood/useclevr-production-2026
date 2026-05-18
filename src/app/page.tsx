import { DataProcessingFlow } from "@/components/ui/data-processing-flow"
import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { WaitlistSignup } from "@/components/ui/waitlist-signup"
import { BarChart3, Database, MessageSquare, Shield, Sparkles, Zap, ChevronDown, HelpCircle, FileText, Globe, CreditCard, Users, ZapIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"

const faqData = [
  {
    q: "How does UseClevr turn CSV data into answers?",
    a: "Upload a CSV file and ask questions in plain English. UseClevr's AI reads your table headers and data types, runs verified calculations (sum, average, top-N, group-by, etc.), and returns both the computed result and a plain-language explanation.",
  },
  {
    q: "Do I need SQL or data science skills?",
    a: "No. UseClevr translates natural language into structured queries and deterministic calculations. You only need to understand your own data — the platform handles the rest.",
  },
  {
    q: "Can I download reports?",
    a: "Yes. Pro and Business plans include PDF export and other downloadable report formats. Free users can explore insights in the dashboard without a download.",
  },
  {
    q: "Is my data secure?",
    a: "UseClevr is GDPR-compliant and aligned with SOC 2 principles. Uploaded datasets and generated reports are your property. We never train external models on your data.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support all major credit and debit cards through Stripe. Enterprise invoices are available on the Business plan.",
  },
  {
    q: "Can I upgrade, downgrade, or cancel anytime?",
    a: "Yes. Changes take effect at the start of the next billing cycle. You can manage your plan, see invoices, and update payment details from Settings → Billing.",
  },
  {
    q: "What is Hybrid AI Lite?",
    a: "Hybrid AI Lite runs lightweight AI analysis entirely in your browser using a local engine. Your data never leaves your device during analysis. It's available on Pro and above.",
  },
  {
    q: "Do you offer an API?",
    a: "Yes. UseClevr provides programmatic access for integrations. API tokens and rate limits are managed from the Settings page.",
  },
  {
    q: "How do I get a custom plan?",
    a: "For volume pricing, custom SLAs, or private deployment options, contact sales@useclevr.com or visit the Business plan options in Settings → Subscription.",
  },
  {
    q: "Which languages and currencies are supported?",
    a: "The platform is currently in English. Currency formatting supports EUR, GBP, and USD and can be changed per user in Preferences.",
  },
]

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIdx === i
        return (
          <div key={i} className="rounded-lg border border-border bg-background overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
            >
              <span className="text-sm font-medium text-foreground">{item.q}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
                {item.a}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 md:px-6 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="max-w-5xl mx-auto text-center space-y-6 py-12">

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance leading-tight">
              AI-powered business intelligence{" "}
              <span className="bg-gradient-to-r from-[#7C3AED] via-[#A78BFA] to-[#06B6D4] bg-clip-text text-transparent">
                without the complexity
              </span>
              <span className="text-[#7C3AED]">.</span>
            </h1>

            <div className="flex justify-center my-6">
              <div className="max-w-[700px] w-full">
                <DataProcessingFlow currentStep={0} variant="hero" />
              </div>
            </div>

            <p className="text-lg md:text-xl text-muted-foreground">
              Turn CSV data into executive reports and actionable business insights with AI.
            </p>

            <p className="text-base font-medium text-foreground/80">
              For founders, startup teams, and business operators who need fast answers from data.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
               <Link href="/signup" prefetch={false}>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-10 text-base rounded-full shadow-lg shadow-black/10 dark:shadow-black/30"
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
                <Shield className="h-4 w-4 text-cyan-800 dark:text-cyan-100" />
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
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Built for real business decisions</h2>
              <p className="text-lg text-muted-foreground">Generate actionable insights and downloadable executive reports in seconds.</p>
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
                  <MessageSquare className="h-8 w-8 text-cyan-800 dark:text-cyan-100" />
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
                <h3 className="text-2xl font-bold">Download Executive Reports</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Generate investor-ready PDF and presentation reports with one click. Structured, branded, and ready to share.
                </p>
              </Card>

              <Card className="p-8 space-y-4 bg-card border-border/50">
                <div className="h-16 w-16 rounded-2xl bg-[#06B6D4]/10 flex items-center justify-center">
                  <Database className="h-8 w-8 text-cyan-800 dark:text-cyan-100" />
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
                  <BarChart3 className="h-8 w-8 text-cyan-800 dark:text-cyan-100" />
                </div>
                <h3 className="text-2xl font-bold">API Access</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Integrate UseClevr into your workflow with API access. Build custom integrations tailored to your needs.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 md:px-6 py-20 border-t border-border/20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/50 bg-primary/10 text-sm text-primary mb-4">
                <HelpCircle className="h-3.5 w-3.5" />
                FAQ
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Frequently asked questions</h2>
              <p className="text-lg text-muted-foreground">
                Quick answers to common questions about UseClevr.
              </p>
            </div>
            <FaqAccordion items={faqData} />
            <div className="mt-8 text-center">
              <Link href="/faq" prefetch={false}>
                <Button variant="outline" className="gap-2 bg-transparent">
                  <FileText className="h-4 w-4" />
                  View all {faqData.length + 8}+ questions
                </Button>
              </Link>
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
               <Link href="/signup" prefetch={false}>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-10 text-base rounded-full shadow-lg shadow-black/10 dark:shadow-black/30"
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
            <p className="text-sm font-medium text-cyan-800 dark:text-cyan-100">No credit card required · 14-day free trial · Cancel anytime</p>
          </div>
        </section>

        {/* Waitlist Section - Before Footer */}
        <section className="container mx-auto px-4 md:px-6 py-16 border-t border-border/20">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Get product updates</h2>
            <p className="text-muted-foreground">
              Be the first to hear about new AI analysis features, reports, and launch updates.
            </p>
            <div className="flex justify-center pt-2">
              <WaitlistSignup source="landing_page" />
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
