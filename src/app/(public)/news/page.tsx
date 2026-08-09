import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { ArrowDown, ArrowRight, BarChart3, Brain, CheckCircle2, Database, LineChart, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp, Zap } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "What You're Missing - UseClevr",
  description:
    "Experience how UseClevr reveals hidden relationships, risks, and opportunities inside business data.",
}

const healthyMetrics = [
  { label: "Revenue", value: "+8%", tone: "text-[#A1EFEA]" },
  { label: "Orders", value: "+12%", tone: "text-[#A1EFEA]" },
  { label: "Customers", value: "+6%", tone: "text-[#A1EFEA]" },
  { label: "Inventory", value: "184K", tone: "text-[#F5F7FB]" },
  { label: "Margin", value: "31%", tone: "text-[#F5F7FB]" },
]

const contradictions = [
  {
    source: "Revenue",
    sourceValue: "+8%",
    hidden: "Margin",
    hiddenValue: "-4.7%",
    insight: "Growth is becoming less profitable.",
    position: "lg:left-[4%] lg:top-[8%]",
  },
  {
    source: "Orders",
    sourceValue: "+12%",
    hidden: "Average order value",
    hiddenValue: "-9%",
    insight: "More orders are carrying less value.",
    position: "lg:right-[4%] lg:top-[10%]",
  },
  {
    source: "Inventory",
    sourceValue: "184K value",
    hidden: "Dead stock",
    hiddenValue: "47K idle",
    insight: "Capital is trapped in slow-moving stock.",
    position: "lg:left-[4%] lg:bottom-[8%]",
  },
  {
    source: "Top-selling product",
    sourceValue: "velocity high",
    hidden: "Stockout risk",
    hiddenValue: "11 days",
    insight: "Demand is about to outrun availability.",
    position: "lg:right-[4%] lg:bottom-[8%]",
  },
]

const intelligenceStack = [
  { label: "Data", detail: "Uploaded files and business records", icon: Database },
  { label: "Understanding", detail: "Metric meaning, entities, relationships", icon: Brain },
  { label: "Evidence", detail: "Calculations, sources, confidence", icon: ShieldCheck },
  { label: "Insight", detail: "Risks, contradictions, opportunities", icon: Sparkles },
  { label: "Action", detail: "Recommended next business moves", icon: Target },
]

const innovationModules = [
  {
    status: "LIVE",
    title: "Hybrid AI",
    body: "Combines deterministic analytics with AI interpretation for grounded business answers.",
    icon: Zap,
  },
  {
    status: "LIVE",
    title: "EDIE AI Analyst",
    body: "Understands business questions and analyzes the underlying dataset context.",
    icon: Brain,
  },
  {
    status: "BETA",
    title: "Accuracy Engine",
    body: "Connects answers with confidence, evidence, and calculation sources.",
    icon: ShieldCheck,
  },
  {
    status: "LIVE",
    title: "Autonomous Insights",
    body: "Finds meaningful changes, risks, and opportunities without requiring the perfect question.",
    icon: LineChart,
  },
  {
    status: "IN DEVELOPMENT",
    title: "Vertical Intelligence",
    body: "Adds domain-specific analytical understanding for retail, finance, operations, and more.",
    icon: BarChart3,
  },
]

const actionSequence = [
  { label: "Detected", value: "Margin declined despite revenue growth." },
  { label: "Why it matters", value: "Growth is becoming less profitable." },
  { label: "Evidence", value: "Revenue +8% / Margin -4.7%" },
  { label: "Action", value: "Review discounting, acquisition cost, and product mix." },
]

