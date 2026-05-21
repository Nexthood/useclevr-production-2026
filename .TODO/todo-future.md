# Future Work

Items here are intentionally deferred.

## Checkout And Billing UX

- Plan and checkout total prices still use client-side defaults for some settings.
- Checkout edge cases: abandonment behaviour, proration, refunds, and expired cards.
- Decide credit expiry rules, backfill behaviour, and post-refund credit reversal.

## Production Follow-Up

- Confirm Vercel project env vars, build logs, and preview/prod branch settings after first deploy.
- Confirm Railway dashboard command overrides are empty after the next deploy check.
- Confirm the older Railway service or source-branch deployment is disabled after the `dist` service succeeds.
- Review the generated-output size report after the next publish and decide whether any remaining
  large required runtime files make the dist branch unsuitable.
