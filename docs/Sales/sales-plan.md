# Sales Plan — UseClevr

Structured sales approach aligned with the [stage plan](Project_Management/stage-plan.md), [PRINCE2 themes](Prince2/prince2-approach.md), and current product capability.

## Objectives

- Convert free users to Pro and Business plans through product-led activation.
- Enable repeatable demo and discovery conversations for outbound sales.
- Build sales materials that accurately represent current capability without overpromising.

## Target Segments

| Segment | Primary Pain | Sales Approach |
|---------|-------------|----------------|
| Startup founders (pre-seed to Series A) | No BI resources, need investor-ready reports | Product-led: upload → ask → export. Demo: SaaS dataset + investor report export. |
| SME owners (10–50 employees) | Spreadsheet chaos, need business health overview | Guided: Business Profile setup + Accountancy overview + recurring analysis. |
| Consultants and agencies | Need client-ready analysis from client data | Data-safe demo: upload client-like data, export branded reports, show multi-provider re-run. |
| E-commerce operators | Sales and margin tracking from platform exports | Quick-start: upload platform CSV → AI computes revenue, costs, margins by product/region. |
| Accountancy-adjacent users | Pre-accountancy data organisation before advisor review | Accountancy readiness: upload + Business Profile + tax context → organised output for accountant. |

## Sales Stages (Inspired by PRINCE2)

### Stage 1: Awareness
- Content marketing (LinkedIn posts, use case examples, founder stories)
- Website with clear value proposition and pricing
- Public FAQ and help chat for self-service questions

### Stage 2: Activation
- Signup flow with demo account option
- Upload guidance and suggested first actions
- Setup progress panel to guide onboarding

### Stage 3: Conversion
- Checkout review with clear plan comparison
- Upgrade prompts when free credits run out
- Business Profile completeness as conversion driver

### Stage 4: Retention
- Regular analysis reports and email summaries
- Accountancy readiness as recurring engagement hook
- AI trace history and re-run for continued value

## Sales Channels

| Channel | Focus | Measurement |
|---------|-------|-------------|
| Website (product-led) | Self-service signup, upload, conversion | Signup rate, first upload rate, conversion rate |
| LinkedIn | Founder/SME content, use case posts, demo CTAs | Engagement, click-through, signup attribution |
| Direct outreach | Targeted founder and SME lists | Meeting rate, demo-to-signup conversion |
| Partner referrals | Accountants, accelerators, co-working spaces | Referral source tracking, partner commissions |
| Product-led onboarding | In-app guidance, progress tracking, AI suggestions | Setup completion rate, time to first analysis |

## Objection Handling

Common objections and responses:

| Objection | Response |
|-----------|----------|
| "I can do this in Excel." | "Excel shows numbers. UseClevr shows what they mean — AI tells you which product drives profit, which region underperforms, and what to do next." |
| "ChatGPT can analyse my data." | "ChatGPT gives generic answers. UseClevr computes KPIs from your actual dataset and shows the numbers behind every answer." |
| "I need an accountant, not software." | "UseClevr organises your data before the accountant sees it. Upload → Business Profile → Accountancy readiness saves hours of prep." |
| "My data is sensitive." | "AI receives only aggregated metrics, never raw rows. Data stays in EU/GDPR-compliant Neon PostgreSQL. Hybrid AI option processes locally." |
| "I'm not technical." | "Upload CSV. Ask in plain English. Get answers. No SQL, no dashboards, no setup." |

## Metrics

| Metric | Target | Source |
|--------|--------|--------|
| Signup-to-first-upload rate | >40% | Activity tracking |
| First-upload-to-AI-question rate | >60% | AI trace log |
| Free-to-paid conversion | >5% | Stripe billing |
| Demo-to-signup rate (outbound) | >20% | Sales tracking |
| Monthly active users (MAU) | TBD | Session tracking |
| NPS or satisfaction score | TBD | In-app survey |

## Related

- [Stage plan](Project_Management/stage-plan.md) — phased delivery with stage gates
- [PRINCE2 approach](Prince2/prince2-approach.md) — PRINCE2 themes and principles applied
- [Marketing plan](Marketing/marketing-plan.md) — campaign planning and funnel measurement
- [Demo scripts](demo-scripts.md) — demo walkthroughs per persona
- [Risk register](Project_Management/risk-register.md) — sales-related risks tracked
