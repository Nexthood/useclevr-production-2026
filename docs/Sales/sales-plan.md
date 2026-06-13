# Sales Plan — UseClevr

Structured sales approach aligned with the [stage plan](Project_Management/stage-plan.md), [project controls](Project_Controls/project-controls-approach.md), and current product capability.

## Objectives

- Convert free users to Pro and Business plans through product-led activation.
- Enable repeatable demo and discovery conversations for outbound sales.
- Build sales materials that accurately represent current capability without overpromising.
- Drive Hybrid AI adoption as a privacy and cost differentiator for data-sensitive segments.

## Target Segments

| Segment | Primary Pain | Sales Approach |
| Segment                                 | Primary Pain                                            | Sales Approach                                                                                                               |
| ---------                               | -------------                                           | ----------------                                                                                                             |
| Startup founders (pre-seed to Series A) | No BI resources, need investor-ready reports            | Product-led: upload → ask → export. Demo: SaaS dataset + investor report export. Hybrid AI Lite for sensitive data.          |
| SME owners (10–50 employees)            | Spreadsheet chaos, need business health overview        | Guided: Business Profile setup + Accountancy overview + recurring analysis. Hybrid AI for offline/private use.               |
| Consultants and agencies                | Need client-ready analysis from client data             | Data-safe demo: upload client-like data, export branded reports, show multi-provider re-run. Hybrid AI MEGA as privacy sell. |
| E-commerce operators                    | Sales and margin tracking from platform exports         | Quick-start: upload platform CSV → AI computes revenue, costs, margins by product/region.                                    |
| Accountancy-adjacent users              | Pre-accountancy data organisation before advisor review | Accountancy readiness: upload + Business Profile + tax context → organised output for accountant.                            |

## Hybrid AI Sales Positioning

Hybrid AI is UseClevr's local-on-device AI capability with automatic cloud fallback. Two tiers:

| Tier | Model | Size | Best For |
| Tier               | Model                  | Size   | Best For                                           |
| ------             | -------                | ------ | ----------                                         |
| **Hybrid AI Lite** | `llama3.2:3b-instruct` | ~2GB   | Quick analysis, basic questions, sensitive data    |
| **Hybrid AI MEGA** | `llama3:8b-instruct`   | ~5GB   | Deep analysis, complex questions, full offline use |

**Sales differentiators**:
- Data never leaves the user's machine when running locally — strong privacy sell for legal, healthcare, and financial data.
- No API credits consumed during local analysis — reduces operating cost for heavy users.
- Works offline — usable without internet connectivity.
- Automatic cloud fallback when local model can't answer — no capability gap.

**Pricing**: Hybrid AI is an add-on upgrade available on Pro and Business plans. Free users see the option but must upgrade to activate.

**Deployment flow** (simplified for sales conversations):
1. User enables Hybrid AI from dashboard topbar
2. One-click install: downloads Ollama runtime + selected model
3. Dashboard routes AI queries through local model with cloud fallback
4. Mega installer modal shows progress, model sizes, and platform-specific desktop runtime options

## Sales Stages

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
| Channel                | Focus                                              | Measurement                                     |
| ---------              | -------                                            | -------------                                   |
| Website (product-led)  | Self-service signup, upload, conversion            | Signup rate, first upload rate, conversion rate |
| LinkedIn               | Founder/SME content, use case posts, demo CTAs     | Engagement, click-through, signup attribution   |
| Direct outreach        | Targeted founder and SME lists                     | Meeting rate, demo-to-signup conversion         |
| Partner referrals      | Accountants, accelerators, co-working spaces       | Referral source tracking, partner commissions   |
| Product-led onboarding | In-app guidance, progress tracking, AI suggestions | Setup completion rate, time to first analysis   |

## Objection Handling

Common objections and responses:

