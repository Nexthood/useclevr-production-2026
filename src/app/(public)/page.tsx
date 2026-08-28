import { FaqAccordion } from "@/components/public/faq-accordion"
import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { WaitlistSignup } from "@/components/ui/waitlist-signup"
import { allFaqCategories, getHomepageFaqs } from "@/lib/content/faq"
import { getHomepageContent, getNewsPosts } from "@/lib/payload/content"
import { ArrowRight, BarChart3, Bot, BriefcaseBusiness, Calculator, CheckCircle2, Database, FileSpreadsheet, FileText, HelpCircle, MessageSquare, Newspaper, Package, Shield, Sparkles, TrendingUp, Upload, Users, Zap } from "lucide-react"
import Link from "next/link"
import { unstable_cache } from "next/cache"

const faqData = getHomepageFaqs()
const allFaqCount = allFaqCategories.reduce((n, c) => n + c.items.length, 0)
const homepageCacheSeconds = 300

const getCachedHomepageContent = unstable_cache(
  () => getHomepageContent(),
  ["homepage-content"],
  { revalidate: homepageCacheSeconds },
)

const getCachedHomepageNews = unstable_cache(
  () => getNewsPosts(3),
  ["homepage-news", "limit-3"],
  { revalidate: homepageCacheSeconds },
)

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
    title: "Finance & Accounting",
    description: "Analyze revenue, costs, profit margins, cashflow, and monthly reports.",
    icon: Calculator,
  },
  {
    title: "Sales & Revenue Analysis",
    description: "Understand sales trends, customer performance, pipeline gaps, and growth areas.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Small Business Operations",
    description: "Turn messy spreadsheets into clear dashboards, KPIs, and action plans.",
    icon: Users,
  },
]

