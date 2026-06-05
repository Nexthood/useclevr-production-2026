import { FaqAccordion } from "@/components/public/faq-accordion"
import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataProcessingFlow } from "@/components/ui/data-processing-flow"
import { WaitlistSignup } from "@/components/ui/waitlist-signup"
import { allFaqCategories, getHomepageFaqs } from "@/lib/content/faq"
import { getHomepageContent, getNewsPosts } from "@/lib/payload/content"
import { ArrowRight, BarChart3, Database, FileText, HelpCircle, MessageSquare, Newspaper, Shield, Sparkles, Zap } from "lucide-react"
import Link from "next/link"

const faqData = getHomepageFaqs()
const allFaqCount = allFaqCategories.reduce((n, c) => n + c.items.length, 0)

export default async function HomePage() {
  const homepageContent = await getHomepageContent()
  const latestNews = await getNewsPosts(3)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 md:px-6 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-800 dark:border-cyan-300/30 dark:text-cyan-100">
              <Sparkles className="h-4 w-4" />
              {homepageContent.heroBadge}
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance">
              {homepageContent.heroTitle}{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                {homepageContent.heroHighlight}
              </span>
            </h1>

            <div className="flex justify-center my-6">
              <div className="max-w-[700px] w-full">
                <DataProcessingFlow currentStep={0} variant="hero" />
              </div>
            </div>

            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              {homepageContent.heroDescription}
            </p>

            <p className="text-base font-medium text-foreground/80">
              {homepageContent.heroAudience}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
               <Link href="/signup" prefetch={false}>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 text-base rounded-full shadow-lg shadow-black/10 dark:shadow-black/30"
                >
                  {homepageContent.primaryCtaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
               <Link href="/contact" prefetch={false}>
                 <Button
                   size="lg"
                   variant="outline"
                   className="h-12 rounded-full border-border bg-transparent px-8 text-base hover:bg-slate-950 hover:text-white dark:hover:bg-white dark:hover:text-slate-950"
                 >
                   {homepageContent.secondaryCtaLabel}
                 </Button>
               </Link>
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

        <section className="container mx-auto px-4 py-6 md:px-6 md:py-10">
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-sm text-primary">
                  <Newspaper className="h-3.5 w-3.5" />
                  News
                </div>
                <h2 className="text-3xl font-bold md:text-4xl">{homepageContent.newsSectionTitle}</h2>
                <p className="max-w-2xl text-muted-foreground">{homepageContent.newsSectionDescription}</p>
              </div>
              <Link href="/news" prefetch={false}>
                <Button variant="outline" className="shrink-0 bg-transparent">
                  View all news
                </Button>
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {latestNews.map((post) => (
                <Card key={post.id} className="flex h-full flex-col border-border/60 p-6">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-foreground">{post.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {post.summary}
                  </p>
                  <Link
                    href={`/news/${post.slug}`}
                    prefetch={false}
                    className="mt-5 inline-flex items-center text-sm font-medium text-primary"
                  >
                    Read update
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Card>
              ))}
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
                  View all {allFaqCount} questions
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-20">
          <Card className="mx-auto max-w-4xl border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 p-8 text-center md:p-12">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Ready to unlock your data's potential?</h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
              Join teams using UseClevr to turn uploaded business data into clearer decisions.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/signup" prefetch={false}>
                <Button
                  size="lg"
                  className="h-12 rounded-full bg-primary px-8 text-base text-primary-foreground shadow-lg shadow-black/10 hover:bg-primary/90 dark:shadow-black/30"
                >
                  Start your free trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="mailto:sales@useclevr.com">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-border/50 bg-transparent px-8 text-base hover:bg-slate-950 hover:text-white dark:hover:bg-white dark:hover:text-slate-950"
                >
                  Contact sales
                </Button>
              </a>
            </div>
            <p className="mt-6 text-sm font-medium text-cyan-800 dark:text-cyan-100">No credit card required · 14-day free trial · Cancel anytime</p>
          </Card>
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
