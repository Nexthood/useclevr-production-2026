# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-09-19
- **Goal**: Final integration check of the combined working tree from the four completed parallel billing/credit tasks (master lifecycle, zero-credit UX, Usy billing knowledge, Free preserved-purchased production regression) before the normal `beta` commit/push.
- **Durable change**: no functional change; verification only. The combined tree keeps one authoritative business model across the shared credit engine, 402 creditState payloads, the zero-credit modal, the sidebar usage monitor, and Usy billing knowledge.
- **Verification**: `test:credit-lifecycle-downgrade` 10/10 (including Free + included 0 + purchased 100 → standard upload succeeds and purchased balance decreases), `test:zero-credit-ux` 12/12, `test:credit-topup-architecture` 18/18, `test:credit-topup-packages` 19/19, `test:credit-engine` 17/17, `test:usy-billing-knowledge` 10/10, `test:upload-credit-reservation` 8/8, `test:sidebar-credit-topup-link` and `test:tier-resolution` pass; `tsc --noEmit` exit 0; ESLint 0 errors on all combined changed files.
- **Residual risk**: the production reports persist until this working tree deploys; the parallel agent's in-progress `src/lib/usy/*` files must compile before the shared branch validates end to end.
- **Date**: 2026-09-19
- **Goal**: Land the Pro-refund recovery end to end and align Usy with the same authoritative billing rules: subscription canceled → existing lifecycle sync downgrades to Free, Pro included credits reset, purchased credits preserved and usable on Free, top-up purchase gated to Pro/Business, and Usy explains exactly these rules (master prompt section 13).
- **Durable change**: `src/app/api/checkout/credit-topup/route.ts` gates top-up purchase to Pro/Business; `src/lib/billing/credit-engine.ts` keeps tier-agnostic reservation with included-before-purchased consumption so preserved purchased credits stay usable on Free; `src/app/(auth)/app/settings/subscription/page.tsx` adds the Subscription Invoices section with refund states; `src/lib/usy/billing-knowledge.ts` (new) plus `src/lib/usy/router.ts` intents (top-ups, refunds, downgrade, cancellation) give Usy deterministic, localized billing answers; `scripts/billing/test-credit-lifecycle-downgrade.ts` (10 cases), `scripts/ai/test-usy-billing-knowledge.ts` (10 cases, `test:usy-billing-knowledge`), and `scripts/billing/test-zero-credit-ux.ts` pin the contracts; `CHANGELOG.md` records the user-facing changes.
- **Verification**: production state verified read-only after the recovery — Stripe subscription canceled; profile tier Free / status canceled; UserCredit included 0, purchased 100, remaining 100; top-up history 2 Refunded + 1 Completed; PLAN_RESET ledger recorded. Suites: `test:credit-lifecycle-downgrade` 10/10, `test:zero-credit-ux` 12/12, `test:usy-billing-knowledge` 10/10, `test:credit-topup-packages` 19/19, `test:credit-topup-webhooks` 68, `test:credit-topup-architecture` 18, `test:upload-credit-reservation` 8/8, `test:sidebar-credit-topup-link` pass, Usy secretariat pass; `tsc --noEmit` exit 0; ESLint clean on touched files; changelog/records/todos checks pass.
- **Residual risk**: the production fixes require the next deploy of the branch; refund recovery of the two top-ups already completed earlier in this session; the confirmation email keeps the payment reference per its existing contract.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)

## Previous Interaction

- **Date**: 2026-09-19
- **Goal**: Show a clear out-of-credits modal instead of a generic error whenever an AI/credit-consuming action is rejected: Pro/Business get Add Credits linking to the billing credit-topups section, Free gets Upgrade to Pro or Business because Free cannot purchase top-ups, the modal uses the authoritative usable balance, the UI never bypasses server-side enforcement, and concurrent requests stay safe with non-negative balances.
- **Durable change**: `src/lib/billing/credit-exhaustion.ts` derives an authoritative `creditState` payload (zero-clamped usable balance, exhaustion reason, plan-aware CTA and copy) from the credit account or a usage snapshot; the analyze, chat, report-generation, and both upload APIs embed `creditState` in every 402 credit-exhaustion response; `src/components/shared/zero-credit-modal.tsx` adds a display-only modal plus `useZeroCreditModal` 402 hook; the chat panels, CSV upload, and retail inventory analysis route exhausted responses into the modal.
- **Verification**: `test:zero-credit-ux` and the billing suites pass; `tsc --noEmit` clean for all touched files; ESLint 0 errors.
- **Residual risk**: `/api/mcp` and the upload spending-limit 402s still return plain messages without `creditState` because spending limits are a separate exhaustion reason.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