export default async function HomePage() {
  const [homepageContent, latestNews] = await Promise.all([
    getCachedHomepageContent(),
    getCachedHomepageNews(),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 py-16 md:px-6 md:py-20">
          <div className="absolute left-1/2 top-10 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute right-0 top-28 -z-10 h-80 w-80 rounded-full bg-[#7C3AED]/10 blur-3xl" />
          <div className="container mx-auto">
            <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.88fr_1.12fr]">
              <div className="space-y-8 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-800 shadow-sm shadow-cyan-950/5 dark:border-cyan-300/30 dark:text-cyan-100">
                  <Sparkles className="h-4 w-4" />
                  AI data analyst for business spreadsheets
                </div>

                <div className="space-y-5">
                  <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
                    Find the answers hiding inside your spreadsheets.
                  </h1>
                  <p className="mx-auto max-w-2xl text-xl text-muted-foreground lg:mx-0">
                    UseClevr analyzes CSV and Excel files, then surfaces insights, trends, risks, opportunities, recommendations, and dashboards for faster business decisions.
                  </p>
                  <p className="text-base font-medium text-foreground/80">
                    Built for founders, business owners, investors, finance teams, accountants, sales leaders, and operations managers.
                  </p>
                </div>

                <div className="flex flex-col justify-center gap-4 pt-2 sm:flex-row lg:justify-start">
                  <Link href="/signup" prefetch={false}>
                    <Button
                      size="lg"
                      className="h-12 rounded-full bg-primary px-8 text-base text-primary-foreground shadow-lg shadow-black/10 hover:bg-primary/90 dark:shadow-black/30"
                    >
                      Analyze your data
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/sample-report" prefetch={false}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-full border-border bg-transparent px-8 text-base hover:bg-slate-950 hover:text-white dark:hover:bg-white dark:hover:text-slate-950"
                    >
                      View sample report
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-sm text-muted-foreground md:gap-6 lg:justify-start">
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
                    <span>AI-guided answers</span>
                  </div>
                </div>
              </div>

              <Card id="ai-report-preview" className="relative overflow-hidden border-white/10 bg-slate-950 p-4 text-left text-white shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-6">
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
                <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#7C3AED]/15 blur-3xl" />

                <div className="relative space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10">
                        <Bot className="h-5 w-5 text-cyan-200" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">UseClevr AI Analyst</p>
                        <p className="text-xs text-slate-300">Self-running spreadsheet demo</p>
                      </div>
                    </div>
                    <div className="rounded-full border border-[#A78BFA]/30 bg-[#7C3AED]/15 px-3 py-1 text-xs font-medium text-[#DDD6FE]">
                      Live analysis
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                    <div className="hero-demo-stage min-h-[360px] rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:min-h-[390px]">
                      <div className="hero-demo-panel hero-demo-panel-pain">
                        <div className="rounded-lg border border-[#A78BFA]/35 bg-slate-950/85 p-5 shadow-2xl shadow-[#7C3AED]/20 backdrop-blur">
                          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                            <Sparkles className="h-3.5 w-3.5 text-[#C4B5FD]" />
                            Spreadsheet answer gap
                          </div>
                          <h2 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
                            How many hours did you spend searching for answers in spreadsheets this month?
                          </h2>
                          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                            Most businesses already have the data. The problem is finding the answers fast enough.
                          </p>
                        </div>
                      </div>

                      <div className="hero-demo-panel hero-demo-panel-upload">
                        <div className="rounded-lg border border-cyan-300/20 bg-slate-900/90 p-5">
                          <div className="mb-5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-300/10">
                                <Upload className="h-5 w-5 text-cyan-200" />
                              </div>
                              <div>
                                <p className="text-base font-semibold text-white">sales_data.xlsx uploaded</p>
                                <p className="text-sm text-slate-300">CSV/Excel file detected.</p>
                              </div>
                            </div>
                            <FileSpreadsheet className="h-6 w-6 text-[#C4B5FD]" />
                          </div>
                          <div className="space-y-3">
                            <div className="h-2 rounded-full bg-white/10">
                              <div className="hero-demo-progress h-2 rounded-full bg-gradient-to-r from-[#A78BFA] via-blue-400 to-cyan-300" />
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                              <span>16 columns</span>
                              <span>24 months</span>
                              <span>5 segments</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="hero-demo-panel hero-demo-panel-analysis">
                        <div className="rounded-lg border border-[#A78BFA]/25 bg-[#7C3AED]/10 p-5">
                          <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#A78BFA]/15">
                              <Bot className="h-5 w-5 text-[#DDD6FE]" />
                            </div>
                            <div>
                              <p className="text-base font-semibold text-white">AI is analyzing your data</p>
                              <p className="text-sm text-slate-300">Finding decision signals across rows, dates, and segments.</p>
                            </div>
                          </div>
                          <div className="space-y-2.5">
                            {["Reading columns", "Detecting KPIs", "Finding trends", "Identifying risks", "Generating recommendations"].map((item) => (
                              <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2 text-sm text-slate-100">
                                <CheckCircle2 className="h-4 w-4 text-cyan-200" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="hero-demo-panel hero-demo-panel-results">
                        <div className="rounded-lg border border-cyan-300/25 bg-slate-900/90 p-5">
                          <p className="mb-4 text-base font-semibold text-white">AI found:</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {["Revenue upside", "Hidden risks", "Growth trends", "Next actions"].map((item) => (
                              <div key={item} className="flex min-w-0 items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[13px] leading-snug text-slate-100">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#C4B5FD]" />
                                <span className="min-w-0 whitespace-normal">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="hero-demo-panel hero-demo-panel-recommendation">
                        <div className="rounded-lg border border-[#A78BFA]/30 bg-gradient-to-br from-[#7C3AED]/20 via-slate-900 to-cyan-400/10 p-5">
                          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[#DDD6FE]">Recommended next action:</p>
                          <p className="text-xl font-semibold leading-snug text-white">
                            Focus on high-performing areas and review underperforming segments.
                          </p>
                          <div className="mt-5 flex flex-wrap gap-2">
                            {["Prioritize winners", "Review risk", "Update forecast"].map((item) => (
                              <span key={item} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-slate-900/80 p-5">
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">AI-discovered growth trend</p>
                          <h2 className="mt-1 text-2xl font-semibold text-white">Performance snapshot</h2>
                        </div>
                        <div className="rounded-full border border-[#A78BFA]/30 bg-[#7C3AED]/15 px-3 py-1 text-xs font-medium text-[#DDD6FE]">
                          Opportunity
                        </div>
                      </div>

                      <div className="relative h-64 overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 p-3">
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
                        <svg className="relative h-full w-full" viewBox="0 0 420 220" role="img" aria-label="Animated growth trend chart with AI opportunity markers">
                          <defs>
                            <linearGradient id="heroAreaGradient" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.42" />
                              <stop offset="52%" stopColor="#60A5FA" stopOpacity="0.22" />
                              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.03" />
                            </linearGradient>
                            <linearGradient id="heroLineGradient" x1="0" x2="1" y1="0" y2="0">
                              <stop offset="0%" stopColor="#A78BFA" />
                              <stop offset="48%" stopColor="#60A5FA" />
                              <stop offset="100%" stopColor="#22D3EE" />
                            </linearGradient>
                          </defs>
                          <path className="hero-chart-area" d="M12 174 C54 168 72 142 108 146 C145 150 158 104 194 110 C230 116 238 82 272 86 C312 90 325 49 365 43 C389 39 402 32 410 24 L410 210 L12 210 Z" fill="url(#heroAreaGradient)" />
                          <path className="hero-chart-line" d="M12 174 C54 168 72 142 108 146 C145 150 158 104 194 110 C230 116 238 82 272 86 C312 90 325 49 365 43 C389 39 402 32 410 24" fill="none" stroke="url(#heroLineGradient)" strokeLinecap="round" strokeWidth="5" />
                          <g className="hero-chart-marker">
                            <circle cx="272" cy="86" r="8" fill="#7C3AED" opacity="0.9" />
                            <circle cx="272" cy="86" r="15" fill="none" stroke="#C4B5FD" strokeOpacity="0.45" strokeWidth="2" />
                          </g>
                          <g className="hero-chart-marker hero-chart-marker-late">
                            <circle cx="365" cy="43" r="8" fill="#22D3EE" opacity="0.95" />
                            <circle cx="365" cy="43" r="15" fill="none" stroke="#67E8F9" strokeOpacity="0.45" strokeWidth="2" />
                          </g>
                        </svg>
                        <div className="absolute bottom-4 left-4 rounded-lg border border-[#A78BFA]/25 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 backdrop-blur">
                          <span className="font-semibold text-[#DDD6FE]">AI signal:</span> high-performing segment detected
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                          <p className="text-xs text-slate-400">Trend</p>
                          <p className="mt-1 text-base font-semibold text-white">Growing</p>
                        </div>
                        <div className="rounded-lg border border-[#A78BFA]/20 bg-[#7C3AED]/10 p-3">
                          <p className="text-xs text-slate-300">Opportunity</p>
                          <p className="mt-1 text-base font-semibold text-white">Found</p>
                        </div>
                        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
                          <p className="text-xs text-slate-300">Action</p>
                          <p className="mt-1 text-base font-semibold text-white">Prioritize</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {["Retail & Inventory", "Investor Portfolio", "Finance", "Sales", "Operations"].map((chip) => (
                      <span key={chip} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
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
                   Turn CSV or Excel files into clear answers using AI. Get instant insights without SQL, dashboards, or complex setup.
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
                <h3 className="text-2xl font-bold">Retail Dashboard</h3>
                <p className="text-muted-foreground leading-relaxed">
                  See revenue, margin, low stock, and dead stock signals in a dashboard built for quick business decisions.
                </p>
              </Card>

              <Card className="p-8 space-y-4 bg-card border-border/50">
                <div className="h-16 w-16 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-[#7C3AED]" />
                </div>
                <h3 className="text-2xl font-bold">Reports & Exports</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Create PDF reports and Excel exports when your analysis is ready to share with your team or accountant.
                </p>
              </Card>

              <Card className="p-8 space-y-4 bg-card border-border/50">
                <div className="h-16 w-16 rounded-2xl bg-[#06B6D4]/10 flex items-center justify-center">
                  <BarChart3 className="h-8 w-8 text-cyan-800 dark:text-cyan-100" />
                </div>
                <h3 className="text-2xl font-bold">Accounting AI</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Prepare invoices, receipts, and business context for cleaner accounting workflows on Business.
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
                  Start with Free
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
            <p className="mt-6 text-sm font-medium text-cyan-800 dark:text-cyan-100">No credit card required · Free plan with limited AI credits · Upgrade anytime</p>
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