| Objection | Response |
| Objection                             | Response                                                                                                                                          |
| -----------                           | ----------                                                                                                                                        |
| "I can do this in Excel."             | "Excel shows numbers. UseClevr shows what they mean — AI tells you which product drives profit, which region underperforms, and what to do next." |
| "ChatGPT can analyse my data."        | "ChatGPT gives generic answers. UseClevr computes KPIs from your actual dataset and shows the numbers behind every answer."                       |
| "I need an accountant, not software." | "UseClevr organises your data before the accountant sees it. Upload → Business Profile → Accountancy readiness saves hours of prep."              |
| "My data is sensitive."               | "AI receives only aggregated metrics, never raw rows. Data stays in EU/GDPR-compliant Neon PostgreSQL. Hybrid AI option processes locally."       |
| "I'm not technical."                  | "Upload CSV. Ask in plain English. Get answers. No SQL, no dashboards, no setup."                                                                 |

## Metrics

| Metric | Target | Source |
| Metric                           | Target   | Source            |
| --------                         | -------- | --------          |
| Signup-to-first-upload rate      | >40%     | Activity tracking |
| First-upload-to-AI-question rate | >60%     | AI trace log      |
| Free-to-paid conversion          | >5%      | Stripe billing    |
| Demo-to-signup rate (outbound)   | >20%     | Sales tracking    |
| Monthly active users (MAU)       | TBD      | Session tracking  |
| NPS or satisfaction score        | TBD      | In-app survey     |

## Stage Gate Reviews

Each sales stage gates against stage transition criteria before proceeding:

| Gate | Trigger | Review Criteria | Tolerances |
| Gate        | Trigger                        | Review Criteria                                                                 | Tolerances                                             |
| ------      | ---------                      | -----------------                                                               | ------------                                           |
| Stage 1 → 2 | Sales materials draft complete | Requirements alignment, screenshots current, objection handling drafted         | ±1 week delay, scope reduced to core features only     |
| Stage 2 → 3 | Demo script reviewed           | Demo covers all personas, objection mapping complete, pricing current           | ±1 sprint, demo flow cuts acceptable for edge personas |
| Stage 3 → 4 | Conversion metrics tracked     | First-use flow clear, support content covers top questions, checkout measurable | ±2 weeks, activation rate target ±20% relative         |

Escalate when tolerances exceed. Log overruns in the issue register.

## Lessons Integration

Sales conversation feedback feeds into the lessons log (`Project_Management/lessons-log.md`):

- Capture objection patterns after each batch of 10 demos.
- Log competitor comparison questions that reveal positioning gaps.
- Record pricing blockers that surface during checkout conversations.
- Update demo scripts and objection handling based on recurring themes.

Review the lessons log quarterly and update sales materials accordingly.

## Product Focus

Sales materials are managed as project products with defined quality criteria:

| Sales Product | Quality Criteria | Reviewed Against |
| Sales Product      | Quality Criteria                                            | Reviewed Against                  |
| ---------------    | -----------------                                           | ------------------                |
| One-pager          | Current features, current screenshots, clear CTA            | `requirements.md`, `CHANGELOG.md` |
| Demo scripts       | Covers all planned flows, objection handling current        | Stage plan scope, issue register  |
| Demo datasets      | Realistic sample data, privacy safe, covers target segments | Product description               |
| Objection handling | Maps to FAQ, follows regulated-advice boundaries            | Risk register, FAQ content        |

## Related

- [Stage plan](Project_Management/stage-plan.md) — phased delivery with stage gates
- [Project controls approach](Project_Controls/project-controls-approach.md) — business case, risks, issues, lessons, and stage gates applied
- [Marketing plan](Marketing/marketing-plan.md) — campaign planning and funnel measurement
- [Demo scripts](demo-scripts.md) — demo walkthroughs per persona
- [Risk register](Project_Management/risk-register.md) — sales-related risks tracked
- [Project product description](Project_Management/project-product-description.md) — product composition and quality expectations
