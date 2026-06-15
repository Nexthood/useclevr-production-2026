# Project Controls Approach — UseClevr

This document maps UseClevr project management artefacts to lightweight controls for business justification, roles, quality, staged delivery, risk, change, and lessons.

## Controls Applied

| Theme | UseClevr Artefact | Purpose |
| Theme         | UseClevr Artefact                                                                                                              | Purpose                                                                                              |
| Theme         | UseClevr Artefact                                                                                                              | Purpose                                                                                              |
| Business Case | [Business case](../Project_Management/business-case.md)                                                                        | Justifies project viability and tracks expected benefits against costs and risks.                    |
| Organization  | [Stakeholder & communications plan](../Project_Management/stakeholder-communications-plan.md)                                  | Defines roles, responsibilities, and communication channels across stakeholder groups.               |
| Quality       | [Project product description](../Project_Management/project-product-description.md) + [sales-one-pager](../sales-one-pager.md) | Sets quality expectations and acceptance criteria for product and sales materials.                   |
| Plans         | [Stage plan](../Project_Management/stage-plan.md)                                                                              | Manages work in controlled stages with clear objectives, scope, controls, and exit criteria.         |
| Risk          | [Risk register](../Project_Management/risk-register.md)                                                                        | Identifies, assesses, and responds to project risks from technical, market, and operational sources. |
| Change        | [Issue register](../Project_Management/issue-register.md)                                                                      | Tracks issues, decisions, and their resolution through defined ownership and status.                 |
| Progress      | [Lessons log](../Project_Management/lessons-log.md) + Stage plan controls                                                      | Captures learning and measures progress against stage-level controls and exit criteria.              |

## Principles Applied

1. **Continued business justification** — Business case maintained with current cost and benefit estimates. Stage plan requires a viable business case to proceed.
2. **Learn from experience** — Lessons log captures findings from deployment, sales, development, and user feedback cycles.
3. **Defined roles and responsibilities** — Stakeholder plan assigns communication ownership. Issue register tracks ownership per item.
4. **Manage by stages** — Four-stage plan with separate objectives, controls, and exit criteria. Each stage must pass before the next starts.
5. **Manage by exception** — Stage tolerances set via controls. Escalation happens when tolerances are exceeded.
6. **Focus on products** — Product description defines deliverables. Quality expectations set acceptance standards for each product.
7. **Tailor to suit environment** — Keep controls lightweight enough for a startup and small-team context.

## Sales-Specific Adaptation

| Practice | Sales Application |
| Practice           | Sales Application                                                                                              |
| Practice        | Sales Application                                                                                              |
| Stage gates     | Each sales readiness milestone (demo ready, objection handling, materials complete) functions as a stage gate. |
| Product focus   | The one-pager, demo scripts, and demo datasets are managed as project products with defined quality criteria.  |
| Risk management | Sales risks tracked: overpromising capabilities, regulated-advice boundaries, competitive positioning gaps.    |
| Lessons learned | Sales conversation feedback feeds back into demo scripts, objection handling, and messaging updates.           |
| Quality review  | Sales materials reviewed against `requirements.md` and `CHANGELOG.md` before use in customer conversations.    |

## Hybrid AI Sales Initiative

The Hybrid AI feature (local on-device AI with cloud fallback) follows stage gates for its sales rollout:

| Stage | Gate | Sales Milestone | Exit Criteria |
| Stage   | Gate          | Sales Milestone       | Exit Criteria                                                                                                                  |
| Stage | Gate       | Sales Milestone       | Exit Criteria                                                                                                                  |
| 1     | Initiation | Developer preview     | Local agent installs, mock AI works, local AI route responds                                                                   |
| 2     | Stage 1    | Internal demo ready   | One-pager covers Hybrid AI tiers, demo script includes local AI flow, screenshots updated                                      |
| 3     | Stage 2    | Early adopter release | Installer flow works end-to-end, support content covers Hybrid AI setup, objection handling includes data-sovereignty response |
| 4     | Stage 3    | General availability  | Pricing live, Hybrid AI in checkout, activation metrics tracked, founder and SME docs updated                                  |

**Key risk**: Overpromising local AI capability — local model quality differs from cloud Gemini. Mitigated by clearly marking local vs. cloud analysis in the UI and sales materials.

## Manage by Exception — Sales Tolerances

"Manage by exception" principle applied to sales activities:

| Tolerance | Threshold | Escalation Path |
| Tolerance               | Threshold                                               | Escalation Path                              |
| Tolerance               | Threshold                                               | Escalation Path                              |
| Demo readiness delay    | >1 sprint past stage gate date                          | Log to issue register, re-plan demo scope    |
| Objection handling gaps | >3 demos with same unanswered objection                 | Update objection handling doc, add FAQ entry |
| Pricing confusion       | >2 checkout drop-offs citing price confusion            | Review pricing page, update one-pager        |
| Sales material accuracy | requirements or CHANGELOG update without sales doc sync | Add checklist step to release process        |

## Quality Review Cycle

Sales materials reviewed against quality expectations after every release:

1. Run `CHANGELOG.md` current-release changes against one-pager feature list.
2. Check screenshots match current topbar, sidebar, upload, AI Assistant, and report pages.
3. Verify pricing table matches Stripe product configuration.
4. Confirm objection handling covers new feature edge cases.
5. Update demo scripts for changed UI flows.

Review results logged in the lessons log. Misses become issue register entries.

## Related Documents

- [Project brief](../Project_Management/project-brief.md) — project definition and approach
- [Business case](../Project_Management/business-case.md) — cost-benefit analysis and justification
- [Stage plan](../Project_Management/stage-plan.md) — phased delivery with stage gates
- [Risk register](../Project_Management/risk-register.md) — risk identification and response
- [Issue register](../Project_Management/issue-register.md) — issue tracking and resolution
- [Marketing plan](../Marketing/marketing-plan.md) — go-to-market and campaign planning
