"use client"

import { Card } from "@/components/ui/card"
import { Bot, CheckCircle2, FileSpreadsheet, Sparkles, Upload } from "lucide-react"

type UseClevrHeroDemoProps = {
  id?: string
  className?: string
  layout?: "landing" | "auth"
}

export function UseClevrHeroDemo({ id, className = "", layout = "landing" }: UseClevrHeroDemoProps) {
  const demoGridClass =
    layout === "auth"
      ? "grid gap-3 md:gap-4 xl:grid-cols-[0.92fr_1.08fr]"
      : "grid gap-4 lg:grid-cols-[0.92fr_1.08fr]"

  const cardPadding = layout === "auth" ? "p-3 md:p-4" : "p-4 md:p-6"
  const stageHeightClass = layout === "auth"
    ? "min-h-[280px] rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:min-h-[300px]"
    : "min-h-[360px] rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:min-h-[390px]"

  return (
    <Card
      id={id}
      className={[
        "relative overflow-hidden border-white/10 bg-slate-950 text-left text-white shadow-2xl shadow-cyan-950/20 backdrop-blur",
        cardPadding,
        className,
      ].filter(Boolean).join(" ")}
    >
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

        <div className={demoGridClass}>
          <div className={`hero-demo-stage ${stageHeightClass}`}>
            <div className="hero-demo-panel hero-demo-panel-pain">
              <div className={`rounded-lg border border-[#A78BFA]/35 bg-slate-950/85 ${layout === "auth" ? "p-4" : "p-5"} shadow-2xl shadow-[#7C3AED]/20 backdrop-blur`}>
                <div className={`mb-${layout === "auth" ? "3" : "4"} inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 ${layout === "auth" ? "px-2.5 py-0.5" : "px-3 py-1"} text-xs font-medium text-cyan-100`}>
                  <Sparkles className="h-3.5 w-3.5 text-[#C4B5FD]" />
                  Spreadsheet answer gap
                </div>
                <h2 className={`text-${layout === "auth" ? "xl" : "2xl"} font-semibold leading-tight text-white sm:text-${layout === "auth" ? "xl" : "3xl"}`}>
                  How many hours did you spend searching for answers in spreadsheets this month?
                </h2>
                <p className={`mt-${layout === "auth" ? "3" : "4"} max-w-md text-sm leading-6 text-slate-300`}>
                  Most businesses already have the data. The problem is finding the answers fast enough.
                </p>
              </div>
            </div>

            <div className="hero-demo-panel hero-demo-panel-upload">
              <div className="rounded-lg border border-cyan-300/20 bg-slate-900/90 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-300/10">
                      <Upload className="h-4 w-4 text-cyan-200" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">sales_data.xlsx uploaded</p>
                      <p className="text-xs text-slate-300">CSV/Excel file detected.</p>
                    </div>
                  </div>
                  <FileSpreadsheet className="h-5 w-5 text-[#C4B5FD]" />
                </div>
                <div className="space-y-2">
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div className="hero-demo-progress h-1.5 rounded-full bg-gradient-to-r from-[#A78BFA] via-blue-400 to-cyan-300" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-xs text-slate-300">
                    <span>16 columns</span>
                    <span>24 months</span>
                    <span>5 segments</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-demo-panel hero-demo-panel-analysis">
              <div className="rounded-lg border border-[#A78BFA]/25 bg-[#7C3AED]/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#A78BFA]/15">
                    <Bot className="h-4 w-4 text-[#DDD6FE]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">AI is analyzing your data</p>
                    <p className="text-xs text-slate-300">Finding decision signals.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {["Reading columns", "Detecting KPIs", "Finding trends", "Identifying risks"].map((item) => (
                    <div key={item} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/35 px-2 py-1.5 text-xs text-slate-100">
                      <CheckCircle2 className="h-3 w-3 text-cyan-200" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hero-demo-panel hero-demo-panel-results">
              <div className="rounded-lg border border-cyan-300/25 bg-slate-900/90 p-4">
                <p className="mb-3 text-sm font-semibold text-white">AI found:</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {["Revenue upside", "Hidden risks", "Growth trends", "Next actions"].map((item) => (
                    <div key={item} className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs leading-snug text-slate-100">
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-[#C4B5FD]" />
                      <span className="min-w-0 text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hero-demo-panel hero-demo-panel-recommendation">
              <div className="rounded-lg border border-[#A78BFA]/30 bg-gradient-to-br from-[#7C3AED]/20 via-slate-900 to-cyan-400/10 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#DDD6FE]">Recommended next action:</p>
                <p className="text-lg font-semibold leading-snug text-white">
                  Focus on high-performing areas and review underperforming segments.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Prioritize winners", "Review risk", "Update forecast"].map((item) => (
                    <span key={item} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-xs font-medium text-cyan-100">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-900/80 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">AI-discovered growth trend</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Performance snapshot</h2>
              </div>
              <div className="rounded-full border border-[#A78BFA]/30 bg-[#7C3AED]/15 px-2.5 py-0.5 text-xs font-medium text-[#DDD6FE]">
                Opportunity
              </div>
            </div>

            <div className="relative h-48 overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 p-2">
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
              <div className="absolute bottom-2 left-2 rounded-lg border border-[#A78BFA]/25 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 backdrop-blur">
                <span className="font-semibold text-[#DDD6FE]">AI signal:</span> high-performing segment detected
              </div>
            </div>

            <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
                <p className="text-xs text-slate-400">Trend</p>
                <p className="mt-0.5 text-sm font-semibold text-white">Growing</p>
              </div>
              <div className="rounded-lg border border-[#A78BFA]/20 bg-[#7C3AED]/10 p-2">
                <p className="text-xs text-slate-300">Opportunity</p>
                <p className="mt-0.5 text-sm font-semibold text-white">Found</p>
              </div>
              <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-2">
                <p className="text-xs text-slate-300">Action</p>
                <p className="mt-0.5 text-sm font-semibold text-white">Prioritize</p>
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
  )
}
