# PRINCE2 Approach — UseClevr

This document maps UseClevr project management artefacts to PRINCE2 themes and processes. The existing documents under `docs/Sales/Project_Management/` follow PRINCE2-inspired structure without naming it explicitly.

## PRINCE2 Themes Applied

| Theme | UseClevr Artefact | Purpose |
|-------|-------------------|---------|
| Business Case | [Business case](../Project_Management/business-case.md) | Justifies project viability and tracks expected benefits against costs and risks. |
| Organization | [Stakeholder & communications plan](../Project_Management/stakeholder-communications-plan.md) | Defines roles, responsibilities, and communication channels across stakeholder groups. |
| Quality | [Project product description](../Project_Management/project-product-description.md) + [sales-one-pager](../sales-one-pager.md) | Sets quality expectations and acceptance criteria for product and sales materials. |
| Plans | [Stage plan](../Project_Management/stage-plan.md) | Manages work in controlled stages with clear objectives, scope, controls, and exit criteria. |
| Risk | [Risk register](../Project_Management/risk-register.md) | Identifies, assesses, and responds to project risks from technical, market, and operational sources. |
| Change | [Issue register](../Project_Management/issue-register.md) | Tracks issues, decisions, and their resolution through defined ownership and status. |
| Progress | [Lessons log](../Project_Management/lessons-log.md) + Stage plan controls | Captures learning and measures progress against stage-level controls and exit criteria. |

## PRINCE2 Principles Applied

1. **Continued business justification** — Business case maintained with current cost and benefit estimates. Stage plan requires a viable business case to proceed.
2. **Learn from experience** — Lessons log captures findings from deployment, sales, development, and user feedback cycles.
3. **Defined roles and responsibilities** — Stakeholder plan assigns communication ownership. Issue register tracks ownership per item.
4. **Manage by stages** — Four-stage plan with separate objectives, controls, and exit criteria. Each stage must pass before the next starts.
5. **Manage by exception** — Stage tolerances set via controls. Escalation happens when tolerances are exceeded.
6. **Focus on products** — Product description defines deliverables. Quality expectations set acceptance standards for each product.
7. **Tailor to suit environment** — Lightweight PRINCE2 adoption suitable for a startup/small-team context. No heavyweight governance overhead.

## Sales-Specific PRINCE2 Adaptation

| PRINCE2 Practice | Sales Application |
|------------------|-------------------|
| Stage gates | Each sales readiness milestone (demo ready, objection handling, materials complete) functions as a stage gate. |
| Product focus | The one-pager, demo scripts, and demo datasets are managed as project products with defined quality criteria. |
| Risk management | Sales risks tracked: overpromising capabilities, regulated-advice boundaries, competitive positioning gaps. |
| Lessons learned | Sales conversation feedback feeds back into demo scripts, objection handling, and messaging updates. |
| Quality review | Sales materials reviewed against `requirements.md` and `CHANGELOG.md` before use in customer conversations. |

## Related Documents

- [Project brief](../Project_Management/project-brief.md) — project definition and approach
- [Business case](../Project_Management/business-case.md) — cost-benefit analysis and justification
- [Stage plan](../Project_Management/stage-plan.md) — phased delivery with stage gates
- [Risk register](../Project_Management/risk-register.md) — risk identification and response
- [Issue register](../Project_Management/issue-register.md) — issue tracking and resolution
- [Marketing plan](../Marketing/marketing-plan.md) — go-to-market and campaign planning