export default function NewsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#080A14] text-[#F5F7FB]">
      <PublicHeader />
      <main className="flex-1 overflow-hidden">
        <section className="relative isolate border-b border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(196,181,253,0.16),transparent_32%),linear-gradient(180deg,#080A14_0%,#0D1020_58%,#080A14_100%)]">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(245,247,251,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(245,247,251,0.025)_1px,transparent_1px)] bg-[size:64px_64px]" />
          <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl content-center gap-12 px-4 py-20 md:px-6 lg:grid-cols-[0.9fr_1.35fr] lg:py-24">
            <div className="flex min-w-0 flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#A1EFEA]">What you&apos;re missing</p>
              <h1 className="mt-6 max-w-3xl text-3xl font-semibold leading-[1.02] tracking-tight text-[#F5F7FB] sm:text-4xl md:text-6xl md:leading-[0.98] lg:text-7xl">
                Your business is already telling you what&apos;s wrong.
              </h1>
              <p className="mt-5 text-2xl font-medium text-[#C4B5FD] md:text-3xl">You just can&apos;t see it yet.</p>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#AEB6C8] md:text-lg">
                Your dashboards show the numbers. UseClevr finds the relationships, risks and opportunities hiding between them.
              </p>
            </div>

            <div className="relative min-w-0" aria-label="Interactive hidden business insight visualization">
              <div className="missing-ambient absolute inset-0 rounded-[40px]" />
              <div className="relative mx-auto w-full max-w-[760px] rounded-[32px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_32px_120px_rgba(0,0,0,0.36)] backdrop-blur-xl md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8BE9E5]">01 / The numbers look healthy</p>
                    <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl md:text-3xl">The numbers look fine.</h2>
                  </div>
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#79E6E3]/25 bg-[#79E6E3]/10 px-3 py-1.5 text-xs font-semibold text-[#A1EFEA]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Dashboard view
                  </div>
                </div>

                <div className="grid min-w-0 gap-3 py-5 sm:grid-cols-5">
                  {healthyMetrics.map((metric, index) => (
                    <div
                      key={metric.label}
                      className="missing-metric rounded-2xl border border-white/10 bg-[#111426]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <p className="text-xs text-[#AEB6C8]">{metric.label}</p>
                      <p className={`mt-2 text-2xl font-semibold ${metric.tone}`}>{metric.value}</p>
                      <div className="mt-3 h-1 rounded-full bg-white/10">
                        <div className="missing-bar h-full rounded-full bg-gradient-to-r from-[#C4B5FD] via-[#8CB8FF] to-[#A1EFEA]" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative hidden min-h-[500px] overflow-hidden rounded-[28px] border border-white/10 bg-[#080A14]/80 p-5 lg:block">
                  <svg className="absolute inset-0 h-full w-full" role="presentation" aria-hidden="true">
                    <defs>
                      <linearGradient id="missingLine" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.16" />
                        <stop offset="50%" stopColor="#8CB8FF" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#A1EFEA" stopOpacity="0.72" />
                      </linearGradient>
                    </defs>
                    <path className="missing-line missing-line-one" d="M135 115 C260 165 430 154 585 112" />
                    <path className="missing-line missing-line-two" d="M605 150 C470 220 330 218 175 322" />
                    <path className="missing-line missing-line-three" d="M150 316 C275 256 438 265 590 304" />
                    <path className="missing-line missing-line-four" d="M600 310 C495 220 365 150 160 126" />
                  </svg>

                  <div className="absolute left-1/2 top-1/2 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#79E6E3]/25 bg-[#0D1020]/90 shadow-[0_0_70px_rgba(121,230,227,0.14),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <div className="missing-core absolute inset-3 rounded-full border border-[#C4B5FD]/20" />
                    <div className="text-center">
                      <Sparkles className="mx-auto h-7 w-7 text-[#A1EFEA]" />
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C4B5FD]">UseClevr</p>
                    </div>
                  </div>

                  {contradictions.map((item, index) => (
                    <div
                      key={item.source}
                      className={`missing-relationship group absolute w-48 rounded-2xl border border-white/10 bg-[#111426]/90 p-3.5 shadow-[0_18px_60px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#8BE9E5]/45 hover:shadow-[0_24px_70px_rgba(0,0,0,0.34),0_0_34px_rgba(121,230,227,0.12)] ${item.position}`}
                      style={{ animationDelay: `${700 + index * 180}ms` }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-[#AEB6C8]">{item.source}</p>
                          <p className="mt-1 text-lg font-semibold text-[#A1EFEA]">{item.sourceValue}</p>
                        </div>
                        <TrendingUp className="h-4 w-4 text-[#A1EFEA]" />
                      </div>
                      <div className="my-3 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#C4B5FD]">
                        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#C4B5FD]/40 to-[#A1EFEA]/50" />
                        but
                        <span className="h-px flex-1 bg-gradient-to-r from-[#A1EFEA]/50 via-[#C4B5FD]/40 to-transparent" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-[#AEB6C8]">{item.hidden}</p>
                          <p className="mt-1 text-lg font-semibold text-[#C4B5FD]">{item.hiddenValue}</p>
                        </div>
                        <TrendingDown className="h-4 w-4 text-[#C4B5FD]" />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-[#AEB6C8] opacity-80 group-hover:text-[#F5F7FB]">{item.insight}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:hidden">
                  {contradictions.map((item) => (
                    <div key={item.source} className="rounded-2xl border border-white/10 bg-[#080A14]/80 p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                        <div>
                          <p className="text-xs text-[#AEB6C8]">{item.source}</p>
                          <p className="mt-1 text-2xl font-semibold text-[#A1EFEA]">{item.sourceValue}</p>
                        </div>
                        <ArrowDown className="h-5 w-5 text-[#C4B5FD] sm:rotate-[-90deg]" />
                        <div>
                          <p className="text-xs text-[#AEB6C8]">{item.hidden}</p>
                          <p className="mt-1 text-2xl font-semibold text-[#C4B5FD]">{item.hiddenValue}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#AEB6C8]">{item.insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-b border-white/10 bg-[#0D1020] px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-5xl text-center">
            <p className="missing-reveal text-sm font-semibold uppercase tracking-[0.34em] text-[#8BE9E5]">The numbers were always there.</p>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-6xl">The insight wasn&apos;t.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#AEB6C8]">This is where UseClevr begins.</p>
          </div>
        </section>

        <section className="bg-[#080A14] px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#A1EFEA]">UseClevr moment</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                We built UseClevr for what dashboards don&apos;t tell you.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[#AEB6C8]">
                From raw business data to evidence-backed insights, risks and recommended actions.
              </p>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_32px_120px_rgba(0,0,0,0.3)] backdrop-blur-xl md:p-7">
              <div className="grid gap-3 md:grid-cols-5">
                {intelligenceStack.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="relative rounded-2xl border border-white/10 bg-[#111426]/90 p-4">
                      {index < intelligenceStack.length - 1 && (
                        <div className="absolute left-1/2 top-full hidden h-3 w-px bg-gradient-to-b from-[#A1EFEA]/70 to-transparent md:left-full md:top-1/2 md:block md:h-px md:w-3 md:bg-gradient-to-r" />
                      )}
                      <Icon className="h-5 w-5 text-[#A1EFEA]" />
                      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-white">{item.label}</p>
                      <p className="mt-3 text-xs leading-5 text-[#AEB6C8]">{item.detail}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0D1020] px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#A1EFEA]">Innovation layer</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">Intelligence that stays grounded in business evidence.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {innovationModules.map((module) => {
                const Icon = module.icon
                return (
                  <article key={module.title} className="rounded-2xl border border-white/10 bg-[#111426]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <Icon className="h-5 w-5 text-[#A1EFEA]" />
                      <span className="rounded-full border border-[#C4B5FD]/20 bg-[#C4B5FD]/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#C4B5FD]">
                        {module.status}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-white">{module.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#AEB6C8]">{module.body}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="bg-[radial-gradient(circle_at_50%_10%,rgba(121,230,227,0.12),transparent_28%),#080A14] px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#A1EFEA]">From insight to action</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">Data becomes context. Context becomes a decision.</h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-4">
              {actionSequence.map((item, index) => (
                <div key={item.label} className="relative rounded-2xl border border-white/10 bg-[#111426]/85 p-5">
                  {index < actionSequence.length - 1 && (
                    <ArrowRight className="absolute -right-5 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-[#A1EFEA]/60 md:block" />
                  )}
                  <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full border border-[#79E6E3]/25 bg-[#79E6E3]/10 text-sm font-semibold text-[#A1EFEA]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C4B5FD]">{item.label}</p>
                  <p className="mt-4 text-base leading-7 text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 flex justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full border border-[#79E6E3]/30 bg-[#79E6E3]/10 px-5 py-3 text-sm font-semibold text-[#F5F7FB] shadow-[0_18px_60px_rgba(121,230,227,0.12)] transition hover:border-[#A1EFEA]/60 hover:bg-[#79E6E3]/15"
              >
                Start finding hidden insight
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
