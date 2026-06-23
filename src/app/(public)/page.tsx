import { FaqAccordion } from "@/components/public/faq-accordion"
import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { WaitlistSignup } from "@/components/ui/waitlist-signup"
import { allFaqCategories, getHomepageFaqs } from "@/lib/content/faq"
import { getHomepageContent, getNewsPosts } from "@/lib/payload/content"
import { ArrowRight, BarChart3, BriefcaseBusiness, Calculator, Database, FileText, HelpCircle, MessageSquare, Newspaper, Package, Shield, Sparkles, TrendingUp, Users, Zap } from "lucide-react"
import Link from "next/link"

const faqData = getHomepageFaqs()
const allFaqCount = allFaqCategories.reduce((n, c) => n + c.items.length, 0)

const useCases = [
  {
    title: "Retail & Inventory",
    description: "Find low-stock risks, dead stock, profit opportunities, and reorder needs.",
    icon: Package,
  },
  {
    title: "Investor Portfolio",
    description: "Track portfolio performance, weak assets, trends, risk signals, and growth opportunities.",
    icon: TrendingUp,
  },
  {
    title: "Accountancy & Finance",
    description: "Analyze revenue, costs, profit margins, cashflow, and monthly reports.",
    icon: Calculator,
  },
  {
    title: "Sales & Business Teams",
    description: "Understand sales trends, customer performance, pipeline gaps, and growth areas.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Founders & Small Businesses",
    description: "Turn messy spreadsheets into clear dashboards, KPIs, and action plans.",
    icon: Users,
  },
]

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
              Turn your business spreadsheets into clear AI insights.
            </h1>

            <div className="flex justify-center my-6">
              <Card id="ai-report-preview" className="w-full max-w-[700px] border-border/50 bg-card/80 p-6 text-left shadow-lg shadow-black/5 dark:shadow-black/20">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Sample analysis</p>
                    <h2 className="text-xl font-semibold text-foreground">Your AI Business Report</h2>
                  </div>
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                    <p className="text-muted-foreground">Revenue trend</p>
                    <p className="text-lg font-semibold text-foreground">+18%</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                    <p className="text-muted-foreground">Risk detected</p>
                    <p className="text-lg font-semibold text-foreground">3 weak-performing areas</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                    <p className="text-muted-foreground">Opportunity</p>
                    <p className="text-lg font-semibold text-foreground">7 high-margin segments</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                    <p className="text-muted-foreground">Suggested action</p>
                    <p className="text-lg font-semibold text-foreground">Reallocate resources</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium text-foreground">Top insight</p>
                  <p className="text-sm text-muted-foreground">Your best-performing category is not receiving enough focus.</p>
                  <p className="text-sm text-muted-foreground">Review underperforming areas and reallocate resources.</p>
                </div>
              </Card>
            </div>

            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Upload CSV or Excel files and let UseClevr analyze performance, risks, trends, opportunities, and key metrics across your business.
            </p>

            <p className="text-base font-medium text-foreground/80">
              Built for small businesses, retail teams, investors, finance users, and business managers.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
               <Link href="/signup" prefetch={false}>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 text-base rounded-full shadow-lg shadow-black/10 dark:shadow-black/30"
                >
                  Analyze your data
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
               <Link href="#ai-report-preview" prefetch={false}>
                 <Button
                   size="lg"
                   variant="outline"
                   className="h-12 rounded-full border-border bg-transparent px-8 text-base hover:bg-slate-950 hover:text-white dark:hover:bg-white dark:hover:text-slate-950"
                 >
                   View sample report
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

        <section className="container mx-auto px-4 py-16 md:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-sm text-primary">
                Use cases
              </div>
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">Analyze the spreadsheets that run your business</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                UseClevr turns CSV and Excel files into clear answers for teams that need fast decisions from business data.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              {useCases.map((item) => {
                const Icon = item.icon

                return (
                  <Card key={item.title} className="h-full border-border/50 bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </Card>
                )
              })}
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
