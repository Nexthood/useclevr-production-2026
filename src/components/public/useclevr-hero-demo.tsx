"use client"

import { Card } from "@/components/ui/card"
import { Bot, CheckCircle2, FileSpreadsheet, Sparkles, Upload } from "lucide-react"

type UseClevrHeroDemoProps = {
  id?: string
  className?: string
  layout?: "landing" | "auth"
}

export function UseClevrHeroDemo({ id, className = "", layout = "landing" }: UseClevrHeroDemoProps) {
  const isAuth = layout === "auth"
  const demoGridClass =
    isAuth
      ? "grid gap-4 xl:grid-cols-[0.86fr_1.14fr]"
      : "grid gap-4 lg:grid-cols-[0.92fr_1.08fr]"

  const cardPadding = isAuth ? "w-full p-3 xl:p-6" : "p-4 md:p-6"
  const stageHeightClass = isAuth
    ? "min-h-[180px] rounded-lg border border-white/10 bg-white/[0.05] p-3 xl:min-h-[340px] xl:p-4"
    : "min-h-[360px] rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:min-h-[390px]"
  const headerIconClass = isAuth ? "h-10 w-10 rounded-lg" : "h-8 w-8 rounded-lg"
  const headerTitleClass = isAuth ? "text-sm" : "text-xs"
  const headerMetaClass = isAuth ? "text-xs" : "text-[10px]"
  const badgeClass = isAuth ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
  const stageCardPadding = isAuth ? "p-3 xl:p-4" : "p-2.5"
  const smallIconClass = isAuth ? "h-9 w-9" : "h-7 w-7"
  const smallIconSvgClass = isAuth ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"
  const panelTitleClass = isAuth ? "text-sm" : "text-xs"
  const panelMetaClass = isAuth ? "text-xs" : "text-[10px]"
  const chartCardPadding = isAuth ? "p-3 xl:p-5" : "p-3"
  const chartHeightClass = isAuth ? "h-36 xl:h-64" : "h-28"
  const metricCardPadding = isAuth ? "p-3" : "p-1.5"
  const chipClass = isAuth
    ? "rounded-full border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-slate-200 shadow-sm shadow-cyan-950/20 backdrop-blur"
    : "rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-300"

  return (
    <Card
      id={id}
      className={[
        "relative overflow-hidden border-white/10 bg-slate-950 text-left text-white shadow-2xl shadow-cyan-950/20 backdrop-blur",
        isAuth ? "border-cyan-300/[0.18] bg-slate-950/[0.92] shadow-[0_28px_90px_rgba(8,47,73,0.38)]" : "",
        cardPadding,
        className,
      ].filter(Boolean).join(" ")}
    >
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
      <div className="absolute inset-x-8 top-1 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className={isAuth ? "absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/[0.18] blur-3xl" : "absolute -right-10 -top-12 h-32 w-32 rounded-full bg-cyan-400/15 blur-2xl"} />
      <div className={isAuth ? "absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[#7C3AED]/[0.18] blur-3xl" : "absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-[#7C3AED]/15 blur-2xl"} />
      {isAuth ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_34%)]" /> : null}

      <div className={isAuth ? "relative space-y-4 xl:space-y-5" : "relative space-y-3"}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex ${headerIconClass} items-center justify-center border border-cyan-300/25 bg-cyan-300/10 shadow-inner shadow-white/10`}>
              <Bot className={isAuth ? "h-5 w-5 text-cyan-200" : "h-4 w-4 text-cyan-200"} />
            </div>
            <div>
              <p className={`${headerTitleClass} font-semibold text-white`}>UseClevr AI Analyst</p>
              <p className={`${headerMetaClass} text-slate-300`}>Self-running demo</p>
            </div>
          </div>
          <div className={`rounded-full border border-[#A78BFA]/30 bg-[#7C3AED]/15 ${badgeClass} font-medium text-[#DDD6FE] shadow-sm shadow-[#7C3AED]/10`}>
            Live analysis
          </div>
        </div>

        <div className={demoGridClass}>
          <div className={`hero-demo-stage ${stageHeightClass}`}>
            <div className="hero-demo-panel hero-demo-panel-pain">
              <div className={`rounded-lg border border-[#A78BFA]/35 bg-slate-950/85 ${isAuth ? "p-4 xl:p-5" : "p-5"} shadow-2xl shadow-[#7C3AED]/20 backdrop-blur`}>
                <div className={`mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 ${isAuth ? "px-3 py-1 xl:py-1.5" : "px-3 py-1"} text-xs font-medium text-cyan-100`}>
                  <Sparkles className={isAuth ? "h-3.5 w-3.5 text-[#C4B5FD]" : "h-3 w-3 text-[#C4B5FD]"} />
                  Spreadsheet answer gap
                </div>
                <h2 className={isAuth ? "text-base font-semibold leading-tight text-white xl:text-xl" : "text-2xl font-semibold leading-tight text-white sm:text-3xl"}>
                  How many hours did you spend searching for answers in spreadsheets this month?
                </h2>
                <p className={isAuth ? "mt-3 max-w-md text-xs leading-5 text-slate-300 xl:text-sm xl:leading-6" : "mt-2 max-w-md text-xs leading-5 text-slate-300"}>
                  Most businesses already have the data. The problem is finding the answers fast enough.
                </p>
              </div>
            </div>

            <div className="hero-demo-panel hero-demo-panel-upload">
              <div className={`rounded-lg border border-cyan-300/20 bg-slate-900/90 ${stageCardPadding} shadow-xl shadow-cyan-950/25`}>
                <div className="mb-3 flex items-center justify-between gap-3 xl:mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex ${smallIconClass} items-center justify-center rounded-lg bg-cyan-300/10`}>
                      <Upload className={`${smallIconSvgClass} text-cyan-200`} />
                    </div>
                    <div>
                      <p className={`${panelTitleClass} font-semibold text-white`}>sales_data.xlsx uploaded</p>
                      <p className={`${panelMetaClass} text-slate-300`}>CSV/Excel file detected.</p>
                    </div>
                  </div>
                  <FileSpreadsheet className={isAuth ? "h-5 w-5 text-[#C4B5FD]" : "h-4 w-4 text-[#C4B5FD]"} />
                </div>
                <div className={isAuth ? "space-y-2 xl:space-y-3" : "space-y-1.5"}>
                  <div className={isAuth ? "h-2 rounded-full bg-white/10" : "h-1 rounded-full bg-white/10"}>
                    <div className={`hero-demo-progress ${isAuth ? "h-2" : "h-1"} rounded-full bg-gradient-to-r from-[#A78BFA] via-blue-400 to-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.25)]`} />
                  </div>
                  <div className={isAuth ? "grid grid-cols-3 gap-2 text-xs text-slate-300" : "grid grid-cols-3 gap-1 text-[10px] text-slate-300"}>
                    <span>16 columns</span>
                    <span>24 months</span>
                    <span>5 segments</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-demo-panel hero-demo-panel-analysis">
              <div className={`rounded-lg border border-[#A78BFA]/25 bg-[#7C3AED]/10 ${stageCardPadding} shadow-xl shadow-[#7C3AED]/15`}>
                <div className="mb-3 flex items-center gap-3 xl:mb-4">
                  <div className={`flex ${smallIconClass} items-center justify-center rounded-lg bg-[#A78BFA]/15`}>
                    <Bot className={`${smallIconSvgClass} text-[#DDD6FE]`} />
                  </div>
                  <div>
                    <p className={`${panelTitleClass} font-semibold text-white`}>AI is analyzing your data</p>
                    <p className={`${panelMetaClass} text-slate-300`}>Finding decision signals.</p>
                  </div>
                </div>
                <div className={isAuth ? "space-y-1.5 xl:space-y-2" : "space-y-1"}>
                  {["Reading columns", "Detecting KPIs", "Finding trends", "Identifying risks"].map((item) => (
                    <div key={item} className={isAuth ? "flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/35 px-3 py-1.5 text-xs text-slate-100 xl:py-2" : "flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/35 px-1.5 py-1 text-[10px] text-slate-100"}>
                      <CheckCircle2 className={isAuth ? "h-3.5 w-3.5 text-cyan-200" : "h-2.5 w-2.5 text-cyan-200"} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hero-demo-panel hero-demo-panel-results">
              <div className={`rounded-lg border border-cyan-300/25 bg-slate-900/90 ${stageCardPadding} shadow-xl shadow-cyan-950/25`}>
                <p className={isAuth ? "mb-3 text-sm font-semibold text-white" : "mb-2 text-xs font-semibold text-white"}>AI found:</p>
                <div className={isAuth ? "grid gap-2 sm:grid-cols-2" : "grid gap-1 sm:grid-cols-2"}>
                  {["Revenue upside", "Hidden risks", "Growth trends", "Next actions"].map((item) => (
                    <div key={item} className={`hero-insight-card flex min-w-0 items-center rounded-lg border border-white/10 bg-white/[0.04] leading-snug text-slate-100 ${isAuth ? "gap-2 px-3 py-2 text-xs xl:py-3" : "gap-1 px-2 py-1.5 text-[10px]"}`}>
                      <CheckCircle2 className={isAuth ? "h-3.5 w-3.5 shrink-0 text-[#C4B5FD]" : "h-2.5 w-2.5 shrink-0 text-[#C4B5FD]"} />
                      <span className={isAuth ? "min-w-0 text-xs" : "min-w-0 text-[10px]"}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hero-demo-panel hero-demo-panel-recommendation">
              <div className={`hero-action-card rounded-lg border border-[#A78BFA]/30 bg-gradient-to-br from-[#7C3AED]/20 via-slate-900 to-cyan-400/10 ${stageCardPadding} shadow-xl shadow-[#7C3AED]/20`}>
                <p className={isAuth ? "mb-2 text-xs font-medium uppercase tracking-wide text-[#DDD6FE]" : "mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#DDD6FE]"}>Recommended next action:</p>
                <p className={isAuth ? "text-base font-semibold leading-snug text-white xl:text-lg" : "text-sm font-semibold leading-snug text-white"}>
                  Focus on high-performing areas and review underperforming segments.
                </p>
                <div className={isAuth ? "mt-3 flex flex-wrap gap-2 xl:mt-4" : "mt-2 flex flex-wrap gap-1"}>
                  {["Prioritize winners", "Review risk", "Update forecast"].map((item) => (
                    <span key={item} className={isAuth ? "rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100" : "rounded-full border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-100"}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`rounded-lg border border-white/10 bg-slate-900/80 ${chartCardPadding} shadow-2xl shadow-cyan-950/20`}>
            <div className={isAuth ? "mb-3 flex items-start justify-between gap-3 xl:mb-4" : "mb-2 flex items-start justify-between gap-2"}>
              <div>
                <p className={isAuth ? "text-xs uppercase tracking-wide text-slate-400" : "text-[10px] uppercase tracking-wide text-slate-400"}>AI-discovered growth trend</p>
                <h2 className={isAuth ? "mt-1 text-xl font-semibold text-white xl:text-2xl" : "mt-0.5 text-sm font-semibold text-white"}>Performance snapshot</h2>
              </div>
              <div className={`rounded-full border border-[#A78BFA]/30 bg-[#7C3AED]/15 ${badgeClass} font-medium text-[#DDD6FE]`}>
                Opportunity
              </div>
            </div>

            <div className={`relative ${chartHeightClass} overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-950/70 ${isAuth ? "p-4 shadow-inner shadow-cyan-950/35" : "p-1.5"}`}>
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
              <div className={isAuth ? "hero-chart-signal absolute bottom-3 left-3 rounded-lg border border-[#A78BFA]/25 bg-slate-950/85 px-2.5 py-1.5 text-[10px] text-slate-200 shadow-lg shadow-[#7C3AED]/15 backdrop-blur xl:bottom-4 xl:left-4 xl:px-3 xl:py-2 xl:text-xs" : "absolute bottom-1 left-1 rounded-lg border border-[#A78BFA]/25 bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-slate-200 backdrop-blur"}>
                <span className="font-semibold text-[#DDD6FE]">AI signal:</span> high-performing segment
              </div>
            </div>

            <div className={isAuth ? "mt-3 grid gap-2 sm:grid-cols-3 xl:mt-4 xl:gap-3" : "mt-2 grid gap-1 sm:grid-cols-3"}>
              <div className={`rounded-lg border border-white/10 bg-white/[0.04] ${metricCardPadding}`}>
                <p className={isAuth ? "text-xs text-slate-400" : "text-[10px] text-slate-400"}>Trend</p>
                <p className={isAuth ? "mt-1 text-sm font-semibold text-white" : "mt-0.5 text-xs font-semibold text-white"}>Growing</p>
              </div>
              <div className={`hero-insight-card rounded-lg border border-[#A78BFA]/20 bg-[#7C3AED]/10 ${metricCardPadding}`}>
                <p className={isAuth ? "text-xs text-slate-300" : "text-[10px] text-slate-300"}>Opportunity</p>
                <p className={isAuth ? "mt-1 text-sm font-semibold text-white" : "mt-0.5 text-xs font-semibold text-white"}>Found</p>
              </div>
              <div className={`hero-action-card rounded-lg border border-cyan-300/20 bg-cyan-300/10 ${metricCardPadding}`}>
                <p className={isAuth ? "text-xs text-slate-300" : "text-[10px] text-slate-300"}>Action</p>
                <p className={isAuth ? "mt-1 text-sm font-semibold text-white" : "mt-0.5 text-xs font-semibold text-white"}>Prioritize</p>
              </div>
            </div>
          </div>
        </div>

        <div className={isAuth ? "flex flex-wrap justify-center gap-2.5 pr-40 xl:pr-0" : "flex flex-wrap justify-center gap-1.5"}>
          {["Retail & Inventory", "Investor Portfolio", "Finance", "Sales", "Operations"].map((chip, index) => (
            <span key={chip} className={`${chipClass} ${isAuth && index === 0 ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-cyan-950/30" : ""}`}>
              {chip}
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}
