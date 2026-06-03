# Bookkeeping Feature Work Prompt

Use this prompt for Accountancy, bookkeeping, monthly close, tax-readiness, receipt, compliance, and reporting work.

```text
Add or review bookkeeping behavior in Accountancy.

User-facing scope:
- Show bank reconciliation, expense coding, receipt tracking, monthly close, tax preparation, and compliance readiness.
- Link bookkeeping data to datasets, business profile details, and Accountancy pages.
- Label estimates, user-provided values, and professional-verification items clearly.
- Avoid presenting tax, legal, insurance, or financing outputs as professional advice.

Developer scope:
- Use business profile records for business readiness.
- Use dataset metrics for financial evidence.
- Use tax and compliance context from the primary business profile.
- Guard missing data and explain confidence levels.
- Keep user guidance separate from developer guidance.

Update:
- requirements.md when behavior is visible in Accountancy.
- docs/AI-interaction/bookkeeping-user-guide.md for user guidance.
- docs/AI-interaction/bookkeeping-developer-guide.md for implementation guidance.
- CHANGELOG.md for release-facing changes.
```
