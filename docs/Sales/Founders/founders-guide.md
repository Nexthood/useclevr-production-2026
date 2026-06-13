# Founder's Guide to UseClevr

UseClevr helps startup founders understand business performance, prepare for investor conversations, and make data-driven decisions — without building a BI stack or hiring a data analyst.

## Why UseClevr for Startups

| Challenge | UseClevr Answer |
| Challenge                                              | UseClevr Answer                                                                                             |
| -----------                                            | -----------------                                                                                           |
| Need to understand revenue trends but have no BI tools | Upload CSV → ask questions in plain English → get structured answers with computed metrics                  |
| Preparing for investor meetings                        | Export analysis as PDF reports with revenue breakdown, growth trends, and KPIs                              |
| Tracking unit economics                                | Upload sales data with revenue, cost, and quantity columns → AI computes margins, trends, and concentration |
| Limited time for analysis                              | Pre-computed KPIs (total revenue, profit margin, growth, top products/regions) visible instantly            |
| Multiple data sources                                  | Upload datasets per period or business line → AI Assistant keeps answers scoped to selected data            |
| Sensitive startup data                                 | Hybrid AI runs analysis on your device — data never leaves your machine                                     |

## Common Founder Use Cases

### Revenue Analysis

- Upload sales CSV with date, product, region, revenue, cost columns.
- Ask: "What is our total revenue?" "Which product generates the most?" "Show revenue trend over time."
- AI returns computed answers tied to your actual numbers, not generic estimates.

### Growth Tracking

- Track month-over-month or quarter-over-quarter growth.
- AI computes growth percentage and trend direction from your data.
- Easily include growth charts in investor updates.

### Investor Report Preparation

- Run analysis on your latest period's data.
- Download the computed report as PDF.
- Combine with Business Profile context (company name, industry, legal structure) for professional output.

### Cost and Margin Analysis

- Include cost columns in your dataset.
- AI computes profit margin per product, region, or overall.
- Identify which products or markets drive the most profit.

### Learn As You Go With AI

- Use AI history and feedback to see which questions produce useful answers.
- Turn repeated unclear answers into better prompts, FAQ updates, or support questions.
- Keep investor and founder analysis grounded in uploaded data, not generic advice.

## Getting Started Fast

1. **Upload data** — Export your CRM, accounting, or analytics data as CSV. Upload via the Upload page.
2. **Set up Business Profile** — Add company name, industry, legal structure. Improves report accuracy and investor-readiness.
3. **Ask questions** — Open AI Assistant, select your dataset, ask in plain language.
4. **Download reports** — Export analysis as PDF or CSV for sharing with co-founders, advisors, or investors.
5. **Track progress** — Use the topbar setup progress panel to track onboarding completeness.

## Example Founder Workflow

```
Week 1: Upload SaaS revenue CSV → Ask "What's our MRR?" → Get computed total
Week 2: Ask "Which customer segment drives most revenue?" → Identify focus area
Week 3: Add Business Profile → Download investor-ready PDF report
Week 4: Upload next month's data → Compare growth trends → Update investor pack
```

## Pricing for Startups

| Plan | Price | What You Get |
| Plan             | Price   | What You Get                                        |
| ------           | ------- | --------------                                      |
| Free             | $0      | Try upload and basic AI. 2 analyst credits.         |
| Pro Monthly      | $29/mo  | Unlimited questions, full AI, PDF report downloads. |
| Pro Annual       | $290/yr | Same as Pro Monthly, two months free.               |
| Business Monthly | $99/mo  | Business Profile, Accountancy, priority support.    |

Hybrid AI upgrade available for on-device analysis when working with sensitive startup data. Two tiers:

| Tier | Model | Size | Use Case |
| Tier           | Model                  | Size   | Use Case                                                      |
| ------         | -------                | ------ | ----------                                                    |
| Hybrid AI Lite | `llama3.2:3b-instruct` | ~2GB   | Daily Q&A, revenue checks, basic margin analysis              |
| Hybrid AI MEGA | `llama3:8b-instruct`   | ~5GB   | Deep dives, full reports, complex trend analysis, offline use |

**When to use Hybrid AI as a founder:**
- Your data contains customer PII, employee records, or financial details you don't want sent to cloud AI.
- You're working without internet (travel, cafés, on-site).
- You've exhausted your analyst credits and want unlimited local analysis.
- You want faster response times for routine questions (local models respond in 1-5s for simple queries).

## Project Controls — What Founders Should Know

UseClevr uses lightweight stage controls to keep product and sales aligned. This means:

| Control | What It Means for Founders |
| Control             | What It Means for Founders                                                                                                                                        |
| ---------           | ---------------------------                                                                                                                                       |
| Business case       | Every feature has a documented benefit and cost. The [business case](../Project_Management/business-case.md) shows what UseClevr delivers and why.                |
| Stage gates         | New capabilities go through defined stages before reaching users — quality checks before rollout.                                                                 |
| Risk register       | Known risks (data privacy, AI accuracy, regulated-advice boundaries) are tracked with responses. See the [risk register](../Project_Management/risk-register.md). |
| Lessons log         | Sales conversations, support tickets, and user feedback feed back into product improvement cycles.                                                                |
| Product description | [Clear boundaries](../Project_Management/project-product-description.md) on what UseClevr is — BI and decision support, not regulated advice.                     |

Founders reviewing UseClevr for their own use, investment due diligence, or partnership evaluation can rely on these controls as evidence of structured product management.

## Related

- [Sales one-pager](../sales-one-pager.md) — complete product overview
- [Demo scripts](../demo-scripts.md) — step-by-step demo walkthroughs
- [Business profile planning](../../Developer_Guides/business-profile-planning.md) — current and planned Business Profile scope
- [Project controls approach](../Project_Controls/project-controls-approach.md) — stage gates, quality reviews, risk management
- [Business case](../Project_Management/business-case.md) — cost-benefit analysis and justification
- [Risk register](../Project_Management/risk-register.md) — risk identification and response
